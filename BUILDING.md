# Building Grandma Guard

Grandma Guard keeps one readable extension source tree. It does not use
transpilation, bundling, minification, a package manager, third-party
libraries, or downloaded code.

The release script copies the shared files into temporary browser staging
folders, selects the correct manifest, validates the result, creates the
browser ZIPs, and removes the staging folders.

## Reference build environment

- Operating system: Windows 11 Pro, build 26200
- PowerShell: Windows PowerShell 5.1
- Node.js: 24.18.0
- npm: 11.16.0, installed with Node.js but not used

Node.js is used only for JavaScript syntax checks and the local regression
tests. No network access is required to build the extension.

## Build the browser packages

1. Install Node.js 24 or a compatible current release.
2. Download or clone this repository.
3. Open Windows PowerShell in the repository root.
4. Run:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\tools\Build-Release.ps1 -Browser All
```

Build only one browser by changing the target:

```powershell
.\tools\Build-Release.ps1 -Browser Chrome
.\tools\Build-Release.ps1 -Browser Firefox
.\tools\Build-Release.ps1 -Browser Opera
```

`All` is the default, so this also builds every browser:

```powershell
.\tools\Build-Release.ps1
```

Depending on the selected target, the script creates:

- `dist/Grandma-Guard-Chrome-1.0.1.zip`
- `dist/Grandma-Guard-Firefox-1.0.1.zip`
- `dist/Grandma-Guard-Opera-1.0.1.zip`

## Build the public source archive

Run:

```powershell
.\tools\Build-Source-Archive.ps1
```

This creates `dist/Grandma-Guard-GitHub-Source-1.0.1.zip`. The archive
contains the readable extension source, both browser manifests, tests, build
tools, policies, documentation, branding, and store artwork. Generated browser
packages, old releases, Git metadata, dependency folders, and logs are
excluded.

## Validation performed by the release script

Every selected browser build:

1. Reads the shared extension files from `extension`.
2. Uses `manifest.chromium.json` for Chrome and Opera.
3. Uses `manifest.firefox.json` for Firefox.
4. Preserves and verifies Firefox's stable add-on ID.
5. Checks every JavaScript file for syntax errors.
6. Runs the 25-case detection regression suite.
7. Confirms that every manifest references existing icon files.
8. Rejects em dashes and stale icon files.
9. Creates archives with forward-slash paths.
10. Rejects development and test content inside store packages.
11. Verifies that every archive matches its temporary build stage.
12. Removes the temporary build stage.

## Project layout

- `extension`: canonical source and browser manifests
- `assets/branding`: project logo files
- `assets/store`: browser-store artwork
- `docs/privacy`: shared and browser-specific privacy policies
- `docs`: listing copy, submission guide, and Firefox release notes
- `tests`: detection-engine regression tests
- `tools`: release and source-archive scripts
- `.github`: validation and browser-store release automation
- `dist`: generated packages, ignored by Git

## GitHub validation

The same complete build runs on GitHub for every push and pull request. A
published GitHub Release rebuilds the packages from the tagged source and adds
them to the release. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the
browser-store publishing setup.
