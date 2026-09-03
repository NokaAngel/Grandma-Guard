# Changelog

All notable changes to Grandma Guard are documented in this file.

## 2.1.0 - 2026-09-02

### Added

- GitHub-hosted domain rule packs for official/trusted business domains
- Ed25519 signatures for bundled and remote rule packs (unsigned remote packs rejected)
- Bundled `data/rule-packs.json` copied into each release build
- Optional background refresh every 48 hours from `NokaAngel/Grandma-Guard` on GitHub
- Options controls to enable GitHub updates, refresh now, and view list status

### Changed

- Official domain lists moved out of hardcoded JavaScript into versioned JSON rule packs
- Remote updates are additive only and never remove bundled core protection

### Packages

- `Grandma-Guard-Chrome-2.1.0.zip`
- `Grandma-Guard-Firefox-2.1.0.zip`

## 2.0.2 - 2026-09-02

### Fixed

- Harmless `javascript:void(0)` and similar no-op links work again on normal websites
- Still blocks executable `javascript:` links in webmail and when the payload looks malicious
- Walmart, Target, Costco, and other major retailer domains are treated as official sites
- Reduced false alarms on help pages and identity verification sites such as idscan.net
- Trap guard no longer treats every low-score page as risky; requires stronger evidence
- Link warnings need a higher score before interrupting clicks or hovers

### Packages

- `Grandma-Guard-Chrome-2.0.2.zip`
- `Grandma-Guard-Firefox-2.0.2.zip`

## 2.0.1 - 2026-08-30

### Fixed

- Webmail scam pills align more reliably in Gmail, Outlook, Yahoo, and other providers
- Pills prefer the subject column when the sender row has an avatar so labels do not break list layout
- Open-email warnings, tips, and Not a scam now share one aligned action bar below the subject
- Improved sender and subject selectors for Outlook, Proton, and newer webmail layouts

### Packages

- `Grandma-Guard-Chrome-2.0.1.zip`
- `Grandma-Guard-Firefox-2.0.1.zip`

## 2.0.0 - 2026-08-29

### Added

- Toolbar popup dashboard with weekly protection counts and quick links to Options
- Grandma preset in Options (Extra careful + Shopping mode + auto after-scam on Continue)
- Navigation guard that blocks family blocklist and remembered bad link domains before pages load
- Bundled scam-host pattern list for common phishing domain fragments
- Smishing-style detection in email and on pages with phone/text bait
- Fastmail and Tutanota (Tuta) webmail support
- Plain-language scam tips when reading flagged emails
- "Bad link" inbox pills for link-only scam messages
- Blocks `javascript:` links and warns on suspicious `tel:` / `sms:` links in scam context
- Auto 48-hour after-scam protection when using Continue (toggle in Options)

### Improved

- Gmail spam folder, Outlook pop-out lists, and iCloud/Fastmail row selectors
- Settings export includes shopping mode, after-scam timer, and learned link domains
- Open-email UI shows contextual safety tips alongside the Not a scam button

### Packages

- `Grandma-Guard-Chrome-2.0.0.zip`
- `Grandma-Guard-Firefox-2.0.0.zip`

## 1.6.0 - 2026-08-29

### Added

- Shopping mode for extra scrutiny on checkout, payment, and gift-card pages
- 48-hour after-scam protection mode for stronger local warnings after an incident
- Remembered suspicious link domains learned from link warnings
- "Block this website" action on suspicious link warnings
- Clipboard pasted-link warnings in form fields and text boxes
- iCloud Mail and Zoho Mail webmail support
- "Turn on 48-hour extra protection" button on blocked pages
- Expanded abuse-prone domain ending list used during hostname analysis

### Improved

- Link, page, and email thresholds now respect after-scam and shopping-mode boosts
- Settings backup/export now includes shopping mode, after-scam timer, and learned link domains

### Packages

- `Grandma-Guard-Chrome-1.6.0.zip`
- `Grandma-Guard-Firefox-1.6.0.zip`

## 1.5.0 - 2026-08-29

### Added

- Link hover warnings that show the real destination before click in webmail and on ordinary pages
- Short-link expansion for services like bit.ly and t.co, with warnings when the final destination looks risky
- Link-only email detection that flags clean-looking messages with one bad URL
- Weekly protection summary in Options (pages blocked, suspicious emails, suspicious links, Continue used)
- Strict mode with caregiver PIN required before Continue on blocked pages
- Family blocklist for hostnames that can never use Continue on this device
- Export/import backup for trusted sites, blocklist, and on-device email learning (JSON file, no PIN included)
- Trap helpers for fullscreen scare pages, alarm audio, and suspicious notification Allow clicks
- Password-form submit guard on unofficial brand-login pages
- Plain-language safety tips on blocked pages
- New detection for gift-card payment scams, crypto wallet drain pages, and smishing-style link paths

