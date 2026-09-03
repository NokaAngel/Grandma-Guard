# Grandma Guard — ChatGPT handoff (2.1.0 + privacy + Ed25519 signing)

Use this document as the full task list. You have access to the **NokaAngel/Grandma-Guard** GitHub repository and should execute these steps in order unless blocked.

**Repository:** https://github.com/NokaAngel/Grandma-Guard  
**Local path (if applicable):** `C:\Users\NokaAngel\Desktop\GrandmaGuard - Universal Extension`  
**Target release:** **2.1.0**  
**Live privacy URL (stores link here):** https://grandmaguard.nokaangel.dev/privacy/

---

## Critical rules

1. **Do NOT commit `GrandmaGuard Website/`** — it is gitignored and deployed separately to the user's server.
2. **Do NOT force-push `main`.**
3. **Do NOT change git config.**
4. **Do NOT commit private signing keys** (`.pem`, `.key`, or env files with Ed25519 private material).
5. Firefox is already published at **2.0.0** on AMO — do not downgrade version numbers.

---

## What is already done locally (may be uncommitted)

Version **2.1.0** work includes:

- GitHub domain rule packs (`data/rule-packs.json`)
- Bundled copy + generated `extension/rule-packs-data.js`
- `extension/rule-packs.js`, `extension/rule-pack-sync.js`
- Options UI: **Use GitHub domain list updates**, **Refresh domain lists now**, status line
- `alarms` permission for ~48h refresh
- False-positive fixes (2.0.2): harmless `javascript:void(0)`, retailer official domains, trap-guard/link thresholds
- Webmail alignment fixes (2.0.1): pills, open-email action bar
- Partial privacy policy updates in `docs/privacy/` (need completion — see below)
- Builds: `dist/Grandma-Guard-Chrome-2.1.0.zip`, `dist/Grandma-Guard-Firefox-2.1.0.zip`

**Rule pack fetch URL (must exist on `main` after push):**

```
https://raw.githubusercontent.com/NokaAngel/Grandma-Guard/main/data/rule-packs.json
```

---

## Phase 1 — Finish privacy policies (do this first)

Privacy must be updated **in the repo** and on the **live website** before store submission.

### Files to edit in the repo

- `docs/privacy/PRIVACY_POLICY.md`
- `docs/privacy/CHROME_PRIVACY_POLICY.md`

### Header updates (both files)

- **Effective date:** September 2, 2026
- **Policy revision:** 2.1.0

### Add this section (both files)

```markdown
## Optional domain rule pack updates

Grandma Guard ships a bundled list of known legitimate business and retailer domains with the extension. When enabled in settings (on by default), it may also download an updated public domain list from GitHub:

https://raw.githubusercontent.com/NokaAngel/Grandma-Guard/main/data/rule-packs.json

That download:

- happens in the background about every 48 hours, or when the user selects **Refresh domain lists now** in Options;
- retrieves a public JSON file containing hostname suffixes only;
- does not include the user's browsing history, page text, email content, passwords, or detection history;
- can be turned off at any time with **Use GitHub domain list updates** in Options.

When turned off, Grandma Guard continues using the bundled domain list included in the installed extension version.
```

### Fix the Security section (both files)

**Remove** any statement that Grandma Guard never uses the network or sends nothing over a network connection.

**Replace with:**

```markdown
## Security

All scam-detection logic is bundled with the extension and runs locally on the device. Grandma Guard does not transmit website content, email content, browsing history, or analytics to the developer.

The only optional network request related to protection is the public GitHub domain rule pack described above. That request sends no user content.
```

### Add to Permissions section (both files)

```markdown
The `alarms` permission is used to schedule optional background checks for updated public domain rule packs about once per day. No alarm sends user data off the device.
```

### Add to User control section (both files)

```markdown
Users can turn GitHub domain list updates on or off, refresh the public list manually, and view the bundled and cached list status under **Official domain lists** in Options.
```

### Update Family protection settings list (both files)

Add:

