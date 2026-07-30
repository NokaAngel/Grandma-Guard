# Store submission guide

## Chrome Web Store

1. Register or open your Chrome Web Store developer account.
2. Create a new item and upload `dist/Grandma-Guard-Chrome-1.0.1.zip`.
3. Paste the listing text from `STORE_LISTING.md`.
4. Upload `assets/store/store-screenshot-1280x800.png` and `assets/store/chrome-promo-440x280.png`.
5. Complete the Privacy practices tab using the purpose, permission justifications, remote-code answer, and data-handling notes in `STORE_LISTING.md`.
6. Host `docs/privacy/CHROME_PRIVACY_POLICY.md` at a public HTTPS URL and enter that URL in the dashboard.
7. Choose visibility and submit for review.

## Firefox Add-ons

1. Sign in to addons.mozilla.org and submit a new add-on.
2. Upload `dist/Grandma-Guard-Firefox-1.0.1.zip`.
3. The Firefox manifest already contains a stable Manifest V3 add-on ID and declares that the extension transmits no data.
4. Paste the listing copy, reviewer notes, version notes, and the text from `docs/privacy/PRIVACY_POLICY.md`.
5. Upload the store screenshot and icon artwork when requested.
6. This package contains readable, unminified source with no code transformation or third-party libraries. The release script only copies files, selects the Firefox manifest, validates the result, and creates the ZIP, so a separate generated-source archive should not be necessary. Answer the source-code question accurately based on the uploaded package.
7. Submit for review and signing. Firefox requires a signed add-on for ordinary distribution.

## Opera Add-ons

1. Sign in to the Opera Add-ons developer site and create a new extension.
2. Upload `dist/Grandma-Guard-Opera-1.0.1.zip`.
3. Paste the listing copy, choose a publisher license, and add the public `docs/privacy/OPERA_PRIVACY_POLICY.md` and support URLs.
4. Upload the icon and `assets/store/opera-screenshot-800x600.png`.
5. Submit for moderator review.

## Updating later

Increase the version in every manifest and keep the same Firefox add-on ID. Build and test each exact ZIP before uploading it as an update. Never add remote JavaScript, analytics, or broader permissions without updating the listing and privacy disclosures first.
