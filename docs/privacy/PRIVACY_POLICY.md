# Grandma Guard Privacy Policy

Effective date: August 29, 2026  
Policy revision: 2.0.0

Grandma Guard is designed to detect and stop deceptive fake-virus, tech-support, notification-bait, phishing, account-lock, and forced-update web pages. It can also warn about suspicious messages and links inside supported webmail without replacing the inbox.

## Information handled by the extension

Grandma Guard reads visible website text, interactive labels, page structure, the current hostname and address, and a small set of page-behavior signals. On supported webmail sites it also reads visible link addresses and nearby message text in the open message. This processing is necessary to decide whether a page or email link shows multiple signs of a deceptive alert.

For pages that are blocked, or email links that trigger a warning, the extension stores locally in the browser:

- the hostname;
- for email warnings, the suspicious link hostname;
- the detection time;
- the detection score and matched reasons; and
- whether the user selected the one-time Continue option or received an email warning.

Family protection settings are also stored locally, including the chosen protection level (Standard or Extra careful), trusted website hostnames, family blocklist hostnames, remembered suspicious link domains, shopping mode, after-scam protection timers, strict mode and caregiver PIN hash, and optional auto after-scam on Continue.

On-device email learning is off until you allow it in a one-time inbox prompt or in Grandma Guard settings. If you allow it, the extension may store short local scam-pattern fingerprints from flagged mail, including:

- a normalized sender label;
- a sender-and-From-domain pair;
- a custom From domain (not broad free webmail domains like Gmail/Yahoo/Outlook alone); and
- a subject fingerprint;

plus “Not a scam” corrections you choose while reading an email. A short undo window is offered after a “Not a scam” click so accidental marks can be reversed. If you decline learning, Grandma Guard will not learn from your mail unless you later turn learning on in settings. These patterns stay on the device only, are capped in number, and can be cleared from the options page. Full email bodies are not stored for learning. The published policy is also at https://grandmaguard.nokaangel.dev/privacy/.

The local history is limited to 100 detection events. A one-time Continue request temporarily stores the exact blocked address and a random decision token. Pending decisions expire after five minutes, and a granted one-time bypass expires after two minutes and is consumed when used.

## Collection, transmission, and sharing

Grandma Guard does not transmit website content, browsing activity, email content, blocked hostnames, exact addresses, detection history, settings, or analytics to the developer or to any third party. It has no developer-operated server, account system, advertising, telemetry, remote configuration, or remote executable code.

No user data is sold, shared, rented, or used for advertising, credit decisions, or purposes unrelated to the extension's visible protection features. Humans cannot access the locally stored information through the extension developer.

The use of information received from browser APIs adheres to the Chrome Web Store User Data Policy, including the Limited Use requirements.

## Permissions

The `storage` permission is used for the limited local detection history, optional on-device email learning patterns, Family protection settings (protection level, trusted websites, family blocklist, remembered suspicious link domains, shopping mode, after-scam timers, strict mode, and caregiver PIN hash), settings export/import data, and short-lived records required by the one-time Continue feature.

The `webNavigation` permission is used to stop navigation to family blocklist hostnames and remembered suspicious link domains before the page loads. No navigation data is transmitted off the device.

Access to HTTP and HTTPS pages is required because Grandma Guard must inspect visible page and link signals locally before a visitor interacts with a suspected scam page or email link.

## User control and retention

Users can open Grandma Guard from the browser toolbar popup or Options page to view weekly protection counts and local detection history, change on-device learning, manage Family protection settings, trusted websites, family blocklist, and remembered suspicious link domains, export or import settings as a local JSON file, clear learned patterns, and select **Clear history**. After extension updates, Grandma Guard may show a one-time on-device notice about the new version and privacy changes. Removing the extension also removes its browser-local storage according to the browser's normal extension-uninstall behavior. Expired one-time decision and bypass records are removed automatically as the extension operates.

## Security

All extension logic is bundled with the extension and runs locally. Because Grandma Guard does not transmit user data, it does not send such data over a network connection.

## Changes

If this policy changes, the effective date above will be updated. Any material change to data handling will also be disclosed through the applicable extension store and extension interface as required.

## Contact

For privacy questions, use the Grandma Guard support form at https://nokaangel.dev/support?project=grandmaguard.
