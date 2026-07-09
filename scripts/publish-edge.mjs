/**
 * Uploads the packaged zip to the Microsoft Edge Add-ons store via the
 * Partner Center submission API (v1.1). Requires env: PRODUCT_ID, CLIENT_ID,
 * API_KEY. See docs/publishing.md for how to obtain them.
 */
import { readFileSync, readdirSync } from 'node:fs';

const { PRODUCT_ID, CLIENT_ID, API_KEY } = process.env;
if (!PRODUCT_ID || !CLIENT_ID || !API_KEY) {
  console.error('Missing Edge credentials (PRODUCT_ID / CLIENT_ID / API_KEY).');
  process.exit(1);
}
const zip = readdirSync('artifacts').find((f) => f.endsWith('.zip') && !f.includes('firefox'));
const base = `https://api.addons.microsoftedge.microsoft.com/v1/products/${PRODUCT_ID}/submissions`;
const headers = { Authorization: `ApiKey ${API_KEY}`, 'X-ClientID': CLIENT_ID };

const up = await fetch(`${base}/draft/package`, {
  method: 'POST',
  headers: { ...headers, 'Content-Type': 'application/zip' },
  body: readFileSync(`artifacts/${zip}`),
});
if (!up.ok) { console.error('Upload failed', up.status, await up.text()); process.exit(1); }
const opId = up.headers.get('Location');
console.log('Uploaded; operation', opId);

const pub = await fetch(base, { method: 'POST', headers, body: JSON.stringify({ notes: 'CI publish' }) });
console.log('Publish requested:', pub.status);