- optional GitHub domain list preference (`remoteRulePackEnabled`)
- cached copy of the last successfully downloaded public rule pack (hostname suffixes only, stored locally)

### Live website (NOT in GitHub)

Update **https://grandmaguard.nokaangel.dev/privacy/** on the server so it matches the repo privacy policy after your edits.

The website folder is local-only (`GrandmaGuard Website/`, gitignored). Do not add it to GitHub.

---

## Phase 2 — Ed25519 signing for rule packs (implement before or as part of 2.1.0)

The user wants **real authentication** for GitHub rule pack updates.

### Security model (important — do not get this wrong)

| Item | Secret? | Ship in extension / public repo? |
|------|---------|----------------------------------|
| Ed25519 **private key** | **YES — never commit** | Never |
| Ed25519 **public key** | No | Yes — embed in extension |
| Signature **verify code** | No | Yes — open source is correct and safe |
| Signed `rule-packs.json` | No | Yes — on GitHub |

**Publishing verify code and the public key does NOT let attackers create fake signed updates.** Only the private key can sign. Hiding verify source code does not add security.

### Signed payload format

Extend `data/rule-packs.json`:

```json
{
  "version": 2,
  "updated": "2026-09-02",
  "official_suffixes": ["walmart.com", "idscan.net"],
  "bad_host_fragments_extra": [],
  "sig": "base64-ed25519-signature"
}
```

**Signing rules:**

1. Build canonical JSON of all fields **except** `sig` (sorted keys, stable UTF-8).
2. Sign canonical bytes with Ed25519 private key.
3. Store signature as base64 in `sig`.

### Implementation tasks

1. **`tools/generate-rule-pack-key.mjs`** — generate Ed25519 keypair; write public key to `data/rule-pack-public.key` (base64, committable); private key to path outside repo or print once for user to save.

2. **`tools/sign-rule-pack.mjs`** — read `data/rule-packs.json`, produce canonical payload, sign with private key from env `RULE_PACK_SIGNING_KEY` or `--key-file` (gitignored).

3. **`.gitignore`** — add:
   ```
   *.pem
   rule-pack-signing.key
   .rule-pack-private.key
   ```

4. **`extension/rule-packs.js`** — embed public key constant; export `verifyRulePackSignature(payload)`.

5. **`extension/rule-pack-sync.js`** — after fetch, **reject** remote pack if signature missing or invalid. Bundled pack must also verify at load (or sign at build time).

6. **`tools/sync-rule-packs.mjs`** — after sync, ensure bundled data includes `sig` field.

7. **Privacy policy** — add after implementing signatures:

   ```markdown
   Before applying a downloaded domain rule pack, Grandma Guard verifies an Ed25519 signature using a public key embedded in the extension. Tampered or unsigned remote packs are rejected.
   ```

8. **`data/README.md`** — document sign workflow for maintainers.

### Private key handling

- **Never** commit private key.
- Store in password manager or GitHub Actions secret `RULE_PACK_SIGNING_KEY` for CI signing on merge to `main`.
- If private key is ever leaked: generate new keypair, embed new public key in next extension release, re-sign all rule packs.

### Chrome Web Store

- **Remote code:** still **No** (signed JSON is data, not executable code).

---

## Phase 3 — Verify, commit, push

```powershell
cd "C:\Users\NokaAngel\Desktop\GrandmaGuard - Universal Extension"
powershell -ExecutionPolicy Bypass -File tools/Sync-RulePacks.ps1
node tests/detection-engine.test.mjs
powershell -ExecutionPolicy Bypass -File tools/Build-Release.ps1
```

Expect:

- All tests pass (111 cases: 52 page + 11 link + 48 email)
- `dist/Grandma-Guard-Chrome-2.1.0.zip`
- `dist/Grandma-Guard-Firefox-2.1.0.zip`
- Manifests show `"version": "2.1.0"`

### Commit

Stage repo files only (not website, not dist, not keys):

```powershell
git add CHANGELOG.md README.md docs/ data/ extension/ tests/ tools/ .gitignore
git status
```

**Commit message:**

