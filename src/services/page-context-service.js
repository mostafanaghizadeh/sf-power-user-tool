import { warn } from '../utils/logger.js';

/**
 * PageContextService
 * ------------------
 * Reads a SMALL, EXPLICIT WHITELIST of non-sensitive fields from SuccessFactors'
 * global `window.pageHeaderJsonData` object, plus safe actions from
 * `window.BizXHeaderController`.
 *
 * SECURITY CONTRACT (this is the whole point of the module):
 *   - It NEVER reads `userInfo`, `proxyBean`, names, personId, userId, tokens,
 *     photos, or anything that identifies a person.
 *   - It only ever touches the fields in SAFE_FIELDS below.
 *   - It NEVER stores anything it reads; callers decide what (if anything) to
 *     persist, and command URLs are token-stripped before persistence.
 *   - Everything is wrapped in try/catch and returns null/empty on absence, so
 *     it degrades silently on SF UI changes and never throws into the page.
 *
 * Because `window` is only reachable from the page's own JS context (not the
 * content-script's isolated world in some browsers), reads go through a tiny
 * bridge that the content script injects — see readPageHeader().
 */
export const PageContextService = (() => {
  // The ONLY fields we will ever look at. Anything not here is off-limits.
  const SAFE_FIELDS = Object.freeze([
    'baseUrl',
    'companyId',
    'companyName',
    'uiVersion',
    'fioriEnabled',
  ]);
  const SAFE_SETTINGS = Object.freeze(['releaseVersionNumber']);
  const SAFE_PAGEINFO = Object.freeze(['moduleId', 'pageId', 'pageQualifier', 'achComponent']);

  /**
   * Read the whitelisted header context. Returns a plain object with only safe
   * fields, or null if the global is not present.
   *
   * In an isolated content-script world `window.pageHeaderJsonData` may be
   * undefined even though the page has it. The content script therefore injects
   * a page-world bridge (injectBridge) that copies ONLY the whitelisted fields
   * onto a namespaced global we can read. We try the direct read first (userscript
   * / non-isolated), then the bridged copy.
   */
  function readPageHeader() {
    const src = _rawHeader();
    if (!src) return null;
    const out = {};
    for (const f of SAFE_FIELDS) if (f in src) out[f] = src[f];
    if (src.settings && typeof src.settings === 'object') {
      out.settings = {};
      for (const f of SAFE_SETTINGS) if (f in src.settings) out.settings[f] = src.settings[f];
    }
    if (src.pageInfo && typeof src.pageInfo === 'object') {
      out.pageInfo = {};
      for (const f of SAFE_PAGEINFO) if (f in src.pageInfo) out.pageInfo[f] = src.pageInfo[f];
    }
    return out;
  }

  function _rawHeader() {
    try {
      // Direct (userscript / non-isolated worlds)
      if (typeof window !== 'undefined' && window.pageHeaderJsonData) return window.pageHeaderJsonData;
      // Bridged copy injected by the content script
      if (typeof window !== 'undefined' && window.__sfSafeHeader) return window.__sfSafeHeader;
    } catch (e) {
      warn('pageHeaderJsonData read failed', e);
    }
    return null;
  }

  const STRIP = new Set(['_s.crb', 'bplte_company']);
  /** Keep only in-app paths; strip session/company tokens; preserve functional params. */
  function _cleanPath(url) {
    if (typeof url !== 'string' || !url.startsWith('/')) return null;
    const [path, query = ''] = url.split('?');
    if (!query) return path;
    const kept = query
      .split('&')
      .filter(Boolean)
      .filter((pair) => !STRIP.has(pair.split('=')[0]));
    return kept.length ? `${path}?${kept.join('&')}` : path;
  }

  /** Safe action passthrough to SF's own controller — no data read. */
  function proxyNow() {
    try {
      window.BizXHeaderController?.proxyNow?.();
      return true;
    } catch {
      return false;
    }
  }

  return { readPageHeader, SAFE_FIELDS, _cleanPath };
})();
