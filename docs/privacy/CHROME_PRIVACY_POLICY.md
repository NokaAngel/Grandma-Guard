# Grandma Guard Privacy Policy for Google Chrome

Effective date: July 22, 2026

Grandma Guard is designed to detect and stop deceptive fake-virus alerts, tech-support scams, notification traps, phishing pages, account-lock warnings, and forced browser updates.

## Information handled by the extension

Grandma Guard reads visible website text, interactive labels, page structure, the current hostname and address, and a limited set of page-behavior signals. This processing happens locally inside Google Chrome and is used only to determine whether a page shows multiple signs of a deceptive alert.

When a page is blocked, Grandma Guard stores the following information locally inside Chrome:

- the hostname;
- the detection time;
- the detection score and matched reasons; and
- whether the one-time Continue option was selected.

The local history is limited to 100 blocked-page events. A pending Continue request temporarily stores the exact blocked address and a random decision token. Pending decisions expire after five minutes. A granted one-time exception expires after two minutes and is consumed when used.

## Collection, transmission, and sharing

Grandma Guard does not transmit website content, browsing activity, blocked hostnames, exact addresses, detection history, settings, or analytics to the developer or any third party.

Grandma Guard has no developer-operated server, account system, advertising, analytics, telemetry, remote configuration, or remote executable code.

No user information is sold, shared, rented, or used for advertising, credit decisions, or purposes unrelated to the extension's visible protection features. The developer cannot access information stored locally inside the user's browser.

The use of information received from Chrome APIs complies with the Chrome Web Store User Data Policy, including the Limited Use requirements.

## Permissions

The `storage` permission is used for the limited local detection history and short-lived records required by the one-time Continue feature.

Access to HTTP and HTTPS pages is required because Grandma Guard must inspect visible page signals locally before a visitor interacts with a suspected scam page.

## User control and retention

Users can select the Grandma Guard toolbar icon to view the local detection history. Selecting **Clear history** removes the saved detection history and pending one-time exceptions.

Removing the extension also removes its browser-local storage according to Chrome's normal extension removal behavior. Expired decisions and one-time exceptions are removed automatically as the extension operates.

## Security

All Grandma Guard detection logic is included with the extension and runs locally. Because Grandma Guard does not transmit user information, it does not send such information over a network connection.

## Changes

If this privacy policy changes, the effective date will be updated. Any material change to data handling will also be disclosed through the Chrome Web Store and extension interface as required.

## Contact

For privacy questions, use the publisher support contact shown on the Grandma Guard listing in the Chrome Web Store.