```
Release 2.1.0 with signed GitHub rule packs and privacy updates.

Adds optional signed domain rule pack fetch from GitHub, bundled rule packs, false-positive fixes, Ed25519 verification, and updated privacy policies including alarms permission disclosure.
```

```powershell
git push origin main
```

Verify raw URL works:

```
https://raw.githubusercontent.com/NokaAngel/Grandma-Guard/main/data/rule-packs.json
```

---

## Phase 4 — GitHub release

Create tag **v2.1.0** with both zips from `dist/`.

**Release notes summary:**

- GitHub-hosted signed domain rule packs (optional, default on)
- Bundled lists work offline
- Webmail alignment + false-positive fixes from 2.0.1/2.0.2
- Privacy policy updated for optional public JSON fetch

---

## Phase 5 — Store submissions

### Firefox AMO

- Upload: `dist/Grandma-Guard-Firefox-2.1.0.zip`
- Privacy policy URL: https://grandmaguard.nokaangel.dev/privacy/
- **New permission:** `alarms` — schedules optional rule pack refresh (~48h)

**Reviewer notes:**

```
2.1.0: Optional fetch of signed public domain rule pack JSON from GitHub (no user data). Ed25519 signature verified before apply. alarms permission for refresh schedule. Privacy policy updated at https://grandmaguard.nokaangel.dev/privacy/
```

### Chrome Web Store

- Upload: `dist/Grandma-Guard-Chrome-2.1.0.zip`
- Privacy policy URL: https://grandmaguard.nokaangel.dev/privacy/ (must reflect 2.1.0 text first)
- **Remote code:** No
- **Data collection:** None transmitted

**Dashboard justification (if prompted):**

```
Grandma Guard runs locally. The only new network activity is an optional download of a signed public domain allowlist JSON from GitHub to reduce false positives. No browsing history, page content, email content, or user settings are sent. Users can disable this in Options.
```

---

## Phase 6 — Live website (manual server upload)

Update on server (not GitHub):

- **https://grandmaguard.nokaangel.dev/privacy/** — match repo policy
- Download page — version **2.1.0**
- Help / release notes — rule packs, signing, false-positive fixes

---

## Ongoing: add a domain without a store release

1. Edit `data/rule-packs.json`
2. Bump `"version"`
3. Run `node tools/sign-rule-pack.mjs`
4. Run `powershell -ExecutionPolicy Bypass -File tools/Sync-RulePacks.ps1`
5. Commit signed JSON + `extension/data/rule-packs.json` + `extension/rule-packs-data.js`
6. Push to `main`

Installed extensions with GitHub updates enabled pick up changes within ~48 hours or on manual refresh in Options.

---

## Checklists

### Privacy

- [ ] Policy revision **2.1.0**, effective date **Sep 2, 2026** in both repo privacy files
- [ ] Optional domain rule pack section added
- [ ] Security section fixed (no false "never uses network" claim)
- [ ] `alarms` permission documented
- [ ] Options toggle + manual refresh documented
- [ ] Ed25519 verification documented (after signing is implemented)
- [ ] Live site https://grandmaguard.nokaangel.dev/privacy/ updated

### Signing

- [ ] Ed25519 keypair generated; private key NOT in repo
- [ ] Public key embedded in extension
- [ ] Sign tool + verify on fetch/bundled load
- [ ] Unsigned/tampered remote packs rejected
- [ ] `data/README.md` updated

### Release

- [ ] Tests pass
- [ ] Builds validated
- [ ] Committed and pushed to `main`
- [ ] `rule-packs.json` live on GitHub raw URL
- [ ] GitHub release **v2.1.0** created
- [ ] Firefox + Chrome submitted
- [ ] Website updated on server

---

## Contact / support URL (for store listings)

https://nokaangel.dev/support?project=grandmaguard

---

## Questions to escalate to the user

- If private signing key does not exist yet: generate keypair and give user the private key backup instructions once (never store in repo).
- If live website SSH/deploy access is unavailable: finish repo + stores and list website as pending manual upload by user.
