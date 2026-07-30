(() => {
  'use strict';

  if (window.top !== window.self || !globalThis.GrandmaGuardDetection) {
    return;
  }

  const extensionApi = globalThis.browser ?? globalThis.chrome;
  const host = location.hostname.toLowerCase();
  let alreadyReported = false;
  let debounceTimer = null;
  let lastEvaluationAt = 0;

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
      if (positioned && visible && areaRatio >= 0.2) {
        overlays.push(element);
        largeOverlay = largeOverlay || areaRatio >= 0.4;
      }
    }

    return {
      overlayText: overlays.map((element) => boundedText(element, 10000)).join('\n').slice(0, 50000),
      largeOverlay
    };
  }

  function buildSnapshot() {
    const article = collectArticleContext();
    const overlay = collectOverlayContext();
    const bodyStyle = document.body ? getComputedStyle(document.body) : null;
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
      scrollLocked: Boolean(bodyStyle && (bodyStyle.overflow === 'hidden' || bodyStyle.overflowY === 'hidden')),
      notificationPermission: typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
      audibleMedia: Array.from(document.querySelectorAll('audio, video')).some((media) => !media.paused && !media.muted),
      ...article
    };
  }

  function evaluate() {
    if (alreadyReported || !document.documentElement || !document.body) {
      return;
    }
    lastEvaluationAt = Date.now();
    const result = globalThis.GrandmaGuardDetection.analyze(buildSnapshot());
    if (!result.block) {
      return;
    }

    alreadyReported = true;
    observer.disconnect();
    window.stop();
    document.documentElement.innerHTML = `
      <head><title>Grandma Guard</title></head>
      <body style="margin:0;background:#f5f7fb;color:#172033;font:20px system-ui;display:grid;place-items:center;min-height:100vh">
        <main style="max-width:600px;padding:32px;text-align:center">
          <h1 style="font-size:30px">Checking a suspicious page…</h1>
          <p>Grandma Guard stopped the page before you could interact with it.</p>
        </main>
      </body>`;

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
      if (await consumeOneTimeBypass()) return;
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
