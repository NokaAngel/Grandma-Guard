import assert from "node:assert/strict";
import "../extension/detection-engine.js";

const { analyze } = globalThis.GrandmaGuardDetection;

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
  ["security news quotation", false, snapshot({ hostname: "example-news.test", titleText: "How fake virus warnings work", pageText: "Security researchers explain scareware. An example says: Your PC is infected with a virus. Click here to remove it now.", articleText: "Security researchers explain scareware. An example says: Your PC is infected with a virus. Click here to remove it now. ".repeat(45), quotedText: "Your PC is infected with a virus. Click here to remove it now.", articleWordCount: 600, articleParagraphCount: 8, structuredArticle: true, hasByline: true })],
  ["help article about Allow bait", false, snapshot({ hostname: "security.example", titleText: "Avoid notification scams", pageText: "This guide explains why a fake page may say click Allow to continue.", articleText: "This guide explains why a fake page may say click Allow to continue. ".repeat(40), quotedText: "click Allow to continue", articleWordCount: 400, articleParagraphCount: 6, structuredArticle: true, hasByline: true })],
  ["article quoting reversed notification gate", false, snapshot({ hostname: "security-journal.example", titleText: "Notification scam analysis", pageText: "Researchers reported that the page said: To continue, click the Allow button.", articleText: "This article explains a notification scam. To continue, click the Allow button. ".repeat(45), quotedText: "To continue, click the Allow button.", articleWordCount: 520, articleParagraphCount: 8, structuredArticle: true, hasByline: true })],
  ["official Microsoft support article", false, snapshot({ hostname: "support.microsoft.com", titleText: "Protect yourself from tech support scams", pageText: "A scam may show a Microsoft Security warning, claim a threat was detected, and tell you to click here to remove it.", articleText: "A scam may show a Microsoft Security warning, claim a threat was detected, and tell you to click here to remove it.", structuredArticle: true })],
  ["ordinary shopping page", false, snapshot({ hostname: "shop.example", pageText: "Free delivery on garden supplies. Add to cart." })],
  ["ordinary notification settings", false, snapshot({ hostname: "calendar.example", pageText: "Allow notifications for meeting reminders in Settings." })],
  ["ordinary site notification choice", false, snapshot({ hostname: "weather.example", pageText: "Would you like weather notifications?", interactiveText: "Allow notifications Not now" })],
  ["normal CAPTCHA wording", false, snapshot({ hostname: "tickets.example", pageText: "Complete the CAPTCHA to verify that you are human." })],
  ["single generic warning", false, snapshot({ hostname: "weather.example", pageText: "Severe weather warning for your area." })],
  ["legitimate update documentation", false, snapshot({ hostname: "mozilla.org", titleText: "Update Firefox", pageText: "Learn how Firefox updates keep your browser secure.", structuredArticle: true })],
  ["official security status page", false, snapshot({ hostname: "microsoft.com", titleText: "Microsoft Security", pageText: "Review security alerts and protection history in Windows Security.", structuredArticle: true })],
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

if (failures > 0) {
  process.exitCode = 1;
} else {
  console.log(`${cases.length} Grandma Guard detection cases passed.`);
}
