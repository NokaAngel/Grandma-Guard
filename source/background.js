'use strict';

const extensionApi = globalThis.browser ?? globalThis.chrome;
const MAX_EVENTS = 100;
const DECISION_LIFETIME_MS = 5 * 60 * 1000;
const BYPASS_LIFETIME_MS = 2 * 60 * 1000;

function isWebUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function createDecisionToken() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

function pruneTemporaryState(state, now = Date.now()) {
  return {
    pendingDecisions: Array.isArray(state.pendingDecisions)
      ? state.pendingDecisions.filter((item) => item.expiresAt > now)
      : [],
    temporaryBypasses: Array.isArray(state.temporaryBypasses)
      ? state.temporaryBypasses.filter((item) => item.expiresAt > now)
      : []
  };
}

async function handleContinue(message, sender) {
  if (!sender.tab?.id || typeof message.token !== 'string') {
    return { ok: false };
  }

  const state = await extensionApi.storage.local.get({
    pendingDecisions: [],
    temporaryBypasses: [],
    detectionEvents: []
  });
  const now = Date.now();
  const active = pruneTemporaryState(state, now);
  const pending = active.pendingDecisions;
  const decision = pending.find((item) => item.token === message.token);
  if (!decision || !isWebUrl(decision.url)) {
    await extensionApi.storage.local.set(active);
    return { ok: false };
  }

  const remainingDecisions = pending.filter((item) => item.token !== message.token);
  const activeBypasses = active.temporaryBypasses;
  activeBypasses.push({
    url: decision.url,
    hostname: decision.hostname,
    expiresAt: now + BYPASS_LIFETIME_MS
  });
  const reviewedEvents = state.detectionEvents.map((event) =>
    event.eventId === message.token
      ? { ...event, outcome: 'continued-once', reviewedAt: new Date().toISOString() }
      : event
  );

  await extensionApi.storage.local.set({
    pendingDecisions: remainingDecisions,
    temporaryBypasses: activeBypasses,
    detectionEvents: reviewedEvents
  });
  await extensionApi.tabs.update(sender.tab.id, { url: decision.url });
  return { ok: true };
}

async function handleDetection(message, sender) {
  if (!sender.tab?.id || !isWebUrl(message.url)) {
    return;
  }

  const parsed = new URL(message.url);
  if (parsed.hostname.toLowerCase() !== String(message.hostname).toLowerCase()) {
    return;
  }

  const token = createDecisionToken();
  const safeEvent = {
    eventId: token,
    timestamp: new Date().toISOString(),
    hostname: parsed.hostname.toLowerCase(),
    score: Number(message.score) || 0,
    reasons: Array.isArray(message.reasons)
      ? message.reasons.map(String).slice(0, 12)
      : []
  };

  const state = await extensionApi.storage.local.get({
    detectionEvents: [],
    pendingDecisions: [],
    temporaryBypasses: []
  });
  const now = Date.now();
  const events = [safeEvent, ...state.detectionEvents].slice(0, MAX_EVENTS);
  const active = pruneTemporaryState(state, now);
  const activeDecisions = active.pendingDecisions;
  activeDecisions.push({
    token,
    url: message.url,
    hostname: safeEvent.hostname,
    expiresAt: now + DECISION_LIFETIME_MS
  });

  await extensionApi.storage.local.set({
    detectionEvents: events,
    pendingDecisions: activeDecisions,
    temporaryBypasses: active.temporaryBypasses
  });

  const details = new URLSearchParams({
    token,
    host: safeEvent.hostname,
    score: String(safeEvent.score),
    reasons: safeEvent.reasons.join('|')
  });
  await extensionApi.tabs.update(sender.tab.id, {
    url: `${extensionApi.runtime.getURL('blocked.html')}?${details}`
  });
}

extensionApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'continue-scareware') {
    handleContinue(message, sender)
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message?.type === 'scareware-detected') {
    handleDetection(message, sender).catch(() => {});
  }
  return false;
});

extensionApi.action.onClicked.addListener(() => {
  extensionApi.runtime.openOptionsPage();
});
