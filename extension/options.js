'use strict';

const extensionApi = globalThis.browser ?? globalThis.chrome;
const detection = globalThis.GrandmaGuardDetection;
const historyStatus = document.getElementById('historyStatus');
const learnedSummary = document.getElementById('learnedSummary');
const learningToggle = document.getElementById('localMailLearningEnabled');
const versionNotice = document.getElementById('versionNotice');
const versionNoticeText = document.getElementById('versionNoticeText');
const protectionStandard = document.getElementById('protectionStandard');
const protectionCareful = document.getElementById('protectionCareful');
const trustedHostInput = document.getElementById('trustedHostInput');
const trustedHostList = document.getElementById('trustedHostList');
const trustedHostEmpty = document.getElementById('trustedHostEmpty');
const blockedHostInput = document.getElementById('blockedHostInput');
const blockedHostList = document.getElementById('blockedHostList');
const blockedHostEmpty = document.getElementById('blockedHostEmpty');
const strictModeToggle = document.getElementById('strictModeEnabled');
const caregiverPinInput = document.getElementById('caregiverPinInput');
const strictModeStatus = document.getElementById('strictModeStatus');
const weeklySummary = document.getElementById('weeklySummary');
const backupStatus = document.getElementById('backupStatus');
const shoppingModeToggle = document.getElementById('shoppingModeEnabled');
const activateAfterScamButton = document.getElementById('activateAfterScam');
const afterScamStatus = document.getElementById('afterScamStatus');
const learnedBadLinkList = document.getElementById('learnedBadLinkList');
const learnedBadLinkEmpty = document.getElementById('learnedBadLinkEmpty');
const autoAfterScamOnContinueToggle = document.getElementById('autoAfterScamOnContinue');
const remoteRulePackEnabledToggle = document.getElementById('remoteRulePackEnabled');
const refreshRulePackButton = document.getElementById('refreshRulePack');
const rulePackStatus = document.getElementById('rulePackStatus');
const EXTENSION_VERSION = String(extensionApi.runtime?.getManifest?.().version || '');

let trustedHosts = [];
let blockedHosts = [];
let learnedBadLinkHosts = [];

function formatRulePackTimestamp(value) {
  const timestamp = Number(value) || 0;
  if (!timestamp) {
    return 'not yet refreshed on this device';
  }
  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return 'recently';
  }
}

async function renderRulePackStatus() {
  if (!rulePackStatus) {
    return;
  }
  try {
    const response = await extensionApi.runtime.sendMessage({ type: 'get-rule-pack-status' });
    if (!response?.ok) {
      rulePackStatus.textContent = 'Bundled domain lists are active. GitHub status is unavailable right now.';
      return;
    }
    const parts = [
      `Bundled list version ${response.bundledVersion || 0}.`
    ];
    if (response.enabled === false) {
      parts.push('GitHub updates are turned off.');
    } else if (response.remoteVersion > 0) {
      parts.push(
        `GitHub overlay version ${response.remoteVersion} (${response.officialCount} official domains, ${response.badFragmentCount} extra scam-host patterns).`
      );
      parts.push(`Last refreshed ${formatRulePackTimestamp(response.fetchedAt)}.`);
    } else {
      parts.push('GitHub overlay has not been applied yet on this device.');
    }
    rulePackStatus.textContent = parts.join(' ');
  } catch {
    rulePackStatus.textContent = 'Bundled domain lists are active.';
  }
}

async function setRemoteRulePackEnabled(enabled) {
  await extensionApi.storage.local.set({ remoteRulePackEnabled: enabled });
  if (!enabled && globalThis.GrandmaGuardRulePacks?.clearRemoteCache) {
    globalThis.GrandmaGuardRulePacks.clearRemoteCache();
  } else if (enabled) {
    await extensionApi.runtime.sendMessage({ type: 'refresh-rule-pack' }).catch(() => {});
  }
  await renderRulePackStatus();
  historyStatus.textContent = enabled
    ? 'GitHub domain list updates enabled.'
    : 'GitHub domain list updates turned off. Bundled lists still apply.';
}

