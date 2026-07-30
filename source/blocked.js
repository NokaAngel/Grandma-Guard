'use strict';

const extensionApi = globalThis.browser ?? globalThis.chrome;
const params = new URLSearchParams(location.search);
const token = params.get('token') || '';
const hostname = params.get('host') || 'Unknown website';
const reasons = (params.get('reasons') || '')
  .split('|')
  .filter(Boolean)
  .slice(0, 6);

document.getElementById('hostname').textContent = hostname;
document.getElementById('reasons').textContent = reasons.length
  ? reasons.join('; ')
  : 'Suspicious scareware behavior';

async function closeCurrentTab() {
  const tab = await extensionApi.tabs.getCurrent();
  if (tab?.id) {
    await extensionApi.tabs.remove(tab.id);
  }
}

document.getElementById('closeTab').addEventListener('click', closeCurrentTab);

document.getElementById('continueAnyway').addEventListener('click', () => {
  if (!token) {
    closeCurrentTab();
    return;
  }
  location.href = `${extensionApi.runtime.getURL('continue.html')}?token=${encodeURIComponent(token)}&host=${encodeURIComponent(hostname)}`;
});

let secondsRemaining = 30;
const countdown = document.getElementById('countdown');
const timer = setInterval(() => {
  secondsRemaining -= 1;
  countdown.textContent = `This tab will close automatically in ${secondsRemaining} second${secondsRemaining === 1 ? '' : 's'}.`;
  if (secondsRemaining <= 0) {
    clearInterval(timer);
    closeCurrentTab();
  }
}, 1000);
