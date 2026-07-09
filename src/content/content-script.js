import browser from 'webextension-polyfill';
import { MSG } from '../constants/config.js';
import { StateService } from '../services/state-service.js';
import { FeatureStateService } from '../services/feature-state-service.js';
import { CommandService } from '../services/command-service.js';
import { KeepAliveService } from '../services/keep-alive-service.js';
import { SearchBarHandler } from '../services/search-bar-handler.js';
import { SuccessFactorsAdapter } from '../services/successfactors-adapter.js';
import { UsageService } from '../services/usage-service.js';
import { QuickLauncher } from '../ui/quick-launcher.js';
import { UiManager } from '../ui/ui-manager.js';
import { MigrationService } from '../storage/migration.js';
import { debounce } from '../utils/dom.js';
import { log } from '../utils/logger.js';

/**
 * Inject the page-world bridge that exposes ONLY whitelisted, non-sensitive
 * header fields (and the tenant module nav list) to this isolated content
 * script. Loaded as a web-accessible <script src> so it's CSP-safe (no inline).
 */
function injectPageBridge() {
  try {
    const s = document.createElement('script');
    s.src = browser.runtime.getURL('src/content/page-bridge.js');
    s.onload = () => s.remove();
    (document.head || document.documentElement).appendChild(s);
  } catch {
    /* ignore — env detection falls back to hostname */
  }
}

(async function boot() {
  if (!SuccessFactorsAdapter.isSuccessFactors()) return;
  log('booting on', location.hostname);

  injectPageBridge();
  await MigrationService.run(); // lift legacy userscript data (once)
  await StateService.load();
  await UsageService.load();

  // Wire cross-module callbacks (avoids hard UI dependency in services).
  CommandService.registerHandlers({
    toggleKeepAlive: () => KeepAliveService.toggle(),
    showToast: (m) => UiManager.showToast(m),
  });
  KeepAliveService.setStateListener((on) => UiManager.updateToggleState('keepalive', on));

  // Build UI.
  await UiManager.init();
  const launcherPos = await FeatureStateService.getLauncherPosition();
  QuickLauncher.init(launcherPos);
  QuickLauncher.onManageClick(() => UiManager.toggle());

  // Restore persisted feature states.
  await KeepAliveService.restore();
  if (await FeatureStateService.isOn('darkmode')) CommandService.toggleDarkMode();
  const states = await FeatureStateService.getStates();
  if (states.quicklauncher === false) QuickLauncher.setVisible(false);

  // Global keyboard shortcuts.
  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.shiftKey && (e.key === 'P' || e.key === 'p')) {
      UiManager.toggle();
      e.preventDefault();
      return;
    }
    if (e.key === 'Escape') UiManager.close();
    const cmd = CommandService.findMatchingCommand(e);
    if (cmd) {
      e.preventDefault();
      e.stopPropagation();
      CommandService.run(cmd);
    }
  });

  // Re-attach to SF's dynamically rendered shell as it mutates.
  //
  // SuccessFactors is a heavy SPA that mutates the DOM continuously. Observing
  // the whole document subtree and doing work on every mutation is a serious
  // performance drain, so this is deliberately conservative:
  //   - the callback bails immediately unless the search field is actually
  //     unbound or the shell button is actually missing (cheap checks);
  //   - work is debounced AND hard-throttled so it can run at most occasionally;
  //   - the Quick Launcher is NOT refreshed here (it rebuilds lazily on open),
  //     so SF's churn no longer touches the launcher at all.
  let lastReattach = 0;
  const MIN_REATTACH_GAP = 2000; // ms — never do reattach work more often than this

  function needsReattach() {
    // Cheap check first: shell button missing?
    if (!document.getElementById('sf-plugin-shell-headerItem-button')) return true;
    // Costlier check (shadow-DOM traversal): search field lost its binding?
    const input = SuccessFactorsAdapter.getSearchInput?.();
    if (input && !input.dataset.sfBound) return true;
    return false;
  }

  const reattach = debounce(() => {
    const now = Date.now();
    if (now - lastReattach < MIN_REATTACH_GAP) return;
    if (!needsReattach()) return;
    lastReattach = now;
    SearchBarHandler.attach();
    UiManager.addShellItemButton();
  }, 500);

  const observer = new MutationObserver(reattach);
  // Watch only direct childList changes, not the entire deep subtree, and only
  // while the tab is visible. This drastically cuts the mutation volume.
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) observer.disconnect();
    else observer.observe(document.body, { childList: true, subtree: true });
  });
  reattach();

  // Keep StateService in sync when popup/options change data.
  StorageSync();

  // Messages from popup / worker.
  browser.runtime.onMessage.addListener((msg) => {
    if (!msg || !msg.type) return;
    switch (msg.type) {
      case MSG.TOGGLE_DIALOG:
        UiManager.toggle();
        break;
      case MSG.RUN_COMMAND: {
        const cmd = StateService.getCommands()[msg.key];
        if (cmd) CommandService.run(cmd);
        break;
      }
      case MSG.KEEP_ALIVE_TICK:
        KeepAliveService.handleTick();
        break;
      case MSG.PING:
        return Promise.resolve({ ok: true });
      default:
        break;
    }
  });

  async function StorageSync() {
    const { StorageManager } = await import('../storage/storage-manager.js');
    const { CONFIG } = await import('../constants/config.js');
    StorageManager.onChanged(CONFIG.STATE_KEY, async () => {
      await StateService.load();
      QuickLauncher.refresh();
    });
  }
})();
