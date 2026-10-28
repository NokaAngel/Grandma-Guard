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
  const MAX_REMOTE_BLOCKED_HOSTS = 500;
  const MAX_REMOTE_BLOCKED_DOMAINS = 200;
  const MAX_REMOTE_WARN_DOMAINS = 500;
  const MAX_REMOTE_BLOCKED_URL_PREFIXES = 200;
  const SIGNATURE_FIELD = 'sig';
  const HOST_SUFFIX_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
  const FRAGMENT_PATTERN = /^[a-z0-9][a-z0-9-]{2,39}$/;

  const publicKeyBase64 = String(root.__grandmaGuardRulePacksPublicKey || '').trim();
  let verifyKeyPromise = null;

  let bundled = {
    version: 0,
    official_suffixes: [],
    bad_host_fragments_extra: [],
    blocked_hosts: [],
    blocked_domains: [],
    warn_domains: [],
    blocked_url_prefixes: []
  };

  let remoteOfficial = [];
  let remoteBadFragments = [];
  let remoteBlockedHosts = [];
  let remoteBlockedDomains = [];
  let remoteWarnDomains = [];
  let remoteBlockedUrlPrefixes = [];
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

  function normalizeHost(value, removeWww = false) {
    const host = String(value || '')
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .replace(/:\d+$/, '');
    const normalizedHost = removeWww ? host.replace(/^www\./, '') : host;
    if (!normalizedHost || !HOST_SUFFIX_PATTERN.test(normalizedHost)) {
      return '';
    }
    const labels = normalizedHost.split('.');
    if (labels.length < 2 || labels.some((label) => label.length === 0)) {
      return '';
    }
    if (labels.length === 1 || (labels.length === 2 && labels[1].length <= 2 && labels[0].length <= 3)) {
      return '';
    }
    return normalizedHost;
  }

  function normalizeSuffix(value) {
    return normalizeHost(value, true);
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

  function normalizeHostList(values, cap) {
    const list = Array.isArray(values) ? values : [];
    const seen = new Set();
    const normalized = [];
    for (const entry of list) {
      const host = normalizeHost(entry);
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

  function normalizeBlockedUrlPrefixes(values, cap) {
    const list = Array.isArray(values) ? values : [];
    const seen = new Set();
    const normalized = [];
    for (const entry of list) {
      const domain = normalizeSuffix(entry?.domain);
      let pathPrefix = String(entry?.path_prefix || '').trim();
      const reason = String(entry?.reason || '').trim().slice(0, 160);
      if (!domain || !pathPrefix.startsWith('/') || pathPrefix.length > 240) {
        continue;
      }
      try {
        pathPrefix = new URL(pathPrefix, 'https://example.invalid').pathname;
      } catch {
        continue;
      }
      const key = `${domain}\n${pathPrefix}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      normalized.push({ domain, path_prefix: pathPrefix, reason });
      if (normalized.length >= cap) {
        break;
      }
    }
    return normalized.sort((left, right) =>
      `${left.domain}${left.path_prefix}`.localeCompare(`${right.domain}${right.path_prefix}`)
    );
  }

  function normalizePack(payload) {
    const version = Number(payload?.version) || 0;
    return {
      schema: Math.max(1, Math.floor(Number(payload?.schema) || 1)),
      version: version > 0 ? Math.floor(version) : 0,
      updated: String(payload?.updated || '').slice(0, 32),
      official_suffixes: normalizeSuffixList(payload?.official_suffixes, MAX_REMOTE_OFFICIAL_SUFFIXES),
      bad_host_fragments_extra: normalizeFragmentList(payload?.bad_host_fragments_extra, MAX_REMOTE_BAD_FRAGMENTS),
      blocked_hosts: normalizeHostList(payload?.blocked_hosts, MAX_REMOTE_BLOCKED_HOSTS),
      blocked_domains: normalizeSuffixList(payload?.blocked_domains, MAX_REMOTE_BLOCKED_DOMAINS),
      warn_domains: normalizeSuffixList(payload?.warn_domains, MAX_REMOTE_WARN_DOMAINS),
      blocked_url_prefixes: normalizeBlockedUrlPrefixes(
        payload?.blocked_url_prefixes,
        MAX_REMOTE_BLOCKED_URL_PREFIXES
      ),
      sig: String(payload?.[SIGNATURE_FIELD] || '').trim()
    };
  }

  function validateRemotePack(payload) {
    const pack = normalizePack(payload);
    return pack.version > 0 && pack.sig && (
      pack.official_suffixes.length > 0 ||
      pack.bad_host_fragments_extra.length > 0 ||
      pack.blocked_hosts.length > 0 ||
      pack.blocked_domains.length > 0 ||
      pack.warn_domains.length > 0 ||
      pack.blocked_url_prefixes.length > 0
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
    remoteBlockedHosts = pack.blocked_hosts.slice();
    remoteBlockedDomains = pack.blocked_domains.slice();
    remoteWarnDomains = pack.warn_domains.slice();
    remoteBlockedUrlPrefixes = pack.blocked_url_prefixes.map((entry) => ({ ...entry }));
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
    remoteBlockedHosts = [];
    remoteBlockedDomains = [];
    remoteWarnDomains = [];
    remoteBlockedUrlPrefixes = [];
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

  function suffixMatches(hostname, suffix) {
    return hostname === suffix || hostname.endsWith(`.${suffix}`);
  }

  function allBlockedHosts() {
    return normalizeHostList([
      ...bundled.blocked_hosts,
      ...remoteBlockedHosts
    ], MAX_REMOTE_BLOCKED_HOSTS + bundled.blocked_hosts.length);
  }

  function allBlockedDomains() {
    return normalizeSuffixList([
      ...bundled.blocked_domains,
      ...remoteBlockedDomains
    ], MAX_REMOTE_BLOCKED_DOMAINS + bundled.blocked_domains.length);
  }

  function allWarnDomains() {
    return normalizeSuffixList([
      ...bundled.warn_domains,
      ...remoteWarnDomains
    ], MAX_REMOTE_WARN_DOMAINS + bundled.warn_domains.length);
  }

  function allBlockedUrlPrefixes() {
    return normalizeBlockedUrlPrefixes([
      ...bundled.blocked_url_prefixes,
      ...remoteBlockedUrlPrefixes
    ], MAX_REMOTE_BLOCKED_URL_PREFIXES + bundled.blocked_url_prefixes.length);
  }

  function isBlockedHost(hostname) {
    const value = String(hostname || '').trim().toLowerCase().replace(/\.$/, '');
    if (!value) {
      return false;
    }
    if (allBlockedHosts().includes(value)) {
      return true;
    }
    return allBlockedDomains().some((domain) => suffixMatches(value, domain));
  }

  function isWarnedHost(hostname) {
    const value = String(hostname || '').trim().toLowerCase().replace(/\.$/, '');
    return Boolean(value && allWarnDomains().some((domain) => suffixMatches(value, domain)));
  }

  function matchBlockedUrl(value) {
    let parsed = null;
    try {
      parsed = new URL(value);
    } catch {
      return null;
    }
    const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '');
    if (isBlockedHost(hostname)) {
      return {
        type: 'host',
        domain: hostname,
        path_prefix: '/',
        reason: 'This website is on Grandma Guard\'s verified global blocklist'
      };
    }
    return allBlockedUrlPrefixes().find((entry) =>
      suffixMatches(hostname, entry.domain) && parsed.pathname.startsWith(entry.path_prefix)
    ) || null;
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
        bad_host_fragments_extra: [],
        blocked_hosts: [],
        blocked_domains: [],
        warn_domains: [],
        blocked_url_prefixes: []
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
    allBlockedHosts,
    allBlockedDomains,
    allWarnDomains,
    allBlockedUrlPrefixes,
    isBlockedHost,
    isWarnedHost,
    matchBlockedUrl,
    bundledVersion,
    remotePackVersion,
    normalizeSuffix,
    initBundledPack
  };

  initBundledPack().finally(() => {
    bindStorageHydration();
  });
}(typeof globalThis !== 'undefined' ? globalThis : this));
