import assert from "node:assert/strict";
import "../extension/rule-packs-data.js";
import "../extension/rule-packs.js";

await globalThis.GrandmaGuardRulePacks.initBundledPack();
await import("../extension/detection-engine.js");

const {
  analyze,
  analyzeLink,
  analyzeEmailLinks,
  analyzeEmailMessage,
  analyzeHostname,
  isMailHost,
  isTrustedHost,
  isBlockedHost,
  isShortenerHost,
  normalizeTrustedHost,
  pickBlockPageTip,
  summarizeWeeklyProtection,
  buildSettingsExport,
  mergeSettingsImport,
  mergeLearnedMailPatterns,
  removeLearnedMailPatterns,
  mergeLearnedBadLinkHosts,
  removeLearnedBadLinkHosts,
  isOfficialHost,
  isHarmlessJavascriptHref,
  shouldBlockJavascriptHref,
  resolveProtectionContext,
  matchesBundledBadHost,
  pickEmailScamTip,
  buildGrandmaPresetSettings,
  AFTER_SCAM_DURATION_MS,
} = globalThis.GrandmaGuardDetection;

function snapshot(overrides = {}) {
  return {
    hostname: "ordinary-example.test",
    protocol: "https:",
    titleText: "",
    pageText: "",
    pageWordCount: 0,
    articleText: "",
    quotedText: "",
    interactiveText: "",
    overlayText: "",
    telLinkText: "",
    hasTelLink: false,
    articleWordCount: 0,
    articleParagraphCount: 0,
    structuredArticle: false,
    hasByline: false,
    largeOverlay: false,
    fullscreen: false,
    scrollLocked: false,
    notificationPermission: "default",
    audibleMedia: false,
    ...overrides,
  };
}

const riskyHost = "d9fedtohubcc73birg8g.rentokium.co.in";
const gibberishHost = "xkqjrmplwvntzqwrty.top";
const deepSubdomainHost = "a7xk.m2pq.n9rt.campaign.evil.top";
const brandImpersonationHost = "windows-defender-alert.scam-host.xyz";
const shortScrambleHost = "lyu-3cvb1.top";
const fakeAmazonHost = "amazon-account-update.xyz";
const fakePaypalHost = "paypal-secure-login.top";

