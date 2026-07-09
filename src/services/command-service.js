import { StateService } from './state-service.js';
import { SuccessFactorsAdapter } from './successfactors-adapter.js';

/**
 * CommandService
 * --------------
 * Responsibility : translate keyboard events / search-bar text / feature calls
 *                  into concrete actions (navigation or SF adapter functions).
 * Public API     : run, findMatchingCommand, executeFromSearchBar, toggleDarkMode,
 *                  registerHandlers
 * Dependencies   : StateService, SuccessFactorsAdapter, callbacks injected by UI
 *
 * Handlers that need UI feedback (toasts, keep-alive) are injected via
 * registerHandlers so this module has no hard dependency on the UI layer.
 */
export const CommandService = (() => {
  let injected = {
    toggleKeepAlive: () => {},
    showToast: () => {},
  };

  function registerHandlers(handlers) {
    injected = { ...injected, ...handlers };
  }

  function handlers() {
    return {
      openProxy: () => SuccessFactorsAdapter.openProxy(),
      becomeSelf: () => {
        injected.showToast('Proxy Deactivated: Wait to become Self');
        SuccessFactorsAdapter.becomeSelf();
      },
      focusSearch: () => SuccessFactorsAdapter.focusSearch(),
      openShellMenu: () => SuccessFactorsAdapter.openShellMenu(),
      toggleKeepAlive: () => injected.toggleKeepAlive(),
      toggleDarkMode: () => toggleDarkMode(),
    };
  }

  function run(cmd) {
    if (!cmd) return;
    const h = handlers();
    if (cmd.function && h[cmd.function]) {
      h[cmd.function]();
      return;
    }
    if (cmd.path && cmd.path.startsWith('/')) {
      window.location.href = SuccessFactorsAdapter.navUrl(cmd.path);
    }
  }

  const normalizeShortcut = (s) => (s || '').toLowerCase().replace(/\s+/g, '');

  /**
   * Derive the base (non-modifier) key in a layout-independent way.
   * With Alt held, `e.key` on many layouts (e.g. German) yields a symbol or dead
   * key instead of the letter, which broke Alt+P etc. `e.code` is the physical
   * key ("KeyP", "Digit4") and is stable across layouts, so we prefer it for
   * A–Z / 0–9 and fall back to `e.key` for everything else (F-keys, arrows…).
   */
  function baseKeyFromEvent(e) {
    const code = e.code || '';
    if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
    if (/^Digit[0-9]$/.test(code)) return code.slice(5);
    if (/^Numpad[0-9]$/.test(code)) return code.slice(6);
    return (e.key || '').toLowerCase();
  }

  function eventToShortcut(e) {
    const parts = [];
    if (e.ctrlKey) parts.push('ctrl');
    if (e.altKey) parts.push('alt');
    if (e.shiftKey) parts.push('shift');
    parts.push(baseKeyFromEvent(e));
    return parts.join('+');
  }

  function findMatchingCommand(e) {
    const pressed = eventToShortcut(e);
    return Object.values(StateService.getCommands()).find(
      (cmd) => cmd.shortcut && normalizeShortcut(cmd.shortcut) === pressed
    );
  }

  /** Parse "/o key", "/n key" or "key" typed into the SF search bar. */
  function executeFromSearchBar(input) {
    if (!input) return false;
    const normalized = input.trim().replace(/\s+/g, ' ');
    let action = '/n';
    let key;
    const parts = normalized.split(' ');
    if (parts.length === 2) {
      action = parts[0];
      key = parts[1];
    } else if (normalized.startsWith('/o')) {
      action = '/o';
      key = normalized.slice(2);
    } else if (normalized.startsWith('/n')) {
      action = '/n';
      key = normalized.slice(2);
    } else {
      key = normalized.replace('/', '');
    }
    const entry = StateService.getCommands()[key];
    if (!entry || !entry.path || !entry.path.startsWith('/')) return false;
    const finalUrl = SuccessFactorsAdapter.navUrl(entry.path);
    if (action === '/o') window.open(finalUrl, '_blank', 'noopener,noreferrer');
    else window.location.href = finalUrl;
    return true;
  }

  /** Toggle a full-page dark-mode style. Returns new on/off state. */
  function toggleDarkMode() {
    const id = 'sf-plugin-shell-darkMode';
    const existing = document.getElementById(id);
    if (existing) {
      existing.remove();
      return false;
    }
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      html { filter: invert(1) hue-rotate(180deg) !important; background: #111 !important; }
      img, video, picture, canvas, svg { filter: invert(1) hue-rotate(180deg) !important; }
      [style*="background-image"] { filter: invert(1) hue-rotate(180deg) !important; }`;
    document.documentElement.appendChild(style);
    return true;
  }

  return { run, findMatchingCommand, executeFromSearchBar, toggleDarkMode, registerHandlers };
})();
