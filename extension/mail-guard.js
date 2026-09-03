(() => {
  'use strict';

  // Run in top window and mail list iframes (older Yahoo layouts).
  if (!globalThis.GrandmaGuardDetection) {
    return;
  }

  const detection = globalThis.GrandmaGuardDetection;
  if (typeof detection.isMailHost !== 'function' || !detection.isMailHost(location.hostname)) {
    return;
  }

  const extensionApi = globalThis.browser ?? globalThis.chrome;
  const ROW_MARK = 'data-grandma-guard-scam';
  const SEVERITY_MARK = 'data-grandma-guard-severity';
  const FROM_FADED_CLASS = 'grandma-guard-from-faded';
  const PILL_CLASS = 'grandma-guard-scam-pill';
  const PILL_HOST_CLASS = 'grandma-guard-pill-host';
  const LEGACY_FROM_HOST_CLASS = 'grandma-guard-from-host';
  const LEGACY_FROM_FADE_CLASS = 'grandma-guard-from-fade';
  const LEGACY_OVERLAY_CLASS = 'grandma-guard-scam-overlay';
  const LEGACY_LABEL_CLASS = 'grandma-guard-scam-label';
  const LEGACY_FADE_HOST_CLASS = 'grandma-guard-fade-host';
  const OPEN_BADGE_ID = 'grandma-guard-open-scam-badge';
  const OPEN_TIP_ID = 'grandma-guard-open-scam-tip';
  const OPEN_ACTIONS_ID = 'grandma-guard-open-scam-actions';
  const OPEN_NOT_SCAM_ID = 'grandma-guard-open-not-scam';
  const DISMISS_CLASS = 'grandma-guard-not-scam';
  const CONSENT_ID = 'grandma-guard-learn-consent';
  const UNDO_TOAST_ID = 'grandma-guard-not-scam-undo';
  const VERSION_NOTICE_ID = 'grandma-guard-version-notice';
  const YAHOO_NOT_SCAM_VALUE = 'grandmaGuardNotScam';
  const PRIVACY_POLICY_URL = 'https://grandmaguard.nokaangel.dev/privacy/';
  const ALERT_COOLDOWN_MS = 5 * 60 * 1000;
  const UNDO_WINDOW_MS = 12 * 1000;
  const EXTENSION_VERSION = String(extensionApi.runtime?.getManifest?.().version || '');
  const warnedKeys = new Map();
  const stickyMarkedKeys = new Map();
  const learnedHintKeys = new Set();
  const yahooToolbarPending = new WeakMap();
  let learnedPatterns = [];
  let safePatterns = [];
  let localLearningEnabled = false;
  let learningConsent = 'unset';
  let protectionLevel = 'standard';
  let afterScamUntil = 0;
  let shoppingModeEnabled = false;
  let learnedBadLinkHosts = [];
  let consentPromptShown = false;
  let versionNoticeShown = false;
  let pendingSafeUndo = null;
  let undoTimer = null;
  let debounceTimer = null;
  let learnedLoadedAt = 0;
  let applyingMarks = false;
  let scanInFlight = false;

  function scamSeverity(score, kind) {
    if (kind === 'link') {
      return { key: 'likely', label: 'Bad link' };
    }
    const value = Number(score) || 0;
    if (value >= 10) {
      return { key: 'likely', label: 'Likely scam' };
    }
    return { key: 'possible', label: 'Possible scam' };
  }

  function findSubjectCell(row) {
    return row.querySelector([
      '[id^="email-subject-"]',
      '[data-test-id="message-subject"]',
      '[data-test-id="subject"]',
      '[data-test-id="email-list-subject"]',
      '[data-test-id*="subject"]',
      '[data-testid="message-subject"]',
      '[data-automationid="MessageSubject"]',
      '[data-automation-id="messageHeaderSubject"]',
      '[data-automation-id="MessageHeaderSubject"]',
      '.message-title',
      '.subj',
      'td.subj',
      'div.subj',
      '.subject',
      'td.subject',
      '.y6',
      '.bog',
      '[data-test-subject]'
    ].join(', '));
  }

  function findSenderCell(row) {
    const exact = row.querySelector([
      '[data-test-id="senders"]',
      '[data-test-id="sender"]',
      '[data-test-id="from"]',
      '[data-test-id="email-list-sender"]',
      '[data-test-id*="sender"]',
      '[data-test-id*="from"]',
      '[data-testid="message-sender"]',
      '[data-automationid="MessageSender"]',
      '[data-automation-id="messageHeaderFrom"]',
      '.yW',
      '.yX',
      '.from',
      'td.from',
      'div.from',
      'span.from',
      '[data-test-sender]',
      '.sender'
    ].join(', '));
    if (exact) {
      return exact;
    }

    // New Yahoo list rows sometimes omit stable sender test ids.
    const subject = findSubjectCell(row);
    const nodes = Array.from(row.querySelectorAll('span, a, div, p')).slice(0, 40);
    for (const node of nodes) {
      if (subject && (node === subject || subject.contains(node) || node.contains(subject))) {
        continue;
      }
      if (node.closest?.(`.${PILL_CLASS}`)) {
        continue;
      }
      const text = String(node.textContent || '').replace(/\s+/g, ' ').trim();
      if (text.length < 2 || text.length > 64) {
        continue;
      }
      if (/^(?:possible|likely)\s+scam$/i.test(text)) {
        continue;
      }
      // Prefer leaf-ish nodes that look like a From label.
      if (node.querySelector?.('input, button, svg, img')) {
        continue;
      }
      return node;
    }
    return null;
  }

  function sanitizeExtractedText(value) {
    return String(value || '')
      .replace(/\b(?:Possible|Likely)\s+Scam(?:\s+link)?\b/gi, ' ')
      .replace(/\bNot a scam\b/gi, ' ')
      .replace(/\b(?:unread-message-status|email-(?:sender|subject-snippet|subject|date|message-actions))-\d{2}_\d+\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isInternalMailLabel(value) {
    const text = String(value || '').trim();
    if (!text) {
      return true;
    }
    if (/^(?:unread-message-status|email-(?:sender|subject-snippet|subject|date|message-actions))-\d{2}_\d+$/i.test(text)) {
      return true;
    }
    if (/^email-[a-z0-9-]+-\d{2}_\d+$/i.test(text)) {
      return true;
    }
    return /^[a-z0-9_-]{8,}$/i.test(text) && text.includes('-00_') && !/\s/.test(text);
  }

  function cleanMailField(value) {
    const text = sanitizeExtractedText(value);
    return isInternalMailLabel(text) ? '' : text;
  }

  function isHumanMailLabel(value) {
    const text = cleanMailField(value);
    if (text.length < 2) {
      return false;
    }
    return /[a-zA-Z]/.test(text);
  }

  function hasAnalyzableMailFields(fields) {
    if (!fields) {
      return false;
    }
    if (isHumanMailLabel(fields.sender) || isHumanMailLabel(fields.subject)) {
      return true;
    }
    const snippet = cleanMailField(fields.snippet);
    return snippet.length >= 12 && isHumanMailLabel(snippet);
  }

  function normalizeMailListRow(node) {
    if (!node?.closest) {
      return node;
    }
    if (node.matches?.([
      'li',
      'tr.zA',
      'tr[role="row"]',
      '.list-view-item',
      '.list-view-item-container',
      '.btn-msglist',
      '[data-test-id="message-list-item"]',
      '[data-test-id="message-item"]',
      '[data-automationid="MessageListItem"]',
      '.msglistitem'
    ].join(', '))) {
      return node;
    }
    return node.closest([
      'li',
      'tr.zA',
      'tr[role="row"]',
      '.list-view-item',
      '.list-view-item-container',
      '.btn-msglist',
      '[data-test-id="message-list-item"]',
      '[data-test-id="message-item"]',
      '[data-automationid="MessageListItem"]',
      '.msglistitem'
    ].join(', ')) || node;
  }

  function boundedText(element, maximum) {
    if (!element) return '';
    try {
      return sanitizeExtractedText(
        String(element.innerText || element.textContent || '')
      ).slice(0, maximum);
    } catch {
      return '';
    }
  }

  function boundedTextWithoutGuardUi(element, maximum) {
    if (!element) return '';
    try {
      const clone = element.cloneNode(true);
      clone.querySelectorAll([
        `.${PILL_CLASS}`,
        `.${DISMISS_CLASS}`,
        `.${LEGACY_OVERLAY_CLASS}`,
        `.${LEGACY_LABEL_CLASS}`,
        `#${OPEN_ACTIONS_ID}`,
        `#${OPEN_BADGE_ID}`,
        `#${OPEN_NOT_SCAM_ID}`
      ].join(', ')).forEach((node) => node.remove());
      return sanitizeExtractedText(
        String(clone.innerText || clone.textContent || '')
      ).slice(0, maximum);
    } catch {
      return boundedText(element, maximum);
    }
  }

  function firstText(root, selectors, maximum) {
    if (!root) return '';
    for (const selector of selectors) {
      const element = root.querySelector(selector);
      if (!element || element.closest?.(`.${PILL_CLASS}, .${DISMISS_CLASS}, #${OPEN_ACTIONS_ID}, #${OPEN_NOT_SCAM_ID}`)) {
        continue;
      }
      const text = boundedTextWithoutGuardUi(element, maximum);
      if (text) {
        return text;
      }
    }
    return '';
  }

  function reasonTooltip(reasons, fallback) {
    const lines = Array.isArray(reasons) ? reasons.filter(Boolean).slice(0, 4) : [];
    if (lines.length === 0) {
      return fallback || 'Grandma Guard: possible scam email.';
    }
    return `Grandma Guard: possible scam. ${lines.join('; ')}.`;
  }

  function messageRoots() {
    return Array.from(document.querySelectorAll([
      '.a3s',
      '.ii.gt',
      '[role="listitem"] .a3s',
      'div[aria-label*="Message body"]',
      '.message-content',
      '[data-test-id="message-view"]'
    ].join(', '))).slice(0, 20);
  }

  function collectCandidateLinks() {
    const roots = messageRoots();
    const seen = new Set();
    const candidates = [];

    for (const root of roots) {
      const contextText = boundedText(root, 8000);
      for (const anchor of Array.from(root.querySelectorAll('a[href^="http"]')).slice(0, 120)) {
        const href = anchor.href || anchor.getAttribute('href') || '';
        if (!href || seen.has(href)) {
          continue;
        }
        seen.add(href);
        candidates.push({
          href,
          linkText: boundedText(anchor, 500),
          contextText
        });
      }
    }

    return candidates;
  }

  function collectLinksFromRoot(root, limit = 24) {
    if (!root) {
      return [];
    }
    const seen = new Set();
    const links = [];
    const contextText = boundedText(root, 4000);

    for (const anchor of Array.from(root.querySelectorAll('a[href^="http"]')).slice(0, 120)) {
      const href = anchor.href || anchor.getAttribute('href') || '';
      if (!href || seen.has(href)) {
        continue;
      }
      seen.add(href);
      links.push({
        href,
        linkText: boundedText(anchor, 300),
        contextText
      });
      if (links.length >= limit) {
        break;
      }
    }

    return links;
  }

  function extractRowFields(row) {
    const aria = sanitizeExtractedText(
      String(row.getAttribute('aria-label') || row.getAttribute('aria-labelledby') || '')
    );
    const fullRowText = boundedTextWithoutGuardUi(row, 2500);

    const yahooOldSenderNode = row.querySelector('[id^="email-sender-"]');
    const yahooOldSubjectNode = row.querySelector('[id^="email-subject-snippet-"], [id^="email-subject-"]');

    let sender = cleanMailField(
      (yahooOldSenderNode ? boundedTextWithoutGuardUi(yahooOldSenderNode, 200) : '') ||
      firstText(row, [
      // Yahoo new
      '[data-test-id="senders"]',
      '[data-test-id="sender"]',
      '[data-test-id="from"]',
      '[data-test-id="email-list-sender"]',
      '[data-test-id*="sender"]',
      // Yahoo old / neo / basic
      '.from name',
      '.from span:not(.grandma-guard-scam-pill)',
      '.from',
      'td.from',
      'div.from',
      '.sender',
      // Gmail
      '.yW .zF',
      '.yW .yP',
      '.yW span[email]',
      '.yW span:not(.grandma-guard-scam-pill)',
      'span[name]',
      '[data-test-sender]',
      '.email-sender'
    ], 200) || cleanMailField((aria.split(/[,|]/)[0] || '').trim())
    );

    let subject = cleanMailField(
      (yahooOldSubjectNode ? boundedTextWithoutGuardUi(yahooOldSubjectNode, 900) : '') ||
      boundedTextWithoutGuardUi(row.querySelector([
        '[id^="email-subject-"]',
        '[data-test-id="message-subject"]',
        '[data-test-id="subject"]',
        '[data-test-id="email-list-subject"]',
        '[data-test-id*="subject"]',
        // Yahoo old / neo / basic
        '.subj',
        'td.subj',
        'div.subj',
        '.subject',
        'td.subject',
        // Gmail
        '.y6',
        '.xT',
        '[data-test-subject]'
      ].join(', ')), 900) ||
      firstText(row, [
        '[id^="email-subject-"]',
        '[data-test-id="message-subject"]',
        '[data-test-id="subject"]',
        '[data-test-id*="subject"]',
        '.subj',
        '.subject',
        '.bog',
        '.bqe',
        '[data-test-subject]'
      ], 900)
    );
    // New Yahoo often shows "Subject · snippet" without a dedicated subject node.
    if (!subject && sender) {
      const withoutSender = sanitizeExtractedText(
        fullRowText.replace(sender, ' ')
      );
      const subjectGuess = cleanMailField(
        withoutSender
          .split(/\s*[·•|]\s*/)[0]
          .replace(/\b(?:AM|PM)\b.*$/i, '')
          .replace(/\b\d{1,2}:\d{2}\b.*$/i, '')
          .trim()
      );
      if (subjectGuess.length >= 4 && subjectGuess.length <= 220) {
        subject = subjectGuess;
      }
    }

    const snippet = cleanMailField(firstText(row, [
      '[data-test-id="snippet"]',
      '[data-test-id="email-list-snippet"]',
      '[data-test-id="message-snippet"]',
      // Yahoo old / neo / basic
      '.snip',
      '.snippet',
      'td.snippet',
      'div.snippet',
      '.preview',
      // Gmail
      '.y2',
      '.a4W',
      'span.y2',
      '[data-test-snippet]'
    ], 900));

    const emailAttrNode = row.querySelector([
      'span[email]',
      '[email]',
      '[data-email]',
      '[data-test-id*="email-address"]',
      'a[href^="mailto:"]'
    ].join(', '));
    const attrEmail = emailAttrNode?.getAttribute?.('email') ||
      emailAttrNode?.getAttribute?.('data-email') ||
      '';
    const mailto = emailAttrNode?.getAttribute?.('href') || '';
    const titleEmailBits = Array.from(row.querySelectorAll('[title*="@"]'))
      .map((node) => node.getAttribute('title') || '')
      .join('\n');
    const fromAddress = (
      typeof detection.extractEmailAddress === 'function'
        ? (
          detection.extractEmailAddress(attrEmail) ||
          detection.extractEmailAddress(mailto) ||
          detection.extractEmailAddress(sender) ||
          detection.extractEmailAddress(titleEmailBits) ||
          detection.extractEmailAddress(aria) ||
          detection.extractEmailAddress(fullRowText)
        )
        : ''
    );

    return {
      row,
      sender,
      fromAddress,
      subject,
      snippet,
      bodyText: sanitizeExtractedText(`${aria}\n${sender}\n${subject}\n${snippet}\n${fullRowText}`).slice(0, 4000)
    };
  }

  function looksLikeMailRow(row, fields) {
    if (!row || !hasAnalyzableMailFields(fields)) {
      return false;
    }
    // Skip Yahoo inner cells that were mistaken for whole rows.
    if (/^email-(?:sender|subject|date|message-actions|subject-snippet)/i.test(String(row.id || '')) &&
      !row.querySelector('[role="checkbox"], input[type="checkbox"]')) {
      return false;
    }
    if (row.closest([
      'nav',
      '[data-test-id="folder-list"]',
      '[data-test-id="mail-left-rail"]',
      '#folder-list',
      '.listnav',
      '.listnav-outter'
    ].join(', '))) {
      return false;
    }
    // Skip Yahoo old list header row.
    if (row.classList?.contains('list-header') || row.querySelector('.list-header, .col-hd')) {
      return false;
    }
    // Skip list/page containers that wrap many messages (caused empty UI after dedupe).
    const checkboxCount = row.querySelectorAll('[role="checkbox"], input[type="checkbox"]').length;
    if (checkboxCount > 2) {
      return false;
    }
    const text = fields.bodyText || '';
    if (text.trim().length < 12) {
      return false;
    }
    const hasYahooMessageChrome = Boolean(
      row.querySelector([
        '[data-test-id="senders"]',
        '[data-test-id="sender"]',
        '[id^="email-subject-"]',
        '[data-test-id="message-subject"]',
        '[data-test-id="subject"]',
        '[data-test-id="email-list-subject"]',
        '[data-test-id="unread-indicator"]',
        'span[role="checkbox"]',
        '.from',
        '.subj'
      ].join(', '))
    );
    if (
      row.matches([
        'tr.zA',
        '[data-test-id="message-item"]',
        '[data-test-id="message-list-item"]',
        'li[data-test-id*="message"]',
        '.list-view-item',
        '.list-view-item-container',
        '.btn-msglist'
      ].join(', ')) ||
      row.closest([
        '[data-test-id="virtual-list-container"]',
        '[data-test-id="message-list"]',
        '#mail-reader-container',
        '#msg-list',
        '#inboxcontainer',
        '.list-view-items',
        '#message-list',
        'table.listtable',
        '.AO'
      ].join(', '))
    ) {
      // For Yahoo virtual list nodes, require message chrome so list wrappers are skipped.
      if (row.closest('[data-test-id="virtual-list-container"]') && !hasYahooMessageChrome) {
        return Boolean(fields.sender && fields.subject);
      }
      return true;
    }
    return Boolean(
      (fields.sender && fields.subject) ||
      fields.snippet ||
      /@|inbox|won|claim|reward|account|verify/i.test(text)
    );
  }

  function collectYahooNewRows() {
    const containers = Array.from(document.querySelectorAll(
      '#mail-reader-container [data-test-id="virtual-list-container"], [data-test-id="virtual-list-container"]'
    ));
    if (containers.length === 0) {
      return [];
    }

    const seen = new Set();
    const candidates = [];
    for (const container of containers) {
      const rows = Array.from(container.querySelectorAll('li')).filter((row) => {
        if (seen.has(row)) {
          return false;
        }
        // Prefer leaf rows that look like one message (checkbox / subject / unread).
        const chrome = row.querySelector([
          '[data-test-id="unread-indicator"]',
          '[id^="email-subject-"]',
          '[data-test-id="senders"]',
          'span[role="checkbox"]',
          'input[type="checkbox"]'
        ].join(', '));
        if (!chrome) {
          return false;
        }
        // Skip wrappers that contain other qualifying lis.
        if (row.querySelector('li [data-test-id="unread-indicator"], li [id^="email-subject-"], li span[role="checkbox"]')) {
          return false;
        }
        return true;
      });

      for (const row of rows.slice(0, 160)) {
        seen.add(row);
        const fields = extractRowFields(row);
        if ((fields.bodyText || '').trim().length < 12) {
          continue;
        }
        candidates.push(fields);
      }
    }
    return candidates;
  }

  function collectInboxRows() {
    const yahooNew = collectYahooNewRows();
    if (yahooNew.length > 0) {
      return yahooNew.slice(0, 120);
    }

    const selectors = [
      // Yahoo Mail (new fallback)
      '#mail-reader-container [data-test-id="virtual-list-container"] li',
      '[data-test-id="virtual-list-container"] li',
      '[data-test-id="message-list"] li',
      'li:has([data-test-id="senders"])',
      'li:has([id^="email-subject-"])',
      'li:has([data-test-id="unread-indicator"])',
      'li[data-test-id*="message"]',
      '[data-test-id="message-list-item"]',
      '[data-test-id="message-item"]',
      // Yahoo Mail (old / neo)
      '#msg-list .list-view-item',
      '#msg-list .list-view-item-container',
      '#msg-list .btn-msglist',
      '#msg-list [role="row"]:not(.list-header)',
      '.list-view-items .list-view-item',
      '.list-view-items .list-view-item-container',
      '.list-view-item',
      '.list-view-item-container',
      // Yahoo Basic Mail (/b/)
      '#message-list tr',
      '#msglist tr',
      'table.listtable tbody tr',
      'table.msglist tbody tr',
      '.msglistitem',
      // Gmail (inbox, spam, tabs)
      'tr.zA',
      'tr[role="row"].zA',
      'div[role="row"].zA',
      'table[role="grid"] tr.zA',
      // Outlook / Office pop-out and reading lists
      '[role="listbox"] [role="option"]',
      '[data-convid]',
      '[data-automationid="MessageListItem"]',
      // iCloud Mail
      '.message-list-item',
      '.message-item',
      // Fastmail / Tutanota list rows
      '.messageRow',
      '.mail-row',
      // Generic / Proton / Outlook-ish (kept after Yahoo-specific selectors)
      '[role="listitem"]',
      '[role="option"]',
      'li[data-id]',
      '.mail-list-item'
    ].join(', ');

    const seen = new Set();
    const candidates = [];
    let matched = [];
    try {
      matched = Array.from(document.querySelectorAll(selectors));
    } catch {
      // Some older engines reject :has(); fall back without those selectors.
      matched = Array.from(document.querySelectorAll(selectors.replace(/[^,]*:has\([^)]*\)\s*,?/g, '')));
    }
    for (const rawRow of matched.slice(0, 300)) {
      const row = normalizeMailListRow(rawRow);
      if (seen.has(row)) {
        continue;
      }
      seen.add(row);
      const fields = extractRowFields(row);
      if (!looksLikeMailRow(row, fields)) {
        continue;
      }
      candidates.push(fields);
    }

    // Keep innermost message rows only (avoid one parent wrapper swallowing the list).
    return candidates.filter((item) =>
      !candidates.some((other) => other.row !== item.row && item.row.contains(other.row))
    ).slice(0, 120);
  }

  function isInsideMessageBody(node) {
    return Boolean(node?.closest?.([
      '[data-test-id="message-view-body-detail"]',
      '[data-test-id="message-view-body"]',
      '[data-test-id="message-body"]',
      '.msg-body',
      '.msg-body-content',
      '.message-content',
      '.a3s',
      '.ii.gt',
      '[data-testid="message-body"]',
      '#message-content',
      '.thread-body',
      '[data-app-section="ConversationContainer"] [role="document"]',
      '[data-automation-id="ReadingPaneContent"]',
      '#ItemContent',
      '.wide-content-host',
      'iframe'
    ].join(', ')));
  }

  function isInsideMessageHeader(node) {
    return Boolean(node?.closest?.([
      '[data-test-id="message-group-header"]',
      '[data-test-id="message-header"]',
      '[data-testid="message-header"]',
      '.message-header',
      '#msg-read .hdr',
      '.mail-header',
      '.thread-header',
      '.gH',
      '.ha',
      '#conversation-header',
      '[data-app-section="ReadingPane"] [role="heading"]',
      '[data-automation-id="MessageHeaderContainer"]',
      '[data-automation-id="messageHeaderContainer"]',
      '[data-testid="message-header"]'
    ].join(', ')));
  }

  function isInsideMailList(node) {
    return Boolean(node?.closest?.(
      '[data-test-id="virtual-list-container"], #msg-list, #message-list, table.listtable, .list-view-items, tr.zA, [data-app-section="MessageList"], [data-automation-id="MessageList"], [data-automation-id="messageList"], [role="listbox"], .AO .Cp, [data-testid="message-list"]'
    ));
  }

  function getYahooReadingRoot() {
    const selectors = [
      '[data-test-id="message-group-view"]',
      '[data-test-id="message-pane"]',
      '[data-test-id="message-view"]',
      '#msg-read',
      '#message-view'
    ];

    for (const selector of selectors) {
      for (const node of Array.from(document.querySelectorAll(selector))) {
        if (isInsideMailList(node)) {
          continue;
        }
        const body = node.querySelector([
          '[data-test-id="message-view-body-detail"]',
          '[data-test-id="message-view-body"]',
          '[data-test-id="message-body"]',
          '.message-content',
          '.msg-body',
          '.msg-body-content',
          '#message-content',
          '.thread-body'
        ].join(', '));
        if (!body || isInsideMailList(body)) {
          continue;
        }
        if (boundedText(body, 400).length >= 40) {
          return node;
        }
      }
    }

    return null;
  }

  function isReadingPaneVisible() {
    const bodySelectors = [
      '[data-test-id="message-view-body-detail"]',
      '[data-test-id="message-view-body"]',
      '[data-test-id="message-body"]',
      '#msg-read .msg-body',
      '#msg-read .msg-body-content',
      '.msg-body-content',
      '.a3s.aiL',
      '.ii.gt .a3s',
      '[data-testid="message-body"]',
      '#message-content',
      '[data-app-section="ConversationContainer"] [role="document"]',
      '[data-automation-id="ReadingPaneContent"]',
      '#ReadingPaneContainerId [role="document"]',
      '#ItemContent',
      '.wide-content-host'
    ];

    for (const selector of bodySelectors) {
      for (const body of Array.from(document.querySelectorAll(selector))) {
        if (isInsideMailList(body)) {
          continue;
        }
        const rect = body.getBoundingClientRect();
        if (rect.width < 200 || rect.height < 80 || rect.bottom <= 0 || rect.right <= 0) {
          continue;
        }
        if (boundedText(body, 300).length >= 40) {
          return true;
        }
      }
    }
    return false;
  }

  function hasSubstantialOpenContent(message) {
    if (!message) {
      return false;
    }
    const bodyLength = String(message.bodyText || message.snippet || '').trim().length;
    if (bodyLength >= 40) {
      return true;
    }
    return Boolean(
      String(message.subject || '').trim() &&
      String(message.sender || message.fromAddress || '').trim() &&
      isReadingPaneVisible()
    );
  }

  function getReadingRoot() {
    if (isYahooHost()) {
      const yahooRoot = getYahooReadingRoot();
      if (yahooRoot) {
        return yahooRoot;
      }
    }

    const candidates = Array.from(document.querySelectorAll([
      // Yahoo new reading pane (must not be the virtual inbox list)
      '[data-test-id="message-group-view"]',
      '#message-group-view',
      '[data-test-id="message-pane"]',
      '[data-test-id="mail-reader"] [data-test-id="message-view"]',
      // Yahoo old / neo / basic
      '#msg-read',
      '#message-view',
      // Gmail open thread body host
      '.nH .aHU',
      '.nH.hx',
      // Outlook reading pane
      '#ReadingPaneContainerId',
      '.ReadingPaneContainer',
      '[role="main"] [data-app-section="ReadingPane"]',
      '[data-app-section="ConversationContainer"]',
      // Proton Mail
      '[data-testid="readingPane"]',
      '[data-test-id="message-view-body-detail"]'
    ].join(', '))).filter((node) => !isInsideMailList(node));

    for (const root of candidates) {
      const body = root.querySelector([
        '.a3s',
        '.ii.gt .a3s',
        '[data-test-id="message-view"]',
        '[data-test-id="message-body"]',
        '[data-test-id="message-view-body-detail"]',
        '.message-content',
        '.msg-body',
        '.msg-body-content',
        '.thread-body',
        '#message-content',
        '[data-testid="message-body"]',
        '.body',
        '#ItemContent'
      ].join(', ')) || root;
      if (boundedText(body, 400).length >= 40) {
        return root;
      }
    }

    // Gmail fallback: open message body outside the inbox table.
    const gmailBody = document.querySelector('.a3s.aiL, .ii.gt .a3s, .a3s');
    if (gmailBody && !isInsideMailList(gmailBody) && boundedText(gmailBody, 400).length >= 40) {
      return gmailBody.closest('.nH') || gmailBody;
    }
    return null;
  }

  function isReadingMessage() {
    return Boolean(getReadingRoot());
  }

  function collectOpenMessage() {
    const root = getReadingRoot();
    if (!root) {
      return null;
    }

    const subjectAnchor = findOpenSubjectAnchor(root, null);
    const subject = subjectAnchor
      ? cleanMailField(boundedTextWithoutGuardUi(subjectAnchor, 500))
      : cleanMailField(firstText(root, [
        'h2.hP',
        '[data-test-id="message-subject"]',
        '[data-test-id="message-group-subject"]',
        '[data-testid="message-header:subject"]',
        '[data-testid="message-subject"]',
        '[data-automation-id="messageHeaderSubject"]',
        '[data-automation-id="MessageHeaderSubject"]',
        '[id^="email-subject-"]',
        '.message-subject',
        '#msg-read .subject',
        '#msg-read .subject-line',
        '.thread-subject'
      ], 500));
    const sender = cleanMailField(firstText(root, [
      'span.gD',
      'span[email].gD',
      '.gD',
      '[data-test-id="message-sender"]',
      '[data-test-id="message-from"]',
      '[data-test-id="from"]',
      '[data-test-id="message-from-text"]',
      '[data-testid="message-header:sender"]',
      '[data-automation-id="messageHeaderFrom"]',
      '[data-automation-id="MessageHeaderFrom"]',
      '.from',
      '.sender'
    ], 200));
    const bodyRoot = root.querySelector([
      '.a3s',
      '.ii.gt .a3s',
      '[data-test-id="message-view"]',
      '[data-test-id="message-body"]',
      '[data-test-id="message-view-body-detail"]',
      '.message-content',
      '.msg-body',
      '.msg-body-content',
      '.thread-body',
      '#message-content',
      '[data-testid="message-body"]',
      '.body',
      '#ItemContent'
    ].join(', ')) || root;
    const bodyText = boundedText(bodyRoot, 12000);
    const senderNode = root.querySelector([
      'span[email].gD',
      'span.gD[email]',
      'span[email]',
      '[data-test-id="message-sender"]',
      '[data-test-id="message-from"]',
      '.from'
    ].join(', '));
    const fromAddress = typeof detection.extractEmailAddress === 'function'
      ? (
        detection.extractEmailAddress(senderNode?.getAttribute?.('email') || '') ||
        detection.extractEmailAddress(senderNode?.getAttribute?.('data-email') || '') ||
        detection.extractEmailAddress(senderNode?.getAttribute?.('title') || '') ||
        detection.extractEmailAddress(sender) ||
        detection.extractEmailAddress(bodyText.slice(0, 1500))
      )
      : '';

    // List-only Yahoo can still expose stub panes; require real open-mail content.
    if (!subject && bodyText.length < 80) {
      return null;
    }

    return {
      sender,
      fromAddress,
      subject,
      snippet: bodyText.slice(0, 800),
      bodyText,
      links: collectLinksFromRoot(bodyRoot)
    };
  }

  function resolveOpenMessage() {
    if (!isReadingPaneVisible()) {
      return null;
    }
    const fromPane = collectOpenMessage();
    if (!fromPane) {
      return null;
    }
    return hasSubstantialOpenContent(fromPane) ? fromPane : null;
  }

  function openMessagesMatch(a, b) {
    if (!a || !b) {
      return false;
    }
    const subjectA = String(a.subject || '').trim().toLowerCase();
    const subjectB = String(b.subject || '').trim().toLowerCase();
    if (subjectA && subjectB) {
      if (subjectA === subjectB) {
        return true;
      }
      if (subjectA.length >= 12 && subjectB.includes(subjectA)) {
        return true;
      }
      if (subjectB.length >= 12 && subjectA.includes(subjectB)) {
        return true;
      }
    }
    const senderA = String(a.sender || a.fromAddress || '').trim().toLowerCase();
    const senderB = String(b.sender || b.fromAddress || '').trim().toLowerCase();
    if (senderA && senderB && subjectA && subjectB) {
      return senderA === senderB || senderA.includes(senderB) || senderB.includes(senderA);
    }
    return false;
  }

  function findMarkedOpenResult(openMessage) {
    if (!openMessage || !isReadingPaneVisible()) {
      return null;
    }

    const selected = document.querySelector([
      'li[aria-selected="true"]',
      'li[aria-current="true"]',
      '[data-test-id="message-list-item"][aria-selected="true"]',
      '.list-view-item.selected',
      '.list-view-item-container.selected',
      '.btn-msglist.selected',
      'tr.zA.xE',
      'tr.zA.btb',
      'div[role="row"].xE',
      'div[role="row"].btb',
      '[role="option"][aria-selected="true"]',
      '[data-testid="message-list-item"][aria-selected="true"]'
    ].join(', '));

    const rowCandidates = [];
    if (selected?.getAttribute?.(ROW_MARK) === '1') {
      rowCandidates.push(extractRowFields(selected));
    }
    for (const row of Array.from(document.querySelectorAll(`[${ROW_MARK}="1"]`)).slice(0, 40)) {
      rowCandidates.push(extractRowFields(row));
    }

    for (const item of rowCandidates) {
      if (!openMessagesMatch(openMessage, item)) {
        continue;
      }
      const rowResult = detection.analyzeEmailMessage(withLearning(item));
      if (rowResult.suspicious) {
        return rowResult;
      }
    }

    for (const [key, sticky] of stickyMarkedKeys) {
      const stickyFields = sticky?.fields || {};
      if (!openMessagesMatch(openMessage, stickyFields)) {
        continue;
      }
      return {
        suspicious: true,
        score: sticky.score || 6,
        reasons: sticky.reasons || [],
        dedupeKey: sticky.dedupeKey || key,
        kind: 'reward-bait',
        learnHints: []
      };
    }

    return null;
  }

  function ensureLabelStyles() {
    let style = document.getElementById('grandma-guard-mail-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'grandma-guard-mail-style';
      document.documentElement.append(style);
    }
    // Always refresh so unpacked reloads pick up styles without a full browser restart.
    style.textContent = `
      tr.zA[${ROW_MARK}="1"],
      div[role="row"].zA[${ROW_MARK}="1"],
      [role="listitem"][${ROW_MARK}="1"],
      [role="option"][${ROW_MARK}="1"],
      [data-test-id="message-item"][${ROW_MARK}="1"],
      [data-test-id="message-list-item"][${ROW_MARK}="1"],
      [data-test-id="virtual-list-container"] li[${ROW_MARK}="1"],
      #mail-reader-container li[${ROW_MARK}="1"],
      li[${ROW_MARK}="1"],
      .list-view-item[${ROW_MARK}="1"],
      .list-view-item-container[${ROW_MARK}="1"],
      .btn-msglist[${ROW_MARK}="1"],
      #msg-list [role="row"][${ROW_MARK}="1"],
      #message-list tr[${ROW_MARK}="1"],
      table.listtable tbody tr[${ROW_MARK}="1"],
      .msglistitem[${ROW_MARK}="1"] {
        outline: 1.5px solid #c45c26 !important;
        outline-offset: -1.5px !important;
        box-shadow: inset 3px 0 0 #c45c26 !important;
        background-color: rgba(196, 92, 38, 0.05) !important;
        border-radius: 4px !important;
      }
      tr.zA[${SEVERITY_MARK}="likely"],
      div[role="row"].zA[${SEVERITY_MARK}="likely"],
      [role="listitem"][${SEVERITY_MARK}="likely"],
      [role="option"][${SEVERITY_MARK}="likely"],
      [data-test-id="message-item"][${SEVERITY_MARK}="likely"],
      [data-test-id="message-list-item"][${SEVERITY_MARK}="likely"],
      [data-test-id="virtual-list-container"] li[${SEVERITY_MARK}="likely"],
      #mail-reader-container li[${SEVERITY_MARK}="likely"],
      li[${SEVERITY_MARK}="likely"],
      .list-view-item[${SEVERITY_MARK}="likely"],
      .list-view-item-container[${SEVERITY_MARK}="likely"],
      .btn-msglist[${SEVERITY_MARK}="likely"],
      #msg-list [role="row"][${SEVERITY_MARK}="likely"],
      #message-list tr[${SEVERITY_MARK}="likely"],
      table.listtable tbody tr[${SEVERITY_MARK}="likely"],
      .msglistitem[${SEVERITY_MARK}="likely"] {
        outline: 1.5px solid #9a3412 !important;
        outline-offset: -1.5px !important;
        box-shadow: inset 3px 0 0 #9a3412 !important;
        background-color: rgba(154, 52, 18, 0.07) !important;
      }
      .${FROM_FADED_CLASS} {
        color: rgba(32, 32, 32, 0.45) !important;
      }
      .${FROM_FADED_CLASS} *:not(.${PILL_CLASS}) {
        color: inherit !important;
      }
      .${PILL_CLASS} {
        display: inline-flex !important;
        align-items: center !important;
        margin: 0 !important;
        padding: 2px 9px !important;
        border-radius: 999px !important;
        background: #c45c26 !important;
        color: #fff !important;
        font: 600 11px/1.35 system-ui, sans-serif !important;
        letter-spacing: 0.01em !important;
        white-space: nowrap !important;
        vertical-align: middle !important;
        line-height: 1.2 !important;
        flex-shrink: 0 !important;
        pointer-events: none !important;
        user-select: none !important;
        opacity: 1 !important;
        position: static !important;
        z-index: auto !important;
      }
      .${PILL_HOST_CLASS} {
        display: inline-flex !important;
        align-items: center !important;
        vertical-align: middle !important;
        margin: 0 8px 0 0 !important;
        flex-shrink: 0 !important;
        max-width: 100% !important;
      }
      tr.zA[${ROW_MARK}="1"] .y6,
      tr.zA[${ROW_MARK}="1"] .yX,
      div[role="row"].zA[${ROW_MARK}="1"] .y6,
      [data-automationid="MessageListItem"][${ROW_MARK}="1"],
      [role="option"][${ROW_MARK}="1"] {
        align-items: center !important;
      }
      tr.zA[${ROW_MARK}="1"] td,
      div[role="row"].zA[${ROW_MARK}="1"] {
        vertical-align: middle !important;
      }
      .${PILL_CLASS}[${SEVERITY_MARK}="likely"] {
        background: #9a3412 !important;
        color: #fff !important;
      }
      .${DISMISS_CLASS}:not(#${OPEN_NOT_SCAM_ID}) {
        display: none !important;
        pointer-events: none !important;
      }
      #${OPEN_NOT_SCAM_ID} {
        display: inline-flex !important;
        align-items: center !important;
        margin: 0 0 0 10px !important;
        padding: 6px 12px !important;
        border: 0 !important;
        border-radius: 999px !important;
        background: #0a7658 !important;
        color: #fff !important;
        font: 700 12px/1.2 system-ui, sans-serif !important;
        white-space: nowrap !important;
        cursor: pointer !important;
        pointer-events: auto !important;
        vertical-align: middle !important;
      }
      #${OPEN_ACTIONS_ID} {
        display: flex !important;
        flex-wrap: wrap !important;
        align-items: center !important;
        gap: 8px !important;
        margin: 8px 0 10px !important;
        clear: both !important;
        width: 100% !important;
        max-width: 100% !important;
      }
      #${OPEN_ACTIONS_ID} .${DISMISS_CLASS} {
        display: inline-flex !important;
        align-items: center !important;
        margin: 0 !important;
        padding: 4px 10px !important;
        border: 1px solid rgba(36, 50, 71, 0.28) !important;
        border-radius: 999px !important;
        background: #fff !important;
        color: #243247 !important;
        font: 600 12px/1.3 system-ui, sans-serif !important;
        white-space: nowrap !important;
        cursor: pointer !important;
        pointer-events: auto !important;
        user-select: none !important;
      }
      #${UNDO_TOAST_ID},
      #${VERSION_NOTICE_ID} {
        position: fixed !important;
        left: 50% !important;
        bottom: 24px !important;
        transform: translateX(-50%) !important;
        z-index: 2147483646 !important;
        width: min(440px, calc(100vw - 24px)) !important;
        padding: 14px 16px !important;
        border-radius: 14px !important;
        background: #243247 !important;
        color: #fff !important;
        box-shadow: 0 14px 36px rgba(20, 28, 40, 0.35) !important;
        font: 600 13px/1.4 system-ui, sans-serif !important;
      }
      #${VERSION_NOTICE_ID} {
        bottom: auto !important;
        top: 24px !important;
        background: #fff !important;
        color: #243247 !important;
        border: 1px solid #d7dfeb !important;
      }
      #${VERSION_NOTICE_ID} p,
      #${UNDO_TOAST_ID} p {
        margin: 0 0 10px !important;
        font-weight: 500 !important;
      }
      #${VERSION_NOTICE_ID} a {
        color: #9a3412 !important;
        font-weight: 700 !important;
      }
      #${UNDO_TOAST_ID} .gg-toast-actions,
      #${VERSION_NOTICE_ID} .gg-toast-actions {
        display: flex !important;
        flex-wrap: wrap !important;
        gap: 8px !important;
      }
      #${UNDO_TOAST_ID} button,
      #${VERSION_NOTICE_ID} button {
        border: 0 !important;
        border-radius: 999px !important;
        padding: 7px 12px !important;
        font: 700 12px/1.2 system-ui, sans-serif !important;
        cursor: pointer !important;
      }
      #${UNDO_TOAST_ID} [data-gg-undo="1"] {
        background: #fff !important;
        color: #243247 !important;
      }
      #${UNDO_TOAST_ID} [data-gg-undo-dismiss="1"],
      #${VERSION_NOTICE_ID} button {
        background: #e8eef7 !important;
        color: #243247 !important;
      }
      #${UNDO_TOAST_ID} .gg-fp-report-link {
        align-self: center !important;
        color: #fff !important;
        font: 700 12px/1.2 system-ui, sans-serif !important;
        text-decoration: underline !important;
      }
      .${LEGACY_OVERLAY_CLASS},
      .${LEGACY_LABEL_CLASS}:not(.${PILL_CLASS}):not(.${DISMISS_CLASS}),
      .${LEGACY_FADE_HOST_CLASS} > .${LEGACY_OVERLAY_CLASS} {
        display: none !important;
        pointer-events: none !important;
      }
      #${OPEN_BADGE_ID} {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin: 0;
        padding: 2px 10px;
        border-radius: 999px;
        background: #c45c26;
        color: #fff;
        font: 600 11px/1.3 system-ui, sans-serif;
        cursor: help;
      }
      #${OPEN_BADGE_ID}[${SEVERITY_MARK}="likely"] {
        background: #9a3412;
      }
      .gg-open-scam-tip {
        display: block;
        flex: 1 1 100%;
        margin: 0;
        padding: 10px 12px;
        border-left: 3px solid #c45c26;
        border-radius: 8px;
        background: rgba(196, 92, 38, 0.08);
        color: #5c3d1e;
        font: 500 13px/1.45 system-ui, sans-serif;
        max-width: 42rem;
      }
      #${CONSENT_ID} {
        position: fixed !important;
        inset: 0 !important;
        z-index: 2147483646 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 20px !important;
        background: rgba(20, 28, 40, 0.45) !important;
        font-family: system-ui, sans-serif !important;
      }
      #${CONSENT_ID} .gg-consent-card {
        width: min(440px, 100%) !important;
        padding: 22px 22px 18px !important;
        border-radius: 16px !important;
        background: #fff !important;
        color: #243247 !important;
        box-shadow: 0 18px 50px rgba(20, 28, 40, 0.28) !important;
      }
      #${CONSENT_ID} h2 {
        margin: 0 0 8px !important;
        font-size: 20px !important;
        line-height: 1.25 !important;
      }
      #${CONSENT_ID} p {
        margin: 0 0 12px !important;
        color: #56647b !important;
        font-size: 14px !important;
        line-height: 1.45 !important;
      }
      #${CONSENT_ID} a {
        color: #9a3412 !important;
        font-weight: 700 !important;
      }
      #${CONSENT_ID} .gg-consent-actions {
        display: flex !important;
        flex-wrap: wrap !important;
        gap: 10px !important;
        margin-top: 16px !important;
      }
      #${CONSENT_ID} button {
        border: 0 !important;
        border-radius: 999px !important;
        padding: 9px 14px !important;
        font: 700 13px/1.2 system-ui, sans-serif !important;
        cursor: pointer !important;
      }
      #${CONSENT_ID} [data-gg-consent="allowed"] {
        background: #c45c26 !important;
        color: #fff !important;
      }
      #${CONSENT_ID} [data-gg-consent="declined"] {
        background: #e8eef7 !important;
        color: #243247 !important;
      }
    `;
  }

  function unwrapLegacyFromWraps(row) {
    for (const fade of Array.from(row.querySelectorAll(`.${LEGACY_FROM_FADE_CLASS}`))) {
      const parent = fade.parentElement;
      if (!parent) {
        fade.remove();
        continue;
      }
      while (fade.firstChild) {
        parent.insertBefore(fade.firstChild, fade);
      }
      fade.remove();
    }
    for (const host of Array.from(row.querySelectorAll(`.${LEGACY_FROM_HOST_CLASS}, .${LEGACY_FADE_HOST_CLASS}`))) {
      host.classList.remove(LEGACY_FROM_HOST_CLASS, LEGACY_FADE_HOST_CLASS);
    }
  }

  function cleanupLegacyMarkers(row) {
    unwrapLegacyFromWraps(row);
    for (const node of Array.from(row.querySelectorAll(`.${LEGACY_OVERLAY_CLASS}, .${LEGACY_LABEL_CLASS}`))) {
      if (!node.classList.contains(PILL_CLASS)) {
        node.remove();
      }
    }
  }

  function removeExtraPills(row, keepPill = null) {
    for (const node of Array.from(row.querySelectorAll(`.${PILL_CLASS}`))) {
      if (keepPill && node === keepPill) {
        continue;
      }
      node.remove();
    }
  }

  function purgeOrphanPills() {
    for (const pill of Array.from(document.querySelectorAll(`.${PILL_CLASS}`))) {
      const markedRow = pill.closest(`[${ROW_MARK}="1"]`);
      if (!markedRow) {
        pill.remove();
        continue;
      }
      // Keep a single pill per marked row.
      const pills = Array.from(markedRow.querySelectorAll(`.${PILL_CLASS}`));
      for (const extra of pills.slice(1)) {
        extra.remove();
      }
    }
  }

  function senderCellHasAvatar(senderCell) {
    if (!senderCell) {
      return false;
    }
    return Boolean(senderCell.querySelector([
      'img',
      'svg',
      'picture',
      '[role="img"]',
      '[data-test-id*="avatar"]',
      '[data-testid*="avatar"]',
      '.avatar',
      '.AE',
      '.afV'
    ].join(', ')));
  }

  function pickPillAnchorCell(senderCell, subjectCell, row) {
    if (subjectCell && (senderCellHasAvatar(senderCell) || !senderCell)) {
      return subjectCell;
    }
    if (senderCell) {
      return senderCell;
    }
    return subjectCell || row;
  }

  function placePill(row, pill, senderCell, subjectCell) {
    const anchorCell = pickPillAnchorCell(senderCell, subjectCell, row);
    if (!anchorCell || anchorCell === row) {
      if (pill.parentElement !== row) {
        row.append(pill);
      }
      return 'row';
    }

    let host = null;
    for (const child of Array.from(anchorCell.children)) {
      if (child.classList?.contains(PILL_HOST_CLASS)) {
        host = child;
        break;
      }
    }
    if (!host) {
      host = document.createElement('span');
      host.className = PILL_HOST_CLASS;
      if (anchorCell.firstChild) {
        anchorCell.insertBefore(host, anchorCell.firstChild);
      } else {
        anchorCell.append(host);
      }
    }
    host.append(pill);
    return anchorCell === subjectCell ? 'subject' : 'sender';
  }

  function removeLegacyListSummary() {
    document.getElementById('grandma-guard-list-summary')?.remove();
  }

  function clearStrayNotScamButtons() {
    const readingRoot = getReadingRoot();
    const bar = readingRoot ? findOpenActionsBar(readingRoot, null) : null;
    for (const button of Array.from(document.querySelectorAll(`#${OPEN_NOT_SCAM_ID}`))) {
      if (!bar?.contains(button)) {
        button.remove();
      }
    }
    for (const button of Array.from(document.querySelectorAll(`button.${DISMISS_CLASS}, .${DISMISS_CLASS}`))) {
      if (button.id === OPEN_NOT_SCAM_ID) {
        continue;
      }
      button.remove();
    }
  }

  function clearRowMark(row) {
    row.removeAttribute(ROW_MARK);
    row.removeAttribute(SEVERITY_MARK);
    row.removeAttribute('title');
    for (const node of Array.from(row.querySelectorAll(`.${PILL_CLASS}, .${DISMISS_CLASS}, .${PILL_HOST_CLASS}`))) {
      node.remove();
    }
    for (const faded of Array.from(row.querySelectorAll(`.${FROM_FADED_CLASS}`))) {
      faded.classList.remove(FROM_FADED_CLASS);
    }
  }

  function hideUndoToast() {
    clearTimeout(undoTimer);
    undoTimer = null;
    pendingSafeUndo = null;
    document.getElementById(UNDO_TOAST_ID)?.remove();
  }

  function showUndoToast(fields, hints, previousSticky, reportInput) {
    hideUndoToast();
    ensureLabelStyles();
    pendingSafeUndo = { fields, hints, previousSticky };
    const toast = document.createElement('div');
    toast.id = UNDO_TOAST_ID;

    const toastText = document.createElement('p');
    toastText.textContent = 'Marked as not a scam on this device.';

    const toastActions = document.createElement('div');
    toastActions.className = 'gg-toast-actions';

    const undoButton = document.createElement('button');
    undoButton.type = 'button';
    undoButton.setAttribute('data-gg-undo', '1');
    undoButton.textContent = 'Undo';

    const dismissButton = document.createElement('button');
    dismissButton.type = 'button';
    dismissButton.setAttribute('data-gg-undo-dismiss', '1');
    dismissButton.textContent = 'Dismiss';

    toastActions.append(undoButton, dismissButton);
    if (reportInput && globalThis.GrandmaGuardFalsePositiveReport) {
      globalThis.GrandmaGuardFalsePositiveReport.appendSuggestLink(
        toastActions,
        reportInput,
        'Report for everyone'
      );
    }
    toast.append(toastText, toastActions);
    toast.addEventListener('click', (event) => {
      const target = event.target;
      if (target?.getAttribute?.('data-gg-undo') === '1') {
        undoNotScamMark();
      } else if (target?.getAttribute?.('data-gg-undo-dismiss') === '1') {
        hideUndoToast();
      }
    });
    document.documentElement.append(toast);
    undoTimer = setTimeout(hideUndoToast, UNDO_WINDOW_MS);
  }

  async function undoNotScamMark() {
    const pending = pendingSafeUndo;
    hideUndoToast();
    if (!pending) {
      return;
    }
    try {
      await extensionApi.runtime.sendMessage({
        type: 'email-learn-safe-undo',
        hints: pending.hints || []
      });
      learnedLoadedAt = 0;
      await refreshLearnedPatterns(true);
    } catch {
      // Fall through and restore UI if possible.
    }
    if (pending.previousSticky?.dedupeKey) {
      stickyMarkedKeys.set(pending.previousSticky.dedupeKey, pending.previousSticky);
    }
    scheduleScan();
  }

  async function markOpenMessageNotScam(result, openMessage) {
    if (!localLearningEnabled) {
      return;
    }
    const fields = {
      sender: openMessage.sender || '',
      fromAddress: openMessage.fromAddress || '',
      subject: openMessage.subject || '',
      bodyText: openMessage.bodyText || '',
      dedupeKey: result.dedupeKey || ''
    };
    const hints = typeof detection.buildMailSafeHints === 'function'
      ? detection.buildMailSafeHints(fields)
      : [];
    const previousSticky = fields.dedupeKey
      ? stickyMarkedKeys.get(fields.dedupeKey) || {
        reasons: result.reasons || [],
        score: result.score || 0,
        fields,
        dedupeKey: fields.dedupeKey
      }
      : null;
    if (fields.dedupeKey) {
      stickyMarkedKeys.delete(fields.dedupeKey);
    }
    clearOpenBadge();
    try {
      await extensionApi.runtime.sendMessage({
        type: 'email-learn-safe-patterns',
        hints
      });
      learnedLoadedAt = 0;
      await refreshLearnedPatterns(true);
    } catch {
      // Still offer undo for a local retry path.
    }
    const fp = globalThis.GrandmaGuardFalsePositiveReport;
    const reportInput = fp ? {
      type: 'email',
      fromAddress: fields.fromAddress,
      domain: fp.extractFromDomain(fields.fromAddress),
      mailHost: location.hostname,
      reasons: previousSticky?.reasons || result.reasons || []
    } : null;
    showUndoToast(fields, hints, previousSticky, reportInput);
    scheduleScan();
  }

  function isYahooHost() {
    const host = location.hostname.toLowerCase();
    return host === 'mail.yahoo.com' || host.endsWith('.mail.yahoo.com');
  }

  function findYahooActionSelects() {
    const seen = new Set();
    const matches = [];
    const push = (node) => {
      if (!node || seen.has(node)) {
        return;
      }
      seen.add(node);
      matches.push(node);
    };

    for (const select of Array.from(document.querySelectorAll('select[name^="toolbar_option"]'))) {
      push(select);
    }
    for (const select of Array.from(document.querySelectorAll('select[aria-label="Actions"]'))) {
      push(select);
    }
    for (const select of Array.from(document.querySelectorAll(
      '[data-test-id="toolbar-actions"] select, [data-test-id="message-toolbar"] select'
    ))) {
      push(select);
    }

    return matches;
  }

  function yahooSelectDefaultValue(select) {
    const placeholder = select.querySelector('option[data-test-id="actions"], option[value="noAction"]');
    if (placeholder) {
      return placeholder.value;
    }
    return select.options.length > 0 ? select.options[0].value : '';
  }

  function findYahooActionMenus() {
    return Array.from(document.querySelectorAll('ul[data-test-id="navigable-list"][role="menu"]'))
      .filter((menu) => menu.querySelector('[data-test-id="menu-list-item-link"]'));
  }

  function findYahooMenuTemplate(menu) {
    return menu.querySelector('li[role="presentation"] [data-test-id="menu-list-item"]')
      ?.closest('li[role="presentation"]') || null;
  }

  function findYahooMenuInsertBefore(menu) {
    const blockSender = menu.querySelector('[data-test-id="menu-list-item"][title="Block sender"]');
    if (blockSender) {
      return blockSender.closest('li[role="presentation"]');
    }
    const divider = Array.from(menu.querySelectorAll('li[role="presentation"]')).find((item) =>
      !item.querySelector('[data-test-id="menu-list-item"]')
    );
    return divider || null;
  }

  function decorateYahooNotScamMenuItem(item) {
    item.setAttribute('data-gg-not-scam-item', '1');

    const row = item.querySelector('[data-test-id="menu-list-item"]');
    if (row) {
      row.setAttribute('title', 'Not a scam');
    }

    const link = item.querySelector('[data-test-id="menu-list-item-link"]');
    if (link) {
      link.setAttribute('aria-label', 'Not a scam');
      link.setAttribute('data-gg-not-scam-link', '1');
      link.setAttribute('href', '#');
    }

    for (const label of Array.from(item.querySelectorAll('span.A_6EGz, .G_e'))) {
      label.textContent = 'Not a scam';
    }

    const icon = item.querySelector('svg');
    if (icon) {
      icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = '<path d="M12 2.8 4.5 6v5.3c0 4.7 3.1 9 7.5 10.2 4.4-1.2 7.5-5.5 7.5-10.2V6L12 2.8zm-1.1 12.4-2.8-2.8 1.3-1.3 1.5 1.5 3.7-3.7 1.3 1.3-5 5z"></path>';
    }

    for (const badge of Array.from(item.querySelectorAll('[data-test-id="badge"]'))) {
      badge.replaceChildren();
    }
  }

  function bindYahooNotScamMenu(menu) {
    if (menu.dataset.ggNotScamMenuBound === '1') {
      return;
    }
    menu.dataset.ggNotScamMenuBound = '1';
    menu.addEventListener('click', async (event) => {
      const link = event.target?.closest?.('[data-gg-not-scam-link="1"]');
      if (!link) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const pending = yahooToolbarPending.get(menu);
      if (!pending || !localLearningEnabled || pending.result?.kind === 'link') {
        return;
      }
      await markOpenMessageNotScam(pending.result, pending.openMessage);
    }, true);
  }

  function syncYahooNotScamMenuItems(result, openMessage) {
    for (const menu of findYahooActionMenus()) {
      bindYahooNotScamMenu(menu);
      yahooToolbarPending.set(menu, { result, openMessage });

      let item = menu.querySelector('li[data-gg-not-scam-item="1"]');
      if (!item) {
        const template = findYahooMenuTemplate(menu);
        if (!template) {
          continue;
        }
        item = template.cloneNode(true);
        decorateYahooNotScamMenuItem(item);
        const insertBefore = findYahooMenuInsertBefore(menu);
        if (insertBefore) {
          menu.insertBefore(item, insertBefore);
        } else {
          menu.append(item);
        }
      }
    }
  }

  function clearYahooNotScamToolbarOptions() {
    for (const select of findYahooActionSelects()) {
      yahooToolbarPending.delete(select);
      for (const option of Array.from(select.querySelectorAll('option[data-gg-not-scam="1"]'))) {
        option.remove();
      }
      for (const group of Array.from(select.querySelectorAll('optgroup[data-gg-not-scam-group="1"]'))) {
        group.remove();
      }
      if (select.value === YAHOO_NOT_SCAM_VALUE) {
        select.value = yahooSelectDefaultValue(select);
      }
    }

    for (const item of Array.from(document.querySelectorAll('li[data-gg-not-scam-item="1"]'))) {
      const menu = item.closest('ul[data-test-id="navigable-list"]');
      if (menu) {
        yahooToolbarPending.delete(menu);
      }
      item.remove();
    }
  }

  function bindYahooNotScamSelect(select) {
    if (select.dataset.ggNotScamBound === '1') {
      return;
    }
    select.dataset.ggNotScamBound = '1';
    select.addEventListener('change', async (event) => {
      if (select.value !== YAHOO_NOT_SCAM_VALUE) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const pending = yahooToolbarPending.get(select);
      select.value = yahooSelectDefaultValue(select);
      if (!pending || !localLearningEnabled || pending.result?.kind === 'link') {
        return;
      }
      await markOpenMessageNotScam(pending.result, pending.openMessage);
    }, true);
  }

  function syncYahooNotScamToolbarOption(result, openMessage) {
    if (!isYahooHost() || !localLearningEnabled || !result || result.kind === 'link') {
      clearYahooNotScamToolbarOptions();
      return;
    }

    syncYahooNotScamMenuItems(result, openMessage);

    const selects = findYahooActionSelects();
    for (const select of selects) {
      bindYahooNotScamSelect(select);
      yahooToolbarPending.set(select, { result, openMessage });

      let option = select.querySelector('option[data-gg-not-scam="1"]');
      if (!option) {
        option = document.createElement('option');
        option.value = YAHOO_NOT_SCAM_VALUE;
        option.setAttribute('data-gg-not-scam', '1');
        option.textContent = 'Not a scam';

        const moveGroup = Array.from(select.querySelectorAll('optgroup')).find((group) =>
          /move to/i.test(String(group.label || ''))
        );
        if (moveGroup) {
          select.insertBefore(option, moveGroup);
        } else {
          const divider = select.querySelector('optgroup[data-gg-not-scam-group="1"]');
          if (divider) {
            divider.append(option);
          } else {
            const group = document.createElement('optgroup');
            group.label = 'Grandma Guard';
            group.setAttribute('data-gg-not-scam-group', '1');
            group.append(option);
            select.append(group);
          }
        }
      }
    }
  }

  function findOpenSubjectAnchor(readingRoot, openMessage) {
    if (!readingRoot) {
      return null;
    }

    const subjectSelectors = [
      'h2.hP',
      '[data-test-id="message-subject"]',
      '[data-test-id="message-group-subject"]',
      '[data-testid="message-header:subject"]',
      '[data-testid="message-subject"]',
      '[data-automation-id="messageHeaderSubject"]',
      '[data-automation-id="MessageHeaderSubject"]',
      '#msg-read .subject',
      '#msg-read .subject-line',
      '#msg-read h3.subject',
      '.message-header-subject',
      '.message-subject',
      '.thread-subject',
      '[id^="email-subject-"]'
    ];

    const headerRoots = [
      readingRoot.querySelector('[data-test-id="message-group-header"]'),
      readingRoot.querySelector('[data-test-id="message-header"]'),
      readingRoot.querySelector('[data-testid="message-header"]'),
      readingRoot.querySelector('.message-header'),
      readingRoot.querySelector('#msg-read .hdr'),
      readingRoot.querySelector('.mail-header'),
      readingRoot.querySelector('.thread-header'),
      readingRoot.querySelector('.gH'),
      readingRoot.querySelector('.ha'),
      readingRoot.querySelector('#conversation-header'),
      document.querySelector('#msg-read .hdr, #msg-read .subject-container'),
      document.querySelector('[data-app-section="ReadingPane"]'),
      document.querySelector('#ReadingPaneContainerId'),
      document.querySelector('[data-testid="readingPane"]'),
      document.querySelector('.nH .gH'),
      readingRoot
    ].filter(Boolean);

    const candidates = [];
    const pushCandidate = (node) => {
      if (!node || isInsideMailList(node) || isInsideMessageBody(node)) {
        return;
      }
      if (!candidates.includes(node)) {
        candidates.push(node);
      }
    };

    for (const headerRoot of headerRoots) {
      if (isInsideMailList(headerRoot)) {
        continue;
      }
      for (const selector of subjectSelectors) {
        for (const node of Array.from(headerRoot.querySelectorAll(selector))) {
          pushCandidate(node);
        }
      }
    }

    for (const selector of subjectSelectors) {
      for (const node of Array.from(document.querySelectorAll(selector))) {
        pushCandidate(node);
      }
    }

    const subjectNeedle = cleanMailField(openMessage?.subject || '').toLowerCase();
    if (subjectNeedle) {
      for (const node of candidates) {
        const text = boundedTextWithoutGuardUi(node, 500).toLowerCase();
        if (!text) {
          continue;
        }
        if (text === subjectNeedle ||
          text.includes(subjectNeedle.slice(0, Math.min(24, subjectNeedle.length))) ||
          subjectNeedle.includes(text.slice(0, Math.min(24, text.length)))) {
          return node;
        }
      }
    }

    return candidates.find((node) => isInsideMessageHeader(node)) || candidates[0] || null;
  }

  function findOpenBadgeAnchor(readingRoot) {
    return findOpenSubjectAnchor(readingRoot, null);
  }

  function findOpenActionsBar(readingRoot, openMessage) {
    if (!readingRoot || isInsideMailList(readingRoot)) {
      return null;
    }

    const anchor = findOpenSubjectAnchor(readingRoot, openMessage);
    if (!anchor) {
      return null;
    }

    const header = anchor.closest([
      '[data-test-id="message-header"]',
      '[data-testid="message-header"]',
      '[data-automation-id="MessageHeaderContainer"]',
      '[data-automationid="MessageHeader"]',
      '.message-header',
      '.thread-header',
      '#msg-read .hdr',
      '.gH',
      '.ha',
      'h2.hP'
    ].join(', ')) || anchor;

    const mountParent = header.parentElement;
    if (!mountParent || isInsideMailList(mountParent) || isInsideMessageBody(mountParent)) {
      return null;
    }

    let bar = document.getElementById(OPEN_ACTIONS_ID);
    if (!bar) {
      bar = document.createElement('div');
      bar.id = OPEN_ACTIONS_ID;
    }

    const insertBefore = header.nextSibling;
    if (bar.parentElement !== mountParent) {
      mountParent.insertBefore(bar, insertBefore);
    } else if (bar.previousSibling !== header) {
      mountParent.insertBefore(bar, insertBefore);
    }

    return bar;
  }

  function findOpenNotScamMount(openMessage) {
    if (!isReadingPaneVisible()) {
      return null;
    }

    const readingRoot = getReadingRoot();
    if (!readingRoot || isInsideMailList(readingRoot)) {
      return null;
    }

    return findOpenActionsBar(readingRoot, openMessage);
  }

  function clearOpenNotScamButton() {
    document.getElementById(OPEN_NOT_SCAM_ID)?.remove();
  }

  function clearLegacyOpenActions() {
    for (const node of Array.from(document.querySelectorAll(
      `#${OPEN_ACTIONS_ID}, #${OPEN_BADGE_ID}, #${OPEN_BADGE_ID}-dismiss, #${OPEN_TIP_ID}`
    ))) {
      node.remove();
    }
  }

  function showOpenNotScamButton(result, openMessage) {
    clearOpenNotScamButton();
    clearStrayNotScamButtons();
    if (!result || !openMessage || !localLearningEnabled || result.kind === 'link') {
      return false;
    }
    if (!isReadingPaneVisible() || !hasSubstantialOpenContent(openMessage)) {
      return false;
    }

    const readingRoot = getReadingRoot();
    const bar = readingRoot ? findOpenActionsBar(readingRoot, openMessage) : null;
    if (!bar || isInsideMailList(bar)) {
      return false;
    }

    ensureLabelStyles();

    const button = document.createElement('button');
    button.id = OPEN_NOT_SCAM_ID;
    button.type = 'button';
    button.textContent = 'Not a scam';
    button.title = reasonTooltip(
      result.reasons,
      'Mark this email as not a scam on this device.'
    );
    button.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      markOpenMessageNotScam(result, openMessage);
    };

    bar.append(button);
    return true;
  }

  function markSuspiciousRow(row, reasons, score, meta = {}) {
    applyingMarks = true;
    try {
      ensureLabelStyles();
      cleanupLegacyMarkers(row);
      // Never put Not a scam on inbox list rows - only inside the open message.
      for (const dismiss of Array.from(row.querySelectorAll(`.${DISMISS_CLASS}`))) {
        dismiss.remove();
      }

      const kind = String(meta.kind || '');
      const severity = scamSeverity(score, kind);
      row.setAttribute(ROW_MARK, '1');
      row.setAttribute(SEVERITY_MARK, severity.key);
      const linkNote = meta.linkHostname ? `Suspicious link: ${meta.linkHostname}. ` : '';
      row.title = `${linkNote}${reasonTooltip(reasons, `Grandma Guard: ${severity.label.toLowerCase()}. Avoid opening it.`)}`;

      const senderCell = findSenderCell(row);
      const subjectCell = findSubjectCell(row);

      let pill = row.querySelector(`.${PILL_CLASS}`);
      if (!pill) {
        pill = document.createElement('span');
        pill.className = PILL_CLASS;
      }
      removeExtraPills(row, pill);

      // Fade only a compact From label, never an avatar wrapper when possible.
      if (senderCell && !senderCell.querySelector?.('img, svg, [data-test-id*="avatar"]')) {
        senderCell.classList.add(FROM_FADED_CLASS);
      }

      placePill(row, pill, senderCell, subjectCell);
      removeExtraPills(row, pill);

      pill.textContent = severity.label;
      pill.setAttribute(SEVERITY_MARK, severity.key);
      // Clicks must pass through to Yahoo's row handlers.
      pill.style.pointerEvents = 'none';
    } finally {
      queueMicrotask(() => {
        applyingMarks = false;
      });
    }
  }

  function showEmailScamTip(result, openMessage) {
    if (!result || result.kind === 'link' || typeof detection.pickEmailScamTip !== 'function') {
      return;
    }
    ensureLabelStyles();

    const root = getReadingRoot();
    const bar = root ? findOpenActionsBar(root, openMessage) : null;
    if (!bar) {
      return;
    }

    bar.querySelector(`#${OPEN_TIP_ID}`)?.remove();

    const tip = document.createElement('p');
    tip.id = OPEN_TIP_ID;
    tip.className = 'gg-open-scam-tip';
    tip.textContent = detection.pickEmailScamTip(result.kind, result.reasons);
    bar.append(tip);
  }

  function showLinkOpenWarning(result, openMessage) {
    ensureLabelStyles();

    const root = getReadingRoot();
    const bar = root ? findOpenActionsBar(root, openMessage) : null;
    if (!bar) {
      return;
    }

    let badge = bar.querySelector(`#${OPEN_BADGE_ID}`);
    if (!badge) {
      badge = document.createElement('div');
      badge.id = OPEN_BADGE_ID;
      bar.prepend(badge);
    }

    const hostname = String(result.hostname || '').trim();
    badge.textContent = hostname
      ? `Suspicious link: ${hostname}`
      : 'Suspicious link inside this email';
    badge.title = Array.isArray(result.reasons) ? result.reasons.join('; ') : 'Suspicious link';
  }

  function showOpenBadge(result, openMessage) {
    if (!result || !openMessage) {
      return;
    }
    ensureLabelStyles();
    clearLegacyOpenActions();

    const root = getReadingRoot();
    const bar = root ? findOpenActionsBar(root, openMessage) : null;
    if (!bar) {
      return;
    }

    if (result.kind === 'link') {
      showLinkOpenWarning(result, openMessage);
      return;
    }

    showEmailScamTip(result, openMessage);
    showOpenNotScamButton(result, openMessage);

    if (isYahooHost()) {
      syncYahooNotScamToolbarOption(result, openMessage);
    }
  }

  function clearOpenBadge() {
    document.getElementById(OPEN_BADGE_ID)?.remove();
    clearOpenNotScamButton();
    clearStrayNotScamButtons();
    clearLegacyOpenActions();
    clearYahooNotScamToolbarOptions();
  }

  async function maybeShowVersionNotice() {
    if (window.top !== window.self || versionNoticeShown || !EXTENSION_VERSION) {
      return;
    }
    try {
      const state = await extensionApi.storage.local.get({
        acknowledgedExtensionVersion: ''
      });
      if (String(state.acknowledgedExtensionVersion || '') === EXTENSION_VERSION) {
        return;
      }
    } catch {
      return;
    }

    versionNoticeShown = true;
    ensureLabelStyles();
    const notice = document.createElement('div');
    notice.id = VERSION_NOTICE_ID;

    const noticeText = document.createElement('p');
    const noticeStrong = document.createElement('strong');
    noticeStrong.textContent = `Grandma Guard ${EXTENSION_VERSION}`;
    const privacyLink = document.createElement('a');
    privacyLink.href = PRIVACY_POLICY_URL;
    privacyLink.target = '_blank';
    privacyLink.rel = 'noopener noreferrer';
    privacyLink.textContent = 'privacy policy';
    noticeText.append(
      noticeStrong,
      document.createTextNode(
        ' adds link hover warnings, short-link checks, weekly summaries, strict mode, family blocklist, and backup/restore. Review the updated '
      ),
      privacyLink,
      document.createTextNode('.')
    );

    const noticeActions = document.createElement('div');
    noticeActions.className = 'gg-toast-actions';
    const ackButton = document.createElement('button');
    ackButton.type = 'button';
    ackButton.setAttribute('data-gg-version-ack', '1');
    ackButton.textContent = 'Got it';
    noticeActions.append(ackButton);
    notice.append(noticeText, noticeActions);

    notice.addEventListener('click', async (event) => {
      if (event.target?.getAttribute?.('data-gg-version-ack') !== '1') {
        return;
      }
      try {
        await extensionApi.storage.local.set({
          acknowledgedExtensionVersion: EXTENSION_VERSION
        });
      } catch {
        // Ignore storage failures; notice still closes.
      }
      notice.remove();
    });
    document.documentElement.append(notice);
  }

  function pruneWarned(now) {
    for (const [key, expiresAt] of warnedKeys) {
      if (expiresAt <= now) {
        warnedKeys.delete(key);
      }
    }
  }

  async function refreshLearnedPatterns(force = false) {
    const now = Date.now();
    if (!force && now - learnedLoadedAt < 15000) {
      return;
    }
    learnedLoadedAt = now;
    try {
      const state = await extensionApi.storage.local.get({
        learnedMailPatterns: [],
        learnedSafeMailPatterns: [],
        localMailLearningConsent: 'unset',
        localMailLearningEnabled: false,
        protectionLevel: 'standard',
        afterScamUntil: 0,
        shoppingModeEnabled: false,
        learnedBadLinkHosts: []
      });
      learningConsent = String(state.localMailLearningConsent || 'unset');
      protectionLevel = state.protectionLevel === 'careful' ? 'careful' : 'standard';
      afterScamUntil = Number(state.afterScamUntil) || 0;
      shoppingModeEnabled = Boolean(state.shoppingModeEnabled);
      learnedBadLinkHosts = Array.isArray(state.learnedBadLinkHosts) ? state.learnedBadLinkHosts : [];
      if (learningConsent === 'allowed') {
        localLearningEnabled = true;
      } else if (learningConsent === 'declined') {
        localLearningEnabled = false;
      } else {
        // Unset: do not learn until the user answers the one-time prompt.
        localLearningEnabled = false;
      }
      learnedPatterns = localLearningEnabled && Array.isArray(state.learnedMailPatterns)
        ? state.learnedMailPatterns
        : [];
      // Safe "not a scam" marks only apply while learning is allowed.
      safePatterns = localLearningEnabled && Array.isArray(state.learnedSafeMailPatterns)
        ? state.learnedSafeMailPatterns
        : [];
    } catch {
      learnedPatterns = [];
      safePatterns = [];
      localLearningEnabled = false;
      learningConsent = 'unset';
      protectionLevel = 'standard';
      afterScamUntil = 0;
      shoppingModeEnabled = false;
      learnedBadLinkHosts = [];
    }
  }

  async function setLearningConsent(choice) {
    try {
      await extensionApi.runtime.sendMessage({
        type: 'email-learn-consent',
        consent: choice
      });
    } catch {
      await extensionApi.storage.local.set({
        localMailLearningConsent: choice,
        localMailLearningEnabled: choice === 'allowed'
      });
    }
    learningConsent = choice;
    localLearningEnabled = choice === 'allowed';
    learnedLoadedAt = 0;
    await refreshLearnedPatterns(true);
    scheduleScan();
  }

  function hideLearningConsent() {
    document.getElementById(CONSENT_ID)?.remove();
  }

  function showLearningConsentPrompt() {
    if (window.top !== window.self || learningConsent !== 'unset' || consentPromptShown) {
      return;
    }
    if (document.getElementById(CONSENT_ID)) {
      return;
    }
    consentPromptShown = true;
    ensureLabelStyles();

    const root = document.createElement('div');
    root.id = CONSENT_ID;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'grandma-guard-learn-consent-title');

    const card = document.createElement('div');
    card.className = 'gg-consent-card';

    const title = document.createElement('h2');
    title.id = 'grandma-guard-learn-consent-title';
    title.textContent = 'Help Grandma Guard learn on this device?';

    const body = document.createElement('p');
    const deviceOnly = document.createElement('strong');
    deviceOnly.textContent = 'this device only';
    const notScam = document.createElement('strong');
    notScam.textContent = 'Not a scam';
    body.append(
      document.createTextNode(
        'If you allow this, Grandma Guard can remember short scam patterns from flagged emails on '
      ),
      deviceOnly,
      document.createTextNode(', and you can mark mistakes as '),
      notScam,
      document.createTextNode(' so it improves for you personally.')
    );

    const privacy = document.createElement('p');
    const privacyLink = document.createElement('a');
    privacyLink.href = PRIVACY_POLICY_URL;
    privacyLink.target = '_blank';
    privacyLink.rel = 'noopener noreferrer';
    privacyLink.textContent = 'privacy policy';
    privacy.append(
      document.createTextNode('Nothing is uploaded. Details are in our '),
      privacyLink,
      document.createTextNode('.')
    );

    const actions = document.createElement('div');
    actions.className = 'gg-consent-actions';

    const allowButton = document.createElement('button');
    allowButton.type = 'button';
    allowButton.setAttribute('data-gg-consent', 'allowed');
    allowButton.textContent = 'Allow on-device learning';

    const declineButton = document.createElement('button');
    declineButton.type = 'button';
    declineButton.setAttribute('data-gg-consent', 'declined');
    declineButton.textContent = 'No thanks';

    actions.append(allowButton, declineButton);
    card.append(title, body, privacy, actions);
    root.append(card);

    root.addEventListener('click', (event) => {
      const choice = event.target?.getAttribute?.('data-gg-consent');
      if (!choice) {
        return;
      }
      hideLearningConsent();
      setLearningConsent(choice);
    });
    document.documentElement.append(root);
  }

  async function rememberLearnedHints(hints, dedupeKey) {
    if (!localLearningEnabled || !Array.isArray(hints) || hints.length === 0) {
      return;
    }
    const key = `learn:${dedupeKey || ''}`;
    if (!dedupeKey || learnedHintKeys.has(key)) {
      return;
    }
    learnedHintKeys.add(key);
    try {
      await extensionApi.runtime.sendMessage({
        type: 'email-learn-patterns',
        hints
      });
      learnedLoadedAt = 0;
    } catch {
      // Detection still works if learning persistence fails.
    }
  }

  function withLearning(input) {
    return {
      ...input,
      protectionLevel,
      afterScamUntil,
      shoppingModeEnabled,
      shoppingModeEnabled,
      learnedBadLinkHosts,
      learnedPatterns: localLearningEnabled ? learnedPatterns : [],
      safePatterns: localLearningEnabled ? safePatterns : []
    };
  }

  async function logWarning(payload) {
    const now = Date.now();
    pruneWarned(now);
    const key = payload.dedupeKey;
    if (!key || (warnedKeys.get(key) || 0) > now) {
      return;
    }
    warnedKeys.set(key, now + ALERT_COOLDOWN_MS);

    try {
      await extensionApi.runtime.sendMessage({
        type: 'email-scam-suspected',
        mailHost: location.hostname.toLowerCase(),
        linkHost: payload.linkHost || '',
        href: payload.href || '',
        score: payload.score || 0,
        reasons: payload.reasons || [],
        kind: payload.kind || 'reward-bait',
        scope: payload.scope,
        count: payload.count || 1,
        labels: payload.labels || []
      });
    } catch {
      // Highlights still work if messaging fails.
    }

    rememberLearnedHints(payload.learnHints || [], payload.dedupeKey);
  }

  async function scan() {
    if (!document.body || typeof detection.analyzeEmailMessage !== 'function' || scanInFlight) {
      return;
    }
    scanInFlight = true;
    applyingMarks = true;
    try {
      removeLegacyListSummary();
      clearStrayNotScamButtons();
      await refreshLearnedPatterns();
      await maybeShowVersionNotice();
      if (learningConsent === 'unset') {
        showLearningConsentPrompt();
      }

      const openMessage = resolveOpenMessage();
      if (openMessage) {
        const messageResult = detection.analyzeEmailMessage(withLearning(openMessage));
        const markedRowMatch = !messageResult.suspicious
          ? findMarkedOpenResult(openMessage)
          : null;
        const openResult = messageResult.suspicious ? messageResult : markedRowMatch;

        if (openResult) {
          showOpenBadge(openResult, openMessage);
          logWarning({
            dedupeKey: `open:${openResult.dedupeKey || messageResult.dedupeKey}`,
            score: openResult.score || messageResult.score,
            reasons: openResult.reasons || messageResult.reasons,
            kind: openResult.kind || messageResult.kind || 'reward-bait',
            scope: 'open',
            labels: [openMessage.sender || openMessage.subject].filter(Boolean),
            learnHints: openResult.learnHints || messageResult.learnHints || []
          });
        } else {
          let linkWarned = false;
          for (const candidate of collectCandidateLinks()) {
            const result = detection.analyzeLink(candidate);
            if (!result.suspicious) {
              continue;
            }
            showOpenBadge({ ...result, kind: 'link' }, openMessage);
            logWarning({
              dedupeKey: `open-link:${result.hostname || candidate.href}`,
              linkHost: result.hostname || '',
              href: candidate.href,
              score: result.score,
              reasons: result.reasons,
              kind: 'link',
              scope: 'open',
              labels: [openMessage.sender || result.hostname].filter(Boolean)
            });
            linkWarned = true;
            break;
          }
          if (!linkWarned) {
            clearOpenBadge();
          }
        }
      } else {
        clearOpenBadge();
      }

      if (!isReadingPaneVisible()) {
        clearOpenNotScamButton();
        clearStrayNotScamButtons();
      }

      // Always scan the visible list too (Yahoo list + reading pane can both be open).
      const rows = collectInboxRows();
      const activeRows = new Set(rows.map((item) => item.row));
      for (const marked of Array.from(document.querySelectorAll(`[${ROW_MARK}="1"]`))) {
        if (activeRows.has(marked)) {
          continue;
        }
        // Only clear true orphans - not recycled nodes still tied to a collected row.
        if (!rows.some((item) => item.row.contains(marked) || marked.contains(item.row))) {
          clearRowMark(marked);
        }
      }

      const hits = [];
      for (const item of rows) {
        let rowResult = detection.analyzeEmailMessage(withLearning({
          ...item,
          links: collectLinksFromRoot(item.row, 8)
        }));
        if (!rowResult.suspicious) {
          if (item.row.getAttribute(ROW_MARK) === '1') {
            clearRowMark(item.row);
          }
          continue;
        }
        stickyMarkedKeys.set(rowResult.dedupeKey, {
          dedupeKey: rowResult.dedupeKey,
          reasons: rowResult.reasons || [],
          score: rowResult.score || 0,
          fields: {
            sender: item.sender,
            fromAddress: item.fromAddress,
            subject: item.subject,
            bodyText: item.bodyText,
            dedupeKey: rowResult.dedupeKey
          }
        });
        markSuspiciousRow(item.row, rowResult.reasons, rowResult.score, {
          kind: rowResult.kind,
          linkHostname: rowResult.linkHostname
        });
        hits.push({
          ...rowResult,
          sender: item.sender,
          subject: item.subject
        });
        rememberLearnedHints(rowResult.learnHints || [], `row:${rowResult.dedupeKey}`);
      }

      if (hits.length === 0 && stickyMarkedKeys.size > 0) {
        for (const item of rows) {
          const key = [
            item.sender.toLowerCase().slice(0, 80),
            item.subject.toLowerCase().slice(0, 120)
          ].join('|');
          const sticky = stickyMarkedKeys.get(key);
          if (sticky) {
            markSuspiciousRow(item.row, sticky.reasons, sticky.score, {
              kind: sticky.kind,
              linkHostname: sticky.linkHostname
            });
            hits.push({
              dedupeKey: sticky.dedupeKey || key,
              reasons: sticky.reasons || [],
              score: sticky.score || 0,
              sender: item.sender,
              subject: item.subject
            });
            continue;
          }
          for (const [stickyKey, stickyValue] of stickyMarkedKeys) {
            const subjectPart = stickyKey.split('|')[1] || '';
            const reasons = Array.isArray(stickyValue) ? stickyValue : stickyValue?.reasons;
            const score = Array.isArray(stickyValue) ? 6 : stickyValue?.score;
            if (subjectPart && reasons && item.bodyText.toLowerCase().includes(subjectPart)) {
              markSuspiciousRow(item.row, reasons, score, {
                kind: stickyValue?.kind,
                linkHostname: stickyValue?.linkHostname
              });
              hits.push({
                dedupeKey: stickyKey,
                reasons,
                score,
                sender: item.sender,
                subject: item.subject
              });
              break;
            }
          }
        }
        purgeOrphanPills();
      }

      purgeOrphanPills();

      if (hits.length > 0) {
        logWarning({
          dedupeKey: `list:${hits.map((hit) => hit.dedupeKey).sort().join('||').slice(0, 400)}`,
          score: Math.max(...hits.map((hit) => hit.score)),
          reasons: hits[0].reasons,
          kind: 'reward-bait',
          scope: 'list',
          count: hits.length,
          labels: hits.map((hit) => hit.sender || hit.subject).filter(Boolean).slice(0, 5)
        });
      }
    } finally {
      scanInFlight = false;
      queueMicrotask(() => {
        applyingMarks = false;
      });
    }
  }

  function mutationIsGuardOnly(mutations) {
    return mutations.every((mutation) => {
      const nodes = [
        mutation.target,
        ...Array.from(mutation.addedNodes || []),
        ...Array.from(mutation.removedNodes || [])
      ];
      return nodes.every((node) => {
        if (!node) {
          return true;
        }
        if (node.nodeType === Node.TEXT_NODE) {
          const parent = node.parentElement;
          return Boolean(parent?.closest?.(
            `.${PILL_CLASS}, .${DISMISS_CLASS}, #${CONSENT_ID}, #${UNDO_TOAST_ID}, #${VERSION_NOTICE_ID}, #${OPEN_ACTIONS_ID}, #${OPEN_BADGE_ID}, #${OPEN_NOT_SCAM_ID}`
          ));
        }
        if (node.nodeType !== Node.ELEMENT_NODE) {
          return true;
        }
        return Boolean(
          node.id === CONSENT_ID ||
          node.id === UNDO_TOAST_ID ||
          node.id === VERSION_NOTICE_ID ||
          node.id === OPEN_ACTIONS_ID ||
          node.id === OPEN_BADGE_ID ||
          node.id === OPEN_NOT_SCAM_ID ||
          node.getAttribute?.('data-gg-not-scam') === '1' ||
          node.getAttribute?.('data-gg-not-scam-group') === '1' ||
          node.getAttribute?.('data-gg-not-scam-item') === '1' ||
          node.getAttribute?.('data-gg-not-scam-link') === '1' ||
          node.classList?.contains(PILL_CLASS) ||
          node.classList?.contains(DISMISS_CLASS) ||
          node.closest?.(
            `.${PILL_CLASS}, .${DISMISS_CLASS}, #${CONSENT_ID}, #${UNDO_TOAST_ID}, #${VERSION_NOTICE_ID}, #${OPEN_ACTIONS_ID}, #${OPEN_BADGE_ID}, #${OPEN_NOT_SCAM_ID}, option[data-gg-not-scam="1"], optgroup[data-gg-not-scam-group="1"], li[data-gg-not-scam-item="1"], [data-gg-not-scam-link="1"]`
          )
        );
      });
    });
  }

  function scheduleScan() {
    if (applyingMarks || scanInFlight) {
      return;
    }
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(scan, 1100);
  }

  const observer = new MutationObserver((mutations) => {
    if (applyingMarks || scanInFlight || mutationIsGuardOnly(mutations)) {
      return;
    }
    scheduleScan();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
  });

  scheduleScan();
  setTimeout(scan, 1500);
  setTimeout(scan, 4000);
})();
