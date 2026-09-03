import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadPrivateKeyFromFile,
  signRulePackPayload
} from './rule-pack-crypto.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const sourcePath = path.join(projectRoot, 'data', 'rule-packs.json');

const keyFile = process.env.RULE_PACK_SIGNING_KEY_FILE ||
  path.join(projectRoot, '.rule-pack-private.pem');

if (!fs.existsSync(sourcePath)) {
  console.error(`Missing ${sourcePath}`);
  process.exit(1);
}

if (!fs.existsSync(keyFile)) {
  console.error(`Missing private key at ${keyFile}`);
  console.error('Run: node tools/generate-rule-pack-key.mjs');
  process.exit(1);
}

const payload = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const privateKey = loadPrivateKeyFromFile(keyFile);
const signed = signRulePackPayload(payload, privateKey);

fs.writeFileSync(sourcePath, `${JSON.stringify(signed, null, 2)}\n`, 'utf8');
console.log(`Signed ${sourcePath} (version ${signed.version}, sig present).`);
