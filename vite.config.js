import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import { readFileSync } from 'node:fs';

const base = JSON.parse(readFileSync('./src/manifest.json', 'utf-8'));
const isFirefox = process.env.TARGET === 'firefox';

/**
 * Firefox differences applied at build time (see docs/multi-browser.md):
 *   - background.scripts (Firefox does not yet ship service_worker for MV3 the
 *     same way; scripts+type:module is the compatible form)
 *   - browser_specific_settings.gecko.id is required by AMO
 */
const manifest = isFirefox
  ? {
      ...base,
      background: { scripts: [base.background.service_worker], type: 'module' },
      browser_specific_settings: {
        gecko: { id: 'sf-power-user-tool@example.com', strict_min_version: '115.0' },
      },
    }
  : base;

export default defineConfig({
  plugins: [crx({ manifest, browser: isFirefox ? 'firefox' : 'chrome' })],
  build: {
    outDir: isFirefox ? 'dist-firefox' : 'dist',
    emptyOutDir: true,
    sourcemap: process.env.NODE_ENV !== 'production',
    rollupOptions: {
      input: {
        popup: 'src/popup/popup.html',
        options: 'src/options/options.html',
        privacy: 'src/options/privacy.html',
        'page-bridge': 'src/content/page-bridge.js',
      },
    },
  },
  define: {
    'import.meta.env.DEV': JSON.stringify(process.env.NODE_ENV !== 'production'),
  },
});