const cases = [
  ["fake virus overlay", true, snapshot({ hostname: riskyHost, pageText: "Your PC is infected with a virus. Click here to remove it now.", overlayText: "Your PC is infected with a virus. Click here to remove it now.", largeOverlay: true })],
  ["encrypted files takeover", true, snapshot({ hostname: riskyHost, pageText: "All your files are encrypted. Click here now to repair your computer.", overlayText: "All your files are encrypted. Click here now to repair your computer.", fullscreen: true })],
  ["allow notification bait", true, snapshot({ hostname: riskyHost, pageText: "Click Allow to continue and enable notifications.", interactiveText: "Click Allow to continue and enable notifications." })],
  ["fake CAPTCHA allow", true, snapshot({ hostname: riskyHost, pageText: "Click Allow to prove you are human and not a robot.", interactiveText: "Click Allow to prove you are human and not a robot." })],
  ["reversed Allow gate", true, snapshot({ hostname: riskyHost, pageText: "To continue, click the Allow button above.", interactiveText: "To continue, click the Allow button above." })],
  ["human check with trailing Allow action", true, snapshot({ hostname: riskyHost, pageText: "If you are not a robot, click Allow.", overlayText: "If you are not a robot, click Allow.", largeOverlay: true })],
  ["push notification subscription gate", true, snapshot({ hostname: riskyHost, pageText: "Subscribe to push notifications to access the video.", interactiveText: "Subscribe to push notifications to access the video." })],
  ["fake browser update", true, snapshot({ hostname: riskyHost, pageText: "Chrome is out of date. Download and install this update now.", overlayText: "Chrome is out of date. Download and install this update now.", largeOverlay: true })],
  ["support phone scam", true, snapshot({ hostname: riskyHost, pageText: "Your computer is infected. Call Microsoft support now at 800-555-0199.", overlayText: "Your computer is infected. Call Microsoft support now at 800-555-0199." })],
  ["security provider impersonation", true, snapshot({ hostname: riskyHost, pageText: "Microsoft Security warning. A threat was detected. Click here to remove it now.", overlayText: "Microsoft Security warning. A threat was detected. Click here to remove it now.", largeOverlay: true })],
  ["account lock phishing", true, snapshot({ hostname: riskyHost, pageText: "Your account has been locked. Verify your account now.", interactiveText: "Verify your account now.", largeOverlay: true })],
  ["expired antivirus scare", true, snapshot({ hostname: riskyHost, pageText: "McAfee license has expired. Click here to stay protected.", overlayText: "McAfee license has expired. Click here to stay protected." })],
  ["suspicious cleaner download", true, snapshot({ hostname: riskyHost, pageText: "Malware was detected on your computer. Install this cleaner to remove the threat.", overlayText: "Malware was detected on your computer. Install this cleaner to remove the threat.", largeOverlay: true })],
  ["malicious overlay on an article", true, snapshot({ hostname: "local-news.example", pageText: "Local news. To continue, click Allow.", articleText: "A long local news story. ".repeat(120), articleWordCount: 600, articleParagraphCount: 9, structuredArticle: true, hasByline: true, overlayText: "To continue, click Allow.", largeOverlay: true, scrollLocked: true })],
  ["pc locked call now scam", true, snapshot({ hostname: riskyHost, pageText: "YOUR COMPUTER HAS BEEN LOCKED. Call now at 1-855-555-0199 for Windows Support.", overlayText: "YOUR COMPUTER HAS BEEN LOCKED. Call now at 1-855-555-0199 for Windows Support.", largeOverlay: true, scrollLocked: true })],
  ["brand helpline without call verb", true, snapshot({ hostname: riskyHost, pageText: "Your computer has been locked. Microsoft Support: 855-555-0199", overlayText: "Your computer has been locked. Microsoft Support: 855-555-0199", largeOverlay: true })],
  ["lock screen with tel link", true, snapshot({ hostname: riskyHost, pageText: "Your PC has been locked by Windows Security.", telLinkText: "Call Windows Support 855-555-0199", hasTelLink: true, largeOverlay: true, scrollLocked: true })],
  ["gibberish host lock screen", true, snapshot({ hostname: gibberishHost, pageText: "Your computer has been locked. Call Microsoft support now at 800-555-0199." })],
  ["deep subdomain scare host", true, snapshot({ hostname: deepSubdomainHost, pageText: "Your computer has been locked. Call now at 855-555-0199." })],
  ["brand impersonation hostname", true, snapshot({ hostname: brandImpersonationHost, pageText: "Your PC has been locked. Windows Support: 1-888-555-0199" })],
  ["short scramble support app download", true, snapshot({ hostname: shortScrambleHost, pageText: "Download the support desktop app to view your report. Install now to continue." })],
  ["fake amazon login page", true, snapshot({ hostname: fakeAmazonHost, pageText: "Your Amazon account has unusual activity. Sign in to verify your account now.", interactiveText: "Sign in to verify your account now.", largeOverlay: true })],
  ["fake paypal login page", true, snapshot({ hostname: fakePaypalHost, pageText: "PayPal: update payment information. Log in to your account to continue.", interactiveText: "Log in to your account", largeOverlay: true })],
  ["fake microsoft login with password field", true, snapshot({
    hostname: "microsoft-signin-verify.xyz",
    titleText: "Sign in to your Microsoft account",
    pageText: "Enter your email and password to continue to Microsoft.",
    interactiveText: "Sign in",
    hasPasswordField: true
  })],
  ["homoglyph hostname login trap", true, snapshot({
    hostname: "microsоft-login.xyz",
    pageText: "Sign in to Microsoft. Enter your password to continue.",
    interactiveText: "Sign in",
    hasPasswordField: true
  })],
  ["security news quotation", false, snapshot({ hostname: "example-news.test", titleText: "How fake virus warnings work", pageText: "Security researchers explain scareware. An example says: Your PC is infected with a virus. Click here to remove it now.", articleText: "Security researchers explain scareware. An example says: Your PC is infected with a virus. Click here to remove it now. ".repeat(45), quotedText: "Your PC is infected with a virus. Click here to remove it now.", articleWordCount: 600, articleParagraphCount: 8, structuredArticle: true, hasByline: true })],
  ["help article about Allow bait", false, snapshot({ hostname: "security.example", titleText: "Avoid notification scams", pageText: "This guide explains why a fake page may say click Allow to continue.", articleText: "This guide explains why a fake page may say click Allow to continue. ".repeat(40), quotedText: "click Allow to continue", articleWordCount: 400, articleParagraphCount: 6, structuredArticle: true, hasByline: true })],
  ["article quoting reversed notification gate", false, snapshot({ hostname: "security-journal.example", titleText: "Notification scam analysis", pageText: "Researchers reported that the page said: To continue, click the Allow button.", articleText: "This article explains a notification scam. To continue, click the Allow button. ".repeat(45), quotedText: "To continue, click the Allow button.", articleWordCount: 520, articleParagraphCount: 8, structuredArticle: true, hasByline: true })],
  ["article quoting pc lock scam", false, snapshot({ hostname: "security-journal.example", titleText: "Tech support scam analysis", pageText: "Researchers reported that the page said: Your computer has been locked. Call Microsoft support now at 800-555-0199.", articleText: "This article explains a tech support scam. Your computer has been locked. Call Microsoft support now at 800-555-0199. ".repeat(40), quotedText: "Your computer has been locked. Call Microsoft support now at 800-555-0199.", articleWordCount: 560, articleParagraphCount: 8, structuredArticle: true, hasByline: true })],
  ["official Microsoft support article", false, snapshot({ hostname: "support.microsoft.com", titleText: "Protect yourself from tech support scams", pageText: "A scam may show a Microsoft Security warning, claim a threat was detected, and tell you to click here to remove it.", articleText: "A scam may show a Microsoft Security warning, claim a threat was detected, and tell you to click here to remove it.", structuredArticle: true })],
  ["google AI overview about fake virus scams", false, snapshot({
    hostname: "www.google.com",
    titleText: "fake virus scams - Google Search",
    pageText: "AI Overview. Fake virus scams often say your computer has been locked and tell you to call Microsoft support now at 800-555-0199. They may also say click Allow to continue. Search results explain how these scareware pages work.",
    overlayText: "AI Overview. Fake virus scams often say your computer has been locked and tell you to call Microsoft support now at 800-555-0199. They may also say click Allow to continue.",
    largeOverlay: true,
    pageWordCount: 420
  })],
  ["bing AI summary about scareware", false, snapshot({
    hostname: "www.bing.com",
    titleText: "fake virus warnings - Search",
    pageText: "Fake virus warnings may claim malware was detected on your computer and ask you to click here to remove it now. This search summary explains the scam.",
    overlayText: "Fake virus warnings may claim malware was detected on your computer and ask you to click here to remove it now.",
    largeOverlay: true,
    pageWordCount: 380
  })],
  ["ordinary shopping page", false, snapshot({ hostname: "shop.example", pageText: "Free delivery on garden supplies. Add to cart." })],
  ["ordinary notification settings", false, snapshot({ hostname: "calendar.example", pageText: "Allow notifications for meeting reminders in Settings." })],
  ["ordinary site notification choice", false, snapshot({ hostname: "weather.example", pageText: "Would you like weather notifications?", interactiveText: "Allow notifications Not now" })],
  ["normal CAPTCHA wording", false, snapshot({ hostname: "tickets.example", pageText: "Complete the CAPTCHA to verify that you are human." })],
  ["single generic warning", false, snapshot({ hostname: "weather.example", pageText: "Severe weather warning for your area." })],
  ["business footer phone number", false, snapshot({ hostname: "bakery.example", pageText: "Visit our bakery downtown. Call us at 555-555-0199 for catering." })],
  ["benign free-host page", false, snapshot({ hostname: "my-portfolio.pages.dev", pageText: "Welcome to my personal portfolio and project notes." })],
  ["ordinary SaaS subdomain", false, snapshot({ hostname: "app.shop.example", pageText: "Sign in to manage your store inventory and orders." })],
  ["legitimate update documentation", false, snapshot({ hostname: "mozilla.org", titleText: "Update Firefox", pageText: "Learn how Firefox updates keep your browser secure.", structuredArticle: true })],
  ["official security status page", false, snapshot({ hostname: "microsoft.com", titleText: "Microsoft Security", pageText: "Review security alerts and protection history in Windows Security.", structuredArticle: true })],
  ["official amazon account page", false, snapshot({ hostname: "www.amazon.com", pageText: "Sign in to your Amazon account to view orders and update payment settings." })],
  ["walmart help center article", false, snapshot({ hostname: "help.walmart.com", titleText: "Verify payment method", pageText: "Sign in to your Walmart account to review saved payment methods and order history.", structuredArticle: true, hasPasswordField: true })],
  ["identity verification business site", false, snapshot({ hostname: "idscan.net", titleText: "IDScan.net", pageText: "Download our SDK and scan IDs to verify customer identity for your business.", hasPasswordField: true })],
  ["official paypal login page", false, snapshot({ hostname: "www.paypal.com", pageText: "Log in to your PayPal account to send money and update payment information." })],
  ["gmail never full-page blocked", false, snapshot({ hostname: "mail.google.com", pageText: "Your computer has been locked. Call Microsoft support now at 800-555-0199.", largeOverlay: true })],
  ["github code discussing virus scams never blocked", false, snapshot({
    hostname: "github.com",
    titleText: "scareware-detector/README.md",
    pageText: "Example scareware copy: Your computer has been locked. Call Microsoft support now at 800-555-0199. Click Allow to continue. Virus detected. Remove it now.",
    interactiveText: "Click Allow to continue",
    largeOverlay: true,
    pageWordCount: 280
  })],
  ["raw githubusercontent malware sample text never blocked", false, snapshot({
    hostname: "raw.githubusercontent.com",
    titleText: "malware-sample.txt",
    pageText: "Your PC is infected with a virus. Click here to remove it now. Do not close this window.",
    pageWordCount: 120
  })],
  ["short business domain ordinary content", false, snapshot({ hostname: "cafe7.example", pageText: "Welcome to Cafe 7. Open daily for coffee and pastry." })],
  ["gift card payment scam page", true, snapshot({ hostname: riskyHost, pageText: "Your account is suspended. Buy Google Play gift cards now and read the numbers back to us.", largeOverlay: true })],
  ["crypto wallet drain page", true, snapshot({ hostname: riskyHost, pageText: "Connect your wallet to approve this transaction and claim your airdrop reward now.", interactiveText: "Connect wallet", largeOverlay: true })],
];

