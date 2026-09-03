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

const blockTip = document.getElementById('blockTip');
const strictModeNote = document.getElementById('strictModeNote');
const continueButton = document.getElementById('continueAnyway');

async function closeCurrentTab() {
  const tab = await extensionApi.tabs.getCurrent();
  if (tab?.id) {
    await extensionApi.tabs.remove(tab.id);
  }
}

document.getElementById('closeTab').addEventListener('click', closeCurrentTab);

continueButton.addEventListener('click', () => {
  if (!token) {
    closeCurrentTab();
    return;
  }
  location.href = `${extensionApi.runtime.getURL('continue.html')}?token=${encodeURIComponent(token)}&host=${encodeURIComponent(hostname)}`;
});

const markSafeButton = document.getElementById('markSafe');
const suggestOfficialButton = document.createElement('button');
suggestOfficialButton.type = 'button';
suggestOfficialButton.className = 'link-button';
suggestOfficialButton.id = 'suggestOfficial';
suggestOfficialButton.textContent = 'Suggest for official list';
suggestOfficialButton.title = 'Opens GitHub to suggest this domain for review. No page content is sent.';
suggestOfficialButton.addEventListener('click', () => {
  globalThis.GrandmaGuardFalsePositiveReport?.openReportUrl({
    type: 'website',
    domain: hostname,
    reasons
  });
});
markSafeButton.insertAdjacentElement('afterend', suggestOfficialButton);

markSafeButton.addEventListener('click', async () => {
  if (!hostname || hostname === 'Unknown website') {
    return;
  }
  markSafeButton.disabled = true;
  try {
    const response = await extensionApi.runtime.sendMessage({
      type: 'mark-host-trusted',
      hostname
    });
    if (response?.ok) {
      markSafeButton.textContent = 'Added to trusted websites';
      clearInterval(timer);
      countdown.textContent = 'Closing this tab…';
      setTimeout(closeCurrentTab, 1200);
      return;
    }
  } catch {
    // Fall through to re-enable the button.
  }
  markSafeButton.disabled = false;
});

document.getElementById('activateAfterScam')?.addEventListener('click', async () => {
  const button = document.getElementById('activateAfterScam');
  button.disabled = true;
  try {
    const response = await extensionApi.runtime.sendMessage({ type: 'activate-after-scam' });
    if (response?.ok) {
      button.textContent = 'Extra protection turned on';
      countdown.textContent = 'Stronger protection is active for 48 hours on this device.';
    }
  } catch {
    button.disabled = false;
  }
});

async function loadBlockedPageExtras() {
  try {
    const state = await extensionApi.storage.local.get({
      strictModeEnabled: false,
      blockedHosts: []
    });
    if (state.strictModeEnabled) {
      strictModeNote.hidden = false;
    }

    const engine = globalThis.GrandmaGuardDetection;
    if (engine && typeof engine.pickBlockPageTip === 'function') {
      blockTip.textContent = engine.pickBlockPageTip(reasons);
    } else {
      blockTip.textContent = 'If this warning surprised you, close the tab and ask a family member before doing anything else.';
    }

    if (engine && typeof engine.isBlockedHost === 'function' &&
      engine.isBlockedHost(hostname, state.blockedHosts || [])) {
      continueButton.hidden = true;
      strictModeNote.hidden = false;
      strictModeNote.textContent = 'This website is on the family blocklist. Continue is disabled on this device.';
    }
  } catch {
    blockTip.textContent = 'If this warning surprised you, close the tab and ask a family member before doing anything else.';
  }
}

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

loadBlockedPageExtras();
