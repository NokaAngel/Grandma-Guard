'use strict';

const extensionApi = globalThis.browser ?? globalThis.chrome;
const params = new URLSearchParams(location.search);
const token = params.get('token') || '';
const hostname = params.get('host') || 'this website';
const confirmButton = document.getElementById('confirmContinue');
const countdown = document.getElementById('countdown');
const unlockStatus = document.getElementById('unlockStatus');

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
    confirmButton.textContent = 'I understand. Open it once';
    unlockStatus.textContent = 'The one-time Continue option is now available.';
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
    token
  });
  if (!response?.ok) {
    confirmButton.textContent = 'This exception expired. Close the tab';
    unlockStatus.textContent = 'The one-time exception expired. Close this tab instead.';
  }
});

let closeSeconds = 30;
const closeTimer = setInterval(() => {
  closeSeconds -= 1;
  countdown.textContent = `This tab will close automatically in ${closeSeconds} second${closeSeconds === 1 ? '' : 's'}.`;
  if (closeSeconds <= 0) {
    clearInterval(closeTimer);
    closeCurrentTab();
  }
}, 1000);
