import { CONFIG } from '../constants/config.js';
import { FEATURES } from '../constants/defaults.js';
import { StorageManager } from '../storage/storage-manager.js';

/**
 * FeatureStateService
 * -------------------
 * Responsibility : persist and expose feature (keepalive/darkmode/quicklauncher)
 *                  on-off flags.
 * Public API     : getAll, getStates, setState, isOn
 * Dependencies   : StorageManager, constants
 */
export const FeatureStateService = (() => {
  const getAll = () => FEATURES;

  async function getStates() {
    return (await StorageManager.get(CONFIG.FEATURE_KEY)) || {};
  }

  async function setState(key, val) {
    const s = await getStates();
    s[key] = val;
    await StorageManager.set(CONFIG.FEATURE_KEY, s);
    return s;
  }

  async function isOn(key) {
    const s = await getStates();
    return !!s[key];
  }

  // Quick-launcher screen position. One of: top-left, top-right,
  // bottom-left, bottom-right. Stored alongside feature flags.
  const POSITIONS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
  const DEFAULT_POSITION = 'top-left';

  async function getLauncherPosition() {
    const s = await getStates();
    return POSITIONS.includes(s.__qlPosition) ? s.__qlPosition : DEFAULT_POSITION;
  }

  async function setLauncherPosition(pos) {
    if (!POSITIONS.includes(pos)) return;
    const s = await getStates();
    s.__qlPosition = pos;
    await StorageManager.set(CONFIG.FEATURE_KEY, s);
  }

  return {
    getAll,
    getStates,
    setState,
    isOn,
    getLauncherPosition,
    setLauncherPosition,
    POSITIONS,
    DEFAULT_POSITION,
  };
})();
