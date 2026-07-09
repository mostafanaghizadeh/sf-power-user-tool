import { findDeep, triggerClick } from '../utils/dom.js';
import { SF_HOST_PATTERNS } from '../constants/config.js';
import { warn } from '../utils/logger.js';

/**
 * SuccessFactorsAdapter
 * ---------------------
 * Responsibility : the SINGLE place that knows SAP SuccessFactors DOM specifics
 *                  (UI5 stable refs, shellbar, search field, proxy menu items,
 *                  nav URL building). When SAP changes its UI, only this file
 *                  needs updating.
 * Public API     : isSuccessFactors, navUrl, openProxy, becomeSelf, focusSearch,
 *                  openShellMenu, getSearchInput, getShellbarController
 * Browser APIs   : window.location, DOM
 *
 * SELECTOR STRATEGY (future-proofing):
 *   Each accessor uses a *prioritised list* of selectors. It tries the most
 *   stable (data-ui5-stable / ARIA) first and falls back to looser ones. If all
 *   fail it logs (dev-only) and returns null instead of throwing — the rest of
 *   the extension degrades gracefully rather than breaking the SF page.
 */
export const SuccessFactorsAdapter = (() => {
  // Prioritised selector lists — edit HERE when SAP changes the DOM.
  const SEL = {
    proxyNow: ['[data-ui5-stable="profile-item-PROXY_NOW"]', '[data-help-id*="PROXY_NOW"]'],
    becomeSelf: ['[data-ui5-stable="profile-item-PROXY_BECOME_SELF"]', '[data-help-id*="BECOME_SELF"]'],
    // The avatar/profile button that opens the dropdown holding the proxy items.
    profileButton: [
      '[data-ui5-stable="shellbar-profile"]',
      'ui5-shellbar [slot="profile"]',
      '[data-help-id*="ProfileButton"]',
      'button[title*="Profile"]',
    ],
    searchInput: ['xweb-shellbar-search-input', '[data-ui5-stable="shellbar-search"]'],
    menuButton: ['button[data-ui5-stable="menu"]', '[data-ui5-stable="shellbar-menu"]'],
  };

  function isSuccessFactors() {
    try {
      return SF_HOST_PATTERNS.some((re) => re.test(location.hostname));
    } catch {
      return false;
    }
  }

  /** Build an absolute nav URL, substituting the SF ajax security key if present. */
  function navUrl(path) {
    const sec = typeof window !== 'undefined' ? window.ajaxSecKey : undefined;
    return window.location.origin + String(path).replace('{{SEC}}', sec ?? '');
  }

  /** First element matching any selector, requiring visibility (for search/menu). */
  function firstVisible(selectors) {
    for (const sel of selectors) {
      const found = findDeep(sel).find((elm) => elm.offsetParent !== null || elm.getBoundingClientRect().width > 0);
      if (found) return found;
    }
    return null;
  }

  /** First element matching any selector, visibility NOT required (for menu items
   *  that live inside a closed popover — matches the original userscript behaviour). */
  function firstAny(selectors) {
    for (const sel of selectors) {
      const found = findDeep(sel)[0];
      if (found) return found;
    }
    return null;
  }

  /** Resolve the clickable node for a UI5 menu item (its inner <li>, else itself). */
  function menuItemNode(host) {
    return host?.shadowRoot?.querySelector('li') || host;
  }

  /**
   * Click a proxy menu item. The item lives inside the profile dropdown, which
   * may be closed, so:
   *   1. Try to find the item directly (works even when the popover is closed —
   *      UI5 keeps it in the DOM). This is what the original userscript relied on.
   *   2. If it isn't in the DOM yet, open the profile button first, then retry
   *      on the next frame.
   */
  function clickProxyItem(selectors, onFound) {
    let node = menuItemNode(firstAny(selectors));
    if (node) {
      onFound?.();
      triggerClick(node);
      return true;
    }
    // Not present — open the profile menu and retry shortly.
    const profile = firstVisible(SEL.profileButton) || firstAny(SEL.profileButton);
    if (profile) {
      triggerClick(menuItemNode(profile));
      let tries = 0;
      const retry = () => {
        node = menuItemNode(firstAny(selectors));
        if (node) {
          onFound?.();
          triggerClick(node);
        } else if (++tries < 20) {
          setTimeout(retry, 50);
        } else {
          warn('proxy item not found after opening profile menu');
        }
      };
      setTimeout(retry, 50);
      return true;
    }
    warn('proxy item and profile button both not found');
    return false;
  }

  function openProxy() {
    return clickProxyItem(SEL.proxyNow);
  }

  function becomeSelf() {
    return clickProxyItem(SEL.becomeSelf, () => {
      try {
        window.dispatchEvent(new CustomEvent('sf:become-self'));
      } catch {
        /* ignore */
      }
    });
  }

  function getSearchInput() {
    for (const sel of SEL.searchInput) {
      const el = findDeep(sel)
        .filter((e) => e.id === 'search' || sel !== 'xweb-shellbar-search-input')
        .find((e) => {
          const r = e.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
      const input = el?.shadowRoot?.querySelector('input') || (el?.tagName === 'INPUT' ? el : null);
      if (input) return input;
    }
    return null;
  }

  function focusSearch() {
    const input = getSearchInput();
    if (input) input.focus();
  }

  function openShellMenu() {
    const btn = firstVisible(SEL.menuButton) || firstAny(SEL.menuButton);
    if (btn) triggerClick(btn);
  }

  /** SAP's programmatic shellbar API, when present, for adding a header button. */
  function getShellbarController() {
    return typeof window !== 'undefined' ? window.BizXHeaderController : undefined;
  }

  /** Best-effort session keep-alive hook exposed by SF. */
  function pokeSession() {
    try {
      if (window.SFSessionTimeout?.reset) {
        window.SFSessionTimeout.reset();
        return true;
      }
    } catch {
      /* ignore */
    }
    return false;
  }

  /**
   * Fetch the SuccessFactors "Actions Search" export as CSV text, using the
   * page's own authenticated session. Mirrors the captured request:
   *   POST /downloadfile
   *   controllerName=actionExportController&encoding=UTF-8&locale=<locale>
   * Throws on non-OK or when an HTML login page is returned (stale session).
   */
  async function fetchActionsExport(locale = 'en') {
    const url = `${window.location.origin}/downloadfile`;
    const body = `controllerName=actionExportController&encoding=UTF-8&locale=${encodeURIComponent(locale)}`;
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} from /downloadfile`);
    const text = await res.text();
    if (/<html/i.test(text.slice(0, 200))) {
      throw new Error('Received an HTML page instead of CSV — the session may have expired.');
    }
    return text;
  }

  return {
    isSuccessFactors,
    navUrl,
    openProxy,
    becomeSelf,
    focusSearch,
    getSearchInput,
    openShellMenu,
    getShellbarController,
    pokeSession,
    fetchActionsExport,
    _SEL: SEL,
  };
})();
