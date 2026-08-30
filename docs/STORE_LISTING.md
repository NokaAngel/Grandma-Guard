# Store listing copy

## Ready-to-paste listing fields

### Chrome Web Store

**Title:** Grandma Guard

**Short description:** Calm, local protection from fake virus alerts, notification traps, forced updates, phishing, and tech-support scams.

### Firefox Add-ons

**Title:** Grandma Guard

**Summary:** Calm, local protection from fake virus alerts, notification traps, forced updates, phishing, and tech-support scams.

## Name

Grandma Guard

## Short description

Calm, local protection from fake virus alerts, notification traps, forced updates, phishing, and tech-support scams.

## Full description

Grandma Guard helps protect families and less technical computer users from deceptive browser pages designed to create panic.

It watches for fake virus warnings, notification permission traps, fake CAPTCHA prompts, tech-support phone scams, suspicious downloads, forced browser updates, account-lock messages, full-screen scare pages, and brand impersonation such as fake shopping, payment, or bank login pages.

Grandma Guard analyzes visible page signals locally inside the browser. It looks for combinations of suspicious claims, pressure tactics, page behavior, and hostname characteristics. It also considers article structure, quotations, bylines, and official support websites to reduce false alarms.

When confidence is high, Grandma Guard replaces the suspicious page with a calm warning and provides a safe way to close the tab. A delayed one-time Continue option is available if a legitimate page is blocked. It applies only to the exact address and never permanently trusts the website.

On Gmail, Outlook, Proton, Yahoo, and AOL webmail, Grandma Guard can mark suspicious messages and links with Possible scam highlights and hover reasons without replacing the inbox. Optional on-device email learning is off until you allow it. If enabled, short scam-pattern fingerprints stay on this device only, and you can mark mistakes as Not a scam with a short undo window.

Family protection settings let you choose Standard or Extra careful mode and keep a trusted websites list on this device.

Grandma Guard has no account, advertising, analytics, telemetry, remote configuration, or developer-operated server. Page content, browsing activity, and email content are not transmitted.

Opera users: there is no separate Opera listing. Install Grandma Guard from the Chrome Web Store in Opera.

## Developer comments

### Known limitations

Grandma Guard is a browser safety aid, not an antivirus. It cannot guarantee that every scam will be detected, and legitimate pages may occasionally be blocked. A delayed one-time Continue option is available for false positives.

Grandma Guard cannot remove browser notifications that were allowed before the extension was installed. Existing notification permissions must be removed through the browser settings.

Webmail highlights depend on each provider's page layout. Some messages or list views may not be labeled until the open message or list row is visible to the extension.

### Possible future direction

Expand detection for emerging fake advertisements, notification scams, fake CAPTCHA pages, malicious downloads, and other deceptive campaigns.

Consider optional server-assisted threat intelligence or diagnostic features in a future version.

These future features are not included in version 1.3.0. Any future server communication or data collection would be disclosed before release, documented in an updated privacy policy, and provided with appropriate user controls.

## Chrome Web Store privacy fields

**Single purpose:** Detect and stop high-confidence deceptive fake-alert web pages while providing a safe warning and a deliberately gated one-time override.

**Storage permission justification:** Stores up to 100 detection events with timestamps and reasons locally, optional on-device email learning patterns when the user allows learning, Family protection settings (protection level and trusted websites), and short-lived decision tokens needed for the one-time Continue feature. Users can clear history and learned patterns. Nothing is synced or transmitted.

**Host access justification:** The core feature must inspect visible text, interactive labels, page structure, hostname, and limited behavior signals on HTTP and HTTPS pages, and visible links in supported webmail pages, to recognize fake alerts before the user interacts with them. Analysis runs locally.

**Remote code:** Select **No, I am not using remote code**. All JavaScript is included in the submitted package.

**Data handling disclosure:** Disclose **Website content** because visible page content and structure are evaluated locally. Disclose **Web history** because the hostname of a blocked page is retained locally and an exact blocked address is held briefly for the one-time Continue flow. State that neither category is transmitted, sold, shared, or used outside the visible protection feature.

**Limited Use certifications:** Certify only after confirming that the dashboard statements match `docs/privacy/PRIVACY_POLICY.md` and the submitted code.

## Reviewer notes

Version 1.3.0 adds Family protection settings, trusted websites, and an optional Ko-fi donate link. Learning data and settings stay local and can be cleared in Options.

The submitted ZIP is already readable unminified source. `tools/Build-Release.ps1 -Browser Firefox` only copies `extension/`, selects `manifest.firefox.json`, validates, and zips. No separate generated-source archive is needed.

No test credentials required. Use any Gmail, Outlook, Proton, Yahoo, or AOL webmail session to exercise inbox highlights and learning prompts. Toolbar icon opens local history and Options. Support: https://nokaangel.dev/support?project=grandmaguard

## Suggested categories

- Chrome Web Store: Privacy & Security
- Firefox Add-ons: Privacy & Security

## Store screenshots

- `assets/store/store-screenshot-blocked-1280x800.png` - calm blocked-page warning
- `assets/store/store-screenshot-gmail-scam-1280x800.png` - webmail Possible scam highlights
- `assets/store/store-screenshot-settings-1280x800.png` - Family protection settings
- `assets/store/chrome-promo-440x280.png` - Chrome Web Store small promo tile
