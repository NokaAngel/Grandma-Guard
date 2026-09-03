(function attachRulePacks(root) {
  'use strict';

  const CORE_OFFICIAL_SUFFIXES = [
    'microsoft.com',
    'google.com',
    'apple.com',
    'amazon.com',
    'paypal.com',
    'github.com'
  ];

  const MAX_REMOTE_OFFICIAL_SUFFIXES = 500;
  const MAX_REMOTE_BAD_FRAGMENTS = 200;
  const SIGNATURE_FIELD = 'sig';
  const HOST_SUFFIX_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
  const FRAGMENT_PATTERN = /^[a-z0-9][a-z0-9-]{2,39}$/;

  const publicKeyBase64 = String(root.__grandmaGuardRulePacksPublicKey || '').trim();
  let verifyKeyPromise = null;

  let bundled = {
    version: 0,
    official_suffixes: [],
    bad_host_fragments_extra: []
  };

  let remoteOfficial = [];
  let remoteBadFragments = [];
  let remoteVersion = 0;

  function sortValue(value) {
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

  function canonicalRulePackBytes(payload) {
    return new TextEncoder().encode(JSON.stringify(sortValue(payload ?? {})));
  }

  function base64ToBytes(value) {
    const binary = atob(String(value || '').trim());
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }

  function importVerifyKey() {
    if (!publicKeyBase64) {
      return Promise.resolve(null);
    }
    if (!verifyKeyPromise) {
      verifyKeyPromise = crypto.subtle.importKey(
        'raw',
        base64ToBytes(publicKeyBase64),
        { name: 'Ed25519' },
        false,
        ['verify']
      ).catch(() => null);
    }
    return verifyKeyPromise;
  }

  async function verifyRulePackSignature(payload) {
    const signatureValue = String(payload?.[SIGNATURE_FIELD] || '').trim();
    if (!signatureValue) {
      return false;
    }
    const verifyKey = await importVerifyKey();
    if (!verifyKey) {
      return false;
    }
    let signature = null;
    try {
      signature = base64ToBytes(signatureValue);
    } catch {
      return false;
    }
    if (signature.length !== 64) {
      return false;
    }
    try {
      return await crypto.subtle.verify(
        'Ed25519',
        verifyKey,
        signature,
        canonicalRulePackBytes(payload)
      );
    } catch {
      return false;
    }
  }

  function normalizeSuffix(value) {
    const host = String(value || '')
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .replace(/^www\./, '')
      .replace(/:\d+$/, '');
    if (!host || !HOST_SUFFIX_PATTERN.test(host)) {
      return '';
    }
    const labels = host.split('.');
    if (labels.length < 2 || labels.some((label) => label.length === 0)) {
      return '';
    }
    if (labels.length === 1 || (labels.length === 2 && labels[1].length <= 2 && labels[0].length <= 3)) {
      return '';
    }
    return host;
  }

  function normalizeFragment(value) {
    const fragment = String(value || '').trim().toLowerCase();
    if (!fragment || !FRAGMENT_PATTERN.test(fragment)) {
      return '';
    }
    return fragment;
  }

  function normalizeSuffixList(values, cap) {
    const list = Array.isArray(values) ? values : [];
    const seen = new Set();
    const normalized = [];
    for (const entry of list) {
      const host = normalizeSuffix(entry);
      if (!host || seen.has(host)) {
        continue;
      }
      seen.add(host);
      normalized.push(host);
      if (normalized.length >= cap) {
        break;
      }
    }
    return normalized.sort();
  }

  function normalizeFragmentList(values, cap) {
    const list = Array.isArray(values) ? values : [];
    const seen = new Set();
    const normalized = [];
    for (const entry of list) {
      const fragment = normalizeFragment(entry);
      if (!fragment || seen.has(fragment)) {
        continue;
      }
      seen.add(fragment);
      normalized.push(fragment);
      if (normalized.length >= cap) {
        break;
      }
    }
    return normalized.sort();
  }

  function normalizePack(payload) {
    const version = Number(payload?.version) || 0;
    return {
      version: version > 0 ? Math.floor(version) : 0,
      updated: String(payload?.updated || '').slice(0, 32),
      official_suffixes: normalizeSuffixList(payload?.official_suffixes, MAX_REMOTE_OFFICIAL_SUFFIXES),
      bad_host_fragments_extra: normalizeFragmentList(payload?.bad_host_fragments_extra, MAX_REMOTE_BAD_FRAGMENTS),
      sig: String(payload?.[SIGNATURE_FIELD] || '').trim()
    };
  }

  function validateRemotePack(payload) {
    const pack = normalizePack(payload);
    return pack.version > 0 && pack.sig && (
      pack.official_suffixes.length > 0 ||
      pack.bad_host_fragments_extra.length > 0
    );
  }

  async function acceptSignedPack(payload) {
    if (!payload || !(await verifyRulePackSignature(payload))) {
      return null;
    }
    return normalizePack(payload);
  }

  function applyRemotePack(pack) {
    if (!pack || pack.version <= 0) {
      return false;
    }
    if (pack.version < bundled.version) {
      return false;
    }
    if (pack.version < remoteVersion) {
      return false;
    }
    remoteOfficial = pack.official_suffixes.slice();
    remoteBadFragments = pack.bad_host_fragments_extra.slice();
    remoteVersion = pack.version;
    return true;
  }

  async function setRemoteCache(payload) {
    const pack = await acceptSignedPack(payload);
    if (!pack) {
      return false;
    }
    return applyRemotePack(pack);
  }

  function clearRemoteCache() {
    remoteOfficial = [];
    remoteBadFragments = [];
    remoteVersion = 0;
  }

  function allOfficialSuffixes() {
    return normalizeSuffixList([
      ...CORE_OFFICIAL_SUFFIXES,
      ...bundled.official_suffixes,
      ...remoteOfficial
    ], MAX_REMOTE_OFFICIAL_SUFFIXES + CORE_OFFICIAL_SUFFIXES.length + bundled.official_suffixes.length);
  }

  function allBadHostFragmentsExtra() {
    return normalizeFragmentList([
      ...bundled.bad_host_fragments_extra,
      ...remoteBadFragments
    ], MAX_REMOTE_BAD_FRAGMENTS + bundled.bad_host_fragments_extra.length);
  }

  function bundledVersion() {
    return bundled.version;
  }

  function remotePackVersion() {
    return remoteVersion;
  }

  async function hydrateRemoteFromStorage(state) {
    if (!state || state.remoteRulePackEnabled === false || !state.remoteRulePack) {
      clearRemoteCache();
      return false;
    }
    return setRemoteCache(state.remoteRulePack);
  }

  async function initBundledPack() {
    const raw = root.__grandmaGuardRulePacksBundled || null;
    if (!raw) {
      return false;
    }
    const pack = await acceptSignedPack(raw);
    if (!pack) {
      bundled = {
        version: 0,
        official_suffixes: [],
        bad_host_fragments_extra: []
      };
      return false;
    }
    bundled = pack;
    return true;
  }

  function bindStorageHydration() {
    const extensionApi = root.browser ?? root.chrome;
    if (!extensionApi?.storage?.local) {
      return;
    }

    extensionApi.storage.local.get({
      remoteRulePackEnabled: true,
      remoteRulePack: null
    }).then((state) => hydrateRemoteFromStorage(state)).catch(() => {});

    if (typeof extensionApi.storage.onChanged?.addListener === 'function') {
      extensionApi.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') {
          return;
        }
        if (!changes.remoteRulePack && !changes.remoteRulePackEnabled) {
          return;
        }
        extensionApi.storage.local.get({
          remoteRulePackEnabled: true,
          remoteRulePack: null
        }).then((state) => hydrateRemoteFromStorage(state)).catch(() => {});
      });
    }
  }

  root.GrandmaGuardRulePacks = {
    RULE_PACK_URL: 'https://raw.githubusercontent.com/NokaAngel/Grandma-Guard/main/data/rule-packs.json',
    RULE_PACK_REFRESH_MS: 48 * 60 * 60 * 1000,
    normalizePack,
    validateRemotePack,
    verifyRulePackSignature,
    acceptSignedPack,
    setRemoteCache,
    applyRemotePack,
    clearRemoteCache,
    hydrateRemoteFromStorage,
    allOfficialSuffixes,
    allBadHostFragmentsExtra,
    bundledVersion,
    remotePackVersion,
    normalizeSuffix,
    initBundledPack
  };

  initBundledPack().finally(() => {
    bindStorageHydration();
  });
}(typeof globalThis !== 'undefined' ? globalThis : this));
