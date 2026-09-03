import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  exportPublicKeyRawBase64,
  generateRulePackKeyPair
} from './rule-pack-crypto.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const privateKeyPath = path.join(projectRoot, '.rule-pack-private.pem');
const publicKeyPath = path.join(projectRoot, 'data', 'rule-pack-public.pem');
const publicRawPath = path.join(projectRoot, 'data', 'rule-pack-public.key');

if (fs.existsSync(privateKeyPath)) {
  console.error(`Private key already exists at ${privateKeyPath}`);
  console.error('Delete it first only if you intend to rotate keys.');
  process.exit(1);
}

const { privateKey, publicKey } = generateRulePackKeyPair();
const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' });
const publicPem = publicKey.export({ type: 'spki', format: 'pem' });
const publicRaw = exportPublicKeyRawBase64(publicKey);

fs.mkdirSync(path.dirname(publicKeyPath), { recursive: true });
fs.writeFileSync(privateKeyPath, privatePem, 'utf8');
fs.writeFileSync(publicKeyPath, publicPem, 'utf8');
fs.writeFileSync(publicRawPath, `${publicRaw}\n`, 'utf8');

console.log('Generated Ed25519 rule pack signing keys.');
console.log(`Private key (gitignored): ${privateKeyPath}`);
console.log(`Public key (commit): ${publicKeyPath}`);
console.log(`Public raw base64 (commit): ${publicRawPath}`);
console.log('Back up the private key outside the repo before deleting this machine copy.');
