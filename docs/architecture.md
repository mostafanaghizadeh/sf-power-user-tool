# Architecture

How SF Power User Tool is structured and why. The extension is a refactor of a ~1,900-line single-file Tampermonkey userscript into a modular, testable, store-compliant MV3 extension.

## Design goals

1. **Store-publishable** — strict CSP, no remote code, minimal scoped permissions.
2. **Secure** — no `innerHTML` with user data; all dynamic DOM built with safe helpers.
3. **Cross-browser** — one codebase for Chromium and Firefox.
4. **Maintainable** — service-layer separation, SAP DOM specifics isolated behind an adapter.
5. **Behavior-preserving** — same features and defaults as the original userscript, with bugs fixed.

## Runtime contexts

An MV3 extension runs code in several isolated contexts. This extension uses three:

- **Content script** (`src/content/content-script.js`) — injected into SuccessFactors pages. Owns the UI, reads/writes state, binds keyboard shortcuts, and interacts with the SF DOM via the adapter.
- **Service worker** (`src/background/service-worker.js`) — the background context. Owns the keep-alive `chrome.alarms` timer, broadcasts ticks to SF tabs, and routes `chrome.commands` keyboard events to the active tab. Survives SPA navigation and worker suspension.
- **Popup / Options** (`src/popup`, `src/options`) — the toolbar UI and settings page.

These communicate through `runtime.sendMessage` using channel names defined in `src/constants/config.js` (`MSG`).

## Layered module map

```
constants/       config, default commands & features (no logic)
    |
utils/           dom (esc/el/findDeep), logger        <- pure helpers
    |
storage/         storage-manager (only chrome.storage caller)
                 migration (one-time localStorage lift)
    |
services/        state-service          command CRUD + groups
                 feature-state-service  feature on/off
                 validation-service      pure validators (unit-tested)
                 successfactors-adapter  ALL SAP selectors here
                 command-service         run/parse commands
                 keep-alive-service      content-side keep-alive
                 search-bar-handler      SF search-field syntax
    |
ui/              dialog-template (trusted static shell)
                 quick-launcher, ui-manager (safe DOM builders)
    |
content/         content-script (boot + wiring)
background/       service-worker
popup/ options/   standalone pages
```

Dependencies point downward only. UI depends on services; services depend on storage and utils; nothing depends upward.

## Data flow: running a command

1. User presses a shortcut or clicks a command in the dialog.
2. `content-script` global keydown handler (or `ui-manager`) resolves the command via `command-service.findMatchingCommand`.
3. `command-service.run` executes the action. SF-specific actions (proxy, become-self, focus search, open menu) delegate to `successfactors-adapter`.
4. Toast/keep-alive callbacks are injected into `command-service` (dependency injection) so services stay decoupled from the UI.

## Data flow: keep-alive

1. User toggles keep-alive (popup, dialog, or `keepalive` command).
2. `keep-alive-service` (content side) requests the worker to arm a `chrome.alarms` alarm (min period 1 min).
3. On each alarm tick the worker broadcasts `KEEP_ALIVE_TICK` to SF tabs.
4. The content side pokes the SF session (same-origin, inside the authenticated tab) and shows a toast/badge.

Using `chrome.alarms` instead of the userscript's `setInterval` is critical: `setInterval` died on SF's single-page-app navigation and when the worker suspended.

## State & storage

- `storage-manager` is the sole module that calls `chrome.storage.local`. Everything else calls the manager. This isolates the browser API and makes storage mockable in tests.
- `state-service` and `feature-state-service` provide async CRUD and a subscribe mechanism so UI refreshes when state changes.
- `migration` runs once to lift legacy userscript data out of page `localStorage` into `chrome.storage`, guarded by `SCHEMA_VERSION` so it is idempotent.

Why not `localStorage`? It is synchronous, page-scoped, and not shared across the content script, popup, and worker. `chrome.storage.local` is async, shared across all contexts, and has a ~10 MB quota.

## Security posture

Summarized here; full detail in [security.md](security.md).

- Strict `extension_pages` CSP: `script-src 'self'; object-src 'self'; base-uri 'self'`.
- No remotely-hosted code.
- All user-supplied data rendered with `esc()` / `el()` safe builders; `innerHTML` is used only for trusted static shells (the dialog template).
- Host permissions scoped to SuccessFactors domains only.

## Bugs fixed vs. the original userscript

1. **Shortcut collision** — the original bound both `cod` and `darkmode` to Alt+D. Now `cod` → Alt+O, dark mode → Alt+Shift+D.
2. **Keep-alive death** — `setInterval` replaced with `chrome.alarms` in the worker.
3. **Storage** — page `localStorage` replaced with `chrome.storage.local`.
4. **XSS surface** — user-data `innerHTML` replaced with safe DOM construction.

## Testing

- **Unit** (`tests/unit`, Vitest) — `validation-service` and `command-service`, with storage/adapter mocked.
- **E2E** (`tests/e2e`, Playwright) — loads the built extension and exercises the popup and options page. The live-tenant test is `.skip` by default because it needs real SF credentials.
