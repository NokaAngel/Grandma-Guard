import assert from "node:assert/strict";
import "../extension/false-positive-report.js";

const {
  buildWebReportUrl,
  buildGitHubReportUrl,
  buildReportUrl,
  normalizeDomain,
  extractFromDomain,
  REPORT_REPO,
  WEB_REPORT_BASE
} = globalThis.GrandmaGuardFalsePositiveReport;

assert.equal(REPORT_REPO, "NokaAngel/Grandma-Guard");
assert.equal(WEB_REPORT_BASE, "https://grandmaguard.nokaangel.dev/report");
assert.equal(normalizeDomain("https://WWW.Example.COM/path"), "example.com");
assert.equal(extractFromDomain("Store Name <orders@shop.example.com>"), "shop.example.com");

const websiteWebUrl = buildWebReportUrl({
  type: "website",
  domain: "help.walmart.com",
  extensionVersion: "2.1.2",
  reasons: ["Uses scareware wording", "Low article depth"]
});
assert.match(websiteWebUrl, /^https:\/\/grandmaguard\.nokaangel\.dev\/report\?/);
assert.match(websiteWebUrl, /type=website/);
assert.match(websiteWebUrl, /domain=help\.walmart\.com/);
assert.match(websiteWebUrl, /version=2\.1\.2/);
assert.match(websiteWebUrl, /reasons=/);

const websiteGithubUrl = buildGitHubReportUrl({
  type: "website",
  domain: "help.walmart.com",
  extensionVersion: "2.1.2",
  reasons: ["Uses scareware wording", "Low article depth"]
});
assert.match(websiteGithubUrl, /^https:\/\/github\.com\/NokaAngel\/Grandma-Guard\/issues\/new\?/);
assert.match(websiteGithubUrl, /help\.walmart\.com/);
assert.equal(buildReportUrl({ domain: "example.com" }), buildGitHubReportUrl({ domain: "example.com" }));

const emailWebUrl = buildWebReportUrl({
  type: "email",
  fromAddress: "noreply@notifications.idscan.net",
  mailHost: "mail.google.com",
  extensionVersion: "2.1.2",
  reasons: ["Suspicious link hostname"]
});
assert.match(emailWebUrl, /type=email/);
assert.match(emailWebUrl, /idscan\.net/);
assert.match(emailWebUrl, /mail\.google\.com/);

console.log("false-positive-report tests passed");
