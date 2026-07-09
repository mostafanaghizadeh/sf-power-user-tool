# Publishing Guide

How to submit **SF Power User Tool** to the Chrome Web Store and Microsoft Edge Add-ons. Facts below reflect store requirements as of July 2026.

## 0. Pre-flight checklist

Run this before every submission:

```bash
npm run validate      # lint + typecheck + test + build
npm run package       # produces artifacts/sf-power-user-tool-chrome.zip
```

Then verify:

- [ ] Manifest is V3 (MV2 is fully removed from the stores; not accepted).
- [ ] CSP for `extension_pages` uses only `'self'` / `'none'` / `'wasm-unsafe-eval'`. No `unsafe-eval`, `unsafe-inline`, or remote origins.
- [ ] No remotely-hosted code. All scripts are bundled.
- [ ] `host_permissions` are scoped to SuccessFactors domains only — no `<all_urls>` or broad `*://*/*`.
- [ ] Only `storage` and `alarms` are required; `downloads` is optional.
- [ ] Icons present at 16, 32, 48, 128 px.
- [ ] A hosted, publicly reachable **privacy policy URL** (host `PRIVACY.md` content on a public page).
- [ ] The zip's root contains `manifest.json` (not a nested folder).

## 1. Store assets you must prepare

Both stores require listing media. Prepare:

- **Icon:** 128×128 PNG (already in `public/icons`).
- **Screenshots:** 1280×800 or 640×400 PNG/JPEG. Show the dialog, quick launcher, and options page. At least 1; up to 5 recommended.
- **Small promo tile** (Chrome, optional): 440×280.
- **Short description** (≤132 chars) and **detailed description** — draft text is in [store-listing.md](../store-listing.md).
- **Category:** Productivity.
- **Language:** English (add more later if needed).

## 2. Chrome Web Store

1. Create/access a developer account at the Chrome Web Store Developer Dashboard. A **one-time US$5 registration fee** applies to new accounts.
2. Click **Add new item**, upload `artifacts/sf-power-user-tool-chrome.zip`.
3. Fill the listing (use `store-listing.md`), upload screenshots and icon.
4. In **Privacy practices**:
   - Provide the privacy policy URL.
   - Declare a **single purpose**: productivity enhancements for SuccessFactors.
   - Justify each permission (copy the justifications from `store-listing.md`).
   - Certify you do not sell data and comply with the developer program policies.
5. Submit for review. Expect **2–5 business days** for established accounts; **7–14 days** for first submissions.

### Common Chrome rejection reasons (all pre-addressed here)

- Unused/over-broad permissions → we request the minimum and scope hosts.
- Missing or vague privacy policy → provided and specific.
- Remote code → none used.
- Vague single-purpose → clearly SuccessFactors productivity.

## 3. Microsoft Edge Add-ons

1. Register in **Partner Center** (no fee) and open the **Microsoft Edge** program.
2. **Create new extension**, upload the same `sf-power-user-tool-chrome.zip` (Edge consumes the Chromium MV3 package directly).
3. Fill listing details, screenshots, and the privacy policy URL.
4. Complete the **Store listing**, **Availability**, and **Properties** tabs; declare permissions similarly.
5. Submit. Edge certification typically takes a few business days.

### Automated Edge upload (optional)

`scripts/publish-edge.mjs` uploads a package via the Edge Add-ons API. Set these environment variables / CI secrets:

- `EDGE_PRODUCT_ID`
- `EDGE_CLIENT_ID`
- `EDGE_API_KEY`

## 4. Firefox (optional, addons.mozilla.org)

Firefox uses the same source but a different background style and requires a gecko id (already handled by `npm run build:firefox`). See [multi-browser.md](multi-browser.md). Submit `artifacts/sf-power-user-tool-firefox.zip` on addons.mozilla.org; AMO also performs source-code review, so keep the repo buildable with the documented commands.

## 5. Releasing via CI

Pushing a `v*` tag triggers `.github/workflows/ci.yml`:

1. `quality` — lint, test, build both targets.
2. `e2e` — Playwright smoke tests.
3. `release` — attaches zips to a GitHub Release.
4. `publish-chrome` / `publish-edge` — upload to stores if the relevant secrets are set:
   - Chrome: `CHROME_EXTENSION_ID`, `CHROME_CLIENT_ID`, `CHROME_CLIENT_SECRET`, `CHROME_REFRESH_TOKEN`.
   - Edge: `EDGE_PRODUCT_ID`, `EDGE_CLIENT_ID`, `EDGE_API_KEY`.

```bash
git tag v6.0.0
git push origin v6.0.0
```

## 6. Post-publish

- Watch the review dashboard for policy messages.
- Bump `version` in both `package.json` and `src/manifest.json` for every resubmission (stores reject duplicate versions).
- Keep `CHANGELOG.md` updated.