const linkCases = [
  ["lookalike amazon email link", true, {
    href: "https://amazon-account-update.xyz/login",
    linkText: "amazon.com",
    contextText: "Your Amazon account was suspended. Verify your account immediately."
  }],
  ["lookalike paypal email link", true, {
    href: "https://paypal-secure-login.top/secure",
    linkText: "Update PayPal",
    contextText: "Unusual activity detected. Click here to confirm your identity."
  }],
  ["scrambled top domain with urgency", true, {
    href: "https://lyu-3cvb1.top/report",
    linkText: "View your report",
    contextText: "Urgent: verify your account and open your security report now."
  }],
  ["real amazon link", false, {
    href: "https://www.amazon.com/gp/css/homepage.html",
    linkText: "amazon.com",
    contextText: "Track your package on Amazon."
  }],
  ["ordinary newsletter link", false, {
    href: "https://news.example/article/garden-tips",
    linkText: "Read more",
    contextText: "This week in the garden newsletter."
  }],
  ["walmart help article link", false, {
    href: "https://help.walmart.com/s/article/account-help",
    linkText: "Walmart Help",
    contextText: "Find answers about your Walmart account."
  }],
  ["identity verification vendor link", false, {
    href: "https://idscan.net/products/scanner",
    linkText: "IDScan",
    contextText: "Learn about identity verification for your business."
  }],
  ["homoglyph brand link", true, {
    href: "https://paypa\u043B-secure.top/login",
    linkText: "PayPal",
    contextText: "Confirm your identity immediately."
  }],
  ["cyrillic microsoft lookalike link", true, {
    href: "https://micros\u043Eft-update.xyz/signin",
    linkText: "Microsoft account",
    contextText: "Your account was locked. Verify now."
  }],
  ["smishing delivery path link", true, {
    href: "https://lyu-3cvb1.top/package/tracking",
    linkText: "Track package",
    contextText: "Your parcel is waiting."
  }],
  ["shortener redirect reason", true, {
    href: "https://amazon-account-update.xyz/login",
    resolvedFrom: "https://bit.ly/example123",
    linkText: "View details",
    contextText: "Urgent account notice."
  }],
];

