import { execSync } from 'node:child_process';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';

/**
 * Packages the built extension into a store-ready zip.
 * IMPORTANT: zips the CONTENTS of dist/ (not the folder itself) — the Chrome
 * Web Store and Edge Add-ons both expect manifest.json at the archive root.
 */
const isFirefox = process.env.TARGET === 'firefox';
const dist = isFirefox ? 'dist-firefox' : 'dist';
const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

if (!existsSync(dist)) {
  console.error(`Build output "${dist}/" not found. Run "npm run build" first.`);
  process.exit(1);
}

if (!existsSync('artifacts')) mkdirSync('artifacts');
const out = `artifacts/${pkg.name}-${pkg.version}${isFirefox ? '-firefox' : ''}.zip`;

execSync(`cd ${dist} && zip -r -FS ../${out} . -x '.*'`, { stdio: 'inherit' });
console.log(`\n✔ Packaged ${out}`);
