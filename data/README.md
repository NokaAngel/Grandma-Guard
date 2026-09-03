# Domain rule packs

Grandma Guard uses versioned, **Ed25519-signed** JSON rule packs for official/trusted business domains.

## Files

| File | Purpose |
|------|---------|
| `rule-packs.json` | Signed source of truth (commit this) |
| `rule-pack-public.pem` | Public key (commit) |
| `rule-pack-public.key` | Raw public key base64 for extension embed (commit) |
| `.rule-pack-private.pem` | **Private signing key (never commit)** |

## First-time key setup

```powershell
node tools/generate-rule-pack-key.mjs
```

Back up `.rule-pack-private.pem` outside the repo.

## Update domains

1. Edit `data/rule-packs.json` (bump `"version"`, add domains)
2. Sign: `node tools/sign-rule-pack.mjs`
3. Sync into extension: `powershell -ExecutionPolicy Bypass -File tools/Sync-RulePacks.ps1`
4. Commit signed JSON, public keys, and generated `extension/rule-packs-data.js`

## GitHub live updates

Push signed `data/rule-packs.json` to `main`. Extensions fetch:

`https://raw.githubusercontent.com/NokaAngel/Grandma-Guard/main/data/rule-packs.json`

Remote packs **must** verify with the embedded public key or they are rejected.

## Entry rules

- `official_suffixes`: lowercase hostname suffixes (`walmart.com`, `help.example.com`)
- `bad_host_fragments_extra`: optional extra scam-host fragments (additive only)
- Updates never remove bundled core protection in the extension code

## Community false-positive reports

Users can optionally report false positives from the extension (**Report false positive**), which opens `https://grandmaguard.nokaangel.dev/report` and then the private support form. Review submissions, then add approved domains here and follow the update steps above. GitHub issues remain optional for advanced users.
