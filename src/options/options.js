import browser from 'webextension-polyfill';
import { CONFIG } from '../constants/config.js';

/**
 * SettingsManager
 * ---------------
 * Responsibility : read/write the small settings object (cross-browser sync
 *                  opt-in). Kept separate from command state so it may live in
 *                  chrome.storage.sync when the user opts in.
 * Public API     : get, set
 */
export const SettingsManager = (() => {
  const DEFAULTS = { syncEnabled: false };
  async function get() {
    const stored = (await browser.storage.local.get(CONFIG.SETTINGS_KEY))[CONFIG.SETTINGS_KEY] || {};
    return { ...DEFAULTS, ...stored };
  }
  async function set(patch) {
    const next = { ...(await get()), ...patch };
    await browser.storage.local.set({ [CONFIG.SETTINGS_KEY]: next });
    return next;
  }
  return { get, set };
})();

async function init() {
  const manifest = browser.runtime.getManifest();
  document.querySelector("[data-role='version']").textContent = `v${manifest.version}`;
  document.querySelector("[data-role='privacy']").href = browser.runtime.getURL('src/options/privacy.html');

  // Settings checkboxes
  const settings = await SettingsManager.get();
  document.querySelectorAll('[data-setting]').forEach((cb) => {
    cb.checked = !!settings[cb.dataset.setting];
    cb.addEventListener('change', () => SettingsManager.set({ [cb.dataset.setting]: cb.checked }));
  });

  // Backup actions
  document.querySelector("[data-action='exportAll']").addEventListener('click', exportAll);
  document.querySelector("[data-action='importAll']").addEventListener('change', importAll);
  document.querySelector("[data-action='resetAll']").addEventListener('click', resetAll);

  // Full command manager: load the same UiManager used in-page.
  const mount = document.getElementById('sf-options-mount');
  mount.innerHTML =
    '<p style="font-size:13px;color:#6a6d70;">Open any SuccessFactors tab and press <b>Alt+Shift+P</b>, or use the toolbar popup, to manage commands with the full drag-and-drop editor. A read-only summary is shown below.</p>';
  renderSummary(mount);
}

async function renderSummary(mount) {
  const state = (await browser.storage.local.get(CONFIG.STATE_KEY))[CONFIG.STATE_KEY];
  if (!state?.commands) return;
  const table = document.createElement('table');
  table.style.cssText = 'width:100%;border-collapse:collapse;font-size:13px;margin-top:10px;';
  table.innerHTML =
    '<thead><tr><th style="text-align:left;padding:4px;border-bottom:2px solid #eee;">Group</th><th style="text-align:left;padding:4px;border-bottom:2px solid #eee;">Key</th><th style="text-align:left;padding:4px;border-bottom:2px solid #eee;">Label</th><th style="text-align:left;padding:4px;border-bottom:2px solid #eee;">Shortcut</th></tr></thead>';
  const tbody = document.createElement('tbody');
  Object.entries(state.commands).forEach(([k, v]) => {
    const tr = document.createElement('tr');
    [v.group || '', k, v.label || '', v.shortcut || ''].forEach((val) => {
      const td = document.createElement('td');
      td.style.cssText = 'padding:4px;border-bottom:1px solid #f0f0f0;';
      td.textContent = val; // textContent → XSS-safe
      tr.append(td);
    });
    tbody.append(tr);
  });
  table.append(tbody);
  mount.append(table);
}

async function exportAll() {
  const all = await browser.storage.local.get(null);
  const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'sf-power-user-tool-backup.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function importAll(e) {
  const file = e.target.files[0];
  if (!file) return;
  const r = new FileReader();
  r.onload = async (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      await browser.storage.local.set(data);
      alert('Import complete. Reload your SuccessFactors tabs to apply.');
      location.reload();
    } catch {
      alert('Invalid backup file.');
    }
    e.target.value = '';
  };
  r.readAsText(file);
}

async function resetAll() {
  if (!confirm('Erase all commands, groups and settings? This cannot be undone.')) return;
  await browser.storage.local.clear();
  alert('All data cleared.');
  location.reload();
}

init();