async function refreshRulePackNow() {
  if (!refreshRulePackButton) {
    return;
  }
  refreshRulePackButton.disabled = true;
  rulePackStatus.textContent = 'Refreshing domain lists from GitHub…';
  try {
    const response = await extensionApi.runtime.sendMessage({ type: 'refresh-rule-pack' });
    if (response?.ok && !response.skipped) {
      historyStatus.textContent = `Domain lists refreshed to version ${response.version || 'unknown'}.`;
    } else if (response?.skipped) {
      historyStatus.textContent = 'Domain lists are already up to date.';
    } else {
      historyStatus.textContent = 'Could not refresh domain lists right now. Bundled lists are still active.';
    }
  } catch {
    historyStatus.textContent = 'Could not refresh domain lists right now.';
  } finally {
    refreshRulePackButton.disabled = false;
    await renderRulePackStatus();
  }
}

function normalizeHost(value) {
  if (detection && typeof detection.normalizeTrustedHost === 'function') {
    return detection.normalizeTrustedHost(value);
  }
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '')
    .replace(/:\d+$/, '');
}

function render(events) {
  const container = document.getElementById('events');
  const empty = document.getElementById('emptyState');
  container.replaceChildren();
  empty.hidden = events.length > 0;

  for (const event of events) {
    const article = document.createElement('article');
    const heading = document.createElement('h2');
    const time = document.createElement('time');
    const details = document.createElement('p');
    const outcome = document.createElement('p');

    heading.textContent = event.hostname;
    time.dateTime = event.timestamp;
    time.textContent = new Date(event.timestamp).toLocaleString();
    details.textContent = Array.isArray(event.reasons)
      ? event.reasons.join('; ')
      : 'Suspicious scareware behavior';
    outcome.className = 'event-outcome';
    if (event.outcome === 'continued-once') {
      outcome.textContent = 'Review flag: someone chose the one-time Continue option.';
    } else if (event.outcome === 'marked-safe') {
      outcome.textContent = 'Action: marked as a trusted website on this device.';
    } else if (event.outcome === 'link-warned') {
      outcome.textContent = `Action: stopped a suspicious link (${event.linkHost || event.hostname}).`;
    } else if (event.outcome === 'link-domain-learned') {
      outcome.textContent = `Action: remembered suspicious link domain (${event.hostname}).`;
    } else if (event.outcome === 'after-scam-enabled') {
      outcome.textContent = 'Action: turned on 48-hour after-scam protection.';
    } else if (event.outcome === 'email-warned') {
      if (event.scope === 'list') {
        const count = Number(event.count) || 1;
        outcome.textContent = count === 1
          ? 'Action: marked 1 possible scam email in the list.'
          : `Action: marked ${count} possible scam emails in the list.`;
      } else if (event.linkHost === 'link') {
        outcome.textContent = 'Action: warned about a suspicious link inside an open email.';
      } else if (event.linkHost && event.linkHost !== 'reward-bait') {
        outcome.textContent = `Action: warned about a suspicious email link (${event.linkHost}).`;
      } else if (event.linkHost === 'reward-bait') {
        outcome.textContent = 'Action: warned that an open email is a scam.';
      } else {
        outcome.textContent = 'Action: warned about a suspicious email.';
      }
    } else {
      outcome.textContent = 'Action: blocked';
    }

    article.append(heading, time, details, outcome);
    container.append(article);
  }
}

function renderWeeklySummary(events) {
  weeklySummary.replaceChildren();
  const summary = detection && typeof detection.summarizeWeeklyProtection === 'function'
    ? detection.summarizeWeeklyProtection(events)
    : { total: 0, counts: { blocked: 0, email: 0, links: 0, continued: 0, markedSafe: 0 } };

  const cards = [
    ['Pages blocked', summary.counts.blocked],
    ['Suspicious emails', summary.counts.email],
    ['Suspicious links', summary.counts.links],
    ['Continue used', summary.counts.continued]
  ];

  for (const [label, value] of cards) {
    const card = document.createElement('div');
    card.className = 'summary-card';
    const strong = document.createElement('strong');
    strong.textContent = String(value);
    const span = document.createElement('span');
    span.textContent = label;
    card.append(strong, span);
    weeklySummary.append(card);
  }
}

