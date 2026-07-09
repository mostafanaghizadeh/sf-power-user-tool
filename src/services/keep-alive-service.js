import browser from 'webextension-polyfill';
import { MSG } from '../constants/config.js';
import { FeatureStateService } from './feature-state-service.js';
import { SuccessFactorsAdapter } from './successfactors-adapter.js';

/**
 * KeepAliveService (content-script side)
 * --------------------------------------
 * Responsibility : keep the SAP session alive. The TIMER lives in the service
 *                  worker (chrome.alarms) — see background/service-worker.js —
 *                  because a page-side setInterval dies on every SF navigation.
 *                  This side merely: (a) persists the on/off flag, (b) receives
 *                  KEEP_ALIVE_TICK messages and pokes the SF session, (c) shows
 *                  a toast + badge.
 * Public API     : toggle, isActive, handleTick
 * Dependencies   : FeatureStateService, SuccessFactorsAdapter, runtime messaging
 * Browser APIs   : chrome.runtime (messaging), chrome.alarms (via worker)
 *
 * SECURITY / CORRECTNESS: keep-alive only extends the session while a real SF
 * tab is open and only by invoking SF's own documented reset hook — it never
 * fabricates auth traffic. When no tab is open, alarms simply no-op.
 */
export const KeepAliveService = (() => {
  let active = false;
  let onStateChange = () => {};

  const isActive = () => active;

  function setStateListener(fn) {
    onStateChange = fn || (() => {});
  }

  async function toggle() {
    active = !active;
    await FeatureStateService.setState('keepalive', active);
    // Ask the worker to start/stop the alarm.
    try {
      await browser.runtime.sendMessage({
        type: MSG.TOGGLE_FEATURE,
        feature: 'keepalive',
        value: active,
      });
    } catch {
      /* worker may be asleep; it re-reads state on wake */
    }
    notify(active);
    onStateChange(active);
    return active;
  }

  /** Called by the content script when the worker broadcasts a tick. */
  function handleTick() {
    if (!active) return;
    SuccessFactorsAdapter.pokeSession();
  }

  async function restore() {
    active = await FeatureStateService.isOn('keepalive');
    if (active) {
      try {
        await browser.runtime.sendMessage({ type: MSG.TOGGLE_FEATURE, feature: 'keepalive', value: true });
      } catch {
        /* ignore */
      }
    }
    return active;
  }

  function notify(on) {
    document.getElementById('sf-keepalive-toast')?.remove();
    const toast = document.createElement('div');
    toast.id = 'sf-keepalive-toast';
    toast.className = 'sf-toast';
    toast.style.background = on ? '#1a7f4b' : '#7f1a1a';
    const strong = document.createElement('strong');
    strong.textContent = `Keep Alive ${on ? 'Activated' : 'Deactivated'}`;
    const detail = document.createElement('span');
    detail.style.cssText = 'font-size:12px;opacity:.85;';
    detail.textContent = on
      ? 'Session will be kept alive automatically.'
      : 'Session timeout is now normal.';
    const icon = document.createElement('span');
    icon.style.fontSize = '18px';
    icon.textContent = on ? '🟢' : '🔴';
    const body = document.createElement('div');
    body.append(strong, document.createElement('br'), detail);
    toast.append(icon, body);
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 400);
    }, 4000);

    const badge = document.getElementById('sf-keepalive-badge');
    if (badge) badge.style.display = on ? 'inline-block' : 'none';
  }

  return { toggle, isActive, handleTick, restore, setStateListener };
})();
