'use strict';

const extensionApi = globalThis.browser ?? globalThis.chrome;
const detection = globalThis.GrandmaGuardDetection;
const popupSummary = document.getElementById('popupSummary');
const popupStatus = document.getElementById('popupStatus');
const popupVersion = document.getElementById('popupVersion');
const EXTENSION_VERSION = String(extensionApi.runtime?.getManifest?.().version || '');

popupVersion.textContent = EXTENSION_VERSION ? `Version ${EXTENSION_VERSION}` : '';

function renderSummary(events, state) {
  popupSummary.replaceChildren();
  const summary = detection && typeof detection.summarizeWeeklyProtection === 'function'
    ? detection.summarizeWeeklyProtection(events)
    : { counts: { blocked: 0, email: 0, links: 0, continued: 0 } };

  const cards = [
    ['Blocked pages', summary.counts.blocked],
    ['Suspicious emails', summary.counts.email],
    ['Suspicious links', summary.counts.links]
  ];

  for (const [label, value] of cards) {
    const card = document.createElement('div');
    card.className = 'summary-card';
    const strong = document.createElement('strong');
    strong.textContent = String(value);
    const span = document.createElement('span');
    span.textContent = label;
    card.append(strong, span);
    popupSummary.append(card);
  }

  const parts = [];
  if (state.protectionLevel === 'careful') {
    parts.push('Extra careful');
  } else {
    parts.push('Standard');
  }
  if (state.shoppingModeEnabled) {
    parts.push('Shopping mode on');
  }
  if (Number(state.afterScamUntil) > Date.now()) {
    parts.push('After-scam active');
  }
  if (state.strictModeEnabled) {
    parts.push('Strict mode on');
  }
  popupStatus.textContent = parts.join(' · ');
}

async function loadPopup() {
  const state = await extensionApi.storage.local.get({
    detectionEvents: [],
    protectionLevel: 'standard',
    shoppingModeEnabled: false,
    afterScamUntil: 0,
    strictModeEnabled: false
  });
  renderSummary(state.detectionEvents || [], state);
}

document.getElementById('popupSettings').addEventListener('click', () => {
  extensionApi.runtime.openOptionsPage();
  window.close();
});

document.getElementById('popupAfterScam').addEventListener('click', async () => {
  const button = document.getElementById('popupAfterScam');
  button.disabled = true;
  const response = await extensionApi.runtime.sendMessage({ type: 'activate-after-scam' });
  if (response?.ok) {
    button.textContent = 'Extra protection is on';
    popupStatus.textContent = `After-scam active until ${new Date(response.afterScamUntil).toLocaleString()}.`;
    return;
  }
  button.disabled = false;
});

loadPopup();
