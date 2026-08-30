(() => {
  'use strict';

  if (window.top !== window.self || !globalThis.GrandmaGuardDetection) {
    return;
  }

  const extensionApi = globalThis.browser ?? globalThis.chrome;
  const host = location.hostname.toLowerCase();
  // Webmail is handled by mail-guard.js with notify-only warnings.
  if (typeof globalThis.GrandmaGuardDetection.isMailHost === 'function' &&
    globalThis.GrandmaGuardDetection.isMailHost(host)) {
    return;
  }

  let alreadyReported = false;
  let debounceTimer = null;
  let lastEvaluationAt = 0;
  let protectionLevel = 'standard';
  let trustedHosts = [];
  let shoppingModeEnabled = false;
  let afterScamUntil = 0;

  async function refreshProtectionSettings() {
    try {
      const state = await extensionApi.storage.local.get({
        protectionLevel: 'standard',
        trustedHosts: [],
        shoppingModeEnabled: false,
        afterScamUntil: 0
      });
      protectionLevel = state.protectionLevel === 'careful' ? 'careful' : 'standard';
      trustedHosts = Array.isArray(state.trustedHosts) ? state.trustedHosts : [];
      shoppingModeEnabled = Boolean(state.shoppingModeEnabled);
      afterScamUntil = Number(state.afterScamUntil) || 0;
    } catch {
      protectionLevel = 'standard';
      trustedHosts = [];
      shoppingModeEnabled = false;
      afterScamUntil = 0;
    }
  }

  function pageLooksLikeShopping() {
    const text = `${document.title}\n${boundedText(document.body, 6000)}`.toLowerCase();
    const hasPaymentField = Boolean(document.querySelector(
      'input[autocomplete*="cc"], input[name*="card" i], input[id*="card" i], input[name*="cvv" i], [data-testid*="payment" i]'
    ));
    return hasPaymentField ||
      /\b(checkout|payment|billing|order summary|shopping cart|gift card|credit card|cvv|add to cart)\b/.test(text);
  }

  function hostIsTrusted() {
    return typeof globalThis.GrandmaGuardDetection.isTrustedHost === 'function' &&
      globalThis.GrandmaGuardDetection.isTrustedHost(host, trustedHosts);
  }

  function boundedText(element, maximum) {
    if (!element) return '';
    try {
      return String(element.innerText || element.textContent || '').slice(0, maximum);
    } catch {
      return '';
    }
  }

  function elementLabel(element) {
    return [
      boundedText(element, 1200),
      element.getAttribute?.('aria-label') || '',
      element.getAttribute?.('title') || '',
      element.value || ''
    ].filter(Boolean).join(' ');
  }

  function collectInteractiveText() {
    return Array.from(document.querySelectorAll(
      'button, a, input[type="button"], input[type="submit"], [role="button"]'
    ))
      .filter((element) => !element.closest(
        'article, [role="article"], [itemtype*="Article"], [itemtype*="NewsArticle"], blockquote, q, pre, code, figcaption'
      ))
      .slice(0, 250)
      .map(elementLabel)
      .join('\n')
      .slice(0, 30000);
  }

  function collectArticleContext() {
    const roots = Array.from(new Set(Array.from(document.querySelectorAll(
      'article, [role="article"], [itemtype*="Article"], [itemtype*="NewsArticle"]'
    )))).slice(0, 20);
    const articleText = roots.map((element) => boundedText(element, 50000)).join('\n').slice(0, 180000);
    const articleWordCount = (articleText.match(/\b[\p{L}\p{N}'’-]+\b/gu) || []).length;
    const articleParagraphCount = roots.reduce(
      (total, root) => total + root.querySelectorAll('p').length,
      0
    );
    const jsonLd = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
      .slice(0, 20)
      .map((element) => element.textContent || '')
      .join('\n')
      .slice(0, 100000);
    const structuredArticle = /["']@type["']\s*:\s*["'](?:NewsArticle|Article|ReportageNewsArticle|AnalysisNewsArticle)["']/i.test(jsonLd) ||
      roots.some((element) => /(?:NewsArticle|Article)/i.test(element.getAttribute('itemtype') || ''));
    const hasByline = Boolean(document.querySelector(
      '[rel="author"], [itemprop="author"], .byline, [class*="byline"], meta[name="author"]'
    ));
    const quotedText = Array.from(document.querySelectorAll('blockquote, q, pre, code, figcaption'))
      .slice(0, 120)
      .map((element) => boundedText(element, 4000))
      .join('\n')
      .slice(0, 50000);

    return {
      articleText,
      articleWordCount,
      articleParagraphCount,
      structuredArticle,
      hasByline,
      quotedText
    };
  }

  function collectTelLinks() {
    const links = Array.from(document.querySelectorAll('a[href^="tel:"], a[href^="TEL:"]')).slice(0, 40);
    const telLinkText = links.map((element) => {
      const href = element.getAttribute('href') || '';
      const number = href.replace(/^tel:/i, '').trim();
      return `${elementLabel(element)} ${number}`.trim();
    }).filter(Boolean).join('\n').slice(0, 5000);

    return {
      telLinkText,
      hasTelLink: links.length > 0
    };
  }

  function collectOverlayContext() {
    const candidates = new Set(document.querySelectorAll('dialog, [role="dialog"], [aria-modal="true"]'));
    const width = Math.max(window.innerWidth, 1);
    const height = Math.max(window.innerHeight, 1);
    const points = [
      [width / 2, height / 2],
      [width * 0.2, height * 0.2],
      [width * 0.8, height * 0.2],
      [width * 0.2, height * 0.8],
      [width * 0.8, height * 0.8]
    ];

    for (const [x, y] of points) {
      for (const element of document.elementsFromPoint(x, y).slice(0, 8)) {
        candidates.add(element);
      }
    }

    const overlays = [];
    let largeOverlay = false;
    for (const element of Array.from(candidates).slice(0, 100)) {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const areaRatio = Math.max(0, rect.width) * Math.max(0, rect.height) / (width * height);
      const positioned = style.position === 'fixed' || style.position === 'sticky' ||
        element.matches('dialog, [role="dialog"], [aria-modal="true"]');
      const visible = style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0.05;
      // Require fixed/sticky/dialog positioning. A high z-index alone is common on
      // normal search and app UIs and must not count as scareware takeover.
      if (visible && areaRatio >= 0.2 && positioned) {
        overlays.push(element);
        largeOverlay = largeOverlay || areaRatio >= 0.4;
      }
    }

    const bodyStyle = document.body ? getComputedStyle(document.body) : null;
    const htmlStyle = getComputedStyle(document.documentElement);
    const scrollLocked = Boolean(
      (bodyStyle && (bodyStyle.overflow === 'hidden' || bodyStyle.overflowY === 'hidden')) ||
      htmlStyle.overflow === 'hidden' ||
      htmlStyle.overflowY === 'hidden'
    );

    // Full-page lock screens often paint the body without position:fixed.
    // Only treat that as an overlay when scrolling is locked; otherwise normal
    // pages (Google results, articles) fill the viewport and look like takeovers.
    if (scrollLocked) {
      const takeoverRoots = [
        document.documentElement,
        document.body,
        ...Array.from(document.querySelectorAll('body > div, body > main, body > section')).slice(0, 12)
      ].filter(Boolean);

      for (const element of takeoverRoots) {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        const areaRatio = Math.max(0, rect.width) * Math.max(0, Math.min(rect.height, height)) / (width * height);
        const fillsViewport = areaRatio >= 0.85 && rect.top <= 12 && rect.left <= 12;
        const visible = style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0.05;
        if (fillsViewport && visible) {
          if (!overlays.includes(element)) {
            overlays.push(element);
          }
          largeOverlay = true;
        }
      }
    }

    return {
      overlayText: overlays.map((element) => boundedText(element, 10000)).join('\n').slice(0, 50000),
      largeOverlay,
      scrollLocked
    };
  }

  function collectCredentialSignals() {
    const fields = Array.from(document.querySelectorAll('input[type="password"]')).slice(0, 20);
    const hasPasswordField = fields.some((field) => {
      if (!field || field.disabled) {
        return false;
      }
      const style = getComputedStyle(field);
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0.05;
    });
    return { hasPasswordField };
  }

  function buildSnapshot() {
    const article = collectArticleContext();
    const overlay = collectOverlayContext();
    const tel = collectTelLinks();
    const credential = collectCredentialSignals();
    const pageText = boundedText(document.body, 250000);
    return {
      hostname: host,
      protocol: location.protocol,
      titleText: document.title || '',
      pageText,
      pageWordCount: (pageText.match(/\b[\p{L}\p{N}'’-]+\b/gu) || []).length,
      interactiveText: collectInteractiveText(),
      overlayText: overlay.overlayText,
      largeOverlay: overlay.largeOverlay,
      fullscreen: Boolean(document.fullscreenElement),
      scrollLocked: overlay.scrollLocked,
      notificationPermission: typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
      audibleMedia: Array.from(document.querySelectorAll('audio, video')).some((media) => !media.paused && !media.muted),
      telLinkText: tel.telLinkText,
      hasTelLink: tel.hasTelLink,
      hasPasswordField: credential.hasPasswordField,
      ...article
    };
  }

  function evaluate() {
    if (alreadyReported || !document.documentElement || !document.body) {
      return;
    }
    if (hostIsTrusted()) {
      return;
    }
    lastEvaluationAt = Date.now();
    const result = globalThis.GrandmaGuardDetection.analyze({
      ...buildSnapshot(),
      protectionLevel,
      shoppingModeEnabled,
      afterScamUntil,
      shoppingPage: pageLooksLikeShopping()
    });
    if (!result.block) {
      return;
    }

    alreadyReported = true;
    observer.disconnect();
    window.stop();

    while (document.documentElement.firstChild) {
      document.documentElement.removeChild(document.documentElement.firstChild);
    }

    const head = document.createElement('head');
    const title = document.createElement('title');
    title.textContent = 'Grandma Guard';
    head.append(title);

    const body = document.createElement('body');
    body.style.cssText = 'margin:0;background:#f5f7fb;color:#172033;font:20px system-ui;display:grid;place-items:center;min-height:100vh';

    const main = document.createElement('main');
    main.style.cssText = 'max-width:600px;padding:32px;text-align:center';

    const heading = document.createElement('h1');
    heading.style.fontSize = '30px';
    heading.textContent = 'Checking a suspicious page…';

    const message = document.createElement('p');
    message.textContent = 'Grandma Guard stopped the page before you could interact with it.';

    main.append(heading, message);
    body.append(main);
    document.documentElement.append(head, body);

    extensionApi.runtime.sendMessage({
      type: 'scareware-detected',
      url: location.href,
      hostname: host,
      score: result.score,
      reasons: result.reasons
    });
  }

  function scheduleEvaluation() {
    clearTimeout(debounceTimer);
    const elapsed = Date.now() - lastEvaluationAt;
    const delay = Math.max(200, 800 - elapsed);
    debounceTimer = setTimeout(evaluate, delay);
  }

  const observer = new MutationObserver(scheduleEvaluation);

  function start() {
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'open', 'aria-hidden', 'aria-modal']
    });
    scheduleEvaluation();
    setTimeout(evaluate, 1200);
    setTimeout(evaluate, 3500);
    setTimeout(evaluate, 8000);
  }

  async function consumeOneTimeBypass() {
    const now = Date.now();
    const { temporaryBypasses = [] } = await extensionApi.storage.local.get({ temporaryBypasses: [] });
    const active = temporaryBypasses.filter((item) => item.expiresAt > now);
    const matchIndex = active.findIndex((item) => item.hostname === host && item.url === location.href);
    if (matchIndex < 0) {
      if (active.length !== temporaryBypasses.length) {
        await extensionApi.storage.local.set({ temporaryBypasses: active });
      }
      return false;
    }
    active.splice(matchIndex, 1);
    await extensionApi.storage.local.set({ temporaryBypasses: active });
    return true;
  }

  async function bootstrap() {
    try {
      await refreshProtectionSettings();
      if (await consumeOneTimeBypass()) return;
      if (hostIsTrusted()) return;
    } catch {
      // If storage is unavailable, retain the safer default and scan.
    }

    if (document.documentElement) {
      start();
    } else {
      document.addEventListener('readystatechange', () => {
        if (document.documentElement) start();
      }, { once: true });
    }
  }

  bootstrap();
})();
