(function attachFalsePositiveReport(root) {
  'use strict';

  const REPORT_REPO = 'NokaAngel/Grandma-Guard';
  const WEB_REPORT_BASE = 'https://grandmaguard.nokaangel.dev/report';
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

  function formatReasonsInline(reasons) {
    const list = Array.isArray(reasons) ? reasons.filter(Boolean).slice(0, MAX_REASONS) : [];
    return list.length ? list.join('; ') : '';
  }

  function normalizeReportInput(input = {}) {
    const type = input.type === 'email' ? 'email' : 'website';
    const fromDomain = normalizeDomain(input.fromDomain || '') ||
      extractFromDomain(input.fromAddress || '');
    let domain = normalizeDomain(input.domain || input.hostname || '');
    if (!domain && type === 'email' && fromDomain) {
      domain = fromDomain;
    }
    return {
      type,
      domain,
      fromDomain,
      mailHost: normalizeDomain(input.mailHost || ''),
      version: String(input.extensionVersion || extensionVersion() || 'unknown').trim(),
      userNote: String(input.userNote || '').trim().slice(0, MAX_NOTE),
      reasons: Array.isArray(input.reasons)
        ? input.reasons.filter(Boolean).slice(0, MAX_REASONS)
        : []
    };
  }

  function buildWebReportUrl(input = {}) {
    const report = normalizeReportInput(input);
    const params = new URLSearchParams();
    params.set('type', report.type);
    if (report.domain) {
      params.set('domain', report.domain);
    }
    if (report.fromDomain) {
      params.set('from_domain', report.fromDomain);
    }
    if (report.mailHost) {
      params.set('mail_host', report.mailHost);
    }
    params.set('version', report.version);
    const reasons = formatReasonsInline(report.reasons);
    if (reasons) {
      params.set('reasons', reasons);
    }
    if (report.userNote) {
      params.set('note', report.userNote);
    }
    return `${WEB_REPORT_BASE}?${params.toString()}`;
  }

  function buildGitHubReportUrl(input = {}) {
    const report = normalizeReportInput(input);
    const titleDomain = report.domain || report.fromDomain || 'unknown-domain';
    const title = `[False positive] ${titleDomain}`;

    const lines = [
      '## Report type',
      report.type === 'email' ? 'Email' : 'Website',
      '',
      '## Domain to add to official list',
      report.domain || '(please fill in the business domain, e.g. example.com)',
      ''
    ];

    if (report.type === 'email') {
      lines.push('## Email From domain (if different)', report.fromDomain || '(unknown)', '');
      lines.push('## Mail provider host', report.mailHost || '(unknown)', '');
    }

    lines.push(
      '## Extension version',
      report.version,
      '',
      '## Why Grandma Guard flagged it',
      formatReasons(report.reasons),
      '',
      '## Optional note',
      report.userNote || '(add context if helpful; do not paste email body or passwords)',
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

  /** @deprecated Use buildWebReportUrl or buildGitHubReportUrl */
  function buildReportUrl(input = {}) {
    return buildGitHubReportUrl(input);
  }

  function openUrl(url) {
    if (!url) {
      return false;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
    return true;
  }

  function openWebReportUrl(input) {
    return openUrl(typeof input === 'string' ? input : buildWebReportUrl(input));
  }

  function openGitHubReportUrl(input) {
    return openUrl(typeof input === 'string' ? input : buildGitHubReportUrl(input));
  }

  function openReportUrl(input) {
    return openWebReportUrl(input);
  }

  function appendReportActions(container, input, options = {}) {
    if (!container) {
      return { primary: null, secondary: null };
    }

    const report = normalizeReportInput(input);
    const primaryLabel = options.primaryLabel ||
      (report.type === 'email' ? 'Report for everyone' : 'Report false positive');
    const secondaryLabel = options.secondaryLabel || 'GitHub (advanced)';

    const primary = document.createElement('button');
    primary.type = 'button';
    primary.className = 'gg-fp-report-button';
    primary.textContent = primaryLabel;
    primary.title = 'Opens a simple report form on grandmaguard.nokaangel.dev. No email body or page content is sent automatically.';
    primary.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      openWebReportUrl(input);
    });

    const secondary = document.createElement('button');
    secondary.type = 'button';
    secondary.className = 'gg-fp-github-button';
    secondary.textContent = secondaryLabel;
    secondary.title = 'Opens GitHub to suggest this domain publicly. Requires a GitHub account.';
    secondary.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      openGitHubReportUrl(input);
    });

    container.append(primary, secondary);
    return { primary, secondary };
  }

  function appendSuggestLink(container, input, label) {
    if (!container) {
      return null;
    }
    const link = document.createElement('a');
    link.className = 'gg-fp-suggest-link';
    link.href = buildWebReportUrl(input);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = label || 'Report for everyone';
    link.title = 'Opens a simple report form. No email body or page content is sent automatically.';
    link.addEventListener('click', (event) => {
      event.stopPropagation();
    });

    const github = document.createElement('a');
    github.className = 'gg-fp-github-link';
    github.href = buildGitHubReportUrl(input);
    github.target = '_blank';
    github.rel = 'noopener noreferrer';
    github.textContent = 'GitHub';
    github.title = 'Optional: open a public GitHub issue instead.';
    github.addEventListener('click', (event) => {
      event.stopPropagation();
    });

    container.append(link, github);
    return link;
  }

  function appendSuggestButton(container, input, label) {
    if (!container) {
      return null;
    }
    const wrap = document.createElement('div');
    wrap.className = 'gg-fp-report-actions';
    appendReportActions(wrap, input, { primaryLabel: label || 'Report false positive' });
    container.append(wrap);
    return wrap;
  }

  root.GrandmaGuardFalsePositiveReport = {
    REPORT_REPO,
    WEB_REPORT_BASE,
    buildWebReportUrl,
    buildGitHubReportUrl,
    buildReportUrl,
    openWebReportUrl,
    openGitHubReportUrl,
    openReportUrl,
    appendReportActions,
    appendSuggestLink,
    appendSuggestButton,
    normalizeDomain,
    extractFromDomain,
    normalizeReportInput
  };
}(typeof globalThis !== 'undefined' ? globalThis : this));
