'use strict';

try {
  if (typeof importScripts === 'function') {
    importScripts('detection-engine.js');
  }
} catch {
  // Firefox loads detection-engine.js via background.scripts instead.
}

const extensionApi = globalThis.browser ?? globalThis.chrome;
const MAX_EVENTS = 100;
const DECISION_LIFETIME_MS = 5 * 60 * 1000;
const BYPASS_LIFETIME_MS = 2 * 60 * 1000;

async function hashPin(pin) {
  const data = new TextEncoder().encode(`grandma-guard:${String(pin || '')}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function normalizeHost(value) {
  const engine = globalThis.GrandmaGuardDetection;
  if (engine && typeof engine.normalizeTrustedHost === 'function') {
    return engine.normalizeTrustedHost(value);
  }
  return String(value || '').trim().toLowerCase();
}

function isBlockedHost(hostname, blockedHosts) {
  const engine = globalThis.GrandmaGuardDetection;
  if (engine && typeof engine.isBlockedHost === 'function') {
    return engine.isBlockedHost(hostname, blockedHosts);
  }
  return false;
}

async function handleResolveShortLink(message) {
  const href = String(message?.href || '');
  if (!isWebUrl(href)) {
    return { ok: false };
  }
  try {
    const response = await fetch(href, {
      method: 'HEAD',
      redirect: 'follow',
      cache: 'no-store'
    });
    return { ok: true, finalHref: response.url || href };
  } catch {
    try {
      const response = await fetch(href, {
        method: 'GET',
        redirect: 'follow',
        cache: 'no-store'
      });
      return { ok: true, finalHref: response.url || href };
    } catch {
      return { ok: false };
    }
  }
}

async function handleVerifyCaregiverPin(message) {
  const state = await extensionApi.storage.local.get({
    strictModeEnabled: false,
    caregiverPinHash: ''
  });
  if (!state.strictModeEnabled || !state.caregiverPinHash) {
    return { ok: true, skipped: true };
  }
  const submitted = await hashPin(String(message?.pin || ''));
  return { ok: submitted === state.caregiverPinHash };
}

async function handleExportSettings() {
  const state = await extensionApi.storage.local.get({
    protectionLevel: 'standard',
    strictModeEnabled: false,
    shoppingModeEnabled: false,
    autoAfterScamOnContinue: true,
    afterScamUntil: 0,
    trustedHosts: [],
    blockedHosts: [],
    learnedBadLinkHosts: [],
    learnedMailPatterns: [],
    learnedSafeMailPatterns: [],
    localMailLearningConsent: 'unset'
  });
  const engine = globalThis.GrandmaGuardDetection;
  if (engine && typeof engine.buildSettingsExport === 'function') {
    return { ok: true, payload: engine.buildSettingsExport(state) };
  }
  return { ok: false };
}

async function handleImportSettings(message) {
  const engine = globalThis.GrandmaGuardDetection;
  if (!engine || typeof engine.mergeSettingsImport !== 'function') {
    return { ok: false };
  }
  const current = await extensionApi.storage.local.get({
    protectionLevel: 'standard',
    strictModeEnabled: false,
    trustedHosts: [],
    blockedHosts: [],
    learnedMailPatterns: [],
    learnedSafeMailPatterns: [],
    localMailLearningConsent: 'unset',
    localMailLearningEnabled: false
  });
  const merged = engine.mergeSettingsImport(current, message?.payload);
  if (!merged.ok) {
    return merged;
  }
  await extensionApi.storage.local.set(merged.settings);
  return { ok: true };
}

async function handleSetCaregiverPin(message) {
  const pin = String(message?.pin || '');
  const enabled = Boolean(message?.strictModeEnabled);
  const state = await extensionApi.storage.local.get({ caregiverPinHash: '' });

  if (enabled && pin.length > 0 && pin.length < 4) {
    return { ok: false, reason: 'pin-too-short' };
  }
  if (enabled && !pin && !state.caregiverPinHash) {
    return { ok: false, reason: 'pin-required' };
  }

  const caregiverPinHash = pin ? await hashPin(pin) : state.caregiverPinHash;
  await extensionApi.storage.local.set({
    strictModeEnabled: enabled,
    caregiverPinHash: enabled ? caregiverPinHash : state.caregiverPinHash
  });
  return { ok: true };
}

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
    detectionEvents: [],
    strictModeEnabled: false,
    caregiverPinHash: '',
    blockedHosts: [],
    autoAfterScamOnContinue: true
  });
  const now = Date.now();
  const active = pruneTemporaryState(state, now);
  const pending = active.pendingDecisions;
  const decision = pending.find((item) => item.token === message.token);
  if (!decision || !isWebUrl(decision.url)) {
    await extensionApi.storage.local.set(active);
    return { ok: false };
  }

  if (state.strictModeEnabled) {
    if (!state.caregiverPinHash) {
      return { ok: false, reason: 'pin-required' };
    }
    const submitted = await hashPin(String(message.pin || ''));
    if (submitted !== state.caregiverPinHash) {
      return { ok: false, reason: 'pin-invalid' };
    }
  }

  if (isBlockedHost(decision.hostname, state.blockedHosts)) {
    return { ok: false, reason: 'blocked-host' };
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
    detectionEvents: reviewedEvents,
    ...(state.autoAfterScamOnContinue !== false
      ? { afterScamUntil: now + (globalThis.GrandmaGuardDetection?.AFTER_SCAM_DURATION_MS || 48 * 60 * 60 * 1000) }
      : {})
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
      : [],
    outcome: 'blocked'
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

function learningAllowedFromState(state) {
  const consent = String(state?.localMailLearningConsent || 'unset');
  if (consent === 'allowed') {
    return true;
  }
  if (consent === 'declined') {
    return false;
  }
  // Legacy installs may only have the boolean flag.
  return state?.localMailLearningEnabled === true;
}

async function handleEmailLearnConsent(message) {
  const choice = String(message?.consent || '');
  if (choice !== 'allowed' && choice !== 'declined') {
    return { ok: false };
  }
  await extensionApi.storage.local.set({
    localMailLearningConsent: choice,
    localMailLearningEnabled: choice === 'allowed'
  });
  return { ok: true, consent: choice };
}

async function handleEmailLearn(message) {
  const state = await extensionApi.storage.local.get({
    localMailLearningConsent: 'unset',
    localMailLearningEnabled: false,
    learnedMailPatterns: []
  });
  if (!learningAllowedFromState(state)) {
    return { ok: true, skipped: true };
  }

  const engine = globalThis.GrandmaGuardDetection;
  const merge = engine && typeof engine.mergeLearnedMailPatterns === 'function'
    ? engine.mergeLearnedMailPatterns
    : null;
  if (!merge) {
    return { ok: false };
  }

  const learnedMailPatterns = merge(state.learnedMailPatterns, message?.hints || []);
  await extensionApi.storage.local.set({ learnedMailPatterns });
  return { ok: true, count: learnedMailPatterns.length };
}

async function handleEmailLearnSafe(message) {
  const state = await extensionApi.storage.local.get({
    localMailLearningConsent: 'unset',
    localMailLearningEnabled: false,
    learnedSafeMailPatterns: []
  });
  if (!learningAllowedFromState(state)) {
    return { ok: true, skipped: true };
  }

  const engine = globalThis.GrandmaGuardDetection;
  const merge = engine && typeof engine.mergeLearnedMailPatterns === 'function'
    ? engine.mergeLearnedMailPatterns
    : null;
  if (!merge) {
    return { ok: false };
  }

  const learnedSafeMailPatterns = merge(state.learnedSafeMailPatterns, message?.hints || []);
  await extensionApi.storage.local.set({ learnedSafeMailPatterns });
  return { ok: true, count: learnedSafeMailPatterns.length };
}

async function handleEmailLearnSafeUndo(message) {
  const state = await extensionApi.storage.local.get({
    localMailLearningConsent: 'unset',
    localMailLearningEnabled: false,
    learnedSafeMailPatterns: []
  });
  if (!learningAllowedFromState(state)) {
    return { ok: true, skipped: true };
  }

  const engine = globalThis.GrandmaGuardDetection;
  const remove = engine && typeof engine.removeLearnedMailPatterns === 'function'
    ? engine.removeLearnedMailPatterns
    : null;
  if (!remove) {
    return { ok: false };
  }

  const learnedSafeMailPatterns = remove(state.learnedSafeMailPatterns, message?.hints || []);
  await extensionApi.storage.local.set({ learnedSafeMailPatterns });
  return { ok: true, count: learnedSafeMailPatterns.length };
}

async function handleMarkHostTrusted(message) {
  const engine = globalThis.GrandmaGuardDetection;
  const normalize = engine && typeof engine.normalizeTrustedHost === 'function'
    ? engine.normalizeTrustedHost
    : (value) => String(value || '').trim().toLowerCase();
  const host = normalize(message.hostname);
  if (!host || !/^[a-z0-9.-]+$/.test(host)) {
    return { ok: false };
  }

  const state = await extensionApi.storage.local.get({
    trustedHosts: [],
    detectionEvents: []
  });
  const trustedHosts = Array.isArray(state.trustedHosts) ? state.trustedHosts.slice() : [];
  if (!trustedHosts.includes(host)) {
    trustedHosts.push(host);
    trustedHosts.sort();
  }

  const safeEvent = {
    eventId: createDecisionToken(),
    timestamp: new Date().toISOString(),
    hostname: host,
    score: 0,
    reasons: ['marked as a trusted website on this device'],
    outcome: 'marked-safe'
  };
  const events = [safeEvent, ...(state.detectionEvents || [])].slice(0, MAX_EVENTS);

  await extensionApi.storage.local.set({ trustedHosts, detectionEvents: events });
  return { ok: true, hostname: host };
}

async function handleLinkWarned(message) {
  const hostname = String(message.hostname || '').toLowerCase();
  if (!hostname) {
    return { ok: false };
  }

  const safeEvent = {
    eventId: createDecisionToken(),
    timestamp: new Date().toISOString(),
    hostname,
    linkHost: hostname,
    score: Number(message.score) || 0,
    reasons: Array.isArray(message.reasons)
      ? message.reasons.map(String).slice(0, 12)
      : [],
    outcome: 'link-warned'
  };

  const state = await extensionApi.storage.local.get({ detectionEvents: [] });
  const events = [safeEvent, ...(state.detectionEvents || [])].slice(0, MAX_EVENTS);
  await extensionApi.storage.local.set({ detectionEvents: events });
  return { ok: true };
}

async function handleLearnBadLinkHost(message) {
  const engine = globalThis.GrandmaGuardDetection;
  const merge = engine && typeof engine.mergeLearnedBadLinkHosts === 'function'
    ? engine.mergeLearnedBadLinkHosts
    : null;
  if (!merge) {
    return { ok: false };
  }

  const state = await extensionApi.storage.local.get({
    learnedBadLinkHosts: [],
    detectionEvents: []
  });
  const hostname = normalizeHost(message.hostname);
  const learnedBadLinkHosts = merge(state.learnedBadLinkHosts, hostname);
  const safeEvent = {
    eventId: createDecisionToken(),
    timestamp: new Date().toISOString(),
    hostname,
    score: 0,
    reasons: ['remembered as a suspicious link domain on this device'],
    outcome: 'link-domain-learned'
  };
  const events = [safeEvent, ...(state.detectionEvents || [])].slice(0, MAX_EVENTS);
  await extensionApi.storage.local.set({ learnedBadLinkHosts, detectionEvents: events });
  return { ok: true, hostname };
}

async function handleActivateAfterScam() {
  const engine = globalThis.GrandmaGuardDetection;
  const duration = engine?.AFTER_SCAM_DURATION_MS || (48 * 60 * 60 * 1000);
  const afterScamUntil = Date.now() + duration;
  const state = await extensionApi.storage.local.get({ detectionEvents: [] });
  const safeEvent = {
    eventId: createDecisionToken(),
    timestamp: new Date().toISOString(),
    hostname: 'device',
    score: 0,
    reasons: ['after-scam protection enabled for 48 hours'],
    outcome: 'after-scam-enabled'
  };
  const events = [safeEvent, ...(state.detectionEvents || [])].slice(0, MAX_EVENTS);
  await extensionApi.storage.local.set({ afterScamUntil, detectionEvents: events });
  return { ok: true, afterScamUntil };
}

async function handleAddBlockedHost(message) {
  const host = normalizeHost(message.hostname);
  if (!host || !/^[a-z0-9.-]+$/.test(host)) {
    return { ok: false };
  }
  const state = await extensionApi.storage.local.get({ blockedHosts: [] });
  const blockedHosts = Array.isArray(state.blockedHosts) ? state.blockedHosts.slice() : [];
  if (!blockedHosts.includes(host)) {
    blockedHosts.push(host);
    blockedHosts.sort();
  }
  await extensionApi.storage.local.set({ blockedHosts });
  return { ok: true, hostname: host };
}

async function handleEmailSuspicion(message, sender) {
  const mailHost = String(message.mailHost || '').toLowerCase();
  const linkHost = String(message.linkHost || '').toLowerCase();
  const kind = String(message.kind || 'link');
  const scope = String(message.scope || 'open');
  if (!mailHost) {
    return { ok: false };
  }
  if (kind === 'link' && scope !== 'list' && !linkHost) {
    return { ok: false };
  }

  const token = createDecisionToken();
  const reasons = Array.isArray(message.reasons)
    ? message.reasons.map(String).slice(0, 12)
    : [];
  const safeEvent = {
    eventId: token,
    timestamp: new Date().toISOString(),
    hostname: mailHost,
    linkHost: linkHost || kind,
    score: Number(message.score) || 0,
    reasons,
    outcome: 'email-warned',
    scope,
    count: Number(message.count) || 1
  };

  const state = await extensionApi.storage.local.get({ detectionEvents: [] });
  const events = [safeEvent, ...state.detectionEvents].slice(0, MAX_EVENTS);
  await extensionApi.storage.local.set({ detectionEvents: events });

  return { ok: true, tabId: sender.tab?.id || null };
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
    return false;
  }

  if (message?.type === 'email-scam-suspected') {
    handleEmailSuspicion(message, sender)
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message?.type === 'email-learn-patterns') {
    handleEmailLearn(message)
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message?.type === 'email-learn-safe-patterns') {
    handleEmailLearnSafe(message)
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message?.type === 'email-learn-safe-undo') {
    handleEmailLearnSafeUndo(message)
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message?.type === 'email-learn-consent') {
    handleEmailLearnConsent(message)
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message?.type === 'mark-host-trusted') {
    handleMarkHostTrusted(message)
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message?.type === 'link-warned') {
    handleLinkWarned(message)
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message?.type === 'resolve-short-link') {
    handleResolveShortLink(message)
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message?.type === 'verify-caregiver-pin') {
    handleVerifyCaregiverPin(message)
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message?.type === 'set-caregiver-pin') {
    handleSetCaregiverPin(message)
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message?.type === 'export-settings') {
    handleExportSettings()
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message?.type === 'import-settings') {
    handleImportSettings(message)
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message?.type === 'learn-bad-link-host') {
    handleLearnBadLinkHost(message)
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message?.type === 'activate-after-scam') {
    handleActivateAfterScam()
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message?.type === 'add-blocked-host') {
    handleAddBlockedHost(message)
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  return false;
});

function navigationBypassed(url, bypasses, now = Date.now()) {
  if (!Array.isArray(bypasses)) {
    return false;
  }
  return bypasses.some((entry) => entry.url === url && entry.expiresAt > now);
}

if (extensionApi.webNavigation?.onBeforeNavigate) {
  extensionApi.webNavigation.onBeforeNavigate.addListener(async (details) => {
    if (details.frameId !== 0 || !isWebUrl(details.url)) {
      return;
    }

    let hostname = '';
    try {
      hostname = new URL(details.url).hostname.toLowerCase();
    } catch {
      return;
    }

    const state = await extensionApi.storage.local.get({
      blockedHosts: [],
      trustedHosts: [],
      temporaryBypasses: [],
      learnedBadLinkHosts: []
    });
    const now = Date.now();
    const active = pruneTemporaryState(state, now);

    if (typeof globalThis.GrandmaGuardDetection?.isTrustedHost === 'function' &&
      globalThis.GrandmaGuardDetection.isTrustedHost(hostname, state.trustedHosts || [])) {
      return;
    }

    if (navigationBypassed(details.url, active.temporaryBypasses, now)) {
      return;
    }

    if (isBlockedHost(hostname, state.blockedHosts)) {
      const params = new URLSearchParams({
        host: hostname,
        reasons: 'This website is on the family blocklist|Continue is disabled on this device'
      });
      extensionApi.tabs.update(details.tabId, {
        url: `${extensionApi.runtime.getURL('blocked.html')}?${params}`
      });
      return;
    }

    const learned = Array.isArray(state.learnedBadLinkHosts) ? state.learnedBadLinkHosts : [];
    if (isBlockedHost(hostname, learned)) {
      const params = new URLSearchParams({
        host: hostname,
        reasons: 'This link domain was remembered as suspicious on this device|Be careful before continuing'
      });
      extensionApi.tabs.update(details.tabId, {
        url: `${extensionApi.runtime.getURL('blocked.html')}?${params}`
      });
    }
  }, {
    url: [{ schemes: ['http', 'https'] }]
  });
}
