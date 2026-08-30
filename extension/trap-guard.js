(() => {
  'use strict';

  if (globalThis.__grandmaGuardTrapGuard) {
    return;
  }
  globalThis.__grandmaGuardTrapGuard = true;

  if (!globalThis.GrandmaGuardDetection || globalThis.GrandmaGuardDetection.isMailHost(location.hostname)) {
    return;
  }

  const detection = globalThis.GrandmaGuardDetection;
  const BANNER_ID = 'grandma-guard-trap-banner';
  const STYLE_ID = 'grandma-guard-trap-style';
  let lastSnapshot = null;

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${BANNER_ID} {
        position: fixed !important;
        left: 50% !important;
        bottom: 18px !important;
        transform: translateX(-50%) !important;
        z-index: 2147483644 !important;
        width: min(560px, calc(100vw - 24px)) !important;
        padding: 14px 16px !important;
        border-radius: 14px !important;
        background: #172033 !important;
        color: #fff !important;
        box-shadow: 0 16px 40px rgba(15, 23, 42, 0.35) !important;
        font: 600 14px/1.45 system-ui, sans-serif !important;
      }
      #${BANNER_ID} strong {
        display: block !important;
        margin-bottom: 4px !important;
        font-size: 15px !important;
      }
      #${BANNER_ID} button {
        margin-top: 10px !important;
        border: 0 !important;
        border-radius: 999px !important;
        padding: 8px 14px !important;
        background: #fff !important;
        color: #172033 !important;
        font: 700 12px/1.2 system-ui, sans-serif !important;
        cursor: pointer !important;
      }
    `;
    document.documentElement.append(style);
  }

  function hideBanner() {
    document.getElementById(BANNER_ID)?.remove();
  }

  function showBanner(title, message, actionLabel, onAction) {
    hideBanner();
    ensureStyles();

    const banner = document.createElement('div');
    banner.id = BANNER_ID;
    banner.setAttribute('role', 'status');

    const heading = document.createElement('strong');
    heading.textContent = title;

    const body = document.createElement('span');
    body.textContent = message;

    banner.append(heading, body);

    if (actionLabel && typeof onAction === 'function') {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = actionLabel;
      button.addEventListener('click', () => {
        onAction();
        hideBanner();
      });
      banner.append(button);
    }

    document.documentElement.append(banner);
  }

  function quickSnapshot() {
    const overlayNodes = Array.from(document.querySelectorAll('div, section, aside')).slice(0, 80);
    let overlayText = '';
    let largeOverlay = false;
    for (const node of overlayNodes) {
      const style = getComputedStyle(node);
      if (style.position !== 'fixed' && style.position !== 'absolute') {
        continue;
      }
      const rect = node.getBoundingClientRect();
      if (rect.width * rect.height < window.innerWidth * window.innerHeight * 0.35) {
        continue;
      }
      largeOverlay = true;
      overlayText += ` ${node.innerText || node.textContent || ''}`;
      if (overlayText.length > 4000) {
        break;
      }
    }

    return {
      hostname: location.hostname.toLowerCase(),
      protocol: location.protocol,
      titleText: document.title || '',
      pageText: String(document.body?.innerText || '').slice(0, 12000),
      overlayText: overlayText.slice(0, 5000),
      largeOverlay,
      fullscreen: Boolean(document.fullscreenElement),
      audibleMedia: Array.from(document.querySelectorAll('audio, video')).some((media) => !media.paused && !media.muted),
      notificationPermission: typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
      interactiveText: '',
      articleText: '',
      quotedText: '',
      telLinkText: '',
      hasTelLink: false,
      hasPasswordField: Boolean(document.querySelector('input[type="password"]')),
      pageWordCount: 0,
      articleWordCount: 0,
      articleParagraphCount: 0,
      structuredArticle: false,
      hasByline: false,
      scrollLocked: document.documentElement.classList.contains('gg-scroll-lock')
    };
  }

  function looksRisky(snapshot) {
    if (!snapshot) {
      return false;
    }
    if (detection.isOfficialHost(snapshot.hostname) || detection.isMailHost(snapshot.hostname)) {
      return false;
    }
    const result = detection.analyze(snapshot);
    return result.score >= 6 || result.block;
  }

  function evaluateTraps() {
    const snapshot = quickSnapshot();
    lastSnapshot = snapshot;
    if (!looksRisky(snapshot)) {
      hideBanner();
      return;
    }

    if (snapshot.fullscreen) {
      showBanner(
        'This page took over full screen',
        'Press Esc on your keyboard, then close the tab if the warning looked fake.',
        'Hide this tip',
        hideBanner
      );
      return;
    }

    if (snapshot.audibleMedia && snapshot.largeOverlay) {
      showBanner(
        'This page is playing alarm sounds',
        'Use the button below to mute this tab, then close it if it looks like a scam.',
        'Mute this tab',
        () => {
          for (const media of document.querySelectorAll('audio, video')) {
            media.muted = true;
            media.pause();
          }
        }
      );
      return;
    }

    if (snapshot.largeOverlay && /allow|notification|continue|robot|human/i.test(`${snapshot.pageText}\n${snapshot.overlayText}`)) {
      showBanner(
        'Do not click Allow on this page',
        'Strange pages often trick people into enabling notifications. Close the tab instead.',
        'Hide this tip',
        hideBanner
      );
    }
  }

  document.addEventListener('fullscreenchange', evaluateTraps, true);
  window.setInterval(evaluateTraps, 2500);
  document.addEventListener('click', (event) => {
    const target = event.target;
    const label = String(target?.innerText || target?.textContent || '').trim();
    if (!/allow|enable notifications|subscribe/i.test(label)) {
      return;
    }
    const snapshot = lastSnapshot || quickSnapshot();
    if (!looksRisky(snapshot)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    showBanner(
      'Notification request blocked',
      'This page looks suspicious, so Grandma Guard stopped an Allow or notification click.',
      'Hide this tip',
      hideBanner
    );
  }, true);
})();
