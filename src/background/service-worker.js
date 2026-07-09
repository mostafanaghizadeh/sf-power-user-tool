import browser from 'webextension-polyfill';
import { CONFIG, MSG } from '../constants/config.js';

/**
 * Background service worker (MV3)
 * -------------------------------
 * Responsibilities:
 *   1. Own the keep-alive TIMER via chrome.alarms (survives worker suspension
 *      and SF SPA navigations — a page setInterval cannot).
 *   2. Route toolbar keyboard commands (chrome.commands) to the active SF tab.
 *   3. Broadcast alarm ticks to SF tabs so the content script pokes the session.
 *
 * The worker is event-driven and may be torn down between events; it holds no
 * long-lived in-memory state. Everything durable lives in chrome.storage.
 */

// ── Feature toggles from content/popup ─────────────────────
browser.runtime.onMessage.addListener(async (msg) => {
  if (msg?.type === MSG.TOGGLE_FEATURE && msg.feature === 'keepalive') {
    if (msg.value) {
      await browser.alarms.create(CONFIG.KEEP_ALIVE_ALARM, {
        periodInMinutes: CONFIG.KEEP_ALIVE_PERIOD_MIN,
      });
    } else {
      await browser.alarms.clear(CONFIG.KEEP_ALIVE_ALARM);
    }
    return { ok: true };
  }
  return undefined;
});

// ── Alarm → broadcast tick to all SF tabs ──────────────────
browser.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== CONFIG.KEEP_ALIVE_ALARM) return;
  const tabs = await browser.tabs.query({
    url: [
      'https://*.successfactors.com/*',
      'https://*.successfactors.eu/*',
      'https://*.sapsf.com/*',
      'https://*.sapsf.eu/*',
      'https://hcm*.hr.cloud.sap/*',
    ],
  });
  for (const tab of tabs) {
    browser.tabs.sendMessage(tab.id, { type: MSG.KEEP_ALIVE_TICK }).catch(() => {});
  }
});

// ── Toolbar keyboard commands → active tab ─────────────────
browser.commands?.onCommand.addListener(async (command) => {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  const map = {
    'toggle-dialog': { type: MSG.TOGGLE_DIALOG },
    'toggle-dark-mode': { type: MSG.RUN_COMMAND, key: 'darkmode' },
  };
  if (map[command]) browser.tabs.sendMessage(tab.id, map[command]).catch(() => {});
});

// ── Re-arm keep-alive alarm on worker startup, if enabled ──
async function rearm() {
  try {
    const stored = (await browser.storage.local.get(CONFIG.FEATURE_KEY))[CONFIG.FEATURE_KEY] || {};
    if (stored.keepalive) {
      await browser.alarms.create(CONFIG.KEEP_ALIVE_ALARM, {
        periodInMinutes: CONFIG.KEEP_ALIVE_PERIOD_MIN,
      });
    }
  } catch {
    /* ignore */
  }
}
browser.runtime.onStartup?.addListener(rearm);
browser.runtime.onInstalled.addListener((details) => {
  rearm();
  if (details.reason === 'install') {
    browser.runtime.openOptionsPage?.().catch(() => {});
  }
});
