<p align="center">
  <img src="assets/branding/grandma-guard-logo-512.png" alt="Grandma Guard logo" width="180">
</p>

<h1 align="center">Grandma Guard</h1>

<p align="center">
  Calm, local protection from fake virus alerts, notification traps, forced
  updates, phishing, and tech-support scams.
</p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/grandma-guard/lmdflikifdocnikfjcfmgmcaknnpghod">
    <img src="https://img.shields.io/badge/Chrome-Install-4285F4?logo=googlechrome&logoColor=white" alt="Install Grandma Guard for Chrome">
  </a>
  <a href="https://addons.mozilla.org/en-US/firefox/addon/grandma-guard/">
    <img src="https://img.shields.io/badge/Firefox-Install-FF7139?logo=firefoxbrowser&logoColor=white" alt="Install Grandma Guard for Firefox">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-0B7A67" alt="MIT License">
  </a>
  <a href="https://github.com/NokaAngel/Grandma-Guard/actions/workflows/ci.yml">
    <img src="https://github.com/NokaAngel/Grandma-Guard/actions/workflows/ci.yml/badge.svg" alt="Build status">
  </a>
  <img src="https://img.shields.io/badge/Manifest-V3-334155" alt="Manifest V3">
  <img src="https://img.shields.io/badge/Privacy-Local%20only-0B7A67" alt="Local-only privacy">
</p>

## What is Grandma Guard?

Grandma Guard is an open-source browser extension designed to stop
high-confidence scareware and deceptive web pages before someone can interact
with them.

It looks for combinations of suspicious claims, coercive instructions,
notification traps, fake support prompts, forced downloads, page-covering
overlays, and other risky behavior. It also considers context so that news
articles, security guides, quoted scam examples, and legitimate vendor websites
are less likely to trigger a false warning.

The extension was inspired by the creator's grandmother and the need for a
calm, understandable layer of protection for people who may not recognize
browser-based scams.

## Browser availability

| Browser | Install |
| --- | --- |
| Google Chrome | [Chrome Web Store](https://chromewebstore.google.com/detail/grandma-guard/lmdflikifdocnikfjcfmgmcaknnpghod) |
| Mozilla Firefox | [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/grandma-guard/) |
| Opera | Use the [Chrome Web Store](https://chromewebstore.google.com/detail/grandma-guard/lmdflikifdocnikfjcfmgmcaknnpghod) listing in Opera |

Install only from these official browser stores. Verified packages and source archives are also attached to [GitHub Releases](https://github.com/NokaAngel/Grandma-Guard/releases).

Project website: https://grandmaguard.nokaangel.dev

## What's new in 2.0.0

Version 2.0.0 is a major update while staying fully local:

- Toolbar popup dashboard with weekly protection counts
- Link click, hover, paste, and short-link warnings
- Navigation guard for family blocklist and remembered bad link domains
- Shopping mode, 48-hour after-scam protection, and Grandma preset
- Expanded webmail support: Gmail, Outlook, Yahoo, Proton, AOL, iCloud, Zoho, Fastmail, and Tuta
- Plain-language scam tips when reading flagged emails
- Family blocklist, strict mode with caregiver PIN, and settings export/import

Full release history is in [CHANGELOG.md](CHANGELOG.md). Store version notes for Firefox are in [docs/FIREFOX_RELEASE_NOTES.md](docs/FIREFOX_RELEASE_NOTES.md).

## What it can detect

- Fake virus, malware, infection, damaged-device, and PC-locked alerts
- Tech-support scams that pressure someone to call a phone number
- Scrambled, deep-subdomain, and brand-impersonating hostnames used with scare pages
- Fake support or report desktop-app downloads and remote-access tool pressure
- Fake Amazon, PayPal, and bank login or account-verification pages
- Suspicious links and fake reward or prize emails inside supported webmail (Gmail, Outlook, Proton, Yahoo, AOL, iCloud, Zoho, Fastmail, and Tuta), marked with Possible scam highlights and hover reasons
- Notification prompts disguised as CAPTCHA or Continue buttons
- Fake browser, Windows, antivirus, and security update warnings
- Account-lock and identity-verification phishing
- Downloads presented as required cleaners, scanners, or protection tools
- Full-screen and page-covering scareware overlays
- Instructions that pressure the visitor not to close the page

Grandma Guard does not block a page because of one scary phrase. A block
requires stronger combinations of evidence or a high-confidence deception
pattern.

## What happens when a page is stopped?

Grandma Guard replaces the suspicious page with a calm warning that explains:

- which website was stopped;
- why it looked suspicious;
- what the visitor should avoid doing; and
- how to close the tab safely.

The tab closes automatically after 30 seconds. A less-prominent Continue path
requires a second confirmation and a five-second pause. If confirmed, it opens
only the exact address once and does not permanently trust the website.

<p align="center">
  <img src="assets/store/store-screenshot-1280x800.png" alt="Grandma Guard warning page showing why a suspicious website was stopped" width="900">
</p>

## Privacy by design

Grandma Guard performs its analysis inside the browser.

- No account is required.
- No analytics or telemetry are included.
- No browsing data is sent to the developer.
- No advertising or affiliate tracking is included.
- Bundled domain rule packs ship with each release; optional GitHub refresh downloads public JSON only (no browsing data sent)
- No remote JavaScript or downloaded executable configuration is used.
- Detection history stays in browser-local storage.
- Email scam highlights and reasons stay on the device.
- The user can clear the local detection history at any time.

The extension stores up to 100 blocked hostnames with timestamps and detection
reasons. An exact blocked address is kept only briefly when needed for the
one-time Continue flow.

Read the full [privacy policy](docs/privacy/PRIVACY_POLICY.md).

## Security design

- Readable, unminified source code
- No third-party runtime libraries
- No remote code execution
- Manifest V3 browser packages
- Limited `storage` and `webNavigation` permissions
- Page access used only for local detection
- Short-lived, single-use bypass tokens
- Context-aware false-positive safeguards
- Automated syntax, manifest, packaging, and regression checks

Grandma Guard is a browser safety aid, not an antivirus. Keep the operating
system, browser, and trusted security software updated.

## Repository layout

```text
GrandmaGuard/
|-- extension/  Shared source tree and browser manifests
|-- assets/     Branding and store artwork
|-- docs/       Privacy policies and submission notes
|-- tests/      Detection-engine regression tests
|-- tools/      Build scripts
|-- BUILDING.md Build instructions
`-- LICENSE     MIT License
```

## Build and test

Grandma Guard does not require npm packages, a bundler, minification, or network
access during the build.

From the repository root:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\tools\Build-Release.ps1 -Browser All
```

Use `-Browser Chrome` or `-Browser Firefox` to build only one package.

See [BUILDING.md](BUILDING.md) for the reference environment and full steps.

## Reviewing or contributing

The core detection logic is in
[`extension/detection-engine.js`](extension/detection-engine.js). Browser page
collection is handled by
[`extension/detector.js`](extension/detector.js), and the
regression scenarios are in
[`tests/detection-engine.test.mjs`](tests/detection-engine.test.mjs).

When changing detection behavior:

1. Add or update a regression case.
2. Keep legitimate articles and security education pages in the test set.
3. Run the complete release build.
4. Confirm that Chrome and Firefox still contain the same shared code.
5. Document any new permission or data-handling behavior.

Security reports should avoid publishing live malicious URLs, personal
information, or exploit details in a public issue.

## License

Grandma Guard is released under the [MIT License](LICENSE).

Copyright (c) 2026 NokaAngel.
