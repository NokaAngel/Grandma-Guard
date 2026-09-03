import crypto from 'node:crypto';
import fs from 'node:fs';

const SIGNATURE_FIELD = 'sig';

export function sortValue(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => sortValue(entry));
  }
  if (value && typeof value === 'object') {
    const sorted = {};
    for (const key of Object.keys(value).sort()) {
      if (key === SIGNATURE_FIELD) {
        continue;
      }
      sorted[key] = sortValue(value[key]);
    }
    return sorted;
  }
  return value;
}

export function canonicalRulePackBytes(payload) {
  const canonical = sortValue(payload ?? {});
  return Buffer.from(JSON.stringify(canonical), 'utf8');
}

export function stripSignature(payload) {
  if (!payload || typeof payload !== 'object') {
    return {};
  }
  const next = { ...payload };
  delete next[SIGNATURE_FIELD];
  return next;
}

export function signRulePackPayload(payload, privateKey) {
  const message = canonicalRulePackBytes(payload);
  const signature = crypto.sign(null, message, privateKey);
  return {
    ...stripSignature(payload),
    [SIGNATURE_FIELD]: signature.toString('base64')
  };
}

export function verifyRulePackPayload(payload, publicKey) {
  const signatureValue = String(payload?.[SIGNATURE_FIELD] || '').trim();
  if (!signatureValue || !publicKey) {
    return false;
  }
  let signature = null;
  try {
    signature = Buffer.from(signatureValue, 'base64');
  } catch {
    return false;
  }
  if (signature.length !== 64) {
    return false;
  }
  const message = canonicalRulePackBytes(payload);
  return crypto.verify(null, message, publicKey, signature);
}

export function loadPrivateKeyFromFile(filePath) {
  const pem = fs.readFileSync(filePath, 'utf8');
  return crypto.createPrivateKey(pem);
}

export function loadPublicKeyFromFile(filePath) {
  const pem = fs.readFileSync(filePath, 'utf8');
  return crypto.createPublicKey(pem);
}

export function exportPublicKeyRawBase64(publicKey) {
  const spki = publicKey.export({ type: 'spki', format: 'der' });
  return spki.subarray(-32).toString('base64');
}

export function generateRulePackKeyPair() {
  return crypto.generateKeyPairSync('ed25519');
}
