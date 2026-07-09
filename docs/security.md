# Security & Maintenance

## Security model

### Content Security Policy

The manifest sets a strict CSP for extension pages:

```
script-src 'self'; object-src 'self'; base-uri 'self'
```

This uses only tokens the stores permit (`'self'`). There is no `unsafe-eval`, no `unsafe-inline`, and no remote origin. This is both a store requirement and a genuine hardening measure.

### No remotely-hosted code

All JavaScript is bundled into the package at build time. Nothing is fetched and executed at runtime. This is mandatory for the Chrome Web Store and Edge, and it removes a large class of supply-chain and injection risks.

### Safe DOM construction

The original userscript built markup with `innerHTML`, including strings containing user-entered command names and URLs — an XSS risk. This extension:

- Renders **all user-supplied data** through `esc()` (HTML-escape) and `el()` (programmatic element creation) in `src/utils/dom.js`.
- Uses `innerHTML` only for **trusted, static** shells with no user data (e.g. the dialog template in `src/ui/dialog-template.js`).

When adding UI, never interpolate user data into an HTML string. Build nodes with `el()` and set text with `textContent`.

### Least-privilege permissions

- Required: `storage`, `alarms`.
- Optional (requested only on use): `downloads`.
- Host access limited to SuccessFactors domains. No `<all_urls>`.

### No data exfiltration

The extension has no external network calls. All data is local (`chrome.storage.local`). The keep-alive interacts only with the user's already-authenticated SF tab, same-origin.

## Maintaining SAP selectors

SuccessFactors changes its DOM between releases and across data centers. **All** SAP-specific selectors are centralized so maintenance is a single-file change.

### Where they live

`src/services/successfactors-adapter.js` → the `SEL` object. Each entry is a **prioritized list** of selectors tried in order until one matches:

```js
const SEL = {
  proxyNow:    [ /* primary */, /* fallback 1 */, /* fallback 2 */ ],
  becomeSelf:  [ ... ],
  searchInput: [ ... ],
  menuButton:  [ ... ],
};
```

### When SF breaks a feature

1. Open the SF page in the browser and inspect the element that stopped working.
2. Find its current selector (prefer stable attributes: `id`, `data-*`, ARIA roles — avoid volatile generated class names).
3. Add the new selector to the **front** of the relevant `SEL` list, keeping the old ones as fallbacks.
4. Add or update a unit test if the change affects command resolution.
5. Rebuild and verify on a real tenant (the gated Playwright test in `tests/e2e/smoke.spec.js` can be un-skipped for this).

Because every other module calls the adapter rather than querying the DOM directly, no other file needs to change.

### Shadow DOM

SF uses web components. The `findDeep()` helper in `src/utils/dom.js` traverses shadow roots when a plain query fails. Use it (via the adapter) rather than `document.querySelector` when targeting shell/menu elements.

## Dependency hygiene

- Keep `@crxjs/vite-plugin`, `vite`, and `webextension-polyfill` current; they track MV3 platform changes.
- Run `npm audit` before each release.
- The CI `quality` job fails the build on lint or test errors, so keep them green.

## Reporting security issues

Report suspected vulnerabilities privately via the repository's security contact rather than a public issue.
