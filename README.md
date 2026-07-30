<p align="center">
  <img src="assets/branding/grandma-guard-logo-512.png" alt="Grandma Guard logo" width="180">
</p>

<h1 align="center">Grandma Guard</h1>

<p align="center">
  Calm, local protection from fake virus alerts, notification traps, forced
  updates, phishing, and tech-support scams.
</p>

<p align="center">
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

| Browser | Status | Install or package |
| --- | --- | --- |
| Firefox | Published | [Install from Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/grandma-guard/) |
| Chrome | Release package | [Download from GitHub Releases](https://github.com/NokaAngel/Grandma-Guard/releases) |
| Opera | Release package | [Download from GitHub Releases](https://github.com/NokaAngel/Grandma-Guard/releases) |

Every GitHub Release includes verified Chrome, Firefox, and Opera packages plus
a complete source archive. Firefox uses its own Manifest V3 background
configuration and stable add-on ID.

## What's new in 1.0.1

Version 1.0.1 is a maintenance and transparency release:

- Provides the complete readable source under the MIT License
- Adds reproducible build and package-validation instructions
- Aligns the Chrome, Firefox, and Opera source trees
- Keeps the same browser permissions and privacy behavior
- Adds no telemetry, remote code, or data collection

Detection behavior is unchanged from version 1.0.0.

## What it can detect

- Fake virus, malware, infection, and damaged-device alerts
- Tech-support scams that pressure someone to call a phone number
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
- No remote JavaScript or downloaded configuration is used.
- Detection history stays in browser-local storage.
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
- Limited `storage` permission
- Page access used only for local detection
- Short-lived, single-use bypass tokens
- Context-aware false-positive safeguards
- Automated syntax, manifest, packaging, and regression checks

Grandma Guard is a browser safety aid, not an antivirus. Keep the operating
system, browser, and trusted security software updated.

## Repository layout

```text
GrandmaGuard/
|-- extension/  One shared source tree and two browser manifests
|-- assets/     Project branding and browser-store artwork
|-- docs/       Submission notes, listing copy, and privacy policies
|-- tests/      Detection-engine regression tests
|-- tools/      Release and source-archive scripts
|-- .github/    Validation and browser-store release automation
|-- dist/       Generated packages, ignored by Git
|-- BUILDING.md Reproducible build instructions
`-- LICENSE     MIT License
```

## Build and test

Grandma Guard does not require npm packages, a bundler, minification, or network
access during the build.

Reference environment:

- Windows 11 Pro, build 26200
- Windows PowerShell 5.1
- Node.js 24.18.0

From the repository root:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\tools\Build-Release.ps1 -Browser All
```

Use `-Browser Chrome`, `-Browser Firefox`, or `-Browser Opera` to build only
one package. Omitting `-Browser` builds all three.

The release builder:

1. Creates temporary Chrome, Firefox, and Opera staging folders.
2. Applies the appropriate Chromium or Firefox manifest.
3. Checks every JavaScript file for syntax errors.
4. Runs 25 detection regression cases.
5. Validates manifest assets and archive paths.
6. Rejects stale assets, development files, and em dashes.
7. Writes the verified browser ZIPs to `dist`.
8. Removes the temporary staging folders automatically.

See [BUILDING.md](BUILDING.md) for complete build and source-archive
instructions.

## Automated releases

Normal pushes and pull requests build and validate all three browser packages.
Publishing a GitHub Release with a matching version tag, such as `v1.0.1`,
then:

1. Rebuilds Chrome, Firefox, Opera, and source archives from the tagged code.
2. Attaches all four verified ZIP files to the GitHub Release.
3. Submits the Chrome package when Chrome publishing is enabled.
4. Submits the Firefox package to AMO when Firefox publishing is enabled.
5. Leaves the Opera package on the release for its required manual store upload.

Store credentials are kept in GitHub's encrypted `browser-stores` environment
and are never committed to the repository. See
[Automated browser-store deployment](docs/DEPLOYMENT.md) for the one-time
setup and release checklist.

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
4. Confirm that Chrome, Firefox, and Opera still contain the same shared code.
5. Document any new permission or data-handling behavior.

Security reports should avoid publishing live malicious URLs, personal
information, or exploit details in a public issue.

## License

Grandma Guard is released under the [MIT License](LICENSE).

Copyright (c) 2026 NokaAngel.
