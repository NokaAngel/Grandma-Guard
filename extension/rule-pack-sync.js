'use strict';

(function initRulePackSync() {
  const extensionApi = globalThis.browser ?? globalThis.chrome;
  const packs = globalThis.GrandmaGuardRulePacks;

  if (!extensionApi?.storage?.local || !packs) {
    return;
  }

  async function syncRulePack(force = false) {
    const state = await extensionApi.storage.local.get({
      remoteRulePackEnabled: true,
      remoteRulePackFetchedAt: 0,
      remoteRulePack: null
    });

    if (state.remoteRulePackEnabled === false && !force) {
      return { ok: false, skipped: true, reason: 'disabled' };
    }

    const now = Date.now();
    if (!force && now - (Number(state.remoteRulePackFetchedAt) || 0) < packs.RULE_PACK_REFRESH_MS) {
      if (state.remoteRulePack) {
        await packs.hydrateRemoteFromStorage(state);
      }
      return { ok: true, skipped: true, reason: 'fresh' };
    }

    try {
      const response = await fetch(packs.RULE_PACK_URL, { cache: 'no-store' });
      if (!response.ok) {
        return { ok: false, reason: 'fetch-failed' };
      }

      const payload = await response.json();
      if (!packs.validateRemotePack(payload)) {
        return { ok: false, reason: 'invalid-pack' };
      }

      if (!(await packs.verifyRulePackSignature(payload))) {
        return { ok: false, reason: 'bad-signature' };
      }

      const normalized = packs.normalizePack(payload);
      if (normalized.version < packs.bundledVersion()) {
        return { ok: false, reason: 'older-than-bundled' };
      }

      const currentVersion = Number(state.remoteRulePack?.version) || 0;
      if (!force && normalized.version < currentVersion) {
        return { ok: false, reason: 'older-than-cache' };
      }

      await extensionApi.storage.local.set({
        remoteRulePack: normalized,
        remoteRulePackFetchedAt: now
      });
      await packs.setRemoteCache(normalized);

      return {
        ok: true,
        version: normalized.version,
        officialCount: normalized.official_suffixes.length,
        badFragmentCount: normalized.bad_host_fragments_extra.length
      };
    } catch {
      if (state.remoteRulePack) {
        await packs.hydrateRemoteFromStorage(state);
      }
      return { ok: false, reason: 'network-error' };
    }
  }

  globalThis.GrandmaGuardRulePackSync = {
    syncRulePack
  };

  const start = async () => {
    if (typeof packs.initBundledPack === 'function') {
      await packs.initBundledPack();
    }
    await syncRulePack(false);
  };

  start().catch(() => {});
  extensionApi.runtime?.onInstalled?.addListener?.(() => {
    start().catch(() => {});
  });
  extensionApi.alarms?.create?.('grandma-guard-rule-pack-sync', { periodInMinutes: 24 * 60 });
  extensionApi.alarms?.onAlarm?.addListener?.((alarm) => {
    if (alarm.name === 'grandma-guard-rule-pack-sync') {
      syncRulePack(false).catch(() => {});
    }
  });
}());
