# Automated browser-store deployment

Grandma Guard uses GitHub Releases as the only publishing trigger. Ordinary
pushes and pull requests validate the project but never contact a browser
store.

When a release such as `v2.0.0` is published, GitHub:

1. Confirms that the release tag matches both manifest versions.
2. Builds and validates Chrome and Firefox packages.
3. Builds the complete readable source archive.
4. Attaches the verified ZIP files to the GitHub Release.
5. Submits Chrome and Firefox when their publishing switches are enabled.

Opera is not supported as a separate listing. Opera users should install the
Chrome Web Store version through Opera's Chromium extension support.

## GitHub environment

Create an environment named `browser-stores` under:

`Settings > Environments > New environment`

The workflow uses this environment only for browser-store publishing. You may
add a required reviewer if you want one final approval after publishing a
GitHub Release.

## Chrome setup

Chrome publishing uses the official Chrome Web Store API v2 and a dedicated
Google Cloud service account.

Add these environment secrets:

- `CHROME_SERVICE_ACCOUNT_JSON`: the complete JSON key for the service account

Add these repository variables under `Settings > Secrets and variables >
Actions > Variables`:

- `CHROME_PUBLISHER_ID`: the publisher ID shown in the Chrome Web Store
  Developer Dashboard
- `CHROME_EXTENSION_ID`: the existing Grandma Guard Chrome item ID
- `CHROME_AUTO_PUBLISH`: set to `true` after the other values are ready

One-time Google and Chrome preparation:

1. Enable the Chrome Web Store API in a Google Cloud project.
2. Create a service account and JSON key.
3. Add that service account email under the Chrome Web Store publisher account.
4. Complete the store listing, privacy information, and visibility settings.
5. If visibility was just changed, publish that visibility once manually.

Keep the JSON key only in the encrypted GitHub environment secret. Do not add
it to this repository or a release.

## Firefox setup

Firefox publishing uses Mozilla's official `web-ext sign` command with the
existing stable extension ID.

Create API credentials in the Firefox Add-on Developer Hub, then add these
environment secrets:

- `AMO_API_KEY`: the JWT issuer
- `AMO_API_SECRET`: the JWT secret

Add this repository variable under `Settings > Secrets and variables >
Actions > Variables`:

- `FIREFOX_AUTO_PUBLISH`: set to `true` after both secrets are ready

The workflow submits the package as a listed update and includes the release
notes and reviewer notes from `docs/amo-metadata.json`.

## Publishing a release

Before publishing:

1. Update the version in both files under `extension`:
   - `manifest.chromium.json`
   - `manifest.firefox.json`
2. Update release notes and documentation.
3. Run `tools/Build-Release.ps1 -Browser All`.
4. Run `tools/Build-Source-Archive.ps1`.
5. Merge the validated changes into `main`.
6. Create a GitHub Release whose tag exactly matches the manifest version with
   a leading `v`, such as `v1.3.0`.

Publishing the release starts the store workflow. Draft releases do not deploy.

## Security rules

- Browser-store secrets exist only in the `browser-stores` environment.
- Pull requests do not receive store credentials.
- Store publishing is disabled until its matching variable is set to `true`.
- Release tags must match the extension manifests.
- Generated packages are built by GitHub from the tagged source.
- No browser-store credential belongs in source code, documentation, logs, or
  GitHub Release files.
