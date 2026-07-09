import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/services/state-service.js', () => ({
  StateService: {
    getCommands: () => ({
      home: { path: '/sf/home', shortcut: 'ALT+H' },
      admin: { path: '/sf/admin', shortcut: 'ALT+I' },
      proxy: { function: 'openProxy', path: 'Proxy Dialog' },
    }),
  },
}));

vi.mock('../../src/services/successfactors-adapter.js', () => ({
  SuccessFactorsAdapter: {
    navUrl: (p) => `https://tenant.successfactors.com${p}`,
    openProxy: vi.fn(),
    becomeSelf: vi.fn(),
    focusSearch: vi.fn(),
    openShellMenu: vi.fn(),
  },
}));

import { CommandService } from '../../src/services/command-service.js';
import { esc } from '../../src/utils/dom.js';

describe('CommandService.findMatchingCommand', () => {
  it('matches ALT+H event to the home command', () => {
    const cmd = CommandService.findMatchingCommand({ altKey: true, key: 'h' });
    expect(cmd?.path).toBe('/sf/home');
  });
  it('returns undefined for unbound combos', () => {
    expect(CommandService.findMatchingCommand({ ctrlKey: true, key: 'z' })).toBeUndefined();
  });
  it('matches by physical key code when Alt mangles e.key (non-US layout)', () => {
    // German layout: Alt+H can produce a symbol in e.key, but code stays KeyH.
    const cmd = CommandService.findMatchingCommand({ altKey: true, key: '˙', code: 'KeyH' });
    expect(cmd?.path).toBe('/sf/home');
  });
  it('prefers e.code over a symbol e.key for ALT+I admin', () => {
    const cmd = CommandService.findMatchingCommand({ altKey: true, key: 'ˆ', code: 'KeyI' });
    expect(cmd?.path).toBe('/sf/admin');
  });
});

describe('CommandService.executeFromSearchBar', () => {
  beforeEach(() => {
    delete window.location;
    window.location = { href: '', origin: 'https://tenant.successfactors.com' };
    window.open = vi.fn();
  });
  it('navigates in the same tab for /n key', () => {
    expect(CommandService.executeFromSearchBar('/n home')).toBe(true);
    expect(window.location.href).toContain('/sf/home');
  });
  it('opens a new tab for /o key', () => {
    expect(CommandService.executeFromSearchBar('/o admin')).toBe(true);
    expect(window.open).toHaveBeenCalled();
  });
  it('rejects unknown keys', () => {
    expect(CommandService.executeFromSearchBar('/n nope')).toBe(false);
  });
});

describe('dom.esc', () => {
  it('escapes all HTML metacharacters', () => {
    expect(esc(`<img src=x onerror="alert('xss')">`)).toBe(
      '&lt;img src=x onerror=&quot;alert(&#39;xss&#39;)&quot;&gt;'
    );
  });
  it('handles null/undefined', () => {
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
  });
});