### Improved

- Open-email link warnings now show which hostname triggered the alert
- Detection history labels link warnings, marked-safe actions, and link-only email flags more clearly

### Packages

- `Grandma-Guard-Chrome-1.5.0.zip`
- `Grandma-Guard-Firefox-1.5.0.zip`

## 1.4.0 - 2026-08-29

### Added

- Suspicious link click warnings on web pages and inside webmail
- "This site is safe" button on blocked pages to add trusted websites locally
- Login-on-wrong-domain detection for password forms on unofficial brand pages
- Punycode and homoglyph hostname checks for lookalike domains

### Packages

- `Grandma-Guard-Chrome-1.4.0.zip`
- `Grandma-Guard-Firefox-1.4.0.zip`

## 1.3.0 - 2026-08-16

### Added

- Family protection settings in Options: Standard vs Extra careful
- Trusted websites allowlist (never block that host or its subdomains on this device)
- Ko-fi donate link so supporters can help fund development (https://ko-fi.com/nokaangel)
- New professional store screenshots for blocked pages, webmail highlights, and Family settings
- New Chrome Web Store promo tile (`chrome-promo-440x280.png`)
- Project website under `GrandmaGuard Website/` with download, help, privacy, and release notes pages
- Store-gated site versioning (`GrandmaGuard Website/app/config/product.json`) plus `app/tools/check-store-versions.php` so public pages advertise 1.3.0 as soon as either store lists it (with store-specific banners), and `?preview=1` for early review

### Improved

- Options page retitled to Protection settings and reorganized for family use
- Extra careful mode slightly lowers page-block and email-warning thresholds for borderline scare pages and mail
- Privacy policy revision **1.3.0** (effective August 16, 2026) documents Family protection settings and trusted websites across shared, Chrome, and website privacy pages
- Store listing, submission guide, README, and deployment docs updated for Chrome + Firefox only
- Website download, help, and home pages clarify that Opera users should install from the Chrome Web Store

### Fixed

- Removed remaining em dashes and en dashes from extension and docs (release validation rejects them)
- Cleared stale Opera packaging, CI handoff, Opera privacy policy, and Opera store artwork after scrapping the separate Opera listing

### Changed

- Dropped the separate Opera build target and listing; Opera users should use the Chrome Web Store version
- Release packages are Chrome and Firefox only

### Packages

- `Grandma-Guard-Chrome-1.3.0.zip`
- `Grandma-Guard-Firefox-1.3.0.zip`

## 1.2.0 - 2026-08-01

### Added

- Opt-in on-device email learning for short local scam-pattern fingerprints
- Domain memory for custom From domains (not broad free webmail providers alone)
- In-message **Not a scam** control with a short undo window
- One-time inbox prompt and settings control for learning consent
- Post-update on-device notice when a new extension version and privacy changes ship
- Stronger inbox heuristics for suspicious webmail messages and links

### Improved

- Privacy policy revision **1.2.0** (effective August 1, 2026) documents webmail reading, email warnings, on-device learning, permissions, and retention
- Privacy contact points to the Grandma Guard support form at https://nokaangel.dev/support?project=grandmaguard
- Shared and Chrome privacy policy docs aligned with the published site policy

### Fixed

- Replaced unsafe `innerHTML` assignments in `detector.js` and `mail-guard.js` with DOM `createElement` / `textContent` construction so Firefox AMO validation no longer flags those warnings

### Packages

- `Grandma-Guard-Chrome-1.2.0.zip`
- `Grandma-Guard-Firefox-1.2.0.zip`

## 1.1.1 - 2026-07

### Improved

- Release packaging and store submission documentation updates for the 1.1.x line

## 1.1.0 - 2026-07

### Added

- Stronger local detection for scrambled scam hosts and abuse-prone domain shapes
- Detection for fake support or report desktop-app download pressure
- Detection for fake Amazon, PayPal, and bank login pages on lookalike hosts
- Calm Possible scam highlights on Gmail, Outlook, Proton, Yahoo, and AOL webmail
- Hover reasons for webmail warnings instead of intrusive popup alerts

### Security / privacy

- Still no telemetry, remote code, analytics, or off-device data collection
- Firefox stable add-on ID unchanged
