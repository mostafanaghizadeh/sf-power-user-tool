import { test, expect } from './fixtures.js';

test('service worker registers', async ({ extensionId }) => {
  expect(extensionId).toBeTruthy();
});

test('popup shows the not-on-SF warning off a SuccessFactors tab', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);
  await expect(page.locator("[data-role='status']")).toContainText('SuccessFactors');
});

test('options page renders the settings card', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/options/options.html`);
  await expect(page.getByRole('heading', { name: /Sync & Privacy/i })).toBeVisible();
});

/**
 * SF smoke test: because we cannot log into a real tenant in CI, serve a local
 * fixture that mimics the SF shellbar DOM. The content script only activates on
 * real SF hosts, so this test documents the manual QA path rather than asserting
 * injection. In a tenant-connected pipeline, replace the URL with a test tenant
 * and assert on `#sf-root` / `#sfQuickLauncher-container` presence.
 */
test.skip('injects UI on a live SuccessFactors tenant (manual/tenant-gated)', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('https://your-tenant.successfactors.com/sf/home');
  await page.keyboard.press('Alt+Shift+P');
  await expect(page.locator('#sf-dialog.sf-open')).toBeVisible();
});
