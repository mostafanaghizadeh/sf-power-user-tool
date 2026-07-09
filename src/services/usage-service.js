import { StorageManager } from '../storage/storage-manager.js';
import { CONFIG } from '../constants/config.js';

/**
 * UsageService (Module 11 — Quick Launcher 2.0)
 * ---------------------------------------------
 * Tracks favorites, recently-used (last 20) and usage counts for commands, so
 * the launcher can surface pinned / recent / frequent sections. Keys are command
 * keys only — no labels, URLs, or user data are stored here beyond the command
 * key the user already created.
 *
 * In-memory cache is loaded once; writes persist to chrome.storage.local.
 */
export const UsageService = (() => {
  let cache = { favorites: [], recent: [], counts: {} };
  let loaded = false;

  async function load() {
    const stored = await StorageManager.get(CONFIG.USAGE_KEY);
    cache = { favorites: [], recent: [], counts: {}, ...(stored || {}) };
    loaded = true;
    return cache;
  }
  function _ensure() {
    return loaded ? Promise.resolve() : load();
  }
  async function _save() {
    await StorageManager.set(CONFIG.USAGE_KEY, cache);
  }

  const isFavorite = (key) => cache.favorites.includes(key);

  async function toggleFavorite(key) {
    await _ensure();
    cache.favorites = isFavorite(key)
      ? cache.favorites.filter((k) => k !== key)
      : [...cache.favorites, key];
    await _save();
    return isFavorite(key);
  }

  /** Record a command use: bump count and move to front of recent (cap 20). */
  async function touch(key) {
    await _ensure();
    cache.counts[key] = (cache.counts[key] || 0) + 1;
    cache.recent = [key, ...cache.recent.filter((k) => k !== key)].slice(0, 20);
    await _save();
  }

  /** Drop a key entirely (e.g. when its command is deleted). */
  async function forget(key) {
    await _ensure();
    cache.favorites = cache.favorites.filter((k) => k !== key);
    cache.recent = cache.recent.filter((k) => k !== key);
    delete cache.counts[key];
    await _save();
  }

  const favorites = () => cache.favorites.slice();
  const recent = () => cache.recent.slice();
  const frequent = (n = 10) =>
    Object.entries(cache.counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([k]) => k);

  return { load, isFavorite, toggleFavorite, touch, forget, favorites, recent, frequent };
})();

/** Fuzzy subsequence match: every char of query appears in order in text. */
export function fuzzyMatch(query, text) {
  if (!query) return true;
  const q = String(query).toLowerCase();
  const t = String(text).toLowerCase();
  let i = 0;
  for (const c of t) if (c === q[i]) i++;
  return i === q.length;
}
