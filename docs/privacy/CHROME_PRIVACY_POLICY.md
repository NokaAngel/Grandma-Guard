# Grandma Guard Privacy Policy for Google Chrome

Effective date: August 29, 2026  
Policy revision: 2.0.0

Grandma Guard is designed to detect and stop deceptive fake-virus alerts, tech-support scams, notification traps, phishing pages, account-lock warnings, and forced browser updates. It can also warn about suspicious messages and links inside supported webmail without replacing the inbox.

## Information handled by the extension

Grandma Guard reads visible website text, interactive labels, page structure, the current hostname and address, and a limited set of page-behavior signals. On supported webmail sites it also reads visible link addresses and nearby message text in the open message. This processing happens locally inside Google Chrome and is used only to determine whether a page or email link shows multiple signs of a deceptive alert.

When a page is blocked, or an email link triggers a warning, Grandma Guard stores the following information locally inside Chrome:

- the hostname;
- for email warnings, the suspicious link hostname;
- the detection time;
- the detection score and matched reasons; and
- whether the one-time Continue option was selected or an email warning was shown.

Family protection settings are also stored locally, including the chosen protection level (Standard or Extra careful), trusted website hostnames, family blocklist hostnames, remembered suspicious link domains, shopping mode, after-scam protection timers, strict mode and caregiver PIN hash, and optional auto after-scam on Continue.

On-device email learning is off until you allow it in a one-time inbox prompt or in Grandma Guard settings. If you allow it, Grandma Guard may store short local scam-pattern fingerprints from flagged mail (sender label, sender-and-From-domain pair, custom From domain that is not a broad free webmail domain, and subject fingerprint), plus “Not a scam” corrections you choose while reading an email, with a short undo window for mistakes. If you decline, it will not learn from your mail unless you later turn learning on in settings. These patterns stay on the device only and can be cleared from the options page. After updates, Grandma Guard may show a one-time on-device version notice. More detail is also published at https://grandmaguard.nokaangel.dev/privacy/.

The local history is limited to 100 detection events. A pending Continue request temporarily stores the exact blocked address and a random decision token. Pending decisions expire after five minutes. A granted one-time exception expires after two minutes and is consumed when used.

## Collection, transmission, and sharing

Grandma Guard does not transmit website content, browsing activity, email content, blocked hostnames, exact addresses, detection history, settings, or analytics to the developer or any third party.

Grandma Guard has no developer-operated server, account system, advertising, analytics, telemetry, remote configuration, or remote executable code.

No user information is sold, shared, rented, or used for advertising, credit decisions, or purposes unrelated to the extension's visible protection features. The developer cannot access information stored locally inside the user's browser.

The use of information received from Chrome APIs complies with the Chrome Web Store User Data Policy, including the Limited Use requirements.

## Permissions

The `storage` permission is used for the limited local detection history, optional on-device email learning patterns, Family protection settings (protection level, trusted websites, family blocklist, remembered suspicious link domains, shopping mode, after-scam timers, strict mode, and caregiver PIN hash), settings export/import data, and short-lived records required by the one-time Continue feature.

The `webNavigation` permission is used to stop navigation to family blocklist hostnames and remembered suspicious link domains before the page loads. No navigation data is transmitted off the device.

Access to HTTP and HTTPS pages is required because Grandma Guard must inspect visible page and link signals locally before a visitor interacts with a suspected scam page or email link.

## User control and retention

Users can select the Grandma Guard toolbar icon to open the popup dashboard or Options page, view weekly protection counts and local detection history, change Family protection settings, trusted websites, family blocklist, and remembered suspicious link domains, export or import settings as a local JSON file, and select **Clear history**.

Removing the extension also removes its browser-local storage according to Chrome's normal extension removal behavior. Expired decisions and one-time exceptions are removed automatically as the extension operates.

## Security

All Grandma Guard detection logic is included with the extension and runs locally. Because Grandma Guard does not transmit user information, it does not send such information over a network connection.

## Changes

If this privacy policy changes, the effective date will be updated. Any material change to data handling will also be disclosed through the Chrome Web Store and extension interface as required.

## Contact

For privacy questions, use the Grandma Guard support form at https://nokaangel.dev/support?project=grandmaguard.