function renderLearning(consent, scamPatterns, safePatterns) {
  const allowed = consent === 'allowed';
  learningToggle.checked = allowed;
  const scamCount = Array.isArray(scamPatterns) ? scamPatterns.length : 0;
  const safeCount = Array.isArray(safePatterns) ? safePatterns.length : 0;
  const total = scamCount + safeCount;

  if (consent === 'unset') {
    learnedSummary.textContent = total === 0
      ? 'Waiting for your choice in the one-time inbox prompt, or turn learning on here.'
      : `Waiting for your choice. ${total} saved pattern${total === 1 ? '' : 's'} stay on this device until cleared.`;
    return;
  }

  if (!allowed) {
    learnedSummary.textContent = total === 0
      ? 'On-device email learning is off. Grandma Guard will not learn from your mail.'
      : `Learning is off. ${total} saved pattern${total === 1 ? '' : 's'} stay on this device until cleared.`;
    return;
  }

  if (total === 0) {
    learnedSummary.textContent = 'Learning is on. No personal scam or "not a scam" patterns saved yet.';
    return;
  }

  learnedSummary.textContent =
    `${scamCount} scam pattern${scamCount === 1 ? '' : 's'} and ${safeCount} "not a scam" pattern${safeCount === 1 ? '' : 's'} remembered on this device.`;
}

function renderProtectionLevel(level) {
  const careful = level === 'careful';
  protectionStandard.checked = !careful;
  protectionCareful.checked = careful;
}

function renderHostList(listElement, emptyElement, hosts, onRemove) {
  listElement.replaceChildren();
  emptyElement.hidden = hosts.length > 0;

  for (const host of hosts) {
    const item = document.createElement('li');
    const label = document.createElement('span');
    label.textContent = host;

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'secondary';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => onRemove(host));

    item.append(label, remove);
    listElement.append(item);
  }
}

function renderTrustedHosts(hosts) {
  trustedHosts = Array.isArray(hosts)
    ? hosts.map(normalizeHost).filter(Boolean)
    : [];
  renderHostList(trustedHostList, trustedHostEmpty, trustedHosts, async (host) => {
    const next = trustedHosts.filter((entry) => entry !== host);
    await extensionApi.storage.local.set({ trustedHosts: next });
    renderTrustedHosts(next);
    historyStatus.textContent = `${host} removed from trusted websites.`;
  });
}

function renderBlockedHosts(hosts) {
  blockedHosts = Array.isArray(hosts)
    ? hosts.map(normalizeHost).filter(Boolean)
    : [];
  renderHostList(blockedHostList, blockedHostEmpty, blockedHosts, async (host) => {
    const next = blockedHosts.filter((entry) => entry !== host);
    await extensionApi.storage.local.set({ blockedHosts: next });
    renderBlockedHosts(next);
    historyStatus.textContent = `${host} removed from the family blocklist.`;
  });
}

function renderStrictMode(enabled, hasPin) {
  strictModeToggle.checked = enabled;
  strictModeStatus.textContent = enabled
    ? (hasPin
      ? 'Strict mode is on. Continue requires the caregiver PIN.'
      : 'Strict mode is on, but no PIN is saved yet.')
    : 'Strict mode is off.';
}

function renderShoppingMode(enabled) {
  shoppingModeToggle.checked = enabled;
}

function renderAfterScam(until) {
  const active = Number(until) > Date.now();
  if (!active) {
    afterScamStatus.textContent = 'After-scam protection is off.';
    return;
  }
  afterScamStatus.textContent = `After-scam protection is active until ${new Date(until).toLocaleString()}.`;
}

