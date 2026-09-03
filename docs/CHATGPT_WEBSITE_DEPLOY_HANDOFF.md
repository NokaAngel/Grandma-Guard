# Grandma Guard — ChatGPT website deploy handoff (2.1.2)

**You have FTP and SSH access** to deploy the Grandma Guard website. Execute these steps so extension **2.1.2** false-positive reporting works end-to-end.

**Extension repo (already pushed):** https://github.com/NokaAngel/Grandma-Guard  
**Live site:** https://grandmaguard.nokaangel.dev/  
**Privacy URL (stores link here):** https://grandmaguard.nokaangel.dev/privacy/  
**New report URL (extension opens this):** https://grandmaguard.nokaangel.dev/report  
**Support form (report page submits here):** https://nokaangel.dev/support?project=grandmaguard

---

## Critical rules

1. **Do NOT commit `GrandmaGuard Website/` to GitHub** — it is deployed separately via FTP/SSH.
2. **Do NOT force-push GitHub `main`.**
3. **Do NOT commit private signing keys** (`.rule-pack-private.pem`).

---

## What the extension expects (2.1.2)

When a user clicks **Report false positive** (blocked page, link warning, or email toast), the extension opens:

```
https://grandmaguard.nokaangel.dev/report?type=website&domain=example.com&version=2.1.2&reasons=reason1;reason2
```

Email reports also include `from_domain` and `mail_host` query params.

The `/report` page must exist and must work without JavaScript build tools (static HTML is fine).

---

## Phase 1 — Deploy `/report` page

### Source file (from GitHub repo)

Download or copy from the extension repository:

```
docs/website-false-positive-report.html
```

Raw GitHub URL (after `main` is updated):

```
https://raw.githubusercontent.com/NokaAngel/Grandma-Guard/main/docs/website-false-positive-report.html
```

### Deploy target on server

Upload so this URL works:

| URL | Server path (typical) |
|-----|------------------------|
| https://grandmaguard.nokaangel.dev/report | `report/index.html` |
| https://grandmaguard.nokaangel.dev/report/ | same file |

If the site uses Apache/Nginx directory indexes, `report/index.html` is correct.  
If the site uses flat files, `report.html` at web root may work only if you also add a redirect from `/report` → `/report.html`.

### FTP/SSH steps

1. SSH or FTP into the Grandma Guard site host.
2. Locate the web root for `grandmaguard.nokaangel.dev` (often `public_html`, `www`, or a vhost folder).
3. Create directory `report/` if it does not exist.
4. Upload `website-false-positive-report.html` as `report/index.html`.
5. Set permissions: `644` for the file, `755` for the directory.

### Verify report page

Open in a browser:

```
https://grandmaguard.nokaangel.dev/report?type=website&domain=help.walmart.com&version=2.1.2&reasons=Low%20article%20depth
```

Checklist:

- [ ] Page loads (not 404)
- [ ] Domain field shows `help.walmart.com`
- [ ] Version shows `2.1.2`
- [ ] Reasons field is pre-filled
- [ ] **Send report** opens `nokaangel.dev/support?project=grandmaguard` in a new tab
- [ ] **GitHub (advanced)** opens GitHub issue draft (optional)

---

## Phase 2 — Update live privacy policy

Stores and the extension link to:

https://grandmaguard.nokaangel.dev/privacy/

### Source files (from GitHub repo)

- `docs/privacy/PRIVACY_POLICY.md` — general / website policy
- `docs/privacy/CHROME_PRIVACY_POLICY.md` — Chrome-specific variant if the site uses it

**Policy revision must be:** `2.1.2`  
**Effective date:** September 2, 2026

### Required new section (must appear on live site)

Ensure the live privacy page includes **Optional false-positive reports** explaining:

- **Report false positive** opens `https://grandmaguard.nokaangel.dev/report`
- Pre-filled fields: type, domain, version, reasons (no email body or page content sent automatically)
- Submit opens private support at `https://nokaangel.dev/support?project=grandmaguard`
- **GitHub (advanced)** is optional

Also ensure these are documented:

- Optional signed GitHub rule-pack fetch (`alarms` permission, Ed25519 verify)
- No telemetry, no remote code

### Deploy

Update whatever powers `/privacy/` on the site (PHP template, static HTML, or CMS page) from the repo markdown above. Match existing site styling.

Verify:

- [ ] https://grandmaguard.nokaangel.dev/privacy/ shows revision **2.1.2**
- [ ] False-positive report section is visible
- [ ] Rule-pack / GitHub fetch section is present

---

## Phase 3 — Update download / release notes on site

Set the public version to **2.1.2** everywhere users see it:

- Download page
- Release notes / changelog page
- Home page version badge (if any)
- `product.json` or equivalent config if the site uses store-gated versioning

### Combined release notes text (use on site)

**Grandma Guard 2.1.2** (September 2, 2026)

- Signed GitHub domain rule packs for faster official-domain updates (Ed25519 verified)
- Optional background refresh of public domain list every ~48 hours (toggle in Options)
- **Report false positive** on blocked pages, link warnings, and email — no GitHub account needed
- Website report form at grandmaguard.nokaangel.dev/report
- GitHub reporting remains optional for advanced users
- False-positive fixes: harmless javascript: links, major retailers, idscan.net-style sites, tuned link/trap thresholds
- Privacy policy updated (revision 2.1.2)
- Still fully local: no telemetry, no remote code, no analytics

Download zips from GitHub release **v2.1.2**:

- Grandma-Guard-Chrome-2.1.2.zip
- Grandma-Guard-Firefox-2.1.2.zip

---

## Phase 4 — Support form compatibility (optional improvement)

The report page opens support with query params:

```
https://nokaangel.dev/support?project=grandmaguard&topic=false-positive&subject=...&message=...
```

If the nokaangel.dev support form **does not** pre-fill from URL params, either:

1. Update the support form to read `subject` and `message` from the query string when `project=grandmaguard`, **or**
2. Leave as-is — users still see all details on the report page and can copy into the support form manually.

Prefer option 1 for best Grandma Guard UX.

---

## Phase 5 — Optional site links

Add a footer or help link:

- **Report a false positive** → https://grandmaguard.nokaangel.dev/report

---

## End-to-end test (after deploy)

1. Load extension 2.1.2 (or simulate by opening report URL with params).
2. Confirm `/report` pre-fills correctly.
3. Submit report → support form opens.
4. Confirm privacy page shows 2.1.2.
5. Confirm download page shows 2.1.2 and links to GitHub release assets.

---

## GitHub reference (extension — do not redeploy via FTP)

| Item | Location |
|------|----------|
| Report page template | `docs/website-false-positive-report.html` |
| Privacy policy source | `docs/privacy/PRIVACY_POLICY.md` |
| Changelog | `CHANGELOG.md` (single **2.1.2** entry for 2.1.x line) |
| Release tag | `v2.1.2` |
| Rule pack URL | `https://raw.githubusercontent.com/NokaAngel/Grandma-Guard/main/data/rule-packs.json` |

---

## Contact

Support form: https://nokaangel.dev/support?project=grandmaguard
