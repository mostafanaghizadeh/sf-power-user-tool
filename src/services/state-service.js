import { CONFIG } from '../constants/config.js';
import { DEFAULT_COMMANDS } from '../constants/defaults.js';
import { StorageManager } from '../storage/storage-manager.js';

/**
 * StateService
 * ------------
 * Responsibility : owns command + group data model and all mutations.
 * Public API     : load, getCommands, getDefaultCommands, getGroups,
 *                  getGroupsSorted, addCommand, removeCommand, updateCommand,
 *                  addGroup, renameGroup, deleteGroup, reorderGroups,
 *                  moveCommandToGroup, reset, subscribe
 * Dependencies   : StorageManager, constants
 * Browser APIs   : none directly (via StorageManager)
 *
 * Behaviour is preserved from the original userscript StateService; the only
 * structural change is that persistence is async and load() must be awaited
 * before reads.
 */
export const StateService = (() => {
  let state = { commands: {}, groups: {} };
  const listeners = new Set();

  const toId = (name) => String(name || '').trim().toLowerCase().replace(/\s+/g, '_');

  function bootstrapGroups() {
    if (!state.groups) state.groups = {};
    const seen = new Set();
    Object.values(state.commands).forEach((cmd) => seen.add((cmd.group || 'General').trim()));
    let maxOrder = Math.max(0, ...Object.values(state.groups).map((g) => g.order || 0));
    seen.forEach((name) => {
      const id = toId(name);
      if (!state.groups[id]) state.groups[id] = { id, name, order: ++maxOrder };
    });
  }

  async function load() {
    const stored = (await StorageManager.get(CONFIG.STATE_KEY)) || {};
    state = { commands: {}, groups: {}, ...stored };

    if (!stored.commands) {
      state.commands = { ...DEFAULT_COMMANDS };
    } else {
      // ensure every default exists (new defaults added in updates)
      Object.entries(DEFAULT_COMMANDS).forEach(([k, v]) => {
        if (!state.commands[k]) state.commands[k] = v;
      });
    }

    Object.values(state.commands).forEach((cmd) => {
      if (cmd.system === undefined) cmd.system = false;
      if (!cmd.shortcut) cmd.shortcut = '';
      if (!cmd.group) cmd.group = 'General';
    });
    bootstrapGroups();
    await save(); // normalise persisted shape
    return state;
  }

  async function save() {
    await StorageManager.set(CONFIG.STATE_KEY, state);
    listeners.forEach((fn) => fn(state));
  }

  const getCommands = () => state.commands;
  const getDefaultCommands = () => DEFAULT_COMMANDS;
  const getGroups = () => state.groups;
  const getGroupsSorted = () => Object.values(state.groups).sort((a, b) => a.order - b.order);

  function ensureGroup(name) {
    const gId = toId(name);
    if (!state.groups[gId]) {
      const maxOrder = Math.max(0, ...Object.values(state.groups).map((g) => g.order));
      state.groups[gId] = { id: gId, name: name.trim(), order: maxOrder + 1 };
    }
    return gId;
  }

  async function addCommand(key, data) {
    if (DEFAULT_COMMANDS[key]) return false;
    ensureGroup((data.group || 'General').trim());
    state.commands[key] = data;
    await save();
    return true;
  }

  async function updateCommand(oldKey, newKey, data) {
    if (DEFAULT_COMMANDS[oldKey]) return false;
    if (oldKey !== newKey) delete state.commands[oldKey];
    ensureGroup((data.group || 'General').trim());
    state.commands[newKey] = data;
    await save();
    return true;
  }

  async function removeCommand(key) {
    if (DEFAULT_COMMANDS[key]) return false;
    delete state.commands[key];
    await save();
    return true;
  }

  async function addGroup(name) {
    const id = toId(name);
    if (state.groups[id]) return null;
    const maxOrder = Math.max(0, ...Object.values(state.groups).map((g) => g.order));
    state.groups[id] = { id, name: name.trim(), order: maxOrder + 1 };
    await save();
    return state.groups[id];
  }

  async function renameGroup(id, newName) {
    if (!state.groups[id]) return false;
    const newId = toId(newName);
    if (newId !== id && state.groups[newId]) return false;
    const old = state.groups[id];
    delete state.groups[id];
    state.groups[newId] = { id: newId, name: newName.trim(), order: old.order };
    Object.values(state.commands).forEach((cmd) => {
      if (toId(cmd.group || '') === id) cmd.group = newName.trim();
    });
    await save();
    return newId;
  }

  async function deleteGroup(id) {
    if (!state.groups[id]) return false;
    const inUse = Object.values(state.commands).some((cmd) => toId(cmd.group || '') === id);
    if (inUse) return false;
    delete state.groups[id];
    await save();
    return true;
  }

  async function reorderGroups(newOrder) {
    newOrder.forEach((id, i) => {
      if (state.groups[id]) state.groups[id].order = i + 1;
    });
    await save();
  }

  async function moveCommandToGroup(cmdKey, groupName) {
    if (!state.commands[cmdKey]) return false;
    state.commands[cmdKey].group = groupName;
    ensureGroup(groupName);
    await save();
    return true;
  }

  async function reset() {
    await StorageManager.remove(CONFIG.STATE_KEY);
    await load();
  }

  /** Subscribe to in-process state changes. Returns unsubscribe fn. */
  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  return {
    load,
    save,
    getCommands,
    getDefaultCommands,
    getGroups,
    getGroupsSorted,
    addCommand,
    updateCommand,
    removeCommand,
    addGroup,
    renameGroup,
    deleteGroup,
    reorderGroups,
    moveCommandToGroup,
    reset,
    subscribe,
    _toId: toId,
  };
})();
