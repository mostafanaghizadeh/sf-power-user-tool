# Multi-Browser Guide

SF Power User Tool ships from a single codebase to all major browsers. This guide explains what differs between them and how the build handles it.

## Compatibility matrix

| Browser | Engine | Manifest | Background | Package |
| --- | --- | --- | --- | --- |
| Chrome | Chromium | MV3 | service worker (module) | `dist/` |
| Edge | Chromium | MV3 | service worker (module) | `dist/` (same zip as Chrome) |
| Brave | Chromium | MV3 | service worker (module) | `dist/` |
| Opera | Chromium | MV3 | service worker (module) | `dist/` |
| Arc | Chromium | MV3 | service worker (module) | `dist/` |
| Firefox | Gecko | MV3 | `background.scripts` + gecko id | `dist-firefox/` |

All Chromium browsers consume the **same** Chrome package. Only Firefox needs a separate build.

## Why Firefox needs a different build

Two Gecko-specific differences are handled automatically by `vite.config.js` when `TARGET=firefox`:

1. **Background style.** Chromium MV3 uses `background.service_worker`. Firefox MV3 expects `background.scripts` (an event page). The build rewrites this field for the Firefox target.
2. **Extension id.** Firefox requires `browser_specific_settings.gecko.id`. The build injects it; Chromium ignores this field.

## The cross-browser API layer

All extension API calls go through **`webextension-polyfill`**, imported as `browser`. This gives a single promise-based API that behaves consistently across Chromium (`chrome.*` callback style) and Firefox (`browser.*` promise style).

Application code never calls `chrome.*` directly. The only module that touches storage is `src/storage/storage-manager.js`; everything else goes through it. This keeps browser-specific behavior in one place.

## SAP DOM differences

SuccessFactors serves slightly different DOM across data centers and release cycles. All SAP selectors live in a single `SEL` object inside `src/services/successfactors-adapter.js`, each with a **prioritized fallback list**. When SAP changes its markup, this one file is the only place to update — see [security.md](security.md#maintaining-sap-selectors).

## Building each target

```bash
npm run build          # Chromium -> dist/
npm run build:firefox  # Firefox  -> dist-firefox/

npm run package          # zip Chromium
npm run package:firefox  # zip Firefox
```

## Loading unpacked for testing

- **Chromium:** `chrome://extensions` → Developer mode → Load unpacked → `dist/`.
- **Firefox:** `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → `dist-firefox/manifest.json`.

## Known per-browser notes

- **Edge** applies its own additional review but accepts the Chromium package unchanged.
- **Firefox** temporary add-ons unload on restart; use AMO or `web-ext` for persistent installs.
- **Safari** is not targeted; it requires Xcode conversion and a separate Apple developer flow. Not in scope for this release.
