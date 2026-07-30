(function attachDetectionEngine(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.GrandmaGuardDetection = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  'use strict';

  const SIGNALS = [
    {
      id: 'encrypted-files',
      label: 'claims files are encrypted',
      weight: 8,
      categories: ['claim'],
      pattern: /\b(?:all|your)\s+(?:of\s+your\s+)?files\s+(?:are|have\s+been)\s+encrypted\b/i
    },
    {
      id: 'device-infected',
      label: 'claims the device is infected or damaged',
      weight: 6,
      categories: ['claim'],
      pattern: /\b(?:your\s+)?(?:system|computer|pc|device)\s+(?:is|has\s+been)\s+(?:damaged|infected|compromised)\b.{0,55}\b(?:virus|malware|attack|threat)?\b/i
    },
    {
      id: 'malware-detected',
      label: 'claims malware or a virus was detected',
      weight: 6,
      categories: ['claim'],
      pattern: /\b(?:malware|virus|threats?)\s+(?:has\s+been\s+|was\s+)?detected\s+(?:on|in)\s+(?:your\s+)?(?:pc|computer|device|system)\b/i
    },
    {
      id: 'virus-count',
      label: 'claims multiple viruses or infections were found',
      weight: 7,
      categories: ['claim'],
      pattern: /\b(?:\d{1,3}|multiple|several)\s+(?:viruses|threats|infections)\s+(?:were\s+|have\s+been\s+)?(?:found|detected)\b|\b(?:your\s+)?(?:pc|computer|device)\b.{0,45}\b(?:has|contains)\s+(?:\d{1,3}|multiple)\s+(?:viruses|threats|infections)\b/i
    },
    {
      id: 'expired-security-product',
      label: 'claims security software expired',
      weight: 6,
      categories: ['claim', 'brand'],
      pattern: /\b(?:mcafee|norton|defender|antivirus|security\s+software)\s+(?:license|subscription|protection)\s+(?:has\s+)?expired\b/i
    },
    {
      id: 'security-brand-impersonation',
      label: 'impersonates a browser or security provider',
      weight: 5,
      categories: ['claim', 'brand'],
      pattern: /\b(?:microsoft|windows|apple|google|chrome|edge|firefox)\s+(?:defender|security|support|protection)\b.{0,100}\b(?:alert|warning|detected|blocked|infected|compromised|expired|threat)\b|\b(?:alert|warning|detected|blocked|infected|compromised|expired|threat)\b.{0,100}\b(?:microsoft|windows|apple|google|chrome|edge|firefox)\s+(?:defender|security|support|protection)\b/i
    },
    {
      id: 'fake-system-alert',
      label: 'uses fake system-alert language',
      weight: 2,
      categories: ['claim'],
      pattern: /\b(?:system|security|critical|virus)\s+(?:alert|warning)\b/i
    },
    {
      id: 'notification-bait',
      label: 'requires Allow or notifications to continue',
      weight: 10,
      categories: ['permission', 'action'],
      highPrecision: true,
      pattern: /(?:\b(?:click|press|tap|select)\s+(?:the\s+)?["']?allow["']?(?:\s+(?:button|above))?\b.{0,100}\b(?:continue|proceed|watch|download|access|verify|confirm|enable|close|remove|scan|notifications?|not\s+a\s+robot)\b)|(?:\ballow\s+notifications?\s+to\s+(?:continue|proceed|watch|download|access|verify|confirm|enable)\b)/i
    },
    {
      id: 'fake-captcha-allow',
      label: 'uses Allow as a fake CAPTCHA or human check',
      weight: 10,
      categories: ['permission', 'action'],
      highPrecision: true,
      pattern: /\b(?:click|press|tap)\s+(?:the\s+)?["']?allow["']?\b.{0,100}\b(?:not\s+a\s+robot|human|captcha|verify)\b|\b(?:verify|prove)\s+(?:that\s+)?you(?:'re|\s+are)\s+(?:human|not\s+a\s+robot)\b.{0,100}\ballow\b/i
    },
    {
      id: 'reversed-notification-gate',
      label: 'uses browser permission as a gate to content',
      weight: 10,
      categories: ['permission', 'action'],
      highPrecision: true,
      pattern: /\b(?:to|please)\s+(?:continue|proceed|watch|play|download|access|verify|confirm|close|remove)\b.{0,100}\b(?:click|press|tap|select)\s+(?:the\s+)?["']?allow["']?\b|\bif\s+you(?:'re|\s+are)\s+(?:not\s+a\s+robot|human)\b.{0,100}\b(?:click|press|tap)\s+["']?allow["']?\b/i
    },
    {
      id: 'push-subscription-gate',
      label: 'pressures the visitor to enable push notifications',
      weight: 9,
      categories: ['permission', 'action'],
      highPrecision: true,
      pattern: /\b(?:enable|allow|subscribe\s+to)\s+(?:browser\s+|push\s+)?notifications?\b.{0,100}\b(?:continue|proceed|watch|download|access|verify|confirm|remove|protect)\b|\b(?:continue|proceed|watch|download|access)\b.{0,100}\b(?:enable|allow|subscribe\s+to)\s+(?:browser\s+|push\s+)?notifications?\b/i
    },
    {
      id: 'urgent-fix',
      label: 'uses an urgent click-to-fix instruction',
      weight: 5,
      categories: ['action'],
      pattern: /\b(?:click|tap|press)\s+(?:here\s+)?(?:now\s+)?to\s+(?:remove|secure|repair|clean|protect|stay\s+protected|fix|scan)\b/i
    },
    {
      id: 'scan-now',
      label: 'demands an immediate scan or cleanup',
      weight: 4,
      categories: ['action'],
      pattern: /\b(?:scan|remove|clean|repair|protect)\s+(?:your\s+(?:pc|computer|device)\s+)?(?:now|immediately)\b/i
    },
    {
      id: 'support-phone',
      label: 'pressures the visitor to call a support number',
      weight: 6,
      categories: ['action', 'support'],
      pattern: /\b(?:call|contact)\s+(?:microsoft|windows|apple|support|a\s+technician|us|now)\b.{0,120}(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/i
    },
    {
      id: 'fake-update',
      label: 'pressures the visitor to install a supposed update',
      weight: 7,
      categories: ['claim', 'action', 'download'],
      highPrecision: true,
      pattern: /\b(?:browser|chrome|edge|firefox|flash|windows|security)\s+(?:is\s+)?(?:out\s+of\s+date|outdated|update\s+required)\b.{0,100}\b(?:download|install|update\s+now|continue)\b/i
    },
    {
      id: 'download-cleaner',
      label: 'pushes a download to remove a claimed threat',
      weight: 6,
      categories: ['action', 'download'],
      pattern: /\b(?:download|install)\s+(?:now\s+)?(?:this\s+)?(?:antivirus|cleaner|security\s+tool|protection|scanner)\b.{0,100}\b(?:remove|clean|fix|protect|virus|malware|threat)\b/i
    },
    {
      id: 'account-locked',
      label: 'claims an account is locked or compromised',
      weight: 6,
      categories: ['claim', 'credential'],
      pattern: /\b(?:your\s+)?account\s+(?:has\s+been\s+|is\s+)?(?:locked|suspended|compromised|disabled)\b/i
    },
    {
      id: 'verify-account',
      label: 'urgently requests account verification or sign-in',
      weight: 5,
      categories: ['action', 'credential'],
      pattern: /\b(?:verify|confirm|restore|unlock|secure)\s+(?:your\s+)?(?:account|identity)\b|\bsign\s+in\s+(?:now\s+)?to\s+(?:verify|restore|unlock|secure)\b/i
    },
    {
      id: 'do-not-close',
      label: 'tells the visitor not to close the warning',
      weight: 4,
      categories: ['action', 'takeover'],
      pattern: /\b(?:do\s+not|don['’]t)\s+(?:close|leave|restart|turn\s+off)\s+(?:this\s+)?(?:window|page|computer|device|browser)\b/i
    }
  ];

  const OFFICIAL_SUFFIXES = [
    'microsoft.com', 'windows.com', 'google.com', 'support.google.com',
    'mcafee.com', 'norton.com', 'apple.com', 'mozilla.org'
  ];

  const EDITORIAL_PATTERN = /\b(?:according\s+to|analysis|article|explains?|example|fake\s+(?:alert|warning|notification)|guide|how\s+to|in\s+this\s+(?:article|report)|news|phishing|researchers?|reported|reporting|scam|scareware|screenshot|security\s+research|what\s+to\s+do)\b/gi;

  function suffixMatches(hostname, suffix) {
    return hostname === suffix || hostname.endsWith(`.${suffix}`);
  }

  function uniqueMatches(text, pattern, cap) {
    const matches = String(text || '').match(pattern) || [];
    return Math.min(new Set(matches.map((item) => item.toLowerCase())).size, cap);
  }

  function hostSignals(snapshot) {
    const hostname = String(snapshot.hostname || '').toLowerCase();
    const firstLabel = hostname.split('.')[0] || '';
    const reasons = [];
    let score = 0;

    if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname) || /^\[[0-9a-f:]+\]$/i.test(hostname)) {
      score += 2;
      reasons.push('uses an IP address instead of a normal hostname');
    }
    if (hostname.includes('xn--')) {
      score += 2;
      reasons.push('uses an internationalized lookalike hostname');
    }
    if (firstLabel.length >= 14 && /[a-z]/i.test(firstLabel) && /\d/.test(firstLabel)) {
      score += 1;
      reasons.push('uses a long mixed-letter-and-number hostname');
    }
    if ((firstLabel.match(/-/g) || []).length >= 3) {
      score += 1;
      reasons.push('uses an unusually hyphenated hostname');
    }
    if (snapshot.protocol === 'http:') {
      score += 1;
      reasons.push('uses an unencrypted connection');
    }

    return { score, reasons };
  }

  function analyze(snapshot) {
    const pageText = String(snapshot.pageText || '').slice(0, 250000);
    const titleText = String(snapshot.titleText || '').slice(0, 3000);
    const articleText = String(snapshot.articleText || '').slice(0, 180000);
    const quotedText = String(snapshot.quotedText || '').slice(0, 50000);
    const interactiveText = String(snapshot.interactiveText || '').slice(0, 30000);
    const overlayText = String(snapshot.overlayText || '').slice(0, 50000);
    const allText = `${titleText}\n${pageText}`;
    const categories = new Set();
    const matchedSignals = [];
    const reasons = [];
    let score = 0;
    let activePlacement = false;
    let overlayPlacement = false;
    let highPrecisionMatch = false;

    for (const signal of SIGNALS) {
      if (!signal.pattern.test(allText)) {
        continue;
      }

      const inOverlay = Boolean(overlayText && signal.pattern.test(overlayText));
      const inInteractive = Boolean(interactiveText && signal.pattern.test(interactiveText));
      const inArticle = Boolean(articleText && signal.pattern.test(articleText));
      const inQuote = Boolean(quotedText && signal.pattern.test(quotedText));
      const inTitle = Boolean(titleText && signal.pattern.test(titleText));
      const placementBonus = inOverlay ? 3 : (inInteractive ? 2 : (inTitle ? 1 : 0));

      score += signal.weight + placementBonus;
      signal.categories.forEach((category) => categories.add(category));
      reasons.push(signal.label);
      activePlacement = activePlacement || inOverlay || inInteractive;
      overlayPlacement = overlayPlacement || inOverlay;
      highPrecisionMatch = highPrecisionMatch || Boolean(signal.highPrecision);
      matchedSignals.push({
        id: signal.id,
        inOverlay,
        inInteractive,
        inArticle,
        inQuote,
        inTitle
      });
    }

    if (matchedSignals.length === 0) {
      return {
        block: false,
        score: 0,
        reasons: [],
        categories: [],
        diagnostics: { editorialConfidence: 0, hostRisk: 0, matchedSignals: [] }
      };
    }

    const host = hostSignals(snapshot);
    score += host.score;
    reasons.push(...host.reasons);

    const largeOverlay = Boolean(snapshot.largeOverlay);
    const fullscreen = Boolean(snapshot.fullscreen);
    const scrollLocked = Boolean(snapshot.scrollLocked);
    const permissionGranted = snapshot.notificationPermission === 'granted';
    const audibleMedia = Boolean(snapshot.audibleMedia);
    if (largeOverlay) {
      score += 3;
      categories.add('takeover');
      reasons.push('appears in a large page-covering overlay');
    }
    if (fullscreen) {
      score += 3;
      categories.add('takeover');
      reasons.push('takes over the full screen');
    }
    if (scrollLocked && largeOverlay) {
      score += 1;
      reasons.push('locks the underlying page while showing the warning');
    }
    if (permissionGranted) {
      score += 2;
      categories.add('permission');
      reasons.push('already has browser notification permission');
    }
    if (audibleMedia && (categories.has('claim') || categories.has('permission'))) {
      score += 1;
      reasons.push('plays audio or video while presenting the warning');
    }

    const hostname = String(snapshot.hostname || '').toLowerCase();
    const officialSite = OFFICIAL_SUFFIXES.some((suffix) => suffixMatches(hostname, suffix));
    const articleWordCount = Number(snapshot.articleWordCount) || 0;
    const articleParagraphCount = Number(snapshot.articleParagraphCount) || 0;
    const pageWordCount = Number(snapshot.pageWordCount) || (pageText.match(/\b[\p{L}\p{N}'’-]+\b/gu) || []).length;
    const structuredArticle = Boolean(snapshot.structuredArticle);
    const hasByline = Boolean(snapshot.hasByline);
    const likelyArticle = structuredArticle || (
      Boolean(articleText) && articleWordCount >= 250 && articleParagraphCount >= 4
    );
    let editorialConfidence = 0;

    if (structuredArticle) editorialConfidence += 4;
    if (hasByline) editorialConfidence += 2;
    if (articleWordCount >= 500 && articleParagraphCount >= 6) editorialConfidence += 2;
    editorialConfidence += uniqueMatches(`${titleText}\n${articleText}\n${pageText.slice(0, 60000)}`, EDITORIAL_PATTERN, 4);

    const everySignalLooksQuoted = matchedSignals.every((signal) => signal.inArticle || signal.inQuote);
    const takeoverPlacement = overlayPlacement || largeOverlay || fullscreen;
    const articleOnly = likelyArticle && everySignalLooksQuoted && !takeoverPlacement;
    const explanatoryContext = !takeoverPlacement && !activePlacement && editorialConfidence >= 4 &&
      (likelyArticle || everySignalLooksQuoted || pageWordCount >= 350);

    if (officialSite && !takeoverPlacement) {
      score -= 6;
    }
    if (articleOnly || explanatoryContext) {
      score -= Math.min(10, editorialConfidence + 4);
    } else if (likelyArticle && !takeoverPlacement) {
      score -= Math.min(6, editorialConfidence);
    }

    const hasClaim = categories.has('claim');
    const hasAction = categories.has('action');
    const notificationTrap = categories.has('permission') && hasAction;
    const scarewareTrap = hasClaim && hasAction;
    const supportTrap = hasClaim && categories.has('support');
    const credentialTrap = categories.has('credential') && hasAction;
    const crossCategoryCore = notificationTrap || scarewareTrap || supportTrap || credentialTrap;
    const environmentalEvidence = activePlacement || takeoverPlacement || permissionGranted || audibleMedia ||
      host.score >= 1 || (categories.has('brand') && !officialSite);

    let block = false;
    if ((!articleOnly && !explanatoryContext) || takeoverPlacement) {
      block = (
        score >= 12 && crossCategoryCore && environmentalEvidence && matchedSignals.length >= 2
      ) || (
        score >= 10 && highPrecisionMatch && !likelyArticle && !explanatoryContext
      ) || (
        score >= 13 && highPrecisionMatch && takeoverPlacement
      );
    }
    if (officialSite && !takeoverPlacement) {
      block = false;
    }

    return {
      block,
      score: Math.max(0, score),
      reasons: Array.from(new Set(reasons)).slice(0, 12),
      categories: Array.from(categories),
      diagnostics: {
        editorialConfidence,
        hostRisk: host.score,
        likelyArticle,
        articleOnly,
        explanatoryContext,
        activePlacement,
        overlayPlacement,
        largeOverlay,
        fullscreen,
        officialSite,
        matchedSignals
      }
    };
  }

  return { analyze };
}));
