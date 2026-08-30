# Store submission guide

## Chrome Web Store

1. Register or open your Chrome Web Store developer account.
2. Create a new item and upload `dist/Grandma-Guard-Chrome-2.0.0.zip`.
3. Paste the listing text from `STORE_LISTING.md`.
4. Upload the screenshots and promo tile from `assets/store/`:
   - `store-screenshot-blocked-1280x800.png`
   - `store-screenshot-gmail-scam-1280x800.png`
   - `store-screenshot-settings-1280x800.png`
   - `chrome-promo-440x280.png`
5. Complete the Privacy practices tab using the purpose, permission justifications, remote-code answer, and data-handling notes in `STORE_LISTING.md`.
6. Host `docs/privacy/CHROME_PRIVACY_POLICY.md` at a public HTTPS URL and enter that URL in the dashboard.
7. Choose visibility and submit for review.

## Firefox Add-ons

1. Sign in to addons.mozilla.org and submit a new add-on.
2. Upload `dist/Grandma-Guard-Firefox-2.0.0.zip`.
3. The Firefox manifest already contains a stable Manifest V3 add-on ID and declares that the extension transmits no data.
4. Paste the listing copy, reviewer notes, version notes, and the text from `docs/privacy/PRIVACY_POLICY.md`.
5. Upload the store screenshots and icon artwork when requested:
   - `store-screenshot-blocked-1280x800.png`
   - `store-screenshot-gmail-scam-1280x800.png`
   - `store-screenshot-settings-1280x800.png`
6. This package contains readable, unminified source with no code transformation or third-party libraries. The release script only copies files, selects the Firefox manifest, validates the result, and creates the ZIP, so a separate generated-source archive should not be necessary. Answer the source-code question accurately based on the uploaded package.
7. Submit for review and signing. Firefox requires a signed add-on for ordinary distribution.

## Opera

There is no separate Opera listing. Opera users should install Grandma Guard from the Chrome Web Store.

## Updating later

Increase the version in both manifests and keep the same Firefox add-on ID. Build and test each exact ZIP before uploading it as an update. Never add remote JavaScript, analytics, or broader permissions without updating the listing and privacy disclosures first.
