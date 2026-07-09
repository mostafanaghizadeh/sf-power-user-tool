import { CONFIG } from '../constants/config.js';
import { StorageManager } from './storage-manager.js';
import { log } from '../utils/logger.js';

/**
 * MigrationService
 * ----------------
 * Runs once in the content script context (which alone can read the SF page's
 * localStorage) to lift a returning userscript user's data into extension
 * storage, then stamps a schema version. Idempotent.
 */
export const MigrationService = (() => {
  async function run() {
    const done = await StorageManager.get('__schema_version__', 0);
    if (done >= CONFIG.SCHEMA_VERSION) return;

    try {
      const legacyState = safeParse(localStorage.getItem(CONFIG.STATE_KEY));
      const legacyFeat = safeParse(localStorage.getItem(CONFIG.FEATURE_KEY));

      if (legacyState && !(await StorageManager.get(CONFIG.STATE_KEY))) {
        await StorageManager.set(CONFIG.STATE_KEY, legacyState);
        log('migrated legacy command state from localStorage');
      }
      if (legacyFeat && !(await StorageManager.get(CONFIG.FEATURE_KEY))) {
        await StorageManager.set(CONFIG.FEATURE_KEY, legacyFeat);
        log('migrated legacy feature state from localStorage');
      }
    } catch (e) {
      log('migration skipped', e);
    }

    await StorageManager.set('__schema_version__', CONFIG.SCHEMA_VERSION);
  }

  function safeParse(raw) {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  return { run };
})();
