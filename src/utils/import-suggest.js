/**
 * import-suggest.js
 * -----------------
 * Pure helpers shared by the "Import Actions" tab. No DOM, no storage — easy to
 * unit test. Ported from the Tampermonkey prototype and hardened:
 *   - keys are always >= 3 characters and unique
 *   - shortcuts are generated avoiding a supplied "taken" set
 *   - CSV parsing is quote-aware (handles commas inside fields)
 */

const STOP = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'for', 'from', 'with',
  'you', 'your', 'on', 'at', 'is', 'be', 'go', 'view', 'manage', 'import', 'export',
]);

export const MIN_KEY_LEN = 3;
export const SHORTCUT_RE = /^(CTRL|ALT|SHIFT)(\+(CTRL|ALT|SHIFT))*\+[A-Z0-9]$/i;

export const normShortcut = (s) => (s || '').toLowerCase().replace(/\s+/g, '');

/** Quote-aware CSV parse → array of row objects keyed by header. */
export function parseCSV(text) {
  const rows = [];
  let field = '';
  let row = [];
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQ = false;
      } else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\r') {
      /* ignore */
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  if (!rows.length) return [];
  const header = rows[0].map((h) => h.trim());
  return rows
    .slice(1)
    .filter((r) => r.length > 1)
    .map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])));
}

/**
 * Suggest a unique key of at least MIN_KEY_LEN characters.
 * Strategy: acronym of significant words → pad from remaining letters →
 * numeric suffix on collision. `taken` is a Set of lowercase keys already used.
 */
export function suggestKey(label, taken) {
  const words = (String(label).toLowerCase().match(/[a-z0-9]+/g) || []).filter((w) => !STOP.has(w));
  const letters = String(label).toLowerCase().replace(/[^a-z0-9]/g, '');
  let base = words.map((w) => w[0]).join('');
  // Ensure minimum length: pad using the flattened letters of the label.
  if (base.length < MIN_KEY_LEN) {
    base = (base + letters).slice(0, Math.max(MIN_KEY_LEN, base.length));
  }
  base = base.slice(0, 8);
  if (base.length < MIN_KEY_LEN) base = (base + 'cmd').slice(0, MIN_KEY_LEN);

  let cand = base;
  let n = 1;
  while (taken.has(cand.toLowerCase())) {
    n++;
    cand = `${base}${n}`;
  }
  taken.add(cand.toLowerCase());
  return cand;
}

/** True when a key is valid: >= MIN_KEY_LEN chars and not in `taken`. */
export function isValidKey(key, taken) {
  const k = (key || '').trim();
  if (k.length < MIN_KEY_LEN) return false;
  return !taken.has(k.toLowerCase());
}

/**
 * Suggest an unused shortcut for a label. Tries ALT+<letter>, ALT+SHIFT+<letter>,
 * CTRL+ALT+<letter> using letters from the label. Mutates `taken` (a Set of
 * normalized shortcuts) when it picks one. Returns '' if nothing is free.
 */
export function suggestShortcut(label, taken) {
  const seen = new Set();
  const letters = (String(label).toUpperCase().match(/[A-Z0-9]/g) || []).filter((L) => {
    if (seen.has(L)) return false;
    seen.add(L);
    return true;
  });
  for (const L of letters) {
    for (const combo of [`ALT+${L}`, `ALT+SHIFT+${L}`, `CTRL+ALT+${L}`]) {
      if (!taken.has(normShortcut(combo))) {
        taken.add(normShortcut(combo));
        return combo;
      }
    }
  }
  return '';
}

/** Only paths the plugin can navigate. */
export const isNavigable = (link) => typeof link === 'string' && link.startsWith('/');
