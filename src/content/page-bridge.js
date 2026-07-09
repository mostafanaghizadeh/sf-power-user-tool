/**
 * page-bridge.js  (runs in the PAGE world, injected by the content script)
 * -----------------------------------------------------------------------
 * MV3 content scripts run in an isolated world and cannot see the page's
 * `window.pageHeaderJsonData`. This tiny bridge runs in the page world, copies
 * ONLY a fixed whitelist of non-sensitive fields onto `window.__sfSafeHeader`.
 * The content script then reads that.
 *
 * It reads NO user data: userInfo, proxyBean, names, ids, tokens, photos are
 * never touched. The whitelist here must mirror PageContextService.
 *
 * This file is injected as a web-accessible resource via a <script src>, so it
 * complies with the extension CSP (no inline script, no eval).
 */
(function () {
  'use strict';
  try {
    var src = window.pageHeaderJsonData;
    if (!src || typeof src !== 'object') return;

    var SAFE = ['baseUrl', 'companyId', 'companyName', 'uiVersion', 'fioriEnabled'];
    var SAFE_SETTINGS = ['releaseVersionNumber'];
    var SAFE_PAGEINFO = ['moduleId', 'pageId', 'pageQualifier', 'achComponent'];

    var out = {};
    for (var i = 0; i < SAFE.length; i++) if (SAFE[i] in src) out[SAFE[i]] = src[SAFE[i]];
    if (src.settings) {
      out.settings = {};
      for (var s = 0; s < SAFE_SETTINGS.length; s++)
        if (SAFE_SETTINGS[s] in src.settings) out.settings[SAFE_SETTINGS[s]] = src.settings[SAFE_SETTINGS[s]];
    }
    if (src.pageInfo) {
      out.pageInfo = {};
      for (var p = 0; p < SAFE_PAGEINFO.length; p++)
        if (SAFE_PAGEINFO[p] in src.pageInfo) out.pageInfo[SAFE_PAGEINFO[p]] = src.pageInfo[SAFE_PAGEINFO[p]];
    }
    window.__sfSafeHeader = out;
  } catch (e) {
    /* silent — never break the SF page */
  }
})();