function renderLearnedBadLinkHosts(hosts) {
  learnedBadLinkHosts = Array.isArray(hosts)
    ? hosts.map(normalizeHost).filter(Boolean)
    : [];
  renderHostList(learnedBadLinkList, learnedBadLinkEmpty, learnedBadLinkHosts, async (host) => {
    const engine = globalThis.GrandmaGuardDetection;
    const remove = engine && typeof engine.removeLearnedBadLinkHosts === 'function'
      ? engine.removeLearnedBadLinkHosts
      : null;
    const next = remove ? remove(learnedBadLinkHosts, host) : learnedBadLinkHosts.filter((entry) => entry !== host);
    await extensionApi.storage.local.set({ learnedBadLinkHosts: next });
    renderLearnedBadLinkHosts(next);
    historyStatus.textContent = `${host} removed from remembered suspicious link domains.`;
  });
}

async function saveProtectionLevel(level) {
  const protectionLevel = level === 'careful' ? 'careful' : 'standard';
  await extensionApi.storage.local.set({ protectionLevel });
  renderProtectionLevel(protectionLevel);
  historyStatus.textContent = protectionLevel === 'careful'
    ? 'Extra careful protection turned on.'
    : 'Standard protection turned on.';
}

async function addTrustedHost() {
  const host = normalizeHost(trustedHostInput.value);
  if (!host || !host.includes('.')) {
    historyStatus.textContent = 'Enter a full website hostname like example.com.';
    trustedHostInput.focus();
    return;
  }
  if (trustedHosts.includes(host)) {
    historyStatus.textContent = `${host} is already trusted.`;
    trustedHostInput.value = '';
    return;
  }
  const next = [...trustedHosts, host].sort();
  await extensionApi.storage.local.set({ trustedHosts: next });
  trustedHostInput.value = '';
  renderTrustedHosts(next);
  historyStatus.textContent = `${host} will not be blocked on this device.`;
}

async function addBlockedHost() {
  const host = normalizeHost(blockedHostInput.value);
  if (!host || !host.includes('.')) {
    historyStatus.textContent = 'Enter a full website hostname like scam-example.com.';
    blockedHostInput.focus();
    return;
  }
  if (blockedHosts.includes(host)) {
    historyStatus.textContent = `${host} is already on the blocklist.`;
    blockedHostInput.value = '';
    return;
  }
  const next = [...blockedHosts, host].sort();
  await extensionApi.storage.local.set({ blockedHosts: next });
  blockedHostInput.value = '';
  renderBlockedHosts(next);
  historyStatus.textContent = `${host} was added to the family blocklist.`;
}

async function saveStrictModeSettings() {
  const enabled = strictModeToggle.checked;
  const pin = String(caregiverPinInput.value || '');
  if (enabled && pin.length > 0 && pin.length < 4) {
    strictModeStatus.textContent = 'Use a caregiver PIN with at least 4 characters.';
    return;
  }
  if (enabled && pin.length === 0) {
    const state = await extensionApi.storage.local.get({ caregiverPinHash: '' });
    if (!state.caregiverPinHash) {
      strictModeStatus.textContent = 'Enter a caregiver PIN before turning strict mode on.';
      return;
    }
  }

  const response = await extensionApi.runtime.sendMessage({
    type: 'set-caregiver-pin',
    strictModeEnabled: enabled,
    pin
  });

  if (!response?.ok) {
    strictModeStatus.textContent = 'Could not save strict mode settings.';
    return;
  }

  if (pin) {
    caregiverPinInput.value = '';
  }
  const state = await extensionApi.storage.local.get({ caregiverPinHash: '' });
  renderStrictMode(enabled, Boolean(state.caregiverPinHash));
  historyStatus.textContent = enabled
    ? 'Strict mode saved.'
    : 'Strict mode turned off.';
}

