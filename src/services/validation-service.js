import { StateService } from './state-service.js';

/**
 * ValidationService
 * -----------------
 * Responsibility : pure validation of command form input and shortcut syntax.
 * Public API     : validateForm, isDuplicateKey, isDuplicateShortcut, isValidShortcut
 * Dependencies   : StateService (read-only)
 *
 * Kept pure/side-effect-free so it is trivially unit-testable.
 */
export const ValidationService = (() => {
  const normalize = (s) => (s || '').toLowerCase().replace(/\s+/g, '');

  function isDuplicateKey(key, ignoreKey) {
    return Object.keys(StateService.getCommands()).some((k) => k === key && k !== ignoreKey);
  }

  function isDuplicateShortcut(shortcut, ignoreKey) {
    if (!shortcut) return false;
    const n = normalize(shortcut);
    return Object.entries(StateService.getCommands()).some(([k, v]) => {
      if (ignoreKey && k === ignoreKey) return false;
      return normalize(v.shortcut) === n;
    });
  }

  function isValidShortcut(shortcut) {
    if (!shortcut) return true;
    return /^(CTRL|ALT|SHIFT)(\+(CTRL|ALT|SHIFT))*\+[A-Z0-9]$/i.test(shortcut.trim());
  }

  function validateForm(key, shortcut, path, editKey) {
    const errors = [];
    if (!key.trim()) errors.push({ field: 'key', message: 'Key is required' });
    if (!path.trim()) errors.push({ field: 'path', message: 'Path is required' });
    if (key.trim() && key !== editKey && isDuplicateKey(key.trim(), editKey))
      errors.push({ field: 'key', message: 'Key already exists' });
    if (shortcut && !isValidShortcut(shortcut))
      errors.push({ field: 'shortcut', message: 'Format: ALT+X or CTRL+SHIFT+X' });
    if (shortcut && isDuplicateShortcut(shortcut, editKey))
      errors.push({ field: 'shortcut', message: 'Shortcut already in use' });
    return errors;
  }

  return { validateForm, isDuplicateKey, isDuplicateShortcut, isValidShortcut, _normalize: normalize };
})();
