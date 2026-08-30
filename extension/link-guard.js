(() => {
  'use strict';

  if (globalThis.__grandmaGuardLinkGuard) {
    return;
  }
  globalThis.__grandmaGuardLinkGuard = true;

  if (!globalThis.GrandmaGuardDetection) {
    return;
  }

  const detection = globalThis.GrandmaGuardDetection;
  const extensionApi = globalThis.browser ?? globalThis.chrome;
  const OVERLAY_ID = 'grandma-guard-link-warning';
  const HOVER_ID = 'grandma-guard-link-hover';
  const STYLE_ID = 'grandma-guard-link-style';
  const allowedLinks = new Set();
  const resolvedCache = new Map();
  let trustedHosts = [];
  let learnedBadLinkHosts = [];
  let protectionLevel = 'standard';
  let shoppingModeEnabled = false;
  let afterScamUntil = 0;
  let hoverTimer = null;
  let hoverAnchor = null;
  let pendingPasteHref = '';

  function linkProtectionContext() {
    return {
      protectionLevel,
      shoppingModeEnabled,
      afterScamUntil,
      learnedBadLinkHosts
    };
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${OVERLAY_ID} {
        position: fixed !important;
        inset: 0 !important;
        z-index: 2147483646 !important;
        display: grid !important;
        place-items: center !important;
        padding: 24px !important;
        background: rgba(15, 23, 42, 0.58) !important;
        font: 500 15px/1.45 system-ui, sans-serif !important;
      }
      #${OVERLAY_ID} .gg-link-card {
        width: min(460px, 100%) !important;
        padding: 22px 24px !important;
        border: 1px solid #d7dfeb !important;
        border-radius: 16px !important;
        background: #fff !important;
        color: #172033 !important;
        box-shadow: 0 18px 48px rgba(20, 28, 40, 0.28) !important;
      }
      #${OVERLAY_ID} strong {
        display: block !important;
        margin: 0 0 8px !important;
        font-size: 22px !important;
      }
      #${OVERLAY_ID} p {
        margin: 0 0 10px !important;
        color: #43516a !important;
      }
      #${OVERLAY_ID} .gg-link-host {
        margin: 0 0 12px !important;
        padding: 10px 12px !important;
        border-radius: 10px !important;
        background: #f4f7fb !important;
        color: #172033 !important;
        font: 600 14px/1.35 ui-monospace, SFMono-Regular, Consolas, monospace !important;
        word-break: break-all !important;
      }
      #${OVERLAY_ID} .gg-link-reasons {
        margin: 0 0 16px !important;
        color: #6c7890 !important;
        font-size: 14px !important;
      }
      #${OVERLAY_ID} .gg-link-actions {
        display: flex !important;
        flex-wrap: wrap !important;
        gap: 10px !important;
      }
      #${OVERLAY_ID} button {
        border: 0 !important;
        border-radius: 999px !important;
        padding: 10px 16px !important;
        font: 700 13px/1.2 system-ui, sans-serif !important;
        cursor: pointer !important;
      }
      #${OVERLAY_ID} [data-gg-link-back] {
        background: #e8eef7 !important;
        color: #243247 !important;
      }
      #${OVERLAY_ID} [data-gg-link-open] {
        background: #8d3024 !important;
        color: #fff !important;
      }
      #${OVERLAY_ID} [data-gg-link-block] {
        background: #172033 !important;
        color: #fff !important;
      }
      #${HOVER_ID} {
        position: fixed !important;
        z-index: 2147483645 !important;
        max-width: min(360px, calc(100vw - 24px)) !important;
        padding: 10px 12px !important;
        border-radius: 12px !important;
        background: #fff3f1 !important;
        border: 1px solid #f4c9c1 !important;
        color: #7c2f21 !important;
        box-shadow: 0 10px 28px rgba(20, 28, 40, 0.18) !important;
        font: 600 12px/1.4 system-ui, sans-serif !important;
        pointer-events: none !important;
      }
      #${HOVER_ID} .gg-hover-host {
        display: block !important;
        margin-top: 4px !important;
        color: #172033 !important;
        font: 600 12px/1.35 ui-monospace, SFMono-Regular, Consolas, monospace !important;
        word-break: break-all !important;
      }
      a[data-gg-link-risk="1"] {
        outline: 2px solid #c45c26 !important;
        outline-offset: 2px !important;
      }
    `;
    document.documentElement.append(style);
  }

  async function refreshLinkSettings() {
    try {
      const state = await extensionApi.storage.local.get({
        trustedHosts: [],
        learnedBadLinkHosts: [],
        protectionLevel: 'standard',
        shoppingModeEnabled: false,
        afterScamUntil: 0
      });
      trustedHosts = Array.isArray(state.trustedHosts) ? state.trustedHosts : [];
      learnedBadLinkHosts = Array.isArray(state.learnedBadLinkHosts) ? state.learnedBadLinkHosts : [];
      protectionLevel = state.protectionLevel === 'careful' ? 'careful' : 'standard';
      shoppingModeEnabled = Boolean(state.shoppingModeEnabled);
      afterScamUntil = Number(state.afterScamUntil) || 0;
    } catch {
      trustedHosts = [];
      learnedBadLinkHosts = [];
      protectionLevel = 'standard';
      shoppingModeEnabled = false;
      afterScamUntil = 0;
    }
  }

  function linkContext(anchor) {
    const parts = [];
    let node = anchor;
    for (let depth = 0; depth < 4 && node; depth += 1) {
      parts.push(String(node.innerText || node.textContent || '').slice(0, 400));
      node = node.parentElement;
    }
    return parts.join('\n').slice(0, 1200);
  }

  function parseHttpHref(value) {
    try {
      const href = new URL(value, location.href).href;
      if (!/^https?:/i.test(href)) {
        return null;
      }
      return href;
    } catch {
      return null;
    }
  }

  function shouldSkipHost(hostname) {
    return detection.isOfficialHost(hostname) ||
      detection.isMailHost(hostname) ||
      detection.isTrustedHost(hostname, trustedHosts);
  }

  async function resolveShortLink(href) {
    if (resolvedCache.has(href)) {
      return resolvedCache.get(href);
    }
    let resolved = href;
    try {
      const response = await extensionApi.runtime.sendMessage({
        type: 'resolve-short-link',
        href
      });
      if (response?.ok && response.finalHref) {
        resolved = response.finalHref;
      }
    } catch {
      // Keep the original href when resolution fails.
    }
    resolvedCache.set(href, resolved);
    return resolved;
  }

  async function analyzeAnchorLink(anchor, options = {}) {
    const href = parseHttpHref(anchor.href || anchor.getAttribute('href') || '');
    if (!href) {
      return null;
    }

    let finalHref = href;
    let hostname = '';
    try {
      hostname = new URL(href).hostname.toLowerCase();
    } catch {
      return null;
    }

    if (shouldSkipHost(hostname)) {
      return null;
    }

    if (options.resolveShorteners !== false &&
      typeof detection.isShortenerHost === 'function' &&
      detection.isShortenerHost(hostname)) {
      finalHref = await resolveShortLink(href);
    }

    const result = detection.analyzeLink({
      href: finalHref,
      resolvedFrom: finalHref !== href ? href : '',
      linkText: String(anchor.innerText || anchor.textContent || '').trim(),
      contextText: linkContext(anchor),
      ...linkProtectionContext()
    });

    if (!result.suspicious) {
      return null;
    }

    return { ...result, href: finalHref, originalHref: href };
  }

  function hideOverlay() {
    document.getElementById(OVERLAY_ID)?.remove();
  }

  function hideHoverTip() {
    if (hoverTimer) {
      clearTimeout(hoverTimer);
      hoverTimer = null;
    }
    hoverAnchor = null;
    document.getElementById(HOVER_ID)?.remove();
  }

  function positionHoverTip(tip, event) {
    const offset = 16;
    const rect = tip.getBoundingClientRect();
    let left = event.clientX + offset;
    let top = event.clientY + offset;
    if (left + rect.width > window.innerWidth - 12) {
      left = Math.max(12, event.clientX - rect.width - offset);
    }
    if (top + rect.height > window.innerHeight - 12) {
      top = Math.max(12, event.clientY - rect.height - offset);
    }
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  }

  function showHoverTip(anchor, result, event) {
    hideHoverTip();
    ensureStyles();

    const tip = document.createElement('div');
    tip.id = HOVER_ID;
    tip.setAttribute('role', 'tooltip');

    const lead = document.createElement('span');
    lead.textContent = result.originalHref && result.originalHref !== result.href
      ? 'Grandma Guard: short link redirects to a suspicious site'
      : 'Grandma Guard: suspicious link';

    const host = document.createElement('span');
    host.className = 'gg-hover-host';
    host.textContent = result.hostname || result.href;

    tip.append(lead, host);
    document.documentElement.append(tip);
    positionHoverTip(tip, event);
    anchor.setAttribute('data-gg-link-risk', '1');
    hoverAnchor = anchor;
  }

  function openAllowedLink(href, target) {
    hideOverlay();
    hideHoverTip();
    allowedLinks.add(href);
    if (pendingPasteHref === href) {
      pendingPasteHref = '';
      window.open(href, '_blank', 'noopener,noreferrer');
      return;
    }
    if (target === '_blank') {
      window.open(href, '_blank', 'noopener,noreferrer');
      return;
    }
    location.href = href;
  }

  function showLinkWarning(anchor, href, result) {
    hideOverlay();
    hideHoverTip();
    ensureStyles();

    let hostname = result.hostname || '';
    try {
      hostname = new URL(href).hostname;
    } catch {
      // Keep hostname from analysis when possible.
    }

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Suspicious link warning');

    const card = document.createElement('div');
    card.className = 'gg-link-card';

    const title = document.createElement('strong');
    title.textContent = 'This link looks suspicious';

    const lead = document.createElement('p');
    lead.textContent = result.originalHref && result.originalHref !== href
      ? 'This short link redirects somewhere that does not look trustworthy.'
      : 'Grandma Guard stopped the link before it opened. The destination does not look trustworthy.';

    const hostLine = document.createElement('p');
    hostLine.className = 'gg-link-host';
    hostLine.textContent = hostname || href;

    const reasons = document.createElement('p');
    reasons.className = 'gg-link-reasons';
    const reasonList = Array.isArray(result.reasons) ? result.reasons.filter(Boolean).slice(0, 4) : [];
    reasons.textContent = reasonList.length
      ? `Why: ${reasonList.join('; ')}.`
      : 'Why: the link destination uses a risky or lookalike website address.';

    const actions = document.createElement('div');
    actions.className = 'gg-link-actions';

    const back = document.createElement('button');
    back.type = 'button';
    back.setAttribute('data-gg-link-back', '1');
    back.textContent = 'Go back';

    const openOnce = document.createElement('button');
    openOnce.type = 'button';
    openOnce.setAttribute('data-gg-link-open', '1');
    openOnce.textContent = 'Open link once';

    const blockDomain = document.createElement('button');
    blockDomain.type = 'button';
    blockDomain.setAttribute('data-gg-link-block', '1');
    blockDomain.textContent = 'Block this website';

    actions.append(back, openOnce, blockDomain);
    card.append(title, lead, hostLine, reasons, actions);
    overlay.append(card);

    overlay.addEventListener('click', (event) => {
      const target = event.target;
      if (target?.getAttribute?.('data-gg-link-back') === '1') {
        hideOverlay();
        return;
      }
      if (target?.getAttribute?.('data-gg-link-open') === '1') {
        openAllowedLink(href, anchor.target);
      }
      if (target?.getAttribute?.('data-gg-link-block') === '1') {
        extensionApi.runtime.sendMessage({
          type: 'learn-bad-link-host',
          hostname: hostname.toLowerCase()
        }).catch(() => {});
        hideOverlay();
      }
    });

    document.documentElement.append(overlay);

    extensionApi.runtime.sendMessage({
      type: 'link-warned',
      href,
      hostname: hostname.toLowerCase(),
      score: result.score || 0,
      reasons: result.reasons || []
    }).catch(() => {});
  }

  function showSchemeWarning(anchor, scheme, detail) {
    hideOverlay();
    hideHoverTip();
    ensureStyles();

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Suspicious link warning');

    const card = document.createElement('div');
    card.className = 'gg-link-card';

    const title = document.createElement('strong');
    title.textContent = scheme === 'javascript'
      ? 'This link is blocked'
      : 'Check this number before calling or texting';

    const lead = document.createElement('p');
    lead.textContent = scheme === 'javascript'
      ? 'Grandma Guard blocked a javascript: link. Real companies do not use these in email or on normal pages.'
      : 'This email or page is pushing you to call or text a number. Scammers often use phone numbers instead of websites.';

    const hostLine = document.createElement('p');
    hostLine.className = 'gg-link-host';
    hostLine.textContent = detail || `${scheme}:`;

    const reasons = document.createElement('p');
    reasons.textContent = linkContext(anchor).slice(0, 220);

    const actions = document.createElement('div');
    actions.className = 'gg-link-actions';

    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'gg-link-primary';
    back.textContent = 'Go back';
    back.addEventListener('click', () => hideOverlay());

    actions.append(back);
    card.append(title, lead, hostLine, reasons, actions);
    overlay.append(card);
    document.documentElement.append(overlay);
  }

  async function handleLinkClick(event) {
    const anchor = event.target?.closest?.('a[href]');
    if (!anchor || event.defaultPrevented) {
      return;
    }

    const rawHref = String(anchor.getAttribute('href') || anchor.href || '').trim();
    if (/^javascript:/i.test(rawHref)) {
      event.preventDefault();
      event.stopPropagation();
      showSchemeWarning(anchor, 'javascript', rawHref.slice(0, 120));
      return;
    }

    const telSmsMatch = rawHref.match(/^(tel|sms):([^?#]+)/i);
    if (telSmsMatch) {
      await refreshLinkSettings();
      const context = linkContext(anchor);
      const smishy = /(?:verify|support|irs|refund|delivery|account|urgent|suspend|locked|billing|crypto|gift|prize|won|claim)/i.test(context);
      if (smishy) {
        event.preventDefault();
        event.stopPropagation();
        showSchemeWarning(anchor, telSmsMatch[1].toLowerCase(), telSmsMatch[2]);
        return;
      }
      return;
    }

    const href = parseHttpHref(rawHref);
    if (!href || allowedLinks.has(href)) {
      return;
    }

    await refreshLinkSettings();
    const result = await analyzeAnchorLink(anchor);
    if (!result) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    showLinkWarning(anchor, result.href, result);
  }

  async function handleLinkHover(event) {
    const anchor = event.target?.closest?.('a[href]');
    if (!anchor) {
      if (hoverAnchor && !hoverAnchor.matches(':hover')) {
        hideHoverTip();
      }
      return;
    }

    if (hoverAnchor === anchor && document.getElementById(HOVER_ID)) {
      positionHoverTip(document.getElementById(HOVER_ID), event);
      return;
    }

    hideHoverTip();
    if (hoverTimer) {
      clearTimeout(hoverTimer);
    }

    hoverTimer = setTimeout(async () => {
      hoverTimer = null;
      await refreshLinkSettings();
      const result = await analyzeAnchorLink(anchor);
      if (!result || !anchor.matches(':hover')) {
        return;
      }
      showHoverTip(anchor, result, event);
    }, 350);
  }

  function formActionHost(form) {
    const action = String(form.getAttribute('action') || location.href).trim();
    try {
      return new URL(action, location.href).hostname.toLowerCase();
    } catch {
      return location.hostname.toLowerCase();
    }
  }

  function formMentionsBrand(form) {
    const text = String(form.innerText || form.textContent || '').slice(0, 8000);
    return /\b(?:amazon|paypal|apple|microsoft|google|netflix|chase|wells\s*fargo|bank\s+of\s+america|citibank)\b/i.test(text);
  }

  async function handleFormSubmit(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) {
      return;
    }

    const passwordField = form.querySelector('input[type="password"]');
    if (!passwordField) {
      return;
    }

    await refreshLinkSettings();
    const actionHost = formActionHost(form);
    if (shouldSkipHost(actionHost)) {
      return;
    }

    const host = detection.analyzeHostname(actionHost);
    const brandPage = formMentionsBrand(form) && (host.brandLookalike || host.score >= 1);
    if (!brandPage && host.score < 2) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    showLinkWarning(form, `https://${actionHost}/`, {
      suspicious: true,
      score: host.score + 4,
      hostname: actionHost,
      href: `https://${actionHost}/`,
      reasons: [
        'shows a password form on an unofficial site that mentions a trusted brand',
        ...host.reasons
      ].slice(0, 6)
    });
  }

  async function handlePaste(event) {
    const text = String(event.clipboardData?.getData('text') || '').trim();
    if (!/^https?:\/\//i.test(text)) {
      return;
    }
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable)) {
      return;
    }

    await refreshLinkSettings();
    let hostname = '';
    try {
      hostname = new URL(text).hostname.toLowerCase();
    } catch {
      return;
    }
    if (shouldSkipHost(hostname)) {
      return;
    }

    const result = detection.analyzeLink({
      href: text,
      linkText: text,
      contextText: boundedPasteContext(target),
      ...linkProtectionContext()
    });
    if (!result.suspicious) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    pendingPasteHref = text;
    showLinkWarning(target, text, result);
  }

  function boundedPasteContext(target) {
    let node = target;
    const parts = [];
    for (let depth = 0; depth < 4 && node; depth += 1) {
      parts.push(String(node.innerText || node.textContent || node.value || '').slice(0, 400));
      node = node.parentElement;
    }
    return parts.join('\n').slice(0, 1200);
  }

  document.addEventListener('click', handleLinkClick, true);
  document.addEventListener('auxclick', handleLinkClick, true);
  document.addEventListener('mouseover', handleLinkHover, true);
  document.addEventListener('mousemove', handleLinkHover, true);
  document.addEventListener('paste', handlePaste, true);
  document.addEventListener('mouseout', (event) => {
    const anchor = event.target?.closest?.('a[href]');
    if (anchor && hoverAnchor === anchor) {
      hideHoverTip();
      anchor.removeAttribute('data-gg-link-risk');
    }
  }, true);
  document.addEventListener('submit', handleFormSubmit, true);
})();
