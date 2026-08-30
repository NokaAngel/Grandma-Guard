'use strict';

const extensionApi = globalThis.browser ?? globalThis.chrome;
const params = new URLSearchParams(location.search);
const token = params.get('token') || '';
const hostname = params.get('host') || 'this website';
const confirmButton = document.getElementById('confirmContinue');
const countdown = document.getElementById('countdown');
const unlockStatus = document.getElementById('unlockStatus');
const pinField = document.getElementById('pinField');
const caregiverPin = document.getElementById('caregiverPin');
let strictModeEnabled = false;

document.getElementById('hostname').textContent = hostname;

async function closeCurrentTab() {
  const tab = await extensionApi.tabs.getCurrent();
  if (tab?.id) {
    await extensionApi.tabs.remove(tab.id);
  }
}

document.getElementById('closeTab').addEventListener('click', closeCurrentTab);

let unlockSeconds = 5;
const unlockTimer = setInterval(() => {
  unlockSeconds -= 1;
  if (unlockSeconds <= 0) {
    clearInterval(unlockTimer);
    confirmButton.disabled = false;
    confirmButton.textContent = strictModeEnabled
      ? 'Enter PIN and open once'
      : 'I understand. Open it once';
    unlockStatus.textContent = strictModeEnabled
      ? 'Enter the caregiver PIN, then use the one-time Continue option.'
      : 'The one-time Continue option is now available.';
  } else {
    unlockStatus.textContent = `Please wait ${unlockSeconds} second${unlockSeconds === 1 ? '' : 's'} before the one-time Continue option becomes available.`;
  }
}, 1000);

confirmButton.addEventListener('click', async () => {
  confirmButton.disabled = true;
  confirmButton.textContent = 'Opening once…';
  unlockStatus.textContent = 'Opening the exact address once.';
  const response = await extensionApi.runtime.sendMessage({
    type: 'continue-scareware',
    token,
    pin: strictModeEnabled ? caregiverPin.value : ''
  });
  if (response?.ok) {
    return;
  }
  if (response?.reason === 'pin-invalid') {
    confirmButton.disabled = false;
    confirmButton.textContent = 'Try PIN again';
    unlockStatus.textContent = 'That caregiver PIN was not correct.';
    caregiverPin.focus();
    return;
  }
  if (response?.reason === 'blocked-host') {
    confirmButton.textContent = 'Continue blocked on this device';
    unlockStatus.textContent = 'This website is on the family blocklist.';
    return;
  }
  confirmButton.textContent = 'This exception expired. Close the tab';
  unlockStatus.textContent = 'The one-time exception expired. Close this tab instead.';
});

async function loadContinueState() {
  try {
    const state = await extensionApi.storage.local.get({
      strictModeEnabled: false,
      blockedHosts: []
    });
    strictModeEnabled = Boolean(state.strictModeEnabled);
    if (strictModeEnabled) {
      pinField.hidden = false;
    }

    const engine = globalThis.GrandmaGuardDetection;
    if (engine && typeof engine.isBlockedHost === 'function' &&
      engine.isBlockedHost(hostname, state.blockedHosts || [])) {
      confirmButton.disabled = true;
      unlockStatus.textContent = 'This website is on the family blocklist. Continue is disabled.';
    }
  } catch {
    // Keep default continue behavior.
  }
}

let closeSeconds = 30;
const closeTimer = setInterval(() => {
  closeSeconds -= 1;
  countdown.textContent = `This tab will close automatically in ${closeSeconds} second${closeSeconds === 1 ? '' : 's'}.`;
  if (closeSeconds <= 0) {
    clearInterval(closeTimer);
    closeCurrentTab();
  }
}, 1000);

loadContinueState();
