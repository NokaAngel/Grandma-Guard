# Store listing copy

## Ready-to-paste listing fields

### Chrome Web Store

**Title:** Grandma Guard

**Short description:** Calm, local protection from fake virus alerts, notification traps, forced updates, phishing, and tech-support scams.

### Firefox Add-ons

**Title:** Grandma Guard

**Summary:** Calm, local protection from fake virus alerts, notification traps, forced updates, phishing, and tech-support scams.

### Opera Add-ons

**Title:** Grandma Guard

**Short description:** Calm, local protection from fake virus alerts, notification traps, forced updates, phishing, and tech-support scams.

## Name

Grandma Guard

## Short description

Calm, local protection from fake virus alerts, notification traps, forced updates, phishing, and tech-support scams.

## Full description

Grandma Guard helps protect people from deceptive pages that pretend a computer is infected, damaged, locked, or out of date; pressure the visitor to call fake support; or demand that browser notifications be allowed to continue.

The extension evaluates pages locally using multiple independent signals, including threat claims, coercive actions, permission traps, impersonation language, overlays, and page behavior. A scary phrase by itself is not enough. Article structure, bylines, quotations, code samples, editorial wording, and official vendor domains help suppress false alarms on news reports and legitimate security guidance.

When a high-confidence page is detected, Grandma Guard stops interaction and shows a calm explanation. The tab closes automatically after 30 seconds. A two-step, delayed Continue option can open the exact address once without permanently trusting the site.

Features:

- Context-aware, multi-signal fake-alert detection
- Protection against fake virus scans, tech-support scams, notification bait, account-lock phishing, and forced updates
- False-positive safeguards for articles, guides, quotes, and official sites
- One-time Continue option with a second confirmation and delay
- Local blocked-page history that the user can clear
- No accounts, ads, analytics, remote configuration, or transmitted browsing data

Grandma Guard is a browser safety aid, not an antivirus. Keep your operating system, browser, and trusted security software updated.

## Chrome Web Store privacy fields

**Single purpose:** Detect and stop high-confidence deceptive fake-alert web pages while providing a safe warning and a deliberately gated one-time override.

**Storage permission justification:** Stores up to 100 blocked hostnames with timestamps and detection reasons locally, plus short-lived decision tokens needed for the one-time Continue feature. Users can clear the history. Nothing is synced or transmitted.

**Host access justification:** The core feature must inspect visible text, interactive labels, page structure, hostname, and limited behavior signals on HTTP and HTTPS pages to recognize fake alerts before the user interacts with them. Analysis runs locally.

**Remote code:** Select **No, I am not using remote code**. All JavaScript is included in the submitted package.

**Data handling disclosure:** Disclose **Website content** because visible page content and structure are evaluated locally. Disclose **Web history** because the hostname of a blocked page is retained locally and an exact blocked address is held briefly for the one-time Continue flow. State that neither category is transmitted, sold, shared, or used outside the visible protection feature.

**Limited Use certifications:** Certify only after confirming that the dashboard statements match `docs/privacy/PRIVACY_POLICY.md` and the submitted code.

## Reviewer notes

Grandma Guard has no login, payment, server, telemetry, advertising, affiliate links, remotely hosted code, or downloaded configuration. The detector runs as a content script on HTTP/HTTPS pages. A detection sends only the current address and detection result to the packaged background context, which stores limited event data in browser-local storage and navigates the same tab to the packaged warning page.

The **Continue anyway** control opens a second packaged confirmation page. After five seconds, the user may allow only the original exact address once. The bypass is consumed on use and does not apply to redirects or later visits.

Select the toolbar icon to open the local detection history. No external account or test credentials are required.

## Suggested categories

- Chrome Web Store: Privacy & Security
- Firefox Add-ons: Privacy & Security
- Opera Add-ons: Productivity (Opera's current category list does not include Security)