const emailCases = [
  ["costco yeti reward inbox scam", true, {
    sender: "Costco_Rewards",
    subject: "rewardbaitstudios YETI Beach Lounge Wagon Bonus - Claim Now - COSTCO WHOLESALE",
    snippet: "WE'RE GIVING YOU AN EXCLUSIVE OPPORTUNITY TO RECEIVE A BRAND-NEW YETI"
  }],
  ["lowes free tool set scam", true, {
    sender: "Lowe's-Rewards",
    subject: "rewardbaitstudios, Claim Your Free Kobalt Tool Set - Lowe's Loyalty Program",
    snippet: "You have been chosen to participate in our Loyalty Program for FREE!"
  }],
  ["best buy shark vacuum scam", true, {
    sender: "BEST BUY",
    subject: "rewardbaitstudios Claim your Shark Cordless Vacuum reward today - BESTBUY",
    snippet: "EXCLUSIVE SHOPPER OFFER Claim Your Shark Vacuum We appreciate your loyalty"
  }],
  ["united healthcare dental kit scam", true, {
    sender: "United-Healthcare-E.",
    subject: "rewardbaitstudios Claim Your Free Oral-B Dental Kit",
    snippet: "You've been selected to claim a complimentary Oral-B Dental Kit from United Healthcare"
  }],
  ["lowes ridgid you won inbox scam", true, {
    sender: "LOWE'S",
    subject: "rewardbaitstudios YOU WON A RIDGID Cordless 8-Tool Combo Kit ! GET IT FROM THE NEAREST STORE OR DATE A DELIVERY",
    snippet: "- Lowe's Lowe's Dear Lowe's Customer, We've develop..."
  }],
  ["partial gmail subject still catches prize bait", true, {
    sender: "LOWE'S",
    subject: "rewardbaitstudios",
    snippet: "Lowe's",
    bodyText: "LOWE'S rewardbaitstudios YOU WON A RIDGID Cordless 8-Tool Combo Kit GET IT FROM THE NEAREST STORE"
  }],
  ["ordinary costco membership email", false, {
    sender: "Costco",
    subject: "Your Costco membership renewal reminder",
    snippet: "Your membership renews next month. Sign in to review your warehouse benefits."
  }],
  ["ordinary google security email", false, {
    sender: "Google",
    subject: "Security alert for your Google Account",
    snippet: "A new sign-in on Windows device was blocked. Review recent activity in your account."
  }],
  ["camouflage news spam echoed sender", true, {
    sender: "Services",
    subject: "Smart Waste Collection Improves City Services",
    snippet: ""
  }],
  ["camouflage news spam odd lowercase sender", true, {
    sender: "long-term",
    subject: "Floating Solar Farms Generate Clean Electricity",
    snippet: ""
  }],
  ["camouflage remote work headline spam", true, {
    sender: "Remote Work",
    subject: "Remote Work Policies Continue to Evolve",
    snippet: ""
  }],
  ["loan qualify borrow bait", true, {
    sender: "Loan approval",
    subject: "MEMBERTOKEN Great News - You May Qualify to Borrow From $100 - $40,000",
    snippet: ""
  }],
  ["free grant info bait", true, {
    sender: "EducationInfo",
    subject: "Attention potential student. Free Grant Info",
    snippet: ""
  }],
  ["fake driver account activation bait", true, {
    sender: "Uber New Driver",
    subject: "Your Driver account is ready to be activated",
    snippet: ""
  }],
  ["ordinary apple invoice stays clean", false, {
    sender: "Apple",
    subject: "Your Invoice from Apple",
    snippet: "Thanks for your purchase. View your invoice in your Apple Account."
  }],
  ["ordinary newsletter stays clean", false, {
    sender: "Local Library",
    subject: "This week at the library",
    snippet: "Join us for story time and community events."
  }],
  ["dating profile picture bait", true, {
    sender: "Online Contact",
    subject: "Hey! Just saw your profile. Here's my picture. Sun, 02 Aug 2026 04:27:37 +0300",
    snippet: ""
  }],
  ["jackpot free coins bait", true, {
    sender: "Jackpot Wins",
    subject: "Apologies! We owe you up to 10T free coins",
    snippet: ""
  }],
  ["cloud storage files waiting scare", true, {
    sender: "Cloud Storage",
    subject: "6,403 files are waiting for available Cloud space",
    snippet: ""
  }],
  ["life insurance alert dollar bait", true, {
    sender: "Insurance Desk - Alert",
    subject: "$50,000 In Life insurance",
    snippet: ""
  }],
  ["vague curiosity subject bait", true, {
    sender: "Unknown Sender",
    subject: "This is for you",
    snippet: ""
  }],
  ["miracle weight loss health bait", true, {
    sender: "Daily Tips",
    subject: "Nutritionists Say This Baking Soda Recipe Keeps Women Slim",
    snippet: ""
  }],
  ["compounded weight-loss drug bait", true, {
    sender: "Clinic Support",
    subject: "Compounded Semaglutide Starting at $134/mo",
    snippet: ""
  }],
  ["home warranty pressure bait", true, {
    sender: "Prime Home Warranty",
    subject: "Stay Cool This Summer with Reliable Home Protection",
    snippet: ""
  }],
  ["package delivery fee bait", true, {
    sender: "Shipping Desk",
    subject: "Undelivered package - delivery fee required",
    snippet: ""
  }],
  ["medicare benefits scare bait", true, {
    sender: "Benefits Notice",
    subject: "Your Medicare benefits are suspended - verify immediately",
    snippet: ""
  }],
  ["gift card payment bait", true, {
    sender: "Account Desk",
    subject: "Urgent: buy Apple gift cards to keep your account open",
    snippet: ""
  }],
  ["cold roofing partner spam", true, {
    sender: "Roofing Innovations Partner",
    subject: "Budget-Friendly Roofing Solutions: Explore Metal Roofs",
    snippet: ""
  }],
  ["brand display from free mail mismatch", true, {
    sender: "PayPal Support",
    fromAddress: "alerts9281@gmail.com",
    subject: "Please review your recent account notice",
    snippet: ""
  }],
  ["finance brand display from free mail", true, {
    sender: "loanDepot Digital Loan Option",
    fromAddress: "offers@yahoo.com",
    subject: "Home equity without the hassle",
    snippet: ""
  }],
  ["official brand domain stays clean without bait", false, {
    sender: "PayPal",
    fromAddress: "service@paypal.com",
    subject: "Your receipt from PayPal",
    snippet: "You sent a payment. View details in your account."
  }],
  ["local learned sender pattern boosts similar mail", true, {
    sender: "Warranty Desk",
    fromAddress: "desk@gmail.com",
    subject: "Household coverage reminder waiting",
    snippet: "",
    learnedPatterns: [
      { kind: "sender-domain", value: "warranty desk|gmail.com", hits: 2, lastSeen: Date.now() }
    ]
  }],
  ["not-a-scam safe pattern suppresses mismatch", false, {
    sender: "PayPal Support",
    fromAddress: "alerts9281@gmail.com",
    subject: "Please review your recent account notice",
    snippet: "",
    safePatterns: [
      { kind: "sender-domain", value: "paypal support|gmail.com", hits: 1, lastSeen: Date.now() }
    ]
  }],
  ["learned custom from-domain boosts similar mail", true, {
    sender: "Billing Desk",
    fromAddress: "notice@suspicious-bills.example",
    subject: "Account notice waiting for review",
    snippet: "",
    learnedPatterns: [
      { kind: "from-domain", value: "suspicious-bills.example", hits: 3, lastSeen: Date.now() }
    ]
  }],
  ["safe custom from-domain suppresses scammy subject", false, {
    sender: "Billing Desk",
    fromAddress: "notice@trusted-bills.example",
    subject: "You May Qualify to Borrow From $100 - $40,000",
    snippet: "",
    safePatterns: [
      { kind: "from-domain", value: "trusted-bills.example", hits: 1, lastSeen: Date.now() }
    ]
  }],
  ["ace hardware yeti bundle reward bait", true, {
    sender: "Ace Hardware",
    subject: "Just For You Your YETI PATRIOTIC Bundle Awaits!",
    snippet: ""
  }],
  ["dating new match wants bait", true, {
    sender: "Crush",
    subject: "New match wants to suck - ACCEPT ME",
    snippet: "Actually, I am looking for a real friend"
  }],
  ["send message chat bait", true, {
    sender: "Leeann, 26",
    subject: "Send Leeann a message - I want to chat with you now",
    snippet: "Online I'm looking for a man"
  }],
  ["photos and videos emailed bait", true, {
    sender: "@AVA_JONES",
    subject: "Photos and videos emailed to you. !",
    snippet: "Hi, I'm Ava Jones"
  }],
  ["pics vids sent to mail bait", true, {
    sender: "@AVA_JONES",
    subject: "Sent to your mail: pics + vids. !!",
    snippet: ""
  }],
  ["click to view photo bait", true, {
    sender: "Emily Bennett",
    subject: "click to view photo !!",
    snippet: ""
  }],
  ["attachment filename photo bait", true, {
    sender: "Sun girl",
    subject: "Hi 4 attachments IMG_3771.jpeg",
    snippet: ""
  }],
  ["neuropathy foot pain miracle bait", true, {
    sender: "Neuropathy Breakthrough",
    subject: "Tingling, Numbness, or Burning in Your Feet? Eat This...",
    snippet: ""
  }],
  ["adult health honey trick bait", true, {
    sender: "Exotic Honey Trick",
    subject: "Sydney Sweeney reveals how 1 tsp of Hollywood Honey will get you hard fast",
    snippet: ""
  }],
  ["illuminati recruitment bait", true, {
    sender: "Illuminati Recruiter",
    subject: "RE - Dear Sir/Madam, We are reaching out on behalf of the Illuminati Society",
    snippet: ""
  }],
  ["ordinary hardware store newsletter stays clean", false, {
    sender: "Ace Hardware",
    subject: "Spring lawn care tips from your local Ace",
    snippet: "Browse grills, tools, and garden supplies at your neighborhood store."
  }],
  ["clean email with one bad link", true, {
    sender: "Billing Desk",
    subject: "Statement ready",
    snippet: "Your monthly statement is ready to view online.",
    links: [{
      href: "https://paypal-secure-login.top/signin",
      linkText: "View statement",
      contextText: "Your monthly statement is ready to view online."
    }]
  }],
  ["clean email with learned bad link domain", true, {
    sender: "Support",
    subject: "Please review",
    snippet: "Open the secure page below.",
    learnedBadLinkHosts: ["scam-billing.xyz"],
    links: [{
      href: "https://scam-billing.xyz/invoice",
      linkText: "Open invoice",
      contextText: "Open the secure page below."
    }]
  }],
];

