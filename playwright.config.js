import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  use: { headless: false },
  // Extensions require a persistent context launched with the built dist/ dir.
  // See tests/e2e/fixtures.js for the loader.
});
