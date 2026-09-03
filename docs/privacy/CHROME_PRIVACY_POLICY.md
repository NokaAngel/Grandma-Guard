# Grandma Guard Privacy Policy for Google Chrome

Effective date: September 2, 2026  
Policy revision: 2.1.2

Grandma Guard is designed to detect and stop deceptive fake-virus alerts, tech-support scams, notification traps, phishing pages, account-lock warnings, and forced browser updates. It can also warn about suspicious messages and links inside supported webmail without replacing the inbox.

## Information handled by the extension

Grandma Guard reads visible website text, interactive labels, page structure, the current hostname and address, and a limited set of page-behavior signals. On supported webmail sites it also reads visible link addresses and nearby message text in the open message. This processing happens locally inside Google Chrome and is used only to determine whether a page or email link shows multiple signs of a deceptive alert.

When a page is blocked, or an email link triggers a warning, Grandma Guard stores the following information locally inside Chrome:

- the hostname;
- for email warnings, the suspicious link hostname;
- the detection time;
- the detection score and matched reasons; and
- whether the one-time Continue option was selected or an email warning was shown.

Family protection settings are also stored locally, including the chosen protection level (Standard or Extra careful), trusted website hostnames, family blocklist hostnames, remembered suspicious link domains, shopping mode, after-scam protection timers, strict mode and caregiver PIN hash, optional auto after-scam on Continue, optional GitHub domain list preference, and a cached copy of the last verified public domain rule pack (hostname suffixes only).

On-device email learning is off until you allow it in a one-time inbox prompt or in Grandma Guard settings. If you allow it, Grandma Guard may store short local scam-pattern fingerprints from flagged mail (sender label, sender-and-From-domain pair, custom From domain that is not a broad free webmail domain, and subject fingerprint), plus “Not a scam” corrections you choose while reading an email, with a short undo window for mistakes. If you decline, it will not learn from your mail unless you later turn learning on in settings. These patterns stay on the device only and can be cleared from the options page. After updates, Grandma Guard may show a one-time on-device version notice. More detail is also published at https://grandmaguard.nokaangel.dev/privacy/.

The local history is limited to 100 detection events. A pending Continue request temporarily stores the exact blocked address and a random decision token. Pending decisions expire after five minutes. A granted one-time exception expires after two minutes and is consumed when used.

## Optional domain rule pack updates

Grandma Guard ships a bundled list of known legitimate business and retailer domains with the extension. When enabled in settings (on by default), it may also download an updated public domain list from GitHub:

https://raw.githubusercontent.com/NokaAngel/Grandma-Guard/main/data/rule-packs.json

That download:

- happens in the background about every 48 hours, or when the user selects **Refresh domain lists now** in Options;
- retrieves a public JSON file containing hostname suffixes and an Ed25519 signature;
- is verified with a public key embedded in the extension before any downloaded domains are applied;
- does not include the user's browsing history, page text, email content, passwords, or detection history;
- can be turned off at any time with **Use GitHub domain list updates** in Options.

When turned off, Grandma Guard continues using the bundled domain list included in the installed extension version.

## Optional false-positive reports

After a blocked page, suspicious link warning, or **Not a scam** action in webmail, Grandma Guard may offer **Report false positive**. If you choose it, your browser opens a simple report form at https://grandmaguard.nokaangel.dev/report that can pre-fill the report type, hostname or sender domain, mail provider host for email reports, extension version, and the short detection reasons Grandma Guard already showed you. Submitting opens the private support form at https://nokaangel.dev/support?project=grandmaguard. **GitHub (advanced)** is optional for public GitHub issues.

Grandma Guard does not automatically send email bodies, page text, passwords, browsing history, or detection history. You can edit or cancel before submitting.

## Collection, transmission, and sharing

Grandma Guard does not transmit website content, browsing activity, email content, blocked hostnames, exact addresses, detection history, settings, or analytics to the developer or any third party.

Grandma Guard has no developer-operated server, account system, advertising, analytics, telemetry, or remote executable code.

The only optional network requests related to protection are the public signed GitHub domain rule pack described above and, if you choose **Report false positive**, opening the Grandma Guard report or support pages in your browser. Neither sends user content automatically unless you submit a report form.

No user information is sold, shared, rented, or used for advertising, credit decisions, or purposes unrelated to the extension's visible protection features. The developer cannot access information stored locally inside the user's browser.

The use of information received from Chrome APIs complies with the Chrome Web Store User Data Policy, including the Limited Use requirements.

## Permissions

The `storage` permission is used for the limited local detection history, optional on-device email learning patterns, Family protection settings (protection level, trusted websites, family blocklist, remembered suspicious link domains, shopping mode, after-scam timers, strict mode, caregiver PIN hash, optional GitHub domain list preference, and cached verified rule packs), settings export/import data, and short-lived records required by the one-time Continue feature.

The `webNavigation` permission is used to stop navigation to family blocklist hostnames and remembered suspicious link domains before the page loads. No navigation data is transmitted off the device.

The `alarms` permission is used to schedule optional background checks for updated public domain rule packs about once per day. No alarm sends user data off the device.

Access to HTTP and HTTPS pages is required because Grandma Guard must inspect visible page and link signals locally before a visitor interacts with a suspected scam page or email link.

## User control and retention

Users can select the Grandma Guard toolbar icon to open the popup dashboard or Options page, view weekly protection counts and local detection history, change Family protection settings, trusted websites, family blocklist, and remembered suspicious link domains, turn GitHub domain list updates on or off, refresh the public list manually, view bundled and cached list status under **Official domain lists**, export or import settings as a local JSON file, and select **Clear history**.

Removing the extension also removes its browser-local storage according to Chrome's normal extension removal behavior. Expired decisions and one-time exceptions are removed automatically as the extension operates.

## Security

All Grandma Guard scam-detection logic is included with the extension and runs locally. Grandma Guard does not transmit website content, email content, browsing history, or analytics to the developer.

The only optional network requests related to protection are the public signed GitHub domain rule pack described above and, if you choose **Report false positive**, opening the Grandma Guard report or support pages in your browser. Before applying a downloaded pack, Grandma Guard verifies an Ed25519 signature using a public key embedded in the extension. Tampered or unsigned remote packs are rejected.

## Changes

If this privacy policy changes, the effective date will be updated. Any material change to data handling will also be disclosed through the Chrome Web Store and extension interface as required.

## Contact

For privacy questions, use the Grandma Guard support form at https://nokaangel.dev/support?project=grandmaguard.
