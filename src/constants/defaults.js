/**
 * Default (system) commands. These ship with the extension and cannot be
 * deleted by the user. Extracted verbatim (behaviour-preserving) from the
 * original userscript defaults.
 */
export const DEFAULT_COMMANDS = Object.freeze({
  proxy: { group: 'System', label: 'Proxy Now', path: 'Proxy Dialog', function: 'openProxy', shortcut: 'ALT+P', system: true },
  becomeSelf: { group: 'System', label: 'Become Self', path: 'Back to Self from Proxy', function: 'becomeSelf', shortcut: 'ALT+S', system: true },
  search: { group: 'System', label: 'Jump on Search', path: 'Focus Search', function: 'focusSearch', shortcut: 'ALT+K', system: true },
  menu: { group: 'System', label: 'Open Menu', path: 'Shell Menu', function: 'openShellMenu', shortcut: 'ALT+M', system: true },
  home: { group: 'System', label: 'Go Home', path: '/sf/home', function: '', shortcut: 'ALT+H', system: true },
  cod: { group: 'Admin', label: 'MDF Object', path: '/xi/ui/genericobject/pages/mdf/mdf.xhtml', function: '', shortcut: 'ALT+O', system: false },
  admin: { group: 'Admin', label: 'Admin Center', path: '/sf/admin', function: '', shortcut: 'ALT+I', system: true },
  keepalive: { group: 'System', label: 'Toggle Keep Alive', path: 'Keep Alive Toggle', function: 'toggleKeepAlive', shortcut: 'ALT+A', system: true, toggleable: true },
  darkmode: { group: 'System', label: 'Toggle Dark Mode', path: 'Dark Mode', function: 'toggleDarkMode', shortcut: 'ALT+Shift+D', system: true, toggleable: true },
});

/** Feature descriptors surfaced in the Features tab. */
export const FEATURES = Object.freeze([
  {
    key: 'keepalive',
    label: 'Keep Alive',
    desc: 'Prevents session timeout by pinging the session periodically in the background.',
    icon: '🔁',
    shortcut: 'ALT+A',
    fn: 'toggleKeepAlive',
  },
  {
    key: 'darkmode',
    label: 'Dark Mode',
    desc: 'Inverts and hue-rotates the entire page for a dark appearance.',
    icon: '🌙',
    shortcut: 'ALT+Shift+D',
    fn: 'toggleDarkMode',
  },
  {
    key: 'quicklauncher',
    label: 'Quick Launcher',
    desc: 'Floating quick-links button pinned to the top-left of every page.',
    icon: '⚡',
    shortcut: null,
    fn: null,
  },
]);
