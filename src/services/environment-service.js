import { PageContextService } from './page-context-service.js';
import { StorageManager } from '../storage/storage-manager.js';
import { CONFIG } from '../constants/config.js';

/**
 * EnvironmentService (Module 1 — Environment Intelligence)
 * --------------------------------------------------------
 * Classifies the current tenant as PROD / PREVIEW / TEST / DEMO using, in order
 * of reliability:
 *   1. SuccessFactors release version string (settings.releaseVersionNumber),
 *      whose suffix is authoritative: "…SD…" = Sales Demo, "…P…"/"preview" host
 *      = Preview. This is the strongest signal and comes from the safe header.
 *   2. Hostname patterns (per SAP note 2089448): "-preview"/"preview" = PREVIEW,
 *      "-sales"/"salesdemo"/"pmsalesdemo" = DEMO.
 *   3. Otherwise a known production DC host = PROD.
 *
 * A per-tenant MANUAL OVERRIDE (stored locally, keyed by hostname) lets admins
 * tag a box as TEST/QA/SANDBOX — SAP does not encode those in the host, so the
 * user is the source of truth for them.
 *
 * Reads only non-sensitive fields (via PageContextService). Stores only the
 * override map (hostname → {code,label}). No user data.
 */
export const EnvironmentService = (() => {
  const ENVS = {
    PROD: { code: 'PROD', label: 'PRODUCTION', color: '#1a7f4b', icon: '🟢', destructive: true },
    PREVIEW: { code: 'PREVIEW', label: 'PREVIEW', color: '#c98a00', icon: '🟡', destructive: false },
    TEST: { code: 'TEST', label: 'TEST', color: '#0a6ed1', icon: '🔵', destructive: false },
    DEMO: { code: 'DEMO', label: 'SALES DEMO', color: '#7a5cff', icon: '🟣', destructive: false },
    SANDBOX: { code: 'SANDBOX', label: 'SANDBOX', color: '#bb0000', icon: '🔴', destructive: false },
    UNKNOWN: { code: 'UNKNOWN', label: 'SUCCESSFACTORS', color: '#354a5e', icon: '⚪', destructive: false },
  };

  function _fromRelease(rel) {
    if (!rel || typeof rel !== 'string') return null;
    // e.g. "2606SD.2026…" (Sales Demo), "2605P…" (preview), "2605.…" (prod)
    const head = rel.split('.')[0].toUpperCase();
    if (head.includes('SD')) return 'DEMO';
    if (/\dP$/.test(head) || head.endsWith('PREV')) return 'PREVIEW';
    return null; // release alone can't prove PROD; fall through to host
  }

  function _fromHost(host) {
    const h = (host || '').toLowerCase();
    if (/salesdemo|pmsalesdemo|-sales\.|hcm\d*sales/.test(h)) return 'DEMO';
    if (/preview/.test(h)) return 'PREVIEW';
    return 'PROD'; // known SF DC host, nothing else matched
  }

  /** Auto-detected environment (no override applied). */
  function detect() {
    let ctx = null;
    try {
      ctx = PageContextService.readPageHeader();
    } catch {
      ctx = null;
    }
    const rel = ctx?.settings?.releaseVersionNumber;
    const host = typeof location !== 'undefined' ? location.hostname : '';
    const code = _fromRelease(rel) || _fromHost(host);
    const base = ENVS[code] || ENVS.UNKNOWN;
    return {
      ...base,
      host,
      companyId: ctx?.companyId || null,
      companyName: ctx?.companyName || null,
      release: rel || null,
    };
  }

  async function _overrides() {
    return (await StorageManager.get(CONFIG.ENV_OVERRIDE_KEY)) || {};
  }

  /** Environment with any per-tenant manual override applied. */
  async function get() {
    const auto = detect();
    const ov = (await _overrides())[auto.host];
    if (ov && ENVS[ov.code]) {
      return { ...auto, ...ENVS[ov.code], overridden: true };
    }
    return auto;
  }

  async function setOverride(code) {
    if (!ENVS[code]) return;
    const host = location.hostname;
    const all = await _overrides();
    all[host] = { code };
    await StorageManager.set(CONFIG.ENV_OVERRIDE_KEY, all);
  }

  async function clearOverride() {
    const host = location.hostname;
    const all = await _overrides();
    delete all[host];
    await StorageManager.set(CONFIG.ENV_OVERRIDE_KEY, all);
  }

  return { detect, get, setOverride, clearOverride, ENVS };
})();
