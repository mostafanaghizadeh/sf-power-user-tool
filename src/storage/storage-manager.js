import browser from 'webextension-polyfill';
import { CONFIG } from '../constants/config.js';
import { warn } from '../utils/logger.js';

/**
 * StorageManager
 * --------------
 * Responsibility : the ONLY module that touches chrome.storage. Provides a
 *                  Promise-based get/set/remove plus a change subscription so
 *                  content script, popup and worker stay in sync.
 * Public API     : get, set, remove, clear, onChanged
 * Browser APIs   : chrome.storage.local, chrome.storage.onChanged
 *
 * Why local (not sync): SF command lists can exceed chrome.storage.sync's
 * 8 KB-per-item / 100 KB quota; local gives ~10 MB. Sync is offered as an
 * opt-in in SettingsManager for the small settings object only.
 */
export const StorageManager = (() => {
  const area = browser.storage.local;

  async function get(key, fallback = null) {
    try {
      const res = await area.get(key);
      return key in res ? res[key] : fallback;
    } catch (e) {
      warn('storage.get failed', key, e);
      return fallback;
    }
  }

  async function set(key, value) {
    try {
      await area.set({ [key]: value });
      return true;
    } catch (e) {
      warn('storage.set failed', key, e);
      return false;
    }
  }

  async function remove(key) {
    try {
      await area.remove(key);
      return true;
    } catch (e) {
      warn('storage.remove failed', key, e);
      return false;
    }
  }

  async function clear() {
    await area.clear();
  }

  /**
   * Subscribe to changes for a specific key. Returns an unsubscribe fn.
   * Callback receives (newValue, oldValue).
   */
  function onChanged(key, cb) {
    const handler = (changes, areaName) => {
      if (areaName !== 'local') return;
      if (changes[key]) cb(changes[key].newValue, changes[key].oldValue);
    };
    browser.storage.onChanged.addListener(handler);
    return () => browser.storage.onChanged.removeListener(handler);
  }

  return { get, set, remove, clear, onChanged, KEYS: CONFIG };
})();
