(function attachFalsePositiveReport(root) {
  'use strict';

  const REPORT_REPO = 'NokaAngel/Grandma-Guard';
  const MAX_REASONS = 6;
  const MAX_NOTE = 240;

  function extensionVersion() {
    try {
      const api = root.browser ?? root.chrome;
      return String(api?.runtime?.getManifest?.().version || '').trim();
    } catch {
      return '';
    }
  }

  function normalizeDomain(value) {
    const engine = root.GrandmaGuardDetection;
    if (engine && typeof engine.normalizeTrustedHost === 'function') {
      return engine.normalizeTrustedHost(value);
    }
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .replace(/^www\./, '')
      .replace(/:\d+$/, '');
  }

  function extractFromDomain(fromAddress) {
    const engine = root.GrandmaGuardDetection;
    const email = engine && typeof engine.extractEmailAddress === 'function'
      ? engine.extractEmailAddress(fromAddress)
      : String(fromAddress || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || '';
    const at = email.lastIndexOf('@');
    if (at < 1) {
      return '';
    }
    return normalizeDomain(email.slice(at + 1));
  }

  function formatReasons(reasons) {
    const list = Array.isArray(reasons) ? reasons.filter(Boolean).slice(0, MAX_REASONS) : [];
    if (!list.length) {
      return '- (none recorded)';
    }
    return list.map((reason) => `- ${String(reason).trim()}`).join('\n');
  }

  function buildReportUrl(input = {}) {
    const type = input.type === 'email' ? 'email' : 'website';
    const fromDomain = normalizeDomain(input.fromDomain || '') ||
      extractFromDomain(input.fromAddress || '');
    let domain = normalizeDomain(input.domain || input.hostname || '');
    if (!domain && type === 'email' && fromDomain) {
      domain = fromDomain;
    }
    const mailHost = normalizeDomain(input.mailHost || '');
    const version = String(input.extensionVersion || extensionVersion() || 'unknown').trim();
    const userNote = String(input.userNote || '').trim().slice(0, MAX_NOTE);
    const titleDomain = domain || fromDomain || 'unknown-domain';
    const title = `[False positive] ${titleDomain}`;

    const lines = [
      '## Report type',
      type === 'email' ? 'Email' : 'Website',
      '',
      '## Domain to add to official list',
      domain || '(please fill in the business domain, e.g. example.com)',
      ''
    ];

    if (type === 'email') {
      lines.push('## Email From domain (if different)', fromDomain || '(unknown)', '');
      lines.push('## Mail provider host', mailHost || '(unknown)', '');
    }

    lines.push(
      '## Extension version',
      version,
      '',
      '## Why Grandma Guard flagged it',
      formatReasons(input.reasons),
      '',
      '## Optional note',
      userNote || '(add context if helpful; do not paste email body or passwords)',
      '',
      '---',
      'Submitted through Grandma Guard optional false-positive report. No email body, page text, or browsing history is included automatically.',
      '',
      'Maintainers: review this report, then open a PR to add the domain to `data/rule-packs.json`, sign, and merge.'
    );

    const params = new URLSearchParams();
    params.set('title', title);
    params.set('body', lines.join('\n'));
    params.set('labels', 'false-positive');
    return `https://github.com/${REPORT_REPO}/issues/new?${params.toString()}`;
  }

  function openReportUrl(input) {
    const url = typeof input === 'string' ? input : buildReportUrl(input);
    if (!url) {
      return false;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
    return true;
  }

  function appendSuggestLink(container, input, label) {
    if (!container) {
      return null;
    }
    const link = document.createElement('a');
    link.className = 'gg-fp-suggest-link';
    link.href = buildReportUrl(input);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = label || 'Suggest for official list';
    link.title = 'Opens GitHub to suggest this domain for review. No email body or page content is sent.';
    link.addEventListener('click', (event) => {
      event.stopPropagation();
    });
    container.append(link);
    return link;
  }

  function appendSuggestButton(container, input, label) {
    if (!container) {
      return null;
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'gg-fp-suggest-button';
    button.textContent = label || 'Suggest for official list';
    button.title = 'Opens GitHub to suggest this domain for review. No email body or page content is sent.';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      openReportUrl(input);
    });
    container.append(button);
    return button;
  }

  root.GrandmaGuardFalsePositiveReport = {
    REPORT_REPO,
    buildReportUrl,
    openReportUrl,
    appendSuggestLink,
    appendSuggestButton,
    normalizeDomain,
    extractFromDomain
  };
}(typeof globalThis !== 'undefined' ? globalThis : this));