async function load() {
  const {
    detectionEvents = [],
    learnedMailPatterns = [],
    learnedSafeMailPatterns = [],
    localMailLearningConsent = 'unset',
    acknowledgedExtensionVersion = '',
    protectionLevel = 'standard',
    trustedHosts: savedTrustedHosts = [],
    blockedHosts: savedBlockedHosts = [],
    strictModeEnabled = false,
    caregiverPinHash = '',
    shoppingModeEnabled = false,
    afterScamUntil = 0,
    learnedBadLinkHosts: savedLearnedBadLinkHosts = [],
    autoAfterScamOnContinue = true,
    remoteRulePackEnabled = true
  } = await extensionApi.storage.local.get({
    detectionEvents: [],
    learnedMailPatterns: [],
    learnedSafeMailPatterns: [],
    localMailLearningConsent: 'unset',
    acknowledgedExtensionVersion: '',
    protectionLevel: 'standard',
    trustedHosts: [],
    blockedHosts: [],
    strictModeEnabled: false,
    caregiverPinHash: '',
    shoppingModeEnabled: false,
    afterScamUntil: 0,
    learnedBadLinkHosts: [],
    autoAfterScamOnContinue: true,
    remoteRulePackEnabled: true
  });
  render(detectionEvents);
  renderWeeklySummary(detectionEvents);
  renderLearning(localMailLearningConsent, learnedMailPatterns, learnedSafeMailPatterns);
  renderProtectionLevel(protectionLevel);
  renderTrustedHosts(savedTrustedHosts);
  renderBlockedHosts(savedBlockedHosts);
  renderStrictMode(strictModeEnabled, Boolean(caregiverPinHash));
  renderShoppingMode(shoppingModeEnabled);
  renderAfterScam(afterScamUntil);
  renderLearnedBadLinkHosts(savedLearnedBadLinkHosts);
  autoAfterScamOnContinueToggle.checked = autoAfterScamOnContinue !== false;
  if (remoteRulePackEnabledToggle) {
    remoteRulePackEnabledToggle.checked = remoteRulePackEnabled !== false;
  }
  await renderRulePackStatus();

  if (EXTENSION_VERSION && acknowledgedExtensionVersion !== EXTENSION_VERSION) {
    versionNotice.hidden = false;
    versionNoticeText.textContent =
      `Grandma Guard ${EXTENSION_VERSION} can now fetch additive official-domain updates from GitHub while keeping bundled lists offline. No browsing data is sent. Everything else still stays on this device.`;
  } else {
    versionNotice.hidden = true;
  }
}

document.getElementById('ackVersion').addEventListener('click', async () => {
  await extensionApi.storage.local.set({
    acknowledgedExtensionVersion: EXTENSION_VERSION
  });
  versionNotice.hidden = true;
  historyStatus.textContent = 'Version notice dismissed.';
});

document.getElementById('clearHistory').addEventListener('click', async () => {
  await extensionApi.storage.local.set({
    detectionEvents: [],
    pendingDecisions: [],
    temporaryBypasses: []
  });
  render([]);
  renderWeeklySummary([]);
  historyStatus.textContent = 'Detection history and pending one-time exceptions were cleared.';
});

protectionStandard.addEventListener('change', () => {
  if (protectionStandard.checked) {
    saveProtectionLevel('standard');
  }
});

protectionCareful.addEventListener('change', () => {
  if (protectionCareful.checked) {
    saveProtectionLevel('careful');
  }
});

document.getElementById('addTrustedHost').addEventListener('click', addTrustedHost);
trustedHostInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    addTrustedHost();
  }
});

document.getElementById('addBlockedHost').addEventListener('click', addBlockedHost);
blockedHostInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    addBlockedHost();
  }
});

document.getElementById('saveCaregiverPin').addEventListener('click', saveStrictModeSettings);
strictModeToggle.addEventListener('change', saveStrictModeSettings);

shoppingModeToggle.addEventListener('change', async () => {
  await extensionApi.storage.local.set({
    shoppingModeEnabled: shoppingModeToggle.checked
  });
  renderShoppingMode(shoppingModeToggle.checked);
  historyStatus.textContent = shoppingModeToggle.checked
    ? 'Shopping mode turned on.'
    : 'Shopping mode turned off.';
});

activateAfterScamButton.addEventListener('click', async () => {
  const response = await extensionApi.runtime.sendMessage({ type: 'activate-after-scam' });
  if (!response?.ok) {
    afterScamStatus.textContent = 'Could not turn on after-scam protection.';
    return;
  }
  renderAfterScam(response.afterScamUntil);
  historyStatus.textContent = '48-hour after-scam protection is now active.';
});

