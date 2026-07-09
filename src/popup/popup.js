import browser from 'webextension-polyfill';
import { CONFIG, MSG, SF_HOST_PATTERNS } from '../constants/config.js';

const $ = (sel) => document.querySelector(sel);
const status = $("[data-role='status']");
const openBtn = $("[data-action='open']");

function isSF(url) {
  try {
    return SF_HOST_PATTERNS.some((re) => re.test(new URL(url).hostname));
  } catch {
    return false;
  }
}

async function activeTab() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function init() {
  const tab = await activeTab();
  const onSF = tab && isSF(tab.url);

  if (onSF) {
    status.textContent = '● Connected to SuccessFactors';
    status.className = 'pu-status ok';
    openBtn.disabled = false;
  } else {
    status.textContent = 'Open a SuccessFactors tab to use the tool.';
    status.className = 'pu-status warn';
  }

  // Reflect stored feature states.
  const states = (await browser.storage.local.get(CONFIG.FEATURE_KEY))[CONFIG.FEATURE_KEY] || {};
  document.querySelectorAll('[data-feature]').forEach((cb) => {
    cb.checked = !!states[cb.dataset.feature];
    cb.addEventListener('change', () => onFeatureToggle(cb.dataset.feature, cb.checked, tab, onSF));
  });

  openBtn.addEventListener('click', async () => {
    if (!onSF) return;
    await browser.tabs.sendMessage(tab.id, { type: MSG.TOGGLE_DIALOG }).catch(() => {});
    window.close();
  });

  $("[data-action='options']").addEventListener('click', () => {
    browser.runtime.openOptionsPage();
    window.close();
  });
}

async function onFeatureToggle(feature, value, tab, onSF) {
  const states = (await browser.storage.local.get(CONFIG.FEATURE_KEY))[CONFIG.FEATURE_KEY] || {};
  states[feature] = value;
  await browser.storage.local.set({ [CONFIG.FEATURE_KEY]: states });

  if (feature === 'keepalive') {
    await browser.runtime.sendMessage({ type: MSG.TOGGLE_FEATURE, feature, value }).catch(() => {});
  }
  // Ask the content script to reflect the change live, if a SF tab is open.
  if (onSF && tab?.id) {
    const key = feature === 'quicklauncher' ? null : feature;
    if (key) browser.tabs.sendMessage(tab.id, { type: MSG.RUN_COMMAND, key }).catch(() => {});
  }
}

init();
