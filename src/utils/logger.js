/**
 * Logger — silent in production, verbose in dev.
 * `import.meta.env.DEV` is replaced at build time by Vite.
 */
const DEBUG = typeof import.meta !== 'undefined' && import.meta.env?.DEV === true;

export const log = (...args) => {
  if (DEBUG) console.log('[SF]', ...args);
};

export const warn = (...args) => {
  if (DEBUG) console.warn('[SF]', ...args);
};

export const error = (...args) => console.error('[SF]', ...args);
