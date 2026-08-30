(function attachDetectionEngine(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.GrandmaGuardDetection = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  'use strict';

  const PHONE = '(?:\\+?1[\\s.-]?)?\\(?\\d{3}\\)?[\\s.-]\\d{3}[\\s.-]\\d{4}';

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
      pattern: /\b(?:your\s+)?(?:system|computer|pc|device|laptop|machine)\s+(?:is|has\s+been)\s+(?:damaged|infected|compromised)\b.{0,55}\b(?:virus|malware|attack|threat)?\b/i
    },
    {
      id: 'device-locked',
      label: 'claims the computer or browser has been locked',
      weight: 6,
      categories: ['claim'],
      pattern: /\b(?:your\s+)?(?:computer|pc|device|system|windows|browser|laptop|machine)\s+(?:has\s+been\s+|is\s+)?(?:locked|blocked|frozen)\b|\baccess\s+(?:to\s+)?(?:your\s+)?(?:computer|pc|device|system|windows|browser)\s+has\s+been\s+(?:locked|blocked|restricted)\b|\b(?:computer|pc|device|windows)\s+has\s+been\s+locked\b/i
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
      pattern: /\b(?:microsoft|windows|apple|google|chrome|edge|firefox)\s+(?:defender|security|support|protection)\b.{0,100}\b(?:alert|warning|detected|blocked|infected|compromised|expired|threat|locked)\b|\b(?:alert|warning|detected|blocked|infected|compromised|expired|threat|locked)\b.{0,100}\b(?:microsoft|windows|apple|google|chrome|edge|firefox)\s+(?:defender|security|support|protection)\b/i
    },
    {
      id: 'commerce-brand-impersonation',
      label: 'impersonates a shopping, payment, or bank brand',
      weight: 6,
      categories: ['claim', 'brand', 'credential'],
      pattern: /\b(?:amazon|paypal|netflix|chase|wells\s*fargo|bank\s+of\s+america|citibank|citi\s*bank|american\s+express|amex)\b.{0,120}\b(?:account|log\s*in|sign\s*in|verify|suspended|unusual\s+activity|update\s+(?:payment|billing)|confirm\s+(?:your\s+)?identity|secure\s+your)\b|\b(?:account|log\s*in|sign\s*in|verify|suspended|unusual\s+activity|update\s+(?:payment|billing)|confirm\s+(?:your\s+)?identity)\b.{0,120}\b(?:amazon|paypal|netflix|chase|wells\s*fargo|bank\s+of\s+america|citibank|american\s+express|amex)\b/i
    },
    {
      id: 'gift-card-payment-scam',
      label: 'asks for gift cards or untraceable payment',
      weight: 8,
      categories: ['claim', 'action', 'credential'],
      highPrecision: true,
      pattern: /\b(?:buy|purchase|get)\s+(?:google\s+play|itunes|apple|steam|target|walmart|amazon)\s+gift\s+cards?\b|\b(?:pay|send)\s+(?:with|using)\s+gift\s+cards?\b|\b(?:wire|zelle|venmo|cash\s*app)\s+(?:transfer|payment)\b.{0,80}\b(?:urgent|immediately|now)\b/i
    },
    {
      id: 'crypto-wallet-drain',
      label: 'pressures a crypto wallet connection or seed phrase',
      weight: 9,
      categories: ['claim', 'action', 'credential'],
      highPrecision: true,
      pattern: /\b(?:connect\s+(?:your\s+)?wallet|wallet\s+connect|seed\s+phrase|recovery\s+phrase|secret\s+phrase|mnemonic)\b.{0,120}\b(?:verify|confirm|approve|sign|claim|airdrop|reward)\b|\b(?:approve|sign)\s+(?:this\s+)?(?:transaction|contract|request)\b.{0,80}\b(?:wallet|crypto|token|nft)\b/i
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
      pattern: new RegExp(
        String.raw`\b(?:call|contact)\b(?:\s+(?:microsoft|windows|apple|google|norton|mcafee|support|a\s+technician|us|now|immediately|toll[- ]?free|the|at|on|for)){0,10}\s*` +
          PHONE +
          String.raw`\b`,
        'i'
      )
    },
    {
      id: 'brand-helpline',
      label: 'shows a brand support helpline phone number',
      weight: 6,
      categories: ['action', 'support', 'brand'],
      pattern: new RegExp(
        String.raw`\b(?:microsoft|windows|apple|google|norton|mcafee)\s+(?:support|helpline|technician|security)\b[:\s.-]{0,24}` +
          PHONE +
          String.raw`\b|\b` +
          PHONE +
          String.raw`\b.{0,80}\b(?:microsoft|windows|apple|google|norton|mcafee)\s+(?:support|helpline|technician)\b`,
        'i'
      )
    },
    {
      id: 'support-app-download',
      label: 'pushes a support or report desktop app download',
      weight: 6,
      categories: ['action', 'download', 'support'],
      pattern: /\b(?:download|install)\b.{0,100}\b(?:support|security|report|remote)\s+(?:desktop\s+)?(?:app|tool|application|software|client)\b|\b(?:support|security|report)\s+(?:desktop\s+)?(?:app|tool|application|software|client)\b.{0,100}\b(?:download|install)\b/i
    },
    {
      id: 'remote-access-tool',
      label: 'pushes a remote-access tool for supposed support',
      weight: 7,
      categories: ['action', 'support', 'download'],
      pattern: /\b(?:anydesk|teamviewer|remote\s+(?:access|desktop|control|assistance))\b.{0,100}\b(?:download|install|support|repair|fix|technician|continue)\b|\b(?:download|install|support|repair|technician|continue)\b.{0,100}\b(?:anydesk|teamviewer|remote\s+(?:access|desktop|control|assistance))\b/i
    },
    {
      id: 'view-report-download',
      label: 'requires a download to view a supposed report',
      weight: 5,
      categories: ['claim', 'action', 'download'],
      pattern: /\b(?:view|open|read|access)\s+(?:your\s+)?(?:report|scan\s+results?|security\s+report)\b.{0,100}\b(?:download|install)\b|\b(?:download|install)\b.{0,100}\b(?:view|open|read|access)\s+(?:your\s+)?(?:report|scan\s+results?|security\s+report)\b/i
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
      pattern: /\b(?:verify|confirm|restore|unlock|secure)\s+(?:your\s+)?(?:account|identity)\b|\bsign\s+in\s+(?:now\s+)?to\s+(?:verify|restore|unlock|secure)\b|\blog\s*in\s+to\s+(?:your\s+)?(?:account|amazon|paypal|bank)\b/i
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
    'mcafee.com', 'norton.com', 'apple.com', 'mozilla.org',
    'bing.com', 'duckduckgo.com',
    'amazon.com', 'amazon.co.uk', 'paypal.com', 'paypal.me',
    'netflix.com', 'chase.com', 'wellsfargo.com', 'bankofamerica.com',
    'citi.com', 'citibank.com', 'americanexpress.com', 'amex.com',
    // Code/docs hosts often quote malware wording; never full-page block them.
    // Do not include github.io - that suffix is commonly abused for phishing.
    'github.com', 'githubusercontent.com', 'githubassets.com', 'github.dev'
  ];

  const MAIL_HOST_SUFFIXES = [
    'mail.google.com',
    'outlook.live.com',
    'outlook.office.com',
    'outlook.office365.com',
    'mail.proton.me',
    'mail.protonmail.com',
    'mail.yahoo.com',
    'mail.aol.com',
    'outlook.aol.com',
    'mail.zoho.com',
    'www.icloud.com',
    'icloud.com',
    'mail.fastmail.com',
    'mail.tutanota.com',
    'app.tuta.com'
  ];

  const ABUSE_PRONE_SUFFIXES = [
    'web.app', 'firebaseapp.com', 'pages.dev', 'vercel.app', 'netlify.app',
    'duckdns.org', '000webhostapp.com', 'ngrok.io', 'trycloudflare.com'
  ];

  const ABUSE_PRONE_TLDS = new Set([
    'top', 'xyz', 'buzz', 'click', 'icu', 'country', 'rest', 'live', 'online',
    'work', 'loan', 'cam', 'gq', 'tk', 'ml', 'ga', 'cf', 'zip', 'mov', 'sbs',
    'cfd', 'shop', 'bond', 'monster', 'quest', 'beauty', 'hair', 'makeup'
  ]);

  const SHOPPING_SCAM_PATTERN = /\b(?:complete\s+(?:your\s+)?(?:order|payment)|enter\s+(?:card|payment)\s+details|billing\s+address|gift\s+card\s+(?:code|number|pin)|verification\s+code|confirm\s+payment|update\s+billing)\b/i;

  const AFTER_SCAM_DURATION_MS = 48 * 60 * 60 * 1000;

  const BUNDLED_BAD_HOST_FRAGMENTS = [
    'microsoft-support',
    'windows-defender',
    'apple-id-login',
    'appleid-verify',
    'paypal-secure',
    'amazon-account',
    'bank-verify',
    'secure-login',
    'account-update',
    'crypto-airdrop',
    'wallet-connect',
    'tech-support',
    'pc-locked',
    'virus-alert',
    'malware-alert',
    'delivery-fee',
    'parcel-fee',
    'voicemail-alert'
  ];

  const SMS_SMISHING_PATTERN = /\b(?:smishing|text\s+message\s+scam|reply\s+stop|your\s+package|missed\s+delivery|voicemail\s+waiting)\b/i;

  const BRAND_HOST_TOKENS = [
    'amazon', 'paypal', 'apple', 'microsoft', 'windows', 'google', 'netflix',
    'chase', 'wellsfargo', 'bankofamerica', 'citibank', 'amex', 'norton',
    'mcafee', 'defender', 'techsupport'
  ];

  const COMMON_HOST_LABELS = new Set([
    'www', 'www2', 'mail', 'smtp', 'ftp', 'cdn', 'static', 'assets', 'img',
    'images', 'api', 'app', 'm', 'mobile', 'blog', 'shop', 'store', 'support',
    'help', 'docs', 'dev', 'staging', 'test', 'beta', 'portal', 'login',
    'secure', 'cloud', 'media', 'video', 'news'
  ]);

  const EDITORIAL_PATTERN = /\b(?:according\s+to|ai\s+overview|analysis|article|explains?|example|fake\s+(?:alert|warning|notification|virus)|guide|how\s+to|in\s+this\s+(?:article|report)|news|phishing|researchers?|reported|reporting|scam|scareware|screenshot|search\s+results?|security\s+research|what\s+to\s+do)\b/gi;

  const MAIL_URGENCY_PATTERN = /\b(?:verify|suspended|unusual\s+activity|update\s+(?:payment|billing)|click\s+here|confirm\s+(?:your\s+)?(?:account|identity)|act\s+now|urgent|immediately|password\s+(?:reset|expire)|secure\s+your\s+account)\b/i;

  const MAIL_BRAND_PATTERN = /\b(?:costco|lowe['’']?s|lowes|best\s*buy|bestbuy|walmart|target|home\s*depot|united\s*healthcare?|amazon|paypal|apple|microsoft|samsung|sony|nike|macy['’']?s|nordstrom|ikea|ace\s+hardware)\b/i;

  const MAIL_REWARD_BAIT_PATTERN = /\b(?:claim\s+(?:now|your\s+free|this\s+free|your\s+(?:reward|bonus|gift|prize|yeti|shark|dewalt|kobalt|ridgid|oral))|you(?:'ve|\s+have)?\s+(?:won|been\s+(?:chosen|selected))|\byou\s+won\b|\bwon\s+a\b|free\s+(?:gift|tool\s+set|vacuum|kit|reward|bonus)|pick\s+up\s+your|get\s+it\s+from\s+the\s+nearest\s+store|answer\s*(?:&|and)\s*win|exclusive\s+(?:opportunity|shopper\s+offer|reward)|complimentary\s+\w+.{0,80}claim|loyalty\s+program.{0,80}(?:free|chosen|selected)|we(?:'re|\s+are)\s+giving\s+you|brand[- ]?new\s+\w+.{0,60}(?:claim|win|free|bonus)|combo\s+kit|just\s+for\s+you|awaits?)\b/i;

  const MAIL_PRIZE_PRODUCT_PATTERN = /\b(?:yeti|dewalt|kobalt|ridgid|shark|oral-?b|ipad|iphone|gift\s*card|pressure\s+washer|(?:\d+-)?tool\s+(?:set|combo|kit)|cordless\s+(?:vacuum|tool|\d+-tool))\b/i;

  const MAIL_CAMPAIGN_PREFIX_PATTERN = /^[a-z]{6,}[\s,]+|[a-z]{6,}(?:studios?|offers?|deals?|rewards?)\b/i;

  // Loan / grant inbox spam (often uses personalization tokens + "great news").
  const MAIL_LOAN_GRANT_BAIT_PATTERN = /\b(?:you\s+may\s+qualify\s+to\s+borrow|qualify\s+to\s+borrow|loan\s+approval|free\s+grant\s+info|free\s+grant\b|home\s+equity\s+without\s+the\s+hassle|borrow\s+from\s+\$?\d[\d,]*(?:\s*[---]\s*\$?\d[\d,]*)?)\b/i;

  // Camouflage spam farms: generic noun sender + SEO/news headline subject.
  const MAIL_CAMOUFLAGE_HEADLINE_PATTERN = /\b(?:improv(?:e|es|ed|ing)|reduc(?:e|es|ed|ing)|generat(?:e|es|ed|ing)|introduc(?:e|es|ed|ing)|continu(?:e|es|ed|ing)|evolv(?:e|es|ed|ing)|scale|capabilities|digital\s+twins?|renewable|automated|smart\s+(?:waste|recreation|city)|floating\s+solar|cultured\s+meat|industrial\s+planning|energy\s+use|clean\s+electricity|city\s+services)\b/i;

  const MAIL_TRUSTED_SENDER_PATTERN = /\b(?:costco|lowe['’']?s|lowes|best\s*buy|bestbuy|walmart|target|home\s*depot|amazon|paypal|apple|microsoft|google|yahoo|aol|proton|outlook|microsoft\s+account|github|usps|ups|fedex|irs|ssa|medicare|social\s+security)\b/i;

  // Romance / sextortion-style inbox bait (pattern-based; no personal names).
  const MAIL_ROMANCE_BAIT_PATTERN = /\b(?:just\s+saw\s+your\s+profile|saw\s+your\s+profile|here'?s\s+my\s+picture|here\s+is\s+my\s+picture|\d+\s+new\s+photos?\s+from|check\s+out\s+my\s+(?:photos?|pictures?|profile)|send\s+\w+\s+a\s+message|want\s+to\s+chat(?:\s+with\s+you)?|new\s+match(?:\s+wants)?|looking\s+for\s+a\s+(?:man|woman|friend|real\s+friend)|accept\s+me|online\s+now|i\s+want\s+to\s+chat|wants\s+to\s+suck)\b/i;

  const MAIL_MEDIA_BAIT_PATTERN = /\b(?:photos?\s+and\s+videos?\s+(?:emailed|sent)|pics?\s*\+\s*vids?|sent\s+to\s+your\s+mail|private\s+(?:photos?|videos?|pics?)|click\s+to\s+view\s+(?:photo|image|pic)|view\s+(?:photo|image|pic))\b/i;

  const MAIL_ATTACHMENT_BAIT_PATTERN = /\b(?:\d+\s+attachments?|IMG_\d+\.(?:jpe?g|png|gif|webp))\b/i;

  const MAIL_NEUROPATHY_HEALTH_PATTERN = /\b(?:tingling|numbness|burning).{0,48}(?:feet|toes|legs)|neuropathy\s+breakthrough|eat\s+this\b/i;

  const MAIL_ADULT_HEALTH_TRICK_PATTERN = /\b(?:reveals?\s+how|simple\s+trick|get\s+you\s+hard|hollywood\s+honey|exotic\s+honey|1\s+tsp)\b/i;

  const MAIL_CULT_SCAM_PATTERN = /\billuminati\b|\bdear\s+sir\/madam\b/i;

  // Bot/script leftovers often dump a full timezone timestamp into the subject.
  const MAIL_SUBJECT_TIMESTAMP_DUMP_PATTERN = /\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\s+\d{2}:\d{2}:\d{2}\s+[+-]\d{4}\b/i;

  const MAIL_JACKPOT_BAIT_PATTERN = /\b(?:jackpot|we\s+owe\s+you|free\s+coins|up\s+to\s+[\d.,]+\s*[kmb]?t?\s+free\s+coins|[\d.,]+\s*t\s+free\s+coins|casino\s+bonus|spin\s+to\s+win)\b/i;

  const MAIL_CLOUD_SCARE_PATTERN = /\b(?:files?\s+are\s+waiting|waiting\s+for\s+available\s+cloud\s+space|available\s+cloud\s+space|(?:\d{1,3},)?\d{3,}\s+files?\s+(?:are\s+)?waiting|cloud\s+(?:storage|space).{0,40}(?:full|waiting|almost\s+full|running\s+out))\b/i;

  const MAIL_INSURANCE_COLD_PATTERN = /(?:\$|USD|US\$)?\s?\d{1,3}(?:,\d{3})+(?:\.\d{2})?\s+in\s+life\s+insurance\b|\blife\s+insurance\b.{0,40}\b(?:alert|claim|qualified|approved)\b|\balert\b.{0,40}\blife\s+insurance\b/i;

  const MAIL_VAGUE_CURIOSITY_SUBJECT_PATTERN = /^(?:this\s+is\s+for\s+you|for\s+you\s+only|you\s+need\s+to\s+see\s+this|open\s+this\s+now)$/i;

  // Common elderly-targeted inbox scams and dangerous health/finance spam.
  const MAIL_ELDER_BENEFITS_BAIT_PATTERN = /\b(?:social\s+security|ssa\.gov|medicare(?:\s+advantage)?|medicaid|stimulus\s+(?:check|payment)|benefit\s+(?:suspended|paused|cancelled|canceled|expired)|your\s+benefits?\s+(?:are|have\s+been)\s+(?:suspended|paused)|cost[- ]of[- ]living\s+increase|direct\s+express\s+card)\b/i;

  const MAIL_PACKAGE_DELIVERY_BAIT_PATTERN = /\b(?:undelivered\s+package|package\s+(?:pending|held|waiting)|delivery\s+(?:attempt\s+failed|fee\s+required|pending)|track(?:ing)?\s+(?:your\s+)?(?:parcel|package)|customs?\s+fee\s+(?:required|due)|redelivery\s+fee)\b/i;

  const SHORTENER_HOSTS = new Set([
    'bit.ly',
    't.co',
    'tinyurl.com',
    'goo.gl',
    'ow.ly',
    'is.gd',
    'buff.ly',
    'rebrand.ly',
    'cutt.ly',
    'rb.gy',
    'shorturl.at',
    's.id',
    'tiny.cc',
    'lc.chat',
    'soo.gd'
  ]);

  const SMISHING_PATH_PATTERN = /\b(?:voicemail|voice-?mail|missed-?call|package|parcel|delivery|track(?:ing)?|usps|ups|fedex|dhl|irs|refund|secure-?pay|verify-?account|signin|login|unlock|billing|invoice|payment|wallet)\b/i;

  const MAIL_GIFT_CARD_WIRE_BAIT_PATTERN = /\b(?:gift\s*cards?\s+(?:needed|required|to\s+pay)|buy\s+(?:itunes|apple|google\s+play|steam)\s+gift\s*cards?|wire\s+(?:transfer|money)|western\s+union|moneygram|send\s+bitcoin|pay\s+with\s+crypto(?:currency)?|urgent(?:ly)?\s+need\s+money)\b/i;

  const MAIL_HEALTH_MIRACLE_BAIT_PATTERN = /\b(?:nutritionists?\s+say|doctors?\s+hate|keeps?\s+women\s+slim|belly\s+fat\s+(?:melt|gone|trick)|miracle\s+(?:weight\s+loss|cure|pill)|one\s+weird\s+trick|baking\s+soda\s+recipe|compounded\s+semaglutide|semaglutide\s+starting\s+at|ozempic\s+(?:for\s+\$|hack|trick)|glp-?1\s+(?:for\s+less|cheap|starting)|lose\s+\d+\s+pounds?\s+in\s+\d+)\b/i;

  const MAIL_WARRANTY_HOME_BAIT_PATTERN = /\b(?:home\s+warranty|appliance\s+protection\s+plan|your\s+warranty\s+(?:is\s+)?(?:expiring|expired)|protect\s+your\s+home\s+(?:today|now)|final\s+notice.{0,40}warranty)\b/i;

  const MAIL_TECH_SUPPORT_EMAIL_BAIT_PATTERN = /\b(?:microsoft\s+(?:support|security)|apple\s+support\s+(?:alert|team)|your\s+(?:pc|computer|device)\s+(?:is\s+)?(?:infected|locked|suspended)|call\s+(?:microsoft|apple|windows)\s+support|virus\s+detected\s+on\s+your|tech\s+support(?:\s+alert)?)\b/i;

  // Brands / institutions often spoofed in From display names.
  const MAIL_IMPERSONATION_BRAND_PATTERN = /\b(?:amazon|paypal|apple|microsoft|google|costco|lowe['’']?s|lowes|best\s*buy|bestbuy|walmart|target|home\s*depot|homedepot|chase|wells\s*fargo|bank\s+of\s+america|citibank|american\s+express|amex|irs|ssa|social\s+security|medicare|usps|ups|fedex|netflix|ebay|facebook|instagram|whatsapp|uber|lyft|loan\s*depot|loandepot|globe\s*life|norton|mcafee|geek\s*squad|paypal)\b/i;

  const FREE_MAIL_DOMAINS = new Set([
    'gmail.com', 'googlemail.com', 'yahoo.com', 'ymail.com', 'rocketmail.com',
    'hotmail.com', 'outlook.com', 'live.com', 'msn.com', 'aol.com', 'aim.com',
    'icloud.com', 'me.com', 'mac.com', 'proton.me', 'protonmail.com', 'pm.me',
    'gmx.com', 'gmx.net', 'mail.com', 'email.com', 'zoho.com', 'yandex.com',
    'yandex.ru', 'qq.com', 'mail.ru'
  ]);

  const MAX_LEARNED_PATTERNS = 200;

  function suffixMatches(hostname, suffix) {
    return hostname === suffix || hostname.endsWith(`.${suffix}`);
  }

  function isOfficialHost(hostname) {
    const value = String(hostname || '').toLowerCase();
    return OFFICIAL_SUFFIXES.some((suffix) => suffixMatches(value, suffix));
  }

  function isMailHost(hostname) {
    const value = String(hostname || '').toLowerCase();
    if (!value) {
      return false;
    }
    if (value === 'mail.yahoo.com' || value.endsWith('.mail.yahoo.com')) {
      return true;
    }
    if (value.endsWith('.ymail.com') || value === 'ymail.com') {
      return true;
    }
    return MAIL_HOST_SUFFIXES.some((suffix) => suffixMatches(value, suffix));
  }

  function uniqueMatches(text, pattern, cap) {
    const matches = String(text || '').match(pattern) || [];
    return Math.min(new Set(matches.map((item) => item.toLowerCase())).size, cap);
  }

  function isShortScrambleLabel(label) {
    const value = String(label || '').toLowerCase();
    if (!value || COMMON_HOST_LABELS.has(value)) {
      return false;
    }
    if (value.length < 6 || value.length > 13) {
      return false;
    }
    if (!/[a-z]/.test(value) || !/\d/.test(value)) {
      return false;
    }
    const letters = value.replace(/[^a-z]/g, '');
    const vowels = (letters.match(/[aeiou]/g) || []).length;
    const vowelRatio = letters.length ? vowels / letters.length : 1;
    const hyphenCount = (value.match(/-/g) || []).length;
    return hyphenCount >= 1 || vowelRatio <= 0.4 || value.length <= 10;
  }

  function isGibberishLabel(label) {
    const value = String(label || '').toLowerCase();
    if (!value || COMMON_HOST_LABELS.has(value)) {
      return false;
    }
    if (isShortScrambleLabel(value)) {
      return true;
    }

    const letters = value.replace(/[^a-z]/g, '');
    const digits = (value.match(/\d/g) || []).length;
    const hyphenCount = (value.match(/-/g) || []).length;

    if (value.length >= 14 && /[a-z]/.test(value) && digits >= 2) {
      return true;
    }
    if (hyphenCount >= 3 && value.length >= 12) {
      return true;
    }
    if (letters.length < 10) {
      return false;
    }

    const vowels = (letters.match(/[aeiou]/g) || []).length;
    const vowelRatio = vowels / letters.length;
    if (/[bcdfghjklmnpqrstvwxyz]{6,}/i.test(letters)) {
      return true;
    }
    if (letters.length >= 14 && vowelRatio < 0.22) {
      return true;
    }
    if (letters.length >= 18 && vowelRatio < 0.28) {
      return true;
    }
    return false;
  }

  function normalizeHostnameConfusables(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[\u0430\u0432\u0435\u0437\u0438\u043a\u043c\u043d\u043e\u0440\u0441\u0442\u0443\u0445]/g, (char) => {
        const map = {
          '\u0430': 'a',
          '\u0432': 'b',
          '\u0435': 'e',
          '\u0437': 'z',
          '\u0438': 'i',
          '\u043a': 'k',
          '\u043c': 'm',
          '\u043d': 'n',
          '\u043e': 'o',
          '\u0440': 'p',
          '\u0441': 'c',
          '\u0442': 't',
          '\u0443': 'y',
          '\u0445': 'x'
        };
        return map[char] || char;
      })
      .replace(/[\u03b1\u03b2\u03b5\u03b7\u03b9\u03ba\u03bc\u03bd\u03bf\u03c1\u03c4\u03c5\u03c7]/g, (char) => {
        const map = {
          '\u03b1': 'a',
          '\u03b2': 'b',
          '\u03b5': 'e',
          '\u03b7': 'n',
          '\u03b9': 'i',
          '\u03ba': 'k',
          '\u03bc': 'm',
          '\u03bd': 'v',
          '\u03bf': 'o',
          '\u03c1': 'p',
          '\u03c4': 't',
          '\u03c5': 'y',
          '\u03c7': 'x'
        };
        return map[char] || char;
      });
  }

  function findBrandLookalike(hostname) {
    if (isOfficialHost(hostname)) {
      return null;
    }
    const compact = normalizeHostnameConfusables(hostname).replace(/[^a-z0-9]/g, '');
    for (const token of BRAND_HOST_TOKENS) {
      if (compact.includes(token)) {
        return token;
      }
    }
    return null;
  }

  function analyzeHostnameHomoglyphs(hostname) {
    const value = String(hostname || '').toLowerCase();
    const labels = value.split('.').filter(Boolean);
    const reasons = [];
    let score = 0;

    for (const label of labels) {
      if (!label || label.startsWith('xn--')) {
        continue;
      }
      const hasLatin = /[a-z]/.test(label);
      const hasCyrillic = /[\u0400-\u04ff]/.test(label);
      const hasGreek = /[\u0370-\u03ff]/.test(label);
      if (hasLatin && (hasCyrillic || hasGreek)) {
        score += 3;
        reasons.push('mixes lookalike foreign letters in the hostname');
        break;
      }
      if ((hasCyrillic || hasGreek) && !hasLatin) {
        score += 2;
        reasons.push('uses non-Latin letters in a website address');
        break;
      }
    }

    return { score, reasons };
  }

  function analyzeHostname(hostname) {
    const value = String(hostname || '').toLowerCase();
    const labels = value.split('.').filter(Boolean);
    const reasons = [];
    let score = 0;
    let shortScramble = false;
    let brandLookalike = null;

    if (!value) {
      return {
        score: 0,
        reasons: [],
        shortScramble: false,
        brandLookalike: null,
        abuseTld: false
      };
    }

    if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(value) || /^\[[0-9a-f:]+\]$/i.test(value)) {
      score += 2;
      reasons.push('uses an IP address instead of a normal hostname');
    }
    if (value.includes('xn--')) {
      score += 2;
      reasons.push('uses an internationalized lookalike hostname');
    }

    const homoglyphs = analyzeHostnameHomoglyphs(value);
    if (homoglyphs.score > 0) {
      score += homoglyphs.score;
      reasons.push(...homoglyphs.reasons);
    }

    const scrambleLabels = labels.filter((label) => isShortScrambleLabel(label) || isGibberishLabel(label));
    shortScramble = labels.some(isShortScrambleLabel);
    if (scrambleLabels.length >= 1) {
      score += 1;
      reasons.push('uses a scrambled or machine-looking hostname');
    }
    if (scrambleLabels.length >= 2) {
      score += 1;
      reasons.push('uses multiple scrambled hostname labels');
    }

    if (labels.length >= 5) {
      score += 1;
      reasons.push('uses an unusually deep subdomain chain');
    }

    brandLookalike = findBrandLookalike(value);
    if (brandLookalike) {
      score += 2;
      reasons.push('uses a trusted brand name in an unofficial hostname');
    }

    if (matchesBundledBadHost(value)) {
      score += 2;
      reasons.push('matches a commonly abused scam-host pattern shipped with Grandma Guard');
    }

    const hostWords = value.replace(/[-.]/g, ' ');
    if (!brandLookalike && /\b(?:tech\s*support)\b/i.test(hostWords)) {
      score += 1;
      reasons.push('uses support wording in the hostname');
    }
    if (/(?:virus|malware|pc-?locked|secure-?update|helpline|windows-?support|microsoft-?support|account-?update|secure-?login)/i.test(value)) {
      score += 1;
      reasons.push('uses scare or support wording in the hostname');
    }

    const tld = labels[labels.length - 1] || '';
    const abuseTld = ABUSE_PRONE_TLDS.has(tld);
    if (abuseTld && (shortScramble || scrambleLabels.length > 0 || brandLookalike)) {
      score += 1;
      reasons.push('uses an abuse-prone domain ending with a scrambled hostname');
    }

    if (!isOfficialHost(value) && ABUSE_PRONE_SUFFIXES.some((suffix) => suffixMatches(value, suffix))) {
      const hasOddLabel = scrambleLabels.length > 0 || labels.some((label) => label.length >= 16);
      if (hasOddLabel) {
        score += 1;
        reasons.push('uses an abuse-prone hosting hostname shape');
      }
    }

    return {
      score,
      reasons: Array.from(new Set(reasons)),
      shortScramble,
      brandLookalike,
      abuseTld
    };
  }

  function hostSignals(snapshot) {
    const analyzed = analyzeHostname(snapshot.hostname);
    const reasons = analyzed.reasons.slice();
    let score = analyzed.score;

    if (snapshot.protocol === 'http:') {
      score += 1;
      reasons.push('uses an unencrypted connection');
    }

    return { score, reasons, brandLookalike: analyzed.brandLookalike };
  }

  function analyzeLink(input) {
    const href = String(input?.href || '').trim();
    const linkText = String(input?.linkText || '');
    const contextText = String(input?.contextText || '');
    let hostname = '';

    try {
      const parsed = new URL(href);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return {
          suspicious: false,
          score: 0,
          reasons: [],
          hostname: ''
        };
      }
      hostname = parsed.hostname.toLowerCase();
    } catch {
      return {
        suspicious: false,
        score: 0,
        reasons: [],
        hostname: ''
      };
    }

    if (isOfficialHost(hostname) || isMailHost(hostname)) {
      return {
        suspicious: false,
        score: 0,
        reasons: [],
        hostname
      };
    }

    const host = analyzeHostname(hostname);
    const reasons = host.reasons.slice();
    let score = host.score;

    if (/\b(?:amazon|paypal|apple|microsoft|netflix|chase|wellsfargo|bankofamerica|citibank)\.(?:com|net|org)\b/i.test(linkText) &&
      !isOfficialHost(hostname)) {
      score += 3;
      reasons.push('link text looks like a trusted brand but goes elsewhere');
    }

    const combinedText = `${linkText}\n${contextText}`;
    if (MAIL_URGENCY_PATTERN.test(combinedText) && host.score >= 1) {
      score += 2;
      reasons.push('uses urgent account wording near a suspicious link');
    }

    if (host.brandLookalike && MAIL_URGENCY_PATTERN.test(combinedText)) {
      score += 1;
    }

    try {
      const pathValue = new URL(href).pathname || '';
      if (SMISHING_PATH_PATTERN.test(pathValue) && host.score >= 1) {
        score += 2;
        reasons.push('uses a delivery, voicemail, or account-style link path on a risky site');
      }
    } catch {
      // Ignore malformed paths.
    }

    if (input.resolvedFrom && input.resolvedFrom !== href) {
      score += 1;
      reasons.push('short link redirects to a different suspicious destination');
    }

    const learned = scoreLearnedBadLinkHost(hostname, input.learnedBadLinkHosts);
    score += learned.score;
    reasons.push(...learned.reasons);

    const ctx = resolveProtectionContext(input);
    const linkThreshold = Math.max(3, 4 - ctx.thresholdReduction);

    const suspicious = Boolean(
      learned.score > 0 ||
      host.brandLookalike ||
      (score >= 3 && host.score >= 1) ||
      score >= linkThreshold
    );

    return {
      suspicious,
      score,
      reasons: Array.from(new Set(reasons)).slice(0, 12),
      hostname,
      href
    };
  }

  function isShortenerHost(hostname) {
    const host = String(hostname || '').toLowerCase().replace(/^www\./, '');
    return SHORTENER_HOSTS.has(host);
  }

  function analyzeEmailLinks(links, options = {}) {
    const items = Array.isArray(links) ? links.slice(0, 24) : [];
    let best = {
      suspicious: false,
      score: 0,
      reasons: [],
      hostname: '',
      href: ''
    };

    for (const link of items) {
      const result = analyzeLink({
        ...options,
        ...link
      });
      if (result.suspicious && result.score >= best.score) {
        best = {
          suspicious: true,
          score: result.score,
          reasons: result.reasons || [],
          hostname: result.hostname || '',
          href: result.href || link?.href || ''
        };
      }
    }

    if (best.suspicious && best.hostname) {
      best.reasons = [
        `contains a suspicious link (${best.hostname})`,
        ...best.reasons.filter((reason) => !reason.startsWith('contains a suspicious link'))
      ].slice(0, 12);
    }

    return best;
  }

  function pickBlockPageTip(reasons) {
    const text = Array.isArray(reasons) ? reasons.join(' ').toLowerCase() : '';
    if (/gift\s*card|wire|zelle|venmo|bitcoin|crypto/.test(text)) {
      return 'Real companies, banks, and government offices never ask for gift cards, wire transfers, or crypto payment.';
    }
    if (/support|call|phone|helpline|locked|virus|malware|infected/.test(text)) {
      return 'Microsoft, Apple, and your bank will not call you from a web page. Close the tab and ask someone you trust.';
    }
    if (/password|log\s*in|sign\s*in|account|verify|credential|wallet|seed\s+phrase/.test(text)) {
      return 'Only enter passwords on official websites you opened yourself. When unsure, call the company using the number on your card or bill.';
    }
    if (/notification|allow|push/.test(text)) {
      return 'Do not click Allow on strange pages. Real websites do not need notification permission to show a video or article.';
    }
    if (/delivery|package|parcel|voicemail|tracking/.test(text)) {
      return 'Delivery and voicemail scams often use urgent links. Open the real carrier or bank app instead of clicking email links.';
    }
    return 'If this warning surprised you, close the tab and ask a family member before doing anything else.';
  }

  function summarizeWeeklyProtection(events) {
    const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const recent = (Array.isArray(events) ? events : []).filter((event) => {
      const time = Date.parse(String(event?.timestamp || ''));
      return Number.isFinite(time) && time >= weekAgo;
    });

    const counts = {
      blocked: 0,
      email: 0,
      links: 0,
      continued: 0,
      markedSafe: 0
    };
    const categories = {
      scareware: 0,
      email: 0,
      links: 0,
      login: 0,
      other: 0
    };

    for (const event of recent) {
      const outcome = String(event?.outcome || '');
      const reasons = Array.isArray(event.reasons) ? event.reasons.join(' ').toLowerCase() : '';
      if (outcome === 'blocked') {
        counts.blocked += 1;
      } else if (outcome === 'email-warned') {
        counts.email += 1;
      } else if (outcome === 'link-warned') {
        counts.links += 1;
      } else if (outcome === 'continued-once') {
        counts.continued += 1;
      } else if (outcome === 'marked-safe') {
        counts.markedSafe += 1;
      }

      if (/virus|malware|support|locked|notification|overlay|scare/.test(reasons)) {
        categories.scareware += 1;
      } else if (outcome === 'email-warned') {
        categories.email += 1;
      } else if (outcome === 'link-warned' || /suspicious link/.test(reasons)) {
        categories.links += 1;
      } else if (/password|login|sign in|credential|brand/.test(reasons)) {
        categories.login += 1;
      } else {
        categories.other += 1;
      }
    }

    return {
      total: recent.length,
      counts,
      categories
    };
  }

  function buildSettingsExport(state) {
    return {
      grandmaGuardExport: 1,
      exportedAt: new Date().toISOString(),
      protectionLevel: state.protectionLevel === 'careful' ? 'careful' : 'standard',
      strictModeEnabled: Boolean(state.strictModeEnabled),
      shoppingModeEnabled: Boolean(state.shoppingModeEnabled),
      autoAfterScamOnContinue: state.autoAfterScamOnContinue !== false,
      afterScamUntil: Number(state.afterScamUntil) || 0,
      trustedHosts: Array.isArray(state.trustedHosts) ? state.trustedHosts.slice().sort() : [],
      blockedHosts: Array.isArray(state.blockedHosts) ? state.blockedHosts.slice().sort() : [],
      learnedBadLinkHosts: Array.isArray(state.learnedBadLinkHosts) ? state.learnedBadLinkHosts.slice().sort() : [],
      learnedMailPatterns: Array.isArray(state.learnedMailPatterns) ? state.learnedMailPatterns : [],
      learnedSafeMailPatterns: Array.isArray(state.learnedSafeMailPatterns) ? state.learnedSafeMailPatterns : [],
      localMailLearningConsent: String(state.localMailLearningConsent || 'unset')
    };
  }

  function mergeSettingsImport(current, payload) {
    if (!payload || payload.grandmaGuardExport !== 1) {
      return { ok: false, reason: 'invalid-format' };
    }

    const next = { ...current };
    if (payload.protectionLevel === 'careful' || payload.protectionLevel === 'standard') {
      next.protectionLevel = payload.protectionLevel;
    }
    if (typeof payload.strictModeEnabled === 'boolean') {
      next.strictModeEnabled = payload.strictModeEnabled;
    }
    if (typeof payload.shoppingModeEnabled === 'boolean') {
      next.shoppingModeEnabled = payload.shoppingModeEnabled;
    }
    if (typeof payload.autoAfterScamOnContinue === 'boolean') {
      next.autoAfterScamOnContinue = payload.autoAfterScamOnContinue;
    }
    if (Number.isFinite(Number(payload.afterScamUntil))) {
      next.afterScamUntil = Number(payload.afterScamUntil);
    }
    if (Array.isArray(payload.trustedHosts)) {
      next.trustedHosts = payload.trustedHosts.map(normalizeTrustedHost).filter(Boolean).sort();
    }
    if (Array.isArray(payload.blockedHosts)) {
      next.blockedHosts = payload.blockedHosts.map(normalizeTrustedHost).filter(Boolean).sort();
    }
    if (Array.isArray(payload.learnedBadLinkHosts)) {
      next.learnedBadLinkHosts = payload.learnedBadLinkHosts.map(normalizeTrustedHost).filter(Boolean).sort();
    }
    if (Array.isArray(payload.learnedMailPatterns)) {
      next.learnedMailPatterns = payload.learnedMailPatterns;
    }
    if (Array.isArray(payload.learnedSafeMailPatterns)) {
      next.learnedSafeMailPatterns = payload.learnedSafeMailPatterns;
    }
    if (payload.localMailLearningConsent === 'allowed' ||
      payload.localMailLearningConsent === 'declined' ||
      payload.localMailLearningConsent === 'unset') {
      next.localMailLearningConsent = payload.localMailLearningConsent;
      next.localMailLearningEnabled = payload.localMailLearningConsent === 'allowed';
    }
    return { ok: true, settings: next };
  }

  function isBlockedHost(hostname, blockedHosts) {
    const host = normalizeTrustedHost(hostname);
    if (!host || !Array.isArray(blockedHosts) || blockedHosts.length === 0) {
      return false;
    }
    for (const entry of blockedHosts) {
      const blocked = normalizeTrustedHost(entry);
      if (!blocked) {
        continue;
      }
      if (host === blocked || host.endsWith(`.${blocked}`)) {
        return true;
      }
    }
    return false;
  }

  function matchesBundledBadHost(hostname) {
    const value = String(hostname || '').toLowerCase();
    if (!value || isOfficialHost(value)) {
      return false;
    }
    const compact = value.replace(/^www\./, '');
    return BUNDLED_BAD_HOST_FRAGMENTS.some((fragment) => compact.includes(fragment));
  }

  function pickEmailScamTip(kind, reasons) {
    const text = `${kind}\n${Array.isArray(reasons) ? reasons.join(' ') : ''}`.toLowerCase();
    if (kind === 'link' || /suspicious link/.test(text)) {
      return 'Do not click links inside this email. If you need to check an account, open the app or type the address yourself.';
    }
    if (/gift|wire|crypto|payment|billing/.test(text)) {
      return 'Real companies never ask for gift cards or rushed payments by email.';
    }
    if (/reward|prize|won|claim|yeti|free/.test(text)) {
      return 'Unexpected prize or reward emails are a common scam. Delete this unless you were expecting it.';
    }
    if (/dating|photo|video|attachment|profile/.test(text)) {
      return 'Strangers asking for photos, chat, or attachments in email are often bots or scams.';
    }
    return 'When unsure, ask a family member before replying, clicking, or calling any number in this email.';
  }

  function buildGrandmaPresetSettings(current = {}) {
    return {
      ...current,
      protectionLevel: 'careful',
      shoppingModeEnabled: true,
      autoAfterScamOnContinue: true,
      localMailLearningConsent: 'allowed',
      localMailLearningEnabled: true
    };
  }

  function resolveProtectionContext(input = {}) {
    const now = Date.now();
    const afterScamActive = Number(input.afterScamUntil || 0) > now;
    const shoppingBoost = Boolean(input.shoppingModeEnabled) && Boolean(input.shoppingPage);
    let protectionLevel = input.protectionLevel === 'careful' ? 'careful' : 'standard';
    if (afterScamActive && protectionLevel === 'standard') {
      protectionLevel = 'careful';
    }
    let thresholdReduction = 0;
    if (afterScamActive) {
      thresholdReduction += 1;
    }
    if (shoppingBoost) {
      thresholdReduction += 1;
    }
    return {
      protectionLevel,
      thresholdReduction,
      afterScamActive,
      shoppingBoost
    };
  }

  function looksLikeShoppingPage(snapshot) {
    if (Boolean(snapshot?.shoppingPage)) {
      return true;
    }
    const text = `${snapshot?.titleText || ''}\n${String(snapshot?.pageText || '').slice(0, 6000)}`.toLowerCase();
    return /\b(checkout|payment|billing|order summary|shopping cart|gift card|credit card|cvv|add to cart)\b/.test(text);
  }

  function mergeLearnedBadLinkHosts(existing, hostname) {
    const host = normalizeTrustedHost(hostname);
    if (!host) {
      return Array.isArray(existing) ? existing.slice() : [];
    }
    const list = Array.isArray(existing) ? existing.slice() : [];
    if (!list.includes(host)) {
      list.push(host);
      list.sort();
    }
    return list;
  }

  function removeLearnedBadLinkHosts(existing, hostname) {
    const host = normalizeTrustedHost(hostname);
    if (!host) {
      return Array.isArray(existing) ? existing.slice() : [];
    }
    return (Array.isArray(existing) ? existing : []).filter((entry) => entry !== host);
  }

  function scoreLearnedBadLinkHost(hostname, learnedBadLinkHosts) {
    const host = normalizeTrustedHost(hostname);
    if (!host || !Array.isArray(learnedBadLinkHosts) || learnedBadLinkHosts.length === 0) {
      return { score: 0, reasons: [] };
    }
    if (learnedBadLinkHosts.includes(host)) {
      return {
        score: 4,
        reasons: ['matches a suspicious link domain remembered on this device']
      };
    }
    for (const entry of learnedBadLinkHosts) {
      const learned = normalizeTrustedHost(entry);
      if (learned && (host === learned || host.endsWith(`.${learned}`))) {
        return {
          score: 4,
          reasons: ['matches a suspicious link domain remembered on this device']
        };
      }
    }
    return { score: 0, reasons: [] };
  }

  function normalizeMailSenderDisplay(sender) {
    const raw = String(sender || '').replace(/\s+/g, ' ').trim();
    if (!raw) {
      return '';
    }
    const angled = raw.match(/^([^<]+)</);
    if (angled) {
      return angled[1].replace(/["']/g, '').trim();
    }
    return raw.replace(/["']/g, '').trim();
  }

  function extractEmailAddress(value) {
    const match = String(value || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    return match ? match[0].toLowerCase() : '';
  }

  function domainFromEmail(email) {
    const value = String(email || '').toLowerCase().trim();
    const at = value.lastIndexOf('@');
    if (at < 1 || at === value.length - 1) {
      return '';
    }
    return value.slice(at + 1);
  }

  function normalizeLearnKey(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 64);
  }

  function normalizeSenderDomainLearnKey(senderPart, domainPart) {
    const senderKey = normalizeLearnKey(senderPart);
    const domain = String(domainPart || '').toLowerCase().trim();
    if (!senderKey || !domain || !domain.includes('.')) {
      return '';
    }
    return `${senderKey}|${domain}`;
  }

  function normalizePatternValue(kind, value) {
    if (kind === 'sender-domain') {
      const raw = String(value || '').toLowerCase();
      const splitAt = raw.lastIndexOf('|');
      if (splitAt < 1) {
        return '';
      }
      return normalizeSenderDomainLearnKey(raw.slice(0, splitAt), raw.slice(splitAt + 1));
    }
    if (kind === 'from-domain') {
      const domain = String(value || '').toLowerCase().trim();
      if (!domain || !domain.includes('.') || FREE_MAIL_DOMAINS.has(domain)) {
        return '';
      }
      return domain;
    }
    return normalizeLearnKey(value);
  }

  function looksLikeTwoWordPersonName(display) {
    const words = String(display || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    return words.length === 2 &&
      /^[A-Z][a-z]+$/.test(words[0]) &&
      /^[A-Z][a-z]+$/.test(words[1]);
  }

  function brandTokenFromDisplay(display) {
    const match = String(display || '').match(MAIL_IMPERSONATION_BRAND_PATTERN);
    if (!match) {
      return '';
    }
    return match[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function domainLooksAlignedWithBrand(domain, brandToken) {
    if (!domain || !brandToken) {
      return false;
    }
    const compact = domain.replace(/[^a-z0-9]/g, '');
    if (compact.includes(brandToken)) {
      return true;
    }
    // Common official variants: bankofamerica.com vs "bank of america"
    if (brandToken.length >= 6 && compact.includes(brandToken.slice(0, Math.min(8, brandToken.length)))) {
      return true;
    }
    return false;
  }

  function looksLikeBusinessOrBrandDisplay(display) {
    const value = String(display || '').trim();
    if (!value || looksLikeTwoWordPersonName(value)) {
      return false;
    }
    if (MAIL_IMPERSONATION_BRAND_PATTERN.test(value) || MAIL_BRAND_PATTERN.test(value)) {
      return true;
    }
    if (/\b(?:loan|bank|insurance|warranty|support|security|billing|payment|rewards?|alert|service)\b/i.test(value)) {
      return true;
    }
    // camelCase / PascalCase product-style names: loanDepot, GlobeLife
    if (/[A-Z][a-z]+[A-Z][A-Za-z]+/.test(value) || /[a-z]+[A-Z][a-z]+/.test(value)) {
      return true;
    }
    return false;
  }

  function analyzeSenderDomainAlignment(senderDisplay, fromAddress, combinedText) {
    const reasons = [];
    let score = 0;
    const email = extractEmailAddress(fromAddress) || extractEmailAddress(combinedText);
    const domain = domainFromEmail(email);
    if (!senderDisplay || !domain) {
      return { score: 0, reasons, email, domain };
    }

    const brandToken = brandTokenFromDisplay(senderDisplay);
    const freeMail = FREE_MAIL_DOMAINS.has(domain);
    const businessLike = looksLikeBusinessOrBrandDisplay(senderDisplay);

    if (brandToken && freeMail && !domainLooksAlignedWithBrand(domain, brandToken)) {
      score += 6;
      reasons.push('sender name uses a trusted brand but the From address is a free email domain');
    } else if (brandToken && !freeMail && !domainLooksAlignedWithBrand(domain, brandToken)) {
      score += 5;
      reasons.push('sender name does not match the From email domain');
    } else if (businessLike && freeMail) {
      score += 4;
      reasons.push('business-style sender name comes from a free email address');
    }

    // Display name contains an email from a different domain than the visible From.
    const nestedEmail = extractEmailAddress(senderDisplay);
    const nestedDomain = domainFromEmail(nestedEmail);
    if (nestedDomain && domain && nestedDomain !== domain &&
      (FREE_MAIL_DOMAINS.has(domain) || FREE_MAIL_DOMAINS.has(nestedDomain))) {
      score += 3;
      reasons.push('sender shows conflicting email domains');
    }

    return { score, reasons, email, domain };
  }

  function scoreLearnedMailPatterns(input, learnedPatterns) {
    const patterns = Array.isArray(learnedPatterns) ? learnedPatterns : [];
    if (patterns.length === 0) {
      return { score: 0, reasons: [], matched: [] };
    }

    const senderKey = normalizeLearnKey(normalizeMailSenderDisplay(input?.sender));
    const subjectKey = normalizeLearnKey(input?.subject);
    const email = extractEmailAddress(input?.fromAddress) || extractEmailAddress(input?.sender);
    const domain = domainFromEmail(email);
    const pairKey = normalizeSenderDomainLearnKey(senderKey, domain);

    let score = 0;
    const reasons = [];
    const matched = [];

    for (const pattern of patterns) {
      const kind = String(pattern?.kind || '');
      const value = normalizePatternValue(kind, pattern?.value);
      const hits = Number(pattern?.hits) || 0;
      if (!kind || !value || hits < 1) {
        continue;
      }
      let hit = false;
      let boost = 0;
      if (kind === 'sender' && senderKey && senderKey === value) {
        hit = true;
        boost = hits >= 4 ? 5 : hits >= 2 ? 4 : 3;
      } else if (kind === 'sender-domain' && pairKey && pairKey === value) {
        hit = true;
        boost = hits >= 2 ? 6 : 4;
      } else if (kind === 'from-domain' && domain && domain === value) {
        hit = true;
        boost = hits >= 3 ? 6 : hits >= 2 ? 5 : 3;
      } else if (kind === 'subject' && subjectKey &&
        (subjectKey === value || subjectKey.includes(value) || value.includes(subjectKey.slice(0, 24)))) {
        hit = true;
        boost = hits >= 3 ? 4 : 3;
      }
      if (hit) {
        score += boost;
        matched.push({ kind, value, hits });
      }
    }

    if (matched.length) {
      reasons.push('matches a scam pattern learned on this device');
    }

    return {
      score: Math.min(score, 8),
      reasons,
      matched
    };
  }

  function collectMailPatternHints(input, options = {}) {
    const allowPersonNames = Boolean(options.allowPersonNames);
    const includeSubject = options.includeSubject !== false;
    const hints = [];
    const senderDisplay = normalizeMailSenderDisplay(input?.sender);
    const senderKey = normalizeLearnKey(senderDisplay);
    if (senderKey.length >= 4 && (allowPersonNames || !looksLikeTwoWordPersonName(senderDisplay))) {
      hints.push({ kind: 'sender', value: senderKey });
    }

    const email = extractEmailAddress(input?.fromAddress) || extractEmailAddress(input?.sender) ||
      extractEmailAddress(input?.bodyText);
    const domain = domainFromEmail(email);
    const pairKey = normalizeSenderDomainLearnKey(senderKey, domain);
    if (pairKey) {
      hints.push({ kind: 'sender-domain', value: pairKey });
    }

    // Learn custom From domains (never free webmail domains alone - too broad).
    const domainKey = normalizePatternValue('from-domain', domain);
    if (domainKey) {
      hints.push({ kind: 'from-domain', value: domainKey });
    }

    if (includeSubject) {
      const cleanedSubject = String(input?.subject || '')
        .replace(/\b(?:Possible|Likely)\s+Scam(?:\s+link)?\b/gi, ' ')
        .replace(/\bNot a scam\b/gi, ' ');
      const subjectKey = normalizeLearnKey(cleanedSubject);
      if (subjectKey.length >= 12 && !/(?:possible|likely)\s+scam/.test(subjectKey)) {
        hints.push({ kind: 'subject', value: subjectKey.slice(0, 48) });
      }
    }

    return hints.slice(0, 4);
  }

  function buildMailLearnHints(input, result) {
    if (!result?.suspicious) {
      return [];
    }
    // Avoid learning solely from prior local learning (feedback loop).
    const reasons = Array.isArray(result.reasons) ? result.reasons : [];
    const onlyLearned = reasons.length > 0 &&
      reasons.every((reason) => /learned on this device/i.test(reason));
    if (onlyLearned) {
      return [];
    }
    return collectMailPatternHints(input, { allowPersonNames: false });
  }

  function buildMailSafeHints(input) {
    return collectMailPatternHints(input, { allowPersonNames: true });
  }

  function matchesSafeMailPatterns(input, safePatterns) {
    const patterns = Array.isArray(safePatterns) ? safePatterns : [];
    if (patterns.length === 0) {
      return { safe: false, matched: [] };
    }

    const senderKey = normalizeLearnKey(normalizeMailSenderDisplay(input?.sender));
    const subjectKey = normalizeLearnKey(input?.subject);
    const email = extractEmailAddress(input?.fromAddress) || extractEmailAddress(input?.sender);
    const domain = domainFromEmail(email);
    const pairKey = normalizeSenderDomainLearnKey(senderKey, domain);
    const matched = [];

    for (const pattern of patterns) {
      const kind = String(pattern?.kind || '');
      const value = normalizePatternValue(kind, pattern?.value);
      const hits = Number(pattern?.hits) || 0;
      if (!kind || !value || hits < 1) {
        continue;
      }
      if (kind === 'sender-domain' && pairKey && pairKey === value) {
        matched.push({ kind, value, hits });
      } else if (kind === 'from-domain' && domain && domain === value) {
        matched.push({ kind, value, hits });
      } else if (kind === 'sender' && senderKey && senderKey === value) {
        matched.push({ kind, value, hits });
      } else if (kind === 'subject' && subjectKey &&
        (subjectKey === value || subjectKey.includes(value) || value.includes(subjectKey.slice(0, 24)))) {
        matched.push({ kind, value, hits });
      }
    }

    return {
      safe: matched.length > 0,
      matched
    };
  }

  function removeLearnedMailPatterns(existing, hints) {
    const list = Array.isArray(existing) ? existing.slice() : [];
    for (const hint of Array.isArray(hints) ? hints : []) {
      const kind = String(hint?.kind || '');
      const value = normalizePatternValue(kind, hint?.value);
      if (!kind || !value) {
        continue;
      }
      const index = list.findIndex((item) => item.kind === kind && normalizePatternValue(kind, item.value) === value);
      if (index < 0) {
        continue;
      }
      const nextHits = Math.max(0, (Number(list[index].hits) || 0) - 1);
      if (nextHits <= 0) {
        list.splice(index, 1);
      } else {
        list[index] = {
          ...list[index],
          hits: nextHits
        };
      }
    }
    return list;
  }

  function mergeLearnedMailPatterns(existing, hints, now = Date.now()) {
    const list = Array.isArray(existing) ? existing.slice() : [];
    for (const hint of Array.isArray(hints) ? hints : []) {
      const kind = String(hint?.kind || '');
      const value = normalizePatternValue(kind, hint?.value);
      if (!kind || !value) {
        continue;
      }
      const index = list.findIndex((item) => item.kind === kind && normalizePatternValue(kind, item.value) === value);
      if (index >= 0) {
        list[index] = {
          ...list[index],
          hits: Math.min(99, (Number(list[index].hits) || 0) + 1),
          lastSeen: now
        };
      } else {
        list.push({
          kind,
          value,
          hits: 1,
          lastSeen: now,
          source: 'auto'
        });
      }
    }
    list.sort((a, b) => (Number(b.lastSeen) || 0) - (Number(a.lastSeen) || 0));
    return list.slice(0, MAX_LEARNED_PATTERNS);
  }

  function looksLikeCamouflageNewsSpam(senderDisplay, subject) {
    const senderNorm = String(senderDisplay || '').replace(/\s+/g, ' ').trim();
    const subjectNorm = String(subject || '').replace(/\s+/g, ' ').trim();
    if (!senderNorm || !subjectNorm) {
      return false;
    }
    if (MAIL_TRUSTED_SENDER_PATTERN.test(senderNorm) || /@/.test(senderNorm)) {
      return false;
    }

    const senderWords = senderNorm.split(/\s+/).filter(Boolean);
    if (senderWords.length < 1 || senderWords.length > 3 || senderNorm.length < 3 || senderNorm.length > 36) {
      return false;
    }
    if (!/^[A-Za-z][A-Za-z0-9&'’.\-]*(?:\s+[A-Za-z][A-Za-z0-9&'’.\-]*){0,2}$/.test(senderNorm)) {
      return false;
    }

    const subjectWords = subjectNorm.split(/\s+/).filter(Boolean);
    if (subjectWords.length < 5) {
      return false;
    }
    // Personal / transactional mail usually addresses "your" or is a reply.
    if (/^(?:re|fw|fwd)\s*:/i.test(subjectNorm) || /\b(?:your|you'?re|hi\s+\w+|dear\s+\w+)\b/i.test(subjectNorm)) {
      return false;
    }
    if (!MAIL_CAMOUFLAGE_HEADLINE_PATTERN.test(subjectNorm)) {
      return false;
    }

    const subjectLower = subjectNorm.toLowerCase();
    const senderLower = senderNorm.toLowerCase();
    const senderEchoedInSubject = subjectLower.includes(senderLower);
    // Spam farms often use odd lowercase/hyphen tokens that never match a real mailbox name.
    const oddBareSender = /^[a-z][a-z0-9-]{2,24}$/.test(senderNorm);
    // Skip ordinary two-word title-case senders unless the sender phrase is echoed in the headline.
    const looksLikeTwoWordSender = senderWords.length === 2 &&
      /^[A-Z][a-z]+$/.test(senderWords[0]) &&
      /^[A-Z][a-z]+$/.test(senderWords[1]);
    if (looksLikeTwoWordSender && !senderEchoedInSubject) {
      return false;
    }
    if (!senderEchoedInSubject && !oddBareSender) {
      return false;
    }

    const titleCaseWords = subjectWords.filter((word) => {
      const cleaned = word.replace(/[^A-Za-z0-9'’\-]/g, '');
      return /^[A-Z][a-z0-9'’\-]*$/.test(cleaned);
    }).length;
    const mostlyTitleCase = titleCaseWords >= Math.max(3, Math.floor(subjectWords.length * 0.45));
    return mostlyTitleCase || oddBareSender;
  }

  function cleanMailAnalysisField(value) {
    return String(value || '')
      .replace(/\b(?:unread-message-status|email-(?:sender|subject-snippet|subject|date|message-actions))-\d{2}_\d+\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function analyzeEmailMessage(input) {
    const sender = cleanMailAnalysisField(input?.sender);
    const subject = cleanMailAnalysisField(input?.subject);
    const snippet = cleanMailAnalysisField(input?.snippet);
    const bodyText = cleanMailAnalysisField(input?.bodyText);
    const fromAddress = String(input?.fromAddress || '').trim();
    const combined = `${sender}\n${fromAddress}\n${subject}\n${snippet}\n${bodyText}`.slice(0, 20000);
    const senderDisplay = normalizeMailSenderDisplay(sender);
    const reasons = [];
    let score = 0;
    let kind = 'clean';

    if (!combined.trim() || (!sender && !subject && bodyText.length < 20 && snippet.length < 12)) {
      return {
        suspicious: false,
        score: 0,
        reasons: [],
        kind: 'empty',
        dedupeKey: '',
        learnHints: []
      };
    }

    const safeMatch = matchesSafeMailPatterns({
      sender,
      subject,
      fromAddress: fromAddress || extractEmailAddress(sender)
    }, input?.safePatterns);
    if (safeMatch.safe) {
      return {
        suspicious: false,
        score: 0,
        reasons: ['previously marked as not a scam on this device'],
        kind: 'safe-learned',
        dedupeKey: [
          sender.toLowerCase().slice(0, 80),
          subject.toLowerCase().slice(0, 120)
        ].join('|'),
        fromDomain: domainFromEmail(fromAddress || extractEmailAddress(sender)),
        learnHints: []
      };
    }

    const hasBrand = MAIL_BRAND_PATTERN.test(combined) || MAIL_IMPERSONATION_BRAND_PATTERN.test(combined);
    const hasRewardBait = MAIL_REWARD_BAIT_PATTERN.test(combined);
    const hasPrizeProduct = MAIL_PRIZE_PRODUCT_PATTERN.test(combined);
    const hasCampaignPrefix = MAIL_CAMPAIGN_PREFIX_PATTERN.test(subject) ||
      MAIL_CAMPAIGN_PREFIX_PATTERN.test(combined.slice(0, 400));
    const hasLoanGrantBait = MAIL_LOAN_GRANT_BAIT_PATTERN.test(combined);
    const hasCamouflageNewsSpam = looksLikeCamouflageNewsSpam(senderDisplay, subject);
    const alignment = analyzeSenderDomainAlignment(senderDisplay, fromAddress || sender, combined);
    const learned = scoreLearnedMailPatterns({
      sender,
      subject,
      fromAddress: fromAddress || extractEmailAddress(sender)
    }, input?.learnedPatterns);

    if (hasBrand && hasRewardBait) {
      score += 6;
      reasons.push('uses a store or brand name with prize or reward claim language');
      kind = 'reward-bait';
    }

    if (hasBrand && hasPrizeProduct && /\b(?:just\s+for\s+you|bundle|awaits?)\b/i.test(combined)) {
      score += 6;
      reasons.push('uses a trusted brand with a gift bundle lure');
      kind = 'reward-bait';
    }

    if (hasBrand && hasPrizeProduct && (hasRewardBait || /\b(?:won|claim|free|bonus|reward)\b/i.test(combined))) {
      score += 4;
      reasons.push('pairs a trusted brand with a high-value prize product');
      kind = 'reward-bait';
    }

    if (hasRewardBait && hasPrizeProduct) {
      score += 2;
      reasons.push('pushes a free high-value product reward');
      kind = kind === 'clean' ? 'reward-bait' : kind;
    }

    if (hasBrand && hasCampaignPrefix && (hasRewardBait || hasPrizeProduct || /\b(?:won|claim|free|bonus|combo)\b/i.test(combined))) {
      score += 4;
      reasons.push('uses an odd campaign prefix with brand prize bait');
      kind = 'reward-bait';
    }

    if (hasBrand && /(?:rewards?|loyalty|winner|prize|bonus)/i.test(sender)) {
      score += 2;
      reasons.push('sender name looks like a fake rewards or loyalty account');
      kind = kind === 'clean' ? 'reward-bait' : kind;
    }

    if (hasBrand && (hasRewardBait || hasPrizeProduct) &&
      /^[A-Z][A-Z\s'.’-]{2,}$/.test(sender.replace(/\s+/g, ' ').trim())) {
      score += 1;
      reasons.push('sender uses an all-caps brand style common in reward scams');
    }

    if (hasBrand && MAIL_URGENCY_PATTERN.test(combined) && hasRewardBait) {
      score += 1;
      reasons.push('combines reward bait with urgent account wording');
    }

    if (hasLoanGrantBait) {
      score += 6;
      reasons.push('uses loan, borrow, or free-grant bait common in inbox scams');
      kind = kind === 'clean' ? 'loan-bait' : kind;
    }

    if (hasCamouflageNewsSpam) {
      score += 6;
      reasons.push('hides behind a generic sender and news-style headline');
      kind = kind === 'clean' ? 'camouflage-spam' : kind;
    }

    // Fake service "activate your account" lures (Uber driver, etc.).
    if (/\b(?:driver\s+)?account\s+is\s+ready\s+to\s+be\s+activated\b/i.test(combined) ||
      /\bready\s+to\s+be\s+activated\b/i.test(subject)) {
      score += 6;
      reasons.push('pushes unexpected account activation');
      kind = kind === 'clean' ? 'account-bait' : kind;
    }

    const hasRomanceBait = MAIL_ROMANCE_BAIT_PATTERN.test(combined) ||
      (/[🔞💕💋😘💞💓]/.test(combined) && /\b(?:profile|picture|photos?|dating|match|chat|message)\b/i.test(combined));
    const hasMediaBait = MAIL_MEDIA_BAIT_PATTERN.test(combined);
    const hasAttachmentBait = MAIL_ATTACHMENT_BAIT_PATTERN.test(combined);
    const hasSubjectTimestampDump = MAIL_SUBJECT_TIMESTAMP_DUMP_PATTERN.test(subject);
    if (hasRomanceBait) {
      score += 6;
      reasons.push('uses dating or profile picture bait');
      kind = kind === 'clean' ? 'romance-bait' : kind;
    }
    if (hasRomanceBait && hasSubjectTimestampDump) {
      score += 2;
      reasons.push('includes a pasted timestamp often seen in dating spam bots');
    }

    if (hasMediaBait) {
      score += 6;
      reasons.push('uses private photo or video bait common in inbox scams');
      kind = kind === 'clean' ? 'romance-bait' : kind;
    }

    if (hasAttachmentBait && /\b(?:hi|hello|photo|image|view|click)\b/i.test(combined)) {
      score += 6;
      reasons.push('uses attachment filenames or photo bait');
      kind = kind === 'clean' ? 'romance-bait' : kind;
    }

    if (MAIL_NEUROPATHY_HEALTH_PATTERN.test(combined)) {
      score += 6;
      reasons.push('uses neuropathy or foot-pain miracle cure bait');
      kind = kind === 'clean' ? 'health-bait' : kind;
    }

    if (MAIL_ADULT_HEALTH_TRICK_PATTERN.test(combined)) {
      score += 6;
      reasons.push('uses adult health miracle trick bait');
      kind = kind === 'clean' ? 'health-bait' : kind;
    }

    if (MAIL_CULT_SCAM_PATTERN.test(combined) &&
      /\b(?:society|recruit|invitation|reaching\s+out|interested)\b/i.test(combined)) {
      score += 6;
      reasons.push('uses secret-society or generic recruitment scam wording');
      kind = kind === 'clean' ? 'cult-scam' : kind;
    }

    if (MAIL_JACKPOT_BAIT_PATTERN.test(combined) ||
      (/\bjackpot\b/i.test(senderDisplay) && /\b(?:free|coins|owe|bonus|win)\b/i.test(subject))) {
      score += 6;
      reasons.push('pushes jackpot, free coins, or casino-style bait');
      kind = kind === 'clean' ? 'jackpot-bait' : kind;
    }

    if (MAIL_CLOUD_SCARE_PATTERN.test(combined) ||
      (/\bcloud\s+storage\b/i.test(senderDisplay) && /\b(?:files?|space|storage|waiting)\b/i.test(subject))) {
      score += 6;
      reasons.push('uses a fake cloud storage full or files-waiting scare');
      kind = kind === 'clean' ? 'cloud-scare' : kind;
    }

    if (MAIL_INSURANCE_COLD_PATTERN.test(combined) ||
      (/alert/i.test(senderDisplay) && /\blife\s+insurance\b/i.test(subject) && /(?:\$|\d{1,3}(?:,\d{3})+)/.test(subject))) {
      score += 6;
      reasons.push('pushes unexpected life-insurance alert or dollar bait');
      kind = kind === 'clean' ? 'insurance-bait' : kind;
    }

    if (MAIL_VAGUE_CURIOSITY_SUBJECT_PATTERN.test(subject.replace(/\s+/g, ' ').trim())) {
      score += 6;
      reasons.push('uses a vague curiosity subject common in phishing mail');
      kind = kind === 'clean' ? 'curiosity-bait' : kind;
    }

    if (MAIL_ELDER_BENEFITS_BAIT_PATTERN.test(combined) &&
      (MAIL_URGENCY_PATTERN.test(combined) ||
        /\b(?:suspended|paused|expired|verify|click|act\s+now|immediately|alert|final\s+notice)\b/i.test(combined))) {
      score += 6;
      reasons.push('uses Social Security, Medicare, or benefits scare language');
      kind = kind === 'clean' ? 'benefits-bait' : kind;
    }

    if (MAIL_PACKAGE_DELIVERY_BAIT_PATTERN.test(combined)) {
      score += 6;
      reasons.push('uses fake package or delivery fee bait');
      kind = kind === 'clean' ? 'delivery-bait' : kind;
    }

    if (MAIL_GIFT_CARD_WIRE_BAIT_PATTERN.test(combined)) {
      score += 6;
      reasons.push('asks for gift cards, wire transfers, or crypto payment');
      kind = kind === 'clean' ? 'payment-bait' : kind;
    }

    if (SMS_SMISHING_PATTERN.test(combined)) {
      score += 5;
      reasons.push('uses text-message or smishing-style delivery bait');
      kind = kind === 'clean' ? 'smishing-bait' : kind;
    }

    if (MAIL_HEALTH_MIRACLE_BAIT_PATTERN.test(combined)) {
      score += 6;
      reasons.push('pushes miracle weight-loss or risky health product bait');
      kind = kind === 'clean' ? 'health-bait' : kind;
    }

    if (MAIL_WARRANTY_HOME_BAIT_PATTERN.test(combined) &&
      (/\b(?:expir|final\s+notice|act\s+now|today|protect\s+your\s+home|stay\s+cool|summer)\b/i.test(combined) ||
        /\bwarranty\b/i.test(senderDisplay))) {
      score += 6;
      reasons.push('pushes unsolicited home warranty pressure');
      kind = kind === 'clean' ? 'warranty-bait' : kind;
    }

    if (MAIL_TECH_SUPPORT_EMAIL_BAIT_PATTERN.test(combined)) {
      score += 6;
      reasons.push('uses tech-support or device-infected email scare tactics');
      kind = kind === 'clean' ? 'tech-support-bait' : kind;
    }

    // Cold roofing / home-service partner spam is common inbox junk aimed at homeowners.
    if (/\b(?:roofing|metal\s+roofs?|roof\s+replacement)\b/i.test(combined) &&
      /\b(?:partner|innovations?|budget-friendly|save\s+big|free\s+estimate)\b/i.test(combined) &&
      !MAIL_TRUSTED_SENDER_PATTERN.test(senderDisplay)) {
      score += 6;
      reasons.push('looks like cold home-service or roofing solicitation spam');
      kind = kind === 'clean' ? 'service-spam' : kind;
    }

    if (alignment.score > 0) {
      score += alignment.score;
      reasons.push(...alignment.reasons);
      kind = kind === 'clean' ? 'sender-mismatch' : kind;
    }

    if (learned.score > 0) {
      score += learned.score;
      reasons.push(...learned.reasons);
      kind = kind === 'clean' ? 'learned' : kind;
    }

    const links = Array.isArray(input.links) ? input.links : [];
    let linkOnlySuspicious = false;
    let linkHostname = '';
    if (links.length > 0 && score < (String(input.protectionLevel || 'standard') === 'careful' ? 5 : 6)) {
      const linkResult = analyzeEmailLinks(links, {
        protectionLevel: input.protectionLevel,
        afterScamUntil: input.afterScamUntil,
        shoppingModeEnabled: input.shoppingModeEnabled,
        learnedBadLinkHosts: input.learnedBadLinkHosts
      });
      if (linkResult.suspicious) {
        linkOnlySuspicious = true;
        linkHostname = linkResult.hostname || '';
        score = Math.max(score, linkResult.score);
        reasons.push(...linkResult.reasons);
        kind = 'link';
      }
    }

    const mailThreshold = Math.max(4, (String(input.protectionLevel || 'standard') === 'careful' ? 5 : 6) -
      resolveProtectionContext(input).thresholdReduction);
    const suspicious = linkOnlySuspicious || score >= mailThreshold;
    const dedupeKey = [
      sender.toLowerCase().slice(0, 80),
      subject.toLowerCase().slice(0, 120)
    ].join('|');
    const result = {
      suspicious,
      score,
      reasons: Array.from(new Set(reasons)).slice(0, 12),
      kind: suspicious ? kind : 'clean',
      dedupeKey,
      fromDomain: alignment.domain || '',
      linkHostname: linkOnlySuspicious ? linkHostname : '',
      learnHints: []
    };
    result.learnHints = buildMailLearnHints({
      sender,
      subject,
      fromAddress: fromAddress || alignment.email || extractEmailAddress(sender),
      bodyText
    }, result);

    return result;
  }

  function analyze(snapshot) {
    const pageText = String(snapshot.pageText || '').slice(0, 250000);
    const titleText = String(snapshot.titleText || '').slice(0, 3000);
    const articleText = String(snapshot.articleText || '').slice(0, 180000);
    const quotedText = String(snapshot.quotedText || '').slice(0, 50000);
    const interactiveText = String(snapshot.interactiveText || '').slice(0, 30000);
    const overlayText = String(snapshot.overlayText || '').slice(0, 50000);
    const telLinkText = String(snapshot.telLinkText || '').slice(0, 5000);
    const allText = `${titleText}\n${pageText}\n${telLinkText}`;
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
      const inTel = Boolean(telLinkText && signal.pattern.test(telLinkText));
      const placementBonus = inOverlay ? 3 : (inInteractive || inTel ? 2 : (inTitle ? 1 : 0));

      score += signal.weight + placementBonus;
      signal.categories.forEach((category) => categories.add(category));
      reasons.push(signal.label);
      activePlacement = activePlacement || inOverlay || inInteractive || inTel;
      overlayPlacement = overlayPlacement || inOverlay;
      highPrecisionMatch = highPrecisionMatch || Boolean(signal.highPrecision);
      matchedSignals.push({
        id: signal.id,
        inOverlay,
        inInteractive,
        inArticle,
        inQuote,
        inTitle,
        inTel
      });
    }

    const host = hostSignals(snapshot);
    score += host.score;
    reasons.push(...host.reasons);

    if (matchedSignals.length === 0 && host.score === 0) {
      const hostname = String(snapshot.hostname || '').toLowerCase();
      const hasPasswordField = Boolean(snapshot.hasPasswordField);
      const mentionsBrand = MAIL_IMPERSONATION_BRAND_PATTERN.test(`${titleText}\n${pageText.slice(0, 12000)}`);
      if (!hasPasswordField || isOfficialHost(hostname) || isMailHost(hostname) || (!host.brandLookalike && !mentionsBrand)) {
        return {
          block: false,
          score: 0,
          reasons: [],
          categories: [],
          diagnostics: { editorialConfidence: 0, hostRisk: 0, matchedSignals: [] }
        };
      }
    }

    if (host.brandLookalike && categories.has('credential')) {
      score += 2;
      categories.add('brand');
      reasons.push('pairs brand-lookalike hostname with account login pressure');
    }

    const largeOverlay = Boolean(snapshot.largeOverlay);
    const fullscreen = Boolean(snapshot.fullscreen);
    const scrollLocked = Boolean(snapshot.scrollLocked);
    const permissionGranted = snapshot.notificationPermission === 'granted';
    const audibleMedia = Boolean(snapshot.audibleMedia);
    const hasTelLink = Boolean(snapshot.hasTelLink);
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
    if (hasTelLink && categories.has('support')) {
      score += 1;
      reasons.push('includes a click-to-call phone link');
    }

    const hostname = String(snapshot.hostname || '').toLowerCase();
    const officialSite = isOfficialHost(hostname);
    const hasPasswordField = Boolean(snapshot.hasPasswordField);
    const credentialBrandPage = hasPasswordField &&
      !officialSite &&
      !isMailHost(hostname) &&
      (host.brandLookalike || MAIL_IMPERSONATION_BRAND_PATTERN.test(`${titleText}\n${pageText.slice(0, 12000)}`));
    if (credentialBrandPage) {
      score += 6;
      categories.add('credential');
      reasons.push('shows a password login on an unofficial site that mentions a trusted brand');
    }
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

    if (officialSite) {
      score -= 8;
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
    const downloadTrap = categories.has('download') && (hasClaim || categories.has('support'));
    const crossCategoryCore = notificationTrap || scarewareTrap || supportTrap || credentialTrap || downloadTrap;
    const fakeLoginPage = credentialBrandPage && host.score >= 1;
    if (host.score >= 2 && (supportTrap || scarewareTrap || downloadTrap || credentialTrap)) {
      score += 1;
    }
    const environmentalEvidence = activePlacement || takeoverPlacement || permissionGranted || audibleMedia ||
      host.score >= 1 || (categories.has('brand') && !officialSite) ||
      (hasTelLink && categories.has('support')) || Boolean(host.brandLookalike);

    const ctx = resolveProtectionContext(snapshot);
    const careful = ctx.protectionLevel === 'careful';
    const mainThreshold = Math.max(8, (careful ? 11 : 12) - ctx.thresholdReduction);
    const highPrecisionThreshold = Math.max(7, (careful ? 9 : 10) - ctx.thresholdReduction);
    const takeoverThreshold = Math.max(9, (careful ? 12 : 13) - ctx.thresholdReduction);

    if (ctx.shoppingBoost && SHOPPING_SCAM_PATTERN.test(allText)) {
      score += 4;
      categories.add('credential');
      reasons.push('uses checkout or payment pressure while Shopping mode is on');
    }

    if (ctx.afterScamActive && score > 0) {
      score += 1;
    }

    if (SMS_SMISHING_PATTERN.test(allText) && (Boolean(snapshot.hasTelLink) || categories.has('support'))) {
      score += 3;
      categories.add('support');
      reasons.push('combines text-message or smishing bait with a click-to-call link');
    }

    let block = false;
    if ((!articleOnly && !explanatoryContext) || takeoverPlacement) {
      block = (
        score >= mainThreshold && crossCategoryCore && environmentalEvidence && matchedSignals.length >= 2
      ) || (
        score >= highPrecisionThreshold && highPrecisionMatch && !likelyArticle && !explanatoryContext
      ) || (
        score >= takeoverThreshold && highPrecisionMatch && takeoverPlacement
      ) || (
        fakeLoginPage && score >= 8
      );
    }
    if (officialSite || isMailHost(hostname)) {
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
        matchedSignals,
        protectionLevel: careful ? 'careful' : 'standard',
        afterScamActive: ctx.afterScamActive,
        shoppingBoost: ctx.shoppingBoost
      }
    };
  }

  function normalizeTrustedHost(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .replace(/^www\./, '')
      .replace(/:\d+$/, '');
  }

  function isTrustedHost(hostname, trustedHosts) {
    const host = normalizeTrustedHost(hostname);
    if (!host || !Array.isArray(trustedHosts) || trustedHosts.length === 0) {
      return false;
    }
    for (const entry of trustedHosts) {
      const trusted = normalizeTrustedHost(entry);
      if (!trusted) {
        continue;
      }
      if (host === trusted || host.endsWith(`.${trusted}`)) {
        return true;
      }
    }
    return false;
  }

  return {
    analyze,
    analyzeHostname,
    analyzeLink,
    analyzeEmailLinks,
    analyzeEmailMessage,
    isOfficialHost,
    isMailHost,
    isTrustedHost,
    isBlockedHost,
    isShortenerHost,
    matchesBundledBadHost,
    normalizeTrustedHost,
    pickBlockPageTip,
    pickEmailScamTip,
    buildGrandmaPresetSettings,
    summarizeWeeklyProtection,
    buildSettingsExport,
    mergeSettingsImport,
    resolveProtectionContext,
    looksLikeShoppingPage,
    mergeLearnedBadLinkHosts,
    removeLearnedBadLinkHosts,
    AFTER_SCAM_DURATION_MS,
    extractEmailAddress,
    mergeLearnedMailPatterns,
    removeLearnedMailPatterns,
    buildMailLearnHints,
    buildMailSafeHints,
    matchesSafeMailPatterns
  };
}));
