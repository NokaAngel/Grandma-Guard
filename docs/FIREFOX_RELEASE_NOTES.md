# Firefox 2.2.0 release notes

## Version notes

Version 2.2.0 reduces false positives from legitimate telephone, text-message, and site JavaScript controls. It also adds signed, reviewed exact-host and domain-plus-path threat rules for faster protection against known malicious campaigns. There is still no telemetry, analytics, or remote executable code.

## Reason for the update

Version 2.2.0 fixes site compatibility problems reported after broader special-link interception. Normal pages may use their own `javascript:`, `tel:`, and `sms:` controls without Grandma Guard blocking them. Phone-link warnings now run only in supported webmail or another high-risk context and require several independent scam indicators.

The release also adds a narrow reviewed rule for an active rotating malware campaign. Optional threat-list refreshes download signed public JSON from the Grandma Guard GitHub repository. No browsing history, page contents, or personal data are sent, and no downloaded JavaScript is executed.

The stable Firefox add-on ID is unchanged.
