# SF Power User Tool

A Manifest V3 browser extension for SAP SuccessFactors, providing keyboard shortcuts, quick links, a session keep-alive, and customizable command groups. Works on Chrome, Edge, Brave, Opera, Arc, and Firefox.

This is a full extension refactor of the original "SuccessFactors Plugin V5" Tampermonkey userscript by Mostafa Naghizadeh — rebuilt for store publishing, security, and cross-browser support.

## Features

- **Command shortcuts** — trigger SF actions (proxy, become-self, search, menu, home, admin, etc.) via keyboard or a searchable dialog.
- **Quick links** — a floating launcher for one-click navigation to frequently used pages.
- **Keep-alive** — prevents SF session timeouts using a service-worker alarm that survives SPA navigation and worker suspension.
- **Command groups** — organize commands into collapsible groups with drag-and-drop reordering and bulk moves.
- **Search-bar syntax** — type `/o <target>` or `/n <target>` directly in the SF search field.
- **Dark mode** toggle.
- **CSV import/export** of commands, plus JSON backup/restore in options.

## Requirements

- Node.js 20 or newer
- npm 10 or newer

## Install (development)

```bash
npm install
npm run build          # Chrome/Edge/Chromium -> dist/
npm run build:firefox  # Firefox -> dist-firefox/
```

Then load the unpacked extension:

- **Chrome/Edge/Brave/Opera/Arc:** open `chrome://extensions` (or `edge://extensions`), enable Developer mode, click "Load unpacked", select the `dist/` folder.
- **Firefox:** open `about:debugging#/runtime/this-firefox`, click "Load Temporary Add-on", select `dist-firefox/manifest.json`.

## Build a publishable package

```bash
npm run package          # -> artifacts/sf-power-user-tool-chrome.zip
npm run package:firefox  # -> artifacts/sf-power-user-tool-firefox.zip
```

The zip contains the **contents** of `dist/` (with `manifest.json` at the archive root), which is what stores expect.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Production build (Chromium) |
| `npm run build:firefox` | Production build (Firefox) |
| `npm run package` | Build + zip for Chrome Web Store / Edge |
| `npm run lint` | ESLint |
| `npm run format` | Prettier write |
| `npm run test` | Vitest unit tests |
| `npm run test:e2e` | Playwright smoke tests |
| `npm run typecheck` | TypeScript check (JS via JSDoc) |
| `npm run validate` | lint + typecheck + test + build |

## Project structure

```
src/
  manifest.json            MV3 manifest (strict CSP, scoped hosts)
  constants/               config + default commands/features
  utils/                   dom (safe builders), logger
  storage/                 storage-manager, migration
  services/                state, features, validation, adapter,
                           command, keep-alive, search-bar
  ui/                      dialog template, quick-launcher, ui-manager
  content/                 content-script + content.css
  background/              service-worker (alarms, commands routing)
  popup/                   toolbar popup
  options/                 settings page
public/icons/              16 / 32 / 48 / 128 px
scripts/                   package + edge publish helpers
tests/                     unit (vitest) + e2e (playwright)
docs/                      guides (see below)
```

## Documentation

- [docs/architecture.md](docs/architecture.md) — design, module map, data flow
- [docs/multi-browser.md](docs/multi-browser.md) — cross-browser build & compatibility
- [docs/publishing.md](docs/publishing.md) — Chrome Web Store & Edge submission
- [docs/security.md](docs/security.md) — security & SAP DOM maintenance
- [PRIVACY.md](PRIVACY.md) — privacy policy (required for store listing)
- [CHANGELOG.md](CHANGELOG.md)

## License

MIT — see [LICENSE](LICENSE).

The original userscript is credited to Mostafa Naghizadeh. This extension is an independent, unaffiliated tool and is not endorsed by SAP. "SAP" and "SuccessFactors" are trademarks of SAP SE.
