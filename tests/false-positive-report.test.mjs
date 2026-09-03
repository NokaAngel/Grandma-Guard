import assert from "node:assert/strict";
import "../extension/false-positive-report.js";

const {
  buildReportUrl,
  normalizeDomain,
  extractFromDomain,
  REPORT_REPO
} = globalThis.GrandmaGuardFalsePositiveReport;

assert.equal(REPORT_REPO, "NokaAngel/Grandma-Guard");
assert.equal(normalizeDomain("https://WWW.Example.COM/path"), "example.com");
assert.equal(extractFromDomain("Store Name <orders@shop.example.com>"), "shop.example.com");

const websiteUrl = buildReportUrl({
  type: "website",
  domain: "help.walmart.com",
  extensionVersion: "2.1.1",
  reasons: ["Uses scareware wording", "Low article depth"]
});
assert.match(websiteUrl, /^https:\/\/github\.com\/NokaAngel\/Grandma-Guard\/issues\/new\?/);
assert.match(websiteUrl, /title=.*help\.walmart\.com/);
assert.match(websiteUrl, /False.positive/i);
const websiteBody = decodeURIComponent(websiteUrl.split("body=")[1].split("&labels=")[0]).replace(/\+/g, " ");
assert.match(websiteBody, /Uses scareware wording/);

const emailUrl = buildReportUrl({
  type: "email",
  fromAddress: "noreply@notifications.idscan.net",
  mailHost: "mail.google.com",
  extensionVersion: "2.1.1",
  reasons: ["Suspicious link hostname"]
});
assert.match(emailUrl, /Report.type/i);
assert.match(emailUrl, /idscan\.net/);
assert.match(emailUrl, /mail\.google\.com/);
assert.match(emailUrl, /false.positive/i);

console.log("false-positive-report tests passed");
