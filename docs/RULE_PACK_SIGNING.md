# Rule pack signing (Ed25519)

Grandma Guard rule packs are signed offline with Ed25519. The extension embeds the **public key** and rejects unsigned or tampered remote packs.

## Keys

| File | Commit? |
|------|---------|
| `data/rule-pack-public.pem` | Yes |
| `data/rule-pack-public.key` | Yes (raw base64 for extension) |
| `.rule-pack-private.pem` | **Never** |

## Maintainer workflow

```powershell
# First time only
node tools/generate-rule-pack-key.mjs

# After editing data/rule-packs.json
node tools/sign-rule-pack.mjs
powershell -ExecutionPolicy Bypass -File tools/Sync-RulePacks.ps1
```

Build-Release.ps1 runs sign + sync automatically when `.rule-pack-private.pem` exists locally.

## GitHub Actions (optional)

To sign on merge, add repository secret `RULE_PACK_SIGNING_KEY` with the PEM contents of `.rule-pack-private.pem`. A future workflow can run `sign-rule-pack.mjs` using:

```powershell
$env:RULE_PACK_SIGNING_KEY_FILE = ".rule-pack-private.pem"
```

## Key rotation

1. Generate a new keypair
2. Ship a new extension version with the new public key embedded
3. Re-sign all rule packs with the new private key
4. Revoke/archive the old private key

## Security note

Publishing verify code and the public key is safe. Only the **private key** must stay secret.
