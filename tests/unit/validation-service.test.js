import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock StateService so ValidationService has deterministic command data.
vi.mock('../../src/services/state-service.js', () => ({
  StateService: {
    getCommands: () => ({
      home: { shortcut: 'ALT+H', path: '/sf/home' },
      admin: { shortcut: 'ALT+I', path: '/sf/admin' },
    }),
  },
}));

import { ValidationService } from '../../src/services/validation-service.js';

describe('ValidationService.isValidShortcut', () => {
  it('accepts single modifier + key', () => {
    expect(ValidationService.isValidShortcut('ALT+X')).toBe(true);
    expect(ValidationService.isValidShortcut('CTRL+SHIFT+K')).toBe(true);
  });
  it('accepts empty (optional shortcut)', () => {
    expect(ValidationService.isValidShortcut('')).toBe(true);
  });
  it('rejects a bare key with no modifier', () => {
    expect(ValidationService.isValidShortcut('X')).toBe(false);
  });
  it('rejects multi-character keys', () => {
    expect(ValidationService.isValidShortcut('ALT+TAB')).toBe(false);
  });
});

describe('ValidationService.isDuplicateShortcut', () => {
  it('detects a collision ignoring case/space', () => {
    expect(ValidationService.isDuplicateShortcut('alt + h')).toBe(true);
  });
  it('ignores the row currently being edited', () => {
    expect(ValidationService.isDuplicateShortcut('ALT+H', 'home')).toBe(false);
  });
});

describe('ValidationService.validateForm', () => {
  let errors;
  beforeEach(() => {
    errors = null;
  });
  it('requires key and path', () => {
    errors = ValidationService.validateForm('', '', '', null);
    expect(errors.map((e) => e.field).sort()).toEqual(['key', 'path']);
  });
  it('flags duplicate key', () => {
    errors = ValidationService.validateForm('home', '', '/x', null);
    expect(errors.some((e) => e.field === 'key')).toBe(true);
  });
  it('passes a clean new command', () => {
    errors = ValidationService.validateForm('report', 'ALT+R', '/sf/report', null);
    expect(errors).toHaveLength(0);
  });
});