document.getElementById('applyGrandmaPreset').addEventListener('click', async () => {
  const current = await extensionApi.storage.local.get({
    protectionLevel: 'standard',
    shoppingModeEnabled: false,
    autoAfterScamOnContinue: true,
    localMailLearningConsent: 'unset',
    localMailLearningEnabled: false,
    trustedHosts: [],
    blockedHosts: [],
    learnedBadLinkHosts: [],
    learnedMailPatterns: [],
    learnedSafeMailPatterns: []
  });
  const preset = detection && typeof detection.buildGrandmaPresetSettings === 'function'
    ? detection.buildGrandmaPresetSettings(current)
    : {
      ...current,
      protectionLevel: 'careful',
      shoppingModeEnabled: true,
      autoAfterScamOnContinue: true,
      localMailLearningConsent: 'allowed',
      localMailLearningEnabled: true
    };
  await extensionApi.storage.local.set(preset);
  await load();
  historyStatus.textContent = 'Grandma preset applied on this device.';
});

autoAfterScamOnContinueToggle.addEventListener('change', async () => {
  await extensionApi.storage.local.set({
    autoAfterScamOnContinue: autoAfterScamOnContinueToggle.checked
  });
  historyStatus.textContent = autoAfterScamOnContinueToggle.checked
    ? 'After-scam protection will turn on automatically after Continue.'
    : 'Automatic after-scam protection on Continue is off.';
});

document.getElementById('exportSettings').addEventListener('click', async () => {
  const response = await extensionApi.runtime.sendMessage({ type: 'export-settings' });
  if (!response?.ok || !response.payload) {
    backupStatus.textContent = 'Export failed.';
    return;
  }
  const blob = new Blob([JSON.stringify(response.payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `grandma-guard-settings-${EXTENSION_VERSION || 'backup'}.json`;
  link.click();
  URL.revokeObjectURL(url);
  backupStatus.textContent = 'Settings exported to a JSON file on this device.';
});

document.getElementById('importSettings').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) {
    return;
  }
  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    const response = await extensionApi.runtime.sendMessage({
      type: 'import-settings',
      payload
    });
    if (!response?.ok) {
      backupStatus.textContent = 'Import failed. Choose a Grandma Guard settings file.';
      return;
    }
    backupStatus.textContent = 'Settings imported. Reloading…';
    await load();
  } catch {
    backupStatus.textContent = 'Import failed. The file could not be read.';
  }
});

learningToggle.addEventListener('change', async () => {
  const enabled = learningToggle.checked;
  const consent = enabled ? 'allowed' : 'declined';
  const {
    learnedMailPatterns = [],
    learnedSafeMailPatterns = []
  } = await extensionApi.storage.local.get({
    learnedMailPatterns: [],
    learnedSafeMailPatterns: []
  });
  await extensionApi.storage.local.set({
    localMailLearningConsent: consent,
    localMailLearningEnabled: enabled
  });
  renderLearning(consent, learnedMailPatterns, learnedSafeMailPatterns);
  historyStatus.textContent = enabled
    ? 'On-device email learning turned on.'
    : 'On-device email learning turned off.';
});

document.getElementById('clearLearned').addEventListener('click', async () => {
  await extensionApi.storage.local.set({
    learnedMailPatterns: [],
    learnedSafeMailPatterns: []
  });
  const { localMailLearningConsent = 'unset' } = await extensionApi.storage.local.get({
    localMailLearningConsent: 'unset'
  });
  renderLearning(localMailLearningConsent, [], []);
  historyStatus.textContent = 'Learned email patterns were cleared.';
});

if (remoteRulePackEnabledToggle) {
  remoteRulePackEnabledToggle.addEventListener('change', async () => {
    await setRemoteRulePackEnabled(remoteRulePackEnabledToggle.checked);
  });
}

if (refreshRulePackButton) {
  refreshRulePackButton.addEventListener('click', refreshRulePackNow);
}

load();
