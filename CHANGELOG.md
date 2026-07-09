# Changelog

All notable changes to this project are documented here. Format based on Keep a Changelog; versioning is semantic.

## [6.2.2] — 2026-07-09

### Removed
- Removed the "Share anonymous usage counts" (analytics opt-in) checkbox from the options page and the `analyticsOptIn` setting. The extension collects no analytics or telemetry of any kind. The privacy policy (bundled page and `PRIVACY.md`) was simplified to state this plainly, matching the store privacy declaration.

## [6.2.1] — 2026-07-09

### Removed
- Removed the "Install tenant modules" quick-add button. It depended on the tenant module list being present in `window.pageHeaderJsonData` at read time, which was not reliably available, so it consistently reported "page context unavailable." The related `readModules` helper and the module-copy in the page bridge were removed as dead code. Environment detection (which uses the page header's release version) and "Add current page" are unaffected.

## [6.2.0] — 2026-07-09

Enterprise modules 1, 2, 3, and 11 from the V6 proposal, built on the existing architecture with no change to permissions and full backward compatibility.

### Added
- **Module 1 — Environment Intelligence.** Detects PRODUCTION / PREVIEW / TEST / SALES DEMO / SANDBOX from the SuccessFactors release version string (authoritative — e.g. an `…SD…` suffix means Sales Demo) with a hostname fallback per SAP note 2089448. Shows a colored banner in the dialog (with a "changes affect live data" warning in production) and an environment pill on the Quick Links button. Admins can manually tag a tenant as TEST/SANDBOX (stored locally per hostname) since SAP does not encode those in the host.
- **Module 2 — Command Packs / tenant modules.** "Install tenant modules" reads the tenant's own enabled module list from `window.pageHeaderJsonData` and adds them as commands, de-duplicated by path. Session tokens (`_s.crb`, `bplte_company`) are stripped before storing; functional query params are preserved; external URLs are skipped.
- **Module 3 — Add current page.** One click captures the current page (path + title/module) as a command in a "Captured" group, with an auto-generated key.
- **Module 11 — Quick Launcher 2.0.** Favorites (pin with a star), Recently used (last 20), Frequently used (by count), and instant fuzzy search — all layered onto the existing lazy-build launcher so performance is unchanged.

### Security
- New `PageContextService` reads a strict whitelist of **non-sensitive** header fields only (`baseUrl`, `companyId`, `companyName`, `uiVersion`, `fioriEnabled`, release version, page identifiers). It never reads `userInfo`, `proxyBean`, names, person/user IDs, tokens, or photos, and never persists what it reads. Verified by unit tests against a real header payload.
- A page-world bridge (`src/content/page-bridge.js`, injected as a CSP-safe web-accessible `<script src>`) copies only the whitelisted fields into the isolated content-script world. No new permissions were added.

### Compatibility
- Existing commands, groups, shortcuts, features, CSV import/export, and the Import Actions tab are unchanged. New storage keys (`sf_env_overrides_v1`, `sf_usage_v1`) are additive.

## [6.1.2] — 2026-07-09

### Fixed
- **Completed the SuccessFactors domain whitelist** to cover every data center listed in SAP note 2089448. Previously the extension did not activate on the China (Shanghai) data center. Added `*.sapsf.cn` and `*.hr.sapcloud.cn`; the full set is now `*.successfactors.com`, `*.successfactors.eu`, `*.sapsf.com`, `*.sapsf.eu`, `*.sapsf.cn`, `*.hr.cloud.sap`, `*.hr.sapcloud.cn`. Applied consistently across `content_scripts`, `host_permissions`, `web_accessible_resources`, the runtime host guard, the privacy policy, and the store-listing justification.

## [6.1.1] — 2026-07-09

### Performance
- **Fixed high CPU/memory usage and flickering in the Quick Links menu.** The page MutationObserver was calling a full teardown-and-rebuild of the launcher menu on every batch of SuccessFactors DOM mutations (which fire continuously in the SPA). The launcher now:
  - builds its menu **lazily, only when opened**, and **only when the underlying command data actually changed** (tracked by a cheap signature), reusing the existing DOM otherwise;
  - swaps the DOM in a single operation via a document fragment instead of clearing and re-appending node by node.
- **Made the MutationObserver far cheaper.** Its callback now bails immediately unless the search field is genuinely unbound or the shell button is missing, is debounced to 500 ms, hard-throttled to at most once every 2 s, and disconnects while the tab is hidden. The Quick Launcher is no longer refreshed from the observer at all.

## [6.1.0] — 2026-07-09

### Added
- **Import Actions tab** in the command palette dialog: reads the SuccessFactors "Actions Search" list live (`POST /downloadfile`), lets you filter by module, select rows, and import them as commands. Runs inside the palette, not the extension settings.
  - Suggested keys are always at least 3 characters and de-duplicated against existing commands, reserved system keys, and other rows in the same batch. Invalid/colliding keys are flagged and block import until fixed.
  - Shortcuts can be auto-generated (avoiding duplicates) or **recorded** per row with a record button.
  - Export-selected-as-CSV produces a plugin-compatible file.
- **Quick Links position** setting (Features tab): pin the launcher to any screen corner (top-left, top-right, bottom-left, bottom-right). The menu opens away from the chosen edge. Persisted across sessions.
- Bundled, offline **privacy policy page** (`src/options/privacy.html`); the options link now opens it via `runtime.getURL` instead of an external placeholder URL.

### Fixed
- **Proxy / Alt+P not working.** Two causes:
  - The proxy menu item lives inside a closed profile dropdown, so the refactor's visibility filter rejected it. Lookup now finds hidden menu items and, if absent, opens the profile menu first and retries.
  - Keyboard matching used `e.key`, which yields symbols under Alt on non-US layouts (e.g. German). Both the runtime matcher and the shortcut recorder now derive the base key from `e.code` (`KeyP` → `p`) for letters/digits, falling back to `e.key` for F-keys etc.

### Tests
- Added unit tests for the import-suggestion util (key length/uniqueness, shortcut generation, quote-aware CSV) and for layout-independent shortcut matching.

## [6.0.0] — 2026-07-09

Full rewrite of the "SuccessFactors Plugin V5" Tampermonkey userscript into a Manifest V3 browser extension for Chrome, Edge, and other Chromium browsers, plus Firefox.

### Added
- Manifest V3 extension packaging with Vite + @crxjs/vite-plugin.
- Cross-browser support via webextension-polyfill; separate Firefox build target.
- Toolbar popup and dedicated options page (settings, command summary, JSON backup/restore).
- Service-worker keep-alive using `chrome.alarms`.
- One-time migration that lifts legacy userscript `localStorage` data into `chrome.storage.local`.
- Unit tests (Vitest) and end-to-end smoke tests (Playwright).
- CI/CD workflow: lint, test, build (Chromium + Firefox), GitHub release, and store publishing.
- Documentation set: architecture, multi-browser, publishing, security, privacy policy, and store listing copy.

### Changed
- Storage moved from page `localStorage` to async `chrome.storage.local`, shared across all extension contexts.
- SAP DOM selectors centralized in a single adapter with prioritized fallbacks.
- All user-supplied data now rendered with safe DOM builders instead of `innerHTML`.
- Strict extension CSP; minimal, scoped permissions for store compliance.

### Fixed
- Shortcut collision: `cod` and dark mode were both bound to Alt+D. Now `cod` → Alt+O and dark mode → Alt+Shift+D.
- Keep-alive no longer dies on SuccessFactors single-page navigation (previously used `setInterval`).

### Security
- Removed all `innerHTML` usage that included user data (XSS hardening).
- No remotely-hosted code; everything is bundled.
- Host access restricted to SuccessFactors domains.

### Credits
- Original userscript by Mostafa Naghizadeh. This extension is independent and unaffiliated with SAP.
