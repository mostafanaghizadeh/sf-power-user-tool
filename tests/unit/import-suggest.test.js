import { describe, it, expect } from 'vitest';
import {
  parseCSV,
  suggestKey,
  suggestShortcut,
  isValidKey,
  normShortcut,
  isNavigable,
  MIN_KEY_LEN,
  SHORTCUT_RE,
} from '../../src/utils/import-suggest.js';

describe('suggestKey', () => {
  it('always returns a key of at least MIN_KEY_LEN characters', () => {
    const taken = new Set();
    expect(suggestKey('Ok', taken).length).toBeGreaterThanOrEqual(MIN_KEY_LEN);
    expect(suggestKey('A', taken).length).toBeGreaterThanOrEqual(MIN_KEY_LEN);
    expect(suggestKey('Admin Center', taken).length).toBeGreaterThanOrEqual(MIN_KEY_LEN);
  });

  it('dedupes against existing keys and within the batch', () => {
    const taken = new Set(['adm']);
    const a = suggestKey('Admin Center', taken);
    const b = suggestKey('Admin Center', taken);
    expect(a).not.toBe('adm');
    expect(b).not.toBe(a);
  });
});

describe('isValidKey', () => {
  it('rejects keys shorter than the minimum', () => {
    expect(isValidKey('ab', new Set())).toBe(false);
    expect(isValidKey('abc', new Set())).toBe(true);
  });
  it('rejects keys already taken (case-insensitive)', () => {
    expect(isValidKey('abc', new Set(['abc']))).toBe(false);
    expect(isValidKey('ABC', new Set(['abc']))).toBe(false);
  });
});

describe('suggestShortcut', () => {
  it('produces a valid shortcut that avoids the taken set', () => {
    const taken = new Set(['alt+a']);
    const s = suggestShortcut('Admin Center', taken);
    expect(SHORTCUT_RE.test(s)).toBe(true);
    expect(normShortcut(s)).not.toBe('alt+a');
  });
  it('returns different shortcuts on repeated calls', () => {
    const taken = new Set();
    const s1 = suggestShortcut('Admin Center', taken);
    const s2 = suggestShortcut('Admin Center', taken);
    expect(s1).not.toBe(s2);
  });
});

describe('parseCSV', () => {
  it('keeps commas inside quoted fields', () => {
    const csv = 'a,b\n"x,y",z\n';
    const rows = parseCSV(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].a).toBe('x,y');
    expect(rows[0].b).toBe('z');
  });
});

describe('isNavigable', () => {
  it('accepts only paths beginning with a slash', () => {
    expect(isNavigable('/sf/admin')).toBe(true);
    expect(isNavigable('widget:foo')).toBe(false);
    expect(isNavigable('javascript:void(0)')).toBe(false);
    expect(isNavigable('')).toBe(false);
  });
});