let failures = 0;
for (const [name, expected, input] of cases) {
  const result = analyze(input);
  try {
    assert.equal(result.block, expected);
  } catch {
    failures += 1;
    console.error(`FAIL ${name}: expected block=${expected}, got block=${result.block}, score=${result.score}`);
    console.error(JSON.stringify(result, null, 2));
  }
}

for (const [name, expected, input] of linkCases) {
  const result = analyzeLink(input);
  try {
    assert.equal(result.suspicious, expected);
  } catch {
    failures += 1;
    console.error(`FAIL link ${name}: expected suspicious=${expected}, got suspicious=${result.suspicious}, score=${result.score}`);
    console.error(JSON.stringify(result, null, 2));
  }
}

for (const [name, expected, input] of emailCases) {
  const result = analyzeEmailMessage(input);
  try {
    assert.equal(result.suspicious, expected);
  } catch {
    failures += 1;
    console.error(`FAIL email ${name}: expected suspicious=${expected}, got suspicious=${result.suspicious}, score=${result.score}`);
    console.error(JSON.stringify(result, null, 2));
  }
}

try {
  assert.equal(isMailHost("mail.google.com"), true);
  assert.equal(isMailHost("outlook.live.com"), true);
  assert.equal(isMailHost("mail.proton.me"), true);
  assert.equal(isMailHost("mail.yahoo.com"), true);
  assert.equal(isMailHost("us.mail.yahoo.com"), true);
  assert.equal(isMailHost("www.yahoo.com"), false);
  assert.equal(isMailHost("mail.aol.com"), true);
  assert.equal(isMailHost("shop.example"), false);
  assert.equal(normalizeTrustedHost("https://www.Example.com/path"), "example.com");
  assert.equal(isTrustedHost("shop.example.com", ["example.com"]), true);
  assert.equal(isTrustedHost("evil.example", ["example.com"]), false);
  assert.ok(analyzeHostname(shortScrambleHost).score >= 1);
  assert.ok(analyzeHostname("paypa\u043B-secure.top").reasons.some((reason) => /lookalike|non-Latin/i.test(reason)));
  assert.ok(analyzeHostname("micros\u043Eft-login.xyz").score >= 2);
  assert.equal(isShortenerHost("bit.ly"), true);
  assert.equal(isShortenerHost("example.com"), false);
  assert.equal(isOfficialHost("help.walmart.com"), true);
  assert.equal(isOfficialHost("idscan.net"), true);
  assert.equal(isHarmlessJavascriptHref("javascript:void(0);"), true);
  assert.equal(isHarmlessJavascriptHref("javascript:alert(document.cookie)"), false);
  assert.equal(shouldBlockJavascriptHref("javascript:void(0)", { mailContext: false }), false);
  assert.equal(shouldBlockJavascriptHref("javascript:void(0)", { mailContext: true }), false);
  assert.equal(shouldBlockJavascriptHref("javascript:alert(1)", { mailContext: true }), true);
  assert.equal(shouldBlockJavascriptHref("javascript:window.location='https://evil.test'", { mailContext: false }), true);
  assert.equal(isBlockedHost("evil.scam-host.xyz", ["scam-host.xyz"]), true);
  assert.ok(pickBlockPageTip(["gift card payment required"]).includes("gift cards"));
  const summary = summarizeWeeklyProtection([
    { timestamp: new Date().toISOString(), outcome: "blocked", reasons: ["fake virus"] },
    { timestamp: new Date().toISOString(), outcome: "link-warned", reasons: ["suspicious link"] }
  ]);
  assert.equal(summary.counts.blocked, 1);
  assert.equal(summary.counts.links, 1);
  const exported = buildSettingsExport({ protectionLevel: "careful", trustedHosts: ["example.com"], blockedHosts: [], learnedMailPatterns: [], learnedSafeMailPatterns: [], localMailLearningConsent: "allowed", strictModeEnabled: true });
  assert.equal(exported.grandmaGuardExport, 1);
  const importMerge = mergeSettingsImport({ protectionLevel: "standard", trustedHosts: [], blockedHosts: [], learnedMailPatterns: [], learnedSafeMailPatterns: [], localMailLearningConsent: "unset", localMailLearningEnabled: false }, exported);
  assert.equal(importMerge.ok, true);
  assert.equal(importMerge.settings.protectionLevel, "careful");
  assert.equal(isMailHost("mail.zoho.com"), true);
  assert.equal(isMailHost("www.icloud.com"), true);
  assert.equal(isMailHost("mail.fastmail.com"), true);
  assert.equal(isMailHost("app.tuta.com"), true);
  assert.equal(matchesBundledBadHost("billing.paypal-secure-login.xyz"), true);
  assert.equal(matchesBundledBadHost("google.com"), false);
  assert.ok(pickEmailScamTip("billing", ["gift card payment"]).includes("gift cards"));
  const preset = buildGrandmaPresetSettings({ protectionLevel: "standard", shoppingModeEnabled: false });
  assert.equal(preset.protectionLevel, "careful");
  assert.equal(preset.shoppingModeEnabled, true);
  assert.equal(preset.autoAfterScamOnContinue, true);
  const ctx = resolveProtectionContext({ protectionLevel: "standard", afterScamUntil: Date.now() + 1000, shoppingModeEnabled: true, shoppingPage: true });
  assert.equal(ctx.protectionLevel, "careful");
  assert.equal(ctx.thresholdReduction, 2);
  const learnedLinks = mergeLearnedBadLinkHosts([], "scam-billing.xyz");
  assert.ok(analyzeLink({ href: "https://scam-billing.xyz/login", learnedBadLinkHosts: learnedLinks }).suspicious);
  assert.equal(AFTER_SCAM_DURATION_MS, 48 * 60 * 60 * 1000);
  const merged = mergeLearnedMailPatterns([], [
    { kind: "sender", value: "Warranty Desk" },
    { kind: "sender", value: "warranty desk" }
  ]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].hits, 2);
  const withDomain = mergeLearnedMailPatterns(merged, [
    { kind: "from-domain", value: "suspicious-bills.example" }
  ]);
  assert.equal(withDomain.length, 2);
  const undone = removeLearnedMailPatterns(withDomain, [
    { kind: "from-domain", value: "suspicious-bills.example" }
  ]);
  assert.equal(undone.length, 1);
} catch (error) {
  failures += 1;
  console.error(`FAIL helper checks: ${error.message}`);
}

if (failures > 0) {
  process.exitCode = 1;
} else {
  console.log(`${cases.length} page, ${linkCases.length} link, and ${emailCases.length} email cases passed.`);
}
