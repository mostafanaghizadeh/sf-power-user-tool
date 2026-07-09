import { StateService } from '../services/state-service.js';
import { FeatureStateService } from '../services/feature-state-service.js';
import { ValidationService } from '../services/validation-service.js';
import { CommandService } from '../services/command-service.js';
import { KeepAliveService } from '../services/keep-alive-service.js';
import { QuickLauncher } from './quick-launcher.js';
import { SuccessFactorsAdapter } from '../services/successfactors-adapter.js';
import { EnvironmentService } from '../services/environment-service.js';
import { PageContextService } from '../services/page-context-service.js';
import { UsageService } from '../services/usage-service.js';
import { DIALOG_HTML } from './dialog-template.js';
import { el, esc } from '../utils/dom.js';
import {
  parseCSV,
  suggestKey,
  suggestShortcut,
  isValidKey,
  normShortcut,
  isNavigable,
  MIN_KEY_LEN,
  SHORTCUT_RE,
} from '../utils/import-suggest.js';

/**
 * UiManager
 * ---------
 * Responsibility : builds and controls the main dialog (Commands + Features
 *                  tabs), grouped accordion list, drag-and-drop, bulk move,
 *                  live validation, shortcut recorder, CSV import/export.
 * Public API     : init, open, close, toggle, showToast, updateToggleState,
 *                  addShellItemButton
 * Dependencies   : StateService, FeatureStateService, ValidationService,
 *                  CommandService, KeepAliveService, QuickLauncher, adapter
 *
 * All rows containing user data are built via safe DOM builders (el/esc) —
 * no untrusted innerHTML. The static chrome comes from DIALOG_HTML (trusted).
 */
export const UiManager = (() => {
  let root = null;
  const ui = {};
  let editKey = null;
  let sortField = 'key';
  let sortDir = 1;
  const toggleStates = {};
  let collapsedGroups = {};
  const selectedRows = new Set();
  let dragState = {};
  let recorderBlink = null;
  // Import-Actions tab state
  let impModel = []; // [{label,path,module,navigable,selected,key,shortcut}]

  async function init() {
    root = el('div', { id: 'sf-root' });
    root.innerHTML = DIALOG_HTML; // trusted static shell
    document.body.appendChild(root);

    Object.assign(ui, {
      panel: root.querySelector('#sf-dialog'),
      overlay: root.querySelector('#sf-overlay'),
      search: root.querySelector("[data-role='search']"),
      key: root.querySelector("[data-role='key']"),
      label: root.querySelector("[data-role='label']"),
      shortcut: root.querySelector("[data-role='shortcut']"),
      path: root.querySelector("[data-role='path']"),
      group: root.querySelector("[data-role='group']"),
      list: root.querySelector("[data-role='list']"),
      sortInd: root.querySelector("[data-role='sort-indicator']"),
      record: root.querySelector("[data-action='recordShortcut']"),
      newGroup: root.querySelector("[data-role='new-group']"),
      bulkBar: root.querySelector("[data-role='bulk-bar']"),
      bulkGroup: root.querySelector("[data-role='bulk-group']"),
      bulkCount: root.querySelector("[data-role='bulk-count']"),
      impModule: root.querySelector("[data-role='imp-module']"),
      impSearch: root.querySelector("[data-role='imp-search']"),
      impList: root.querySelector("[data-role='imp-list']"),
      impSummary: root.querySelector("[data-role='imp-summary']"),
      envBanner: root.querySelector("[data-role='env-banner']"),
      quickAddMsg: root.querySelector("[data-role='quickadd-msg']"),
    });

    bindEvents();
    bindGroupRename();
    renderEnvBanner();
    render();
  }

  // ── Module 1: Environment banner ────────────────────────
  async function renderEnvBanner() {
    if (!ui.envBanner) return;
    let env;
    try {
      env = await EnvironmentService.get();
    } catch {
      return;
    }
    ui.envBanner.style.display = 'flex';
    ui.envBanner.style.background = env.color;
    ui.envBanner.textContent = '';
    ui.envBanner.append(el('span', {}, `${env.icon} ${env.label}`));
    if (env.companyName) {
      ui.envBanner.append(
        el('span', { class: 'sf-env-warn' }, `· ${env.companyName}`)
      );
    }
    if (env.destructive) {
      ui.envBanner.append(
        el('span', { class: 'sf-env-warn' }, '· ⚠ changes affect live data')
      );
    }
    // Override control: let the admin retag this tenant (TEST/SANDBOX/clear).
    const btn = el('button', { class: 'sf-env-btn' }, env.overridden ? 'Reset tag' : 'Tag env');
    btn.addEventListener('click', () => cycleEnvOverride(env));
    ui.envBanner.append(btn);
  }

  async function cycleEnvOverride(current) {
    // Simple cycle: (auto) → TEST → SANDBOX → clear
    if (current.overridden && current.code === 'TEST') {
      await EnvironmentService.setOverride('SANDBOX');
    } else if (current.overridden && current.code === 'SANDBOX') {
      await EnvironmentService.clearOverride();
    } else {
      await EnvironmentService.setOverride('TEST');
    }
    renderEnvBanner();
    showToast('Environment tag updated for this tenant.');
  }

  // ── Tabs ───────────────────────────────────────────────
  function switchTab(name) {
    root.querySelectorAll('.sf-tab').forEach((t) => t.classList.remove('sf-tab-active'));
    root.querySelector(`.sf-tab[data-tab="${name}"]`).classList.add('sf-tab-active');
    root.querySelector('#sf-pane-commands').style.display = name === 'commands' ? '' : 'none';
    root.querySelector('#sf-pane-features').style.display = name === 'features' ? '' : 'none';
    root.querySelector('#sf-pane-import').style.display = name === 'import' ? '' : 'none';
    if (name === 'features') renderFeaturesTab();
    if (name === 'import' && !impModel.length) loadImportData();
  }

  async function renderFeaturesTab() {
    const grid = root.querySelector('#sf-feat-grid');
    const badge = root.querySelector('#sf-feat-on-count');
    const states = await FeatureStateService.getStates();
    let onCount = 0;
    grid.textContent = '';

    FeatureStateService.getAll().forEach((f) => {
      const on = !!states[f.key];
      if (on) onCount++;
      const card = el('div', { class: `sf-feat-card ${on ? 'sf-feat-on' : ''}` });
      card.innerHTML = `
        <div class="sf-feat-icon">${esc(f.icon)}</div>
        <div class="sf-feat-body">
          <div class="sf-feat-name">${esc(f.label)}${f.shortcut ? `<span class="sf-feat-sc">${esc(f.shortcut)}</span>` : ''}</div>
          <div class="sf-feat-desc">${esc(f.desc)}</div>
          <div class="sf-feat-status"><span class="sf-feat-dot ${on ? 'sf-on' : ''}"></span>${on ? 'Active — state saved' : 'Inactive'}</div>
        </div>`;
      const btn = el('button', {
        class: `sf-toggle ${on ? 'sf-on' : 'sf-off'}`,
        title: on ? 'Turn off' : 'Turn on',
        dataset: { featToggle: f.key },
      });
      btn.append(el('span', { class: 'sf-toggle-knob' }));
      btn.addEventListener('click', () => handleFeatureToggle(f.key));
      card.append(btn);
      grid.append(card);
    });

    badge.textContent = onCount > 0 ? `${onCount} on` : '';
    badge.classList.toggle('sf-visible', onCount > 0);

    // Quick Links position control
    const pos = await FeatureStateService.getLauncherPosition();
    const posCard = el('div', { class: 'sf-feat-card', style: 'align-items:flex-start;' });
    posCard.append(el('div', { class: 'sf-feat-icon' }, '📍'));
    const body = el('div', { class: 'sf-feat-body' });
    body.append(el('div', { class: 'sf-feat-name' }, 'Quick Links position'));
    body.append(
      el('div', { class: 'sf-feat-desc' }, 'Choose which screen corner the Quick Links button is pinned to.')
    );
    const select = el('select', {
      class: 'sf-input',
      style: 'height:32px;margin-top:8px;max-width:200px;cursor:pointer;',
    });
    const LABELS = {
      'top-left': 'Top left',
      'top-right': 'Top right',
      'bottom-left': 'Bottom left',
      'bottom-right': 'Bottom right',
    };
    FeatureStateService.POSITIONS.forEach((p) => {
      select.append(el('option', { value: p, selected: p === pos || null }, [LABELS[p] || p]));
    });
    select.addEventListener('change', async () => {
      await FeatureStateService.setLauncherPosition(select.value);
      QuickLauncher.setPosition(select.value);
      showToast(`Quick Links moved to ${LABELS[select.value].toLowerCase()}.`);
    });
    body.append(select);
    posCard.append(body);
    grid.append(posCard);
  }

  async function handleFeatureToggle(key) {
    const newVal = !(await FeatureStateService.isOn(key));
    await FeatureStateService.setState(key, newVal);

    if (key === 'keepalive') {
      await KeepAliveService.toggle();
    } else if (key === 'darkmode') {
      CommandService.toggleDarkMode();
    } else if (key === 'quicklauncher') {
      QuickLauncher.setVisible(newVal);
    }
    renderFeaturesTab();
  }

  // ── Group select refresh ───────────────────────────────
  function refreshGroupSelects(selectedName) {
    const groups = StateService.getGroupsSorted();
    ui.group.textContent = '';
    ui.bulkGroup.textContent = '';
    groups.forEach((g) => {
      const mk = () =>
        el('option', { value: g.name, selected: g.name === selectedName || null }, [g.name]);
      ui.group.append(mk());
      ui.bulkGroup.append(mk());
    });
  }

  // ── Render grouped accordion ────────────────────────────
  function render() {
    const filter = (ui.search.value || '').toLowerCase();
    const cmds = StateService.getCommands();
    const groups = StateService.getGroupsSorted();

    if (ui.sortInd) ui.sortInd.textContent = `${sortField} ${sortDir === 1 ? '▲' : '▼'}`;
    refreshGroupSelects(ui.group.value);

    const buckets = {};
    groups.forEach((g) => (buckets[g.name] = []));

    let entries = Object.entries(cmds).filter(
      ([k, v]) => !filter || k.toLowerCase().includes(filter) || (v.label || '').toLowerCase().includes(filter)
    );
    entries.sort(([ak, av], [bk, bv]) => {
      let a = '';
      let b = '';
      if (sortField === 'key') [a, b] = [ak, bk];
      if (sortField === 'label') [a, b] = [av.label || '', bv.label || ''];
      if (sortField === 'shortcut') [a, b] = [av.shortcut || '', bv.shortcut || ''];
      return a.localeCompare(b) * sortDir;
    });
    entries.forEach(([k, v]) => {
      const g = (v.group || 'General').trim();
      (buckets[g] = buckets[g] || []).push([k, v]);
    });

    ui.list.textContent = '';
    let rendered = 0;

    groups.forEach((g) => {
      const items = buckets[g.name] || [];
      const collapsed = !!collapsedGroups[g.name];
      const isSystem = g.name === 'System';
      const inUse = items.length > 0;
      rendered += items.length;

      const header = el('div', {
        class: 'sf-group-header',
        draggable: 'true',
        dataset: { groupId: g.id, groupName: g.name, droptarget: 'group' },
      });
      header.innerHTML = `
        <span class="sf-group-drag-handle" title="Drag to reorder group">⠿</span>
        <span class="sf-group-arrow ${collapsed ? 'sf-collapsed' : ''}">▾</span>
        <span class="sf-group-name-wrap">
          <span class="sf-group-name">${esc(g.name)}</span>
          <input class="sf-group-name-input" value="${esc(g.name)}" data-group-rename="${esc(g.id)}" />
          <span class="sf-group-count">(${items.length})</span>
        </span>
        <span class="sf-group-actions">
          <button class="sf-group-btn" data-group-edit="${esc(g.id)}" title="Rename group">✎</button>
          ${!isSystem ? `<button class="sf-group-btn sf-group-btn-del" data-group-del="${esc(g.id)}" title="${inUse ? 'Cannot delete — group has commands' : 'Delete group'}" ${inUse ? 'disabled style="opacity:.4;cursor:not-allowed;"' : ''}>🗑</button>` : ''}
        </span>`;
      ui.list.append(header);

      if (collapsed) return;
      const body = el('div', { dataset: { groupBody: g.name } });
      items.forEach(([k, v]) => body.append(buildRow(k, v)));
      ui.list.append(body);
    });

    if (rendered === 0 && ui.list.childElementCount === 0) {
      ui.list.append(el('div', { style: 'padding:12px;color:#888;font-size:13px;', text: 'No commands found.' }));
    }

    bindListDelegation();
    bindDragDrop();
    updateBulkBar();
  }

  function buildRow(k, v) {
    const isSelected = selectedRows.has(k);
    const isToggle = !!v.toggleable;
    const isOn = isToggle && !!toggleStates[k];

    const row = el('div', {
      class: `sf-row ${isSelected ? 'sf-row-selected' : ''}`,
      draggable: 'true',
      dataset: { cmdKey: k, cmdGroup: v.group || 'General', droptarget: 'row' },
    });

    const cb = el('input', { type: 'checkbox', dataset: { cb: k } });
    cb.checked = isSelected;
    row.append(el('div', { class: 'sf-row-cb' }, [cb]));
    row.append(el('div', { class: 'sf-row-drag', title: 'Drag to move to another group', text: '⠿' }));
    row.append(el('div', { class: 'sf-row-key', text: k }));

    const labelCell = el('div', { class: 'sf-row-label', text: v.label || '' });
    if (v.system) labelCell.append(el('span', { class: 'sf-badge', text: 'system' }));
    row.append(labelCell);

    const scCell = el('div', { class: 'sf-row-shortcut' });
    if (v.shortcut) scCell.append(el('span', { class: 'sf-kbd', text: v.shortcut }));
    row.append(scCell);

    row.append(el('div', { class: 'sf-row-path', text: v.path || '' }));

    const actions = el('div', { class: 'sf-row-actions' });
    if (v.system) {
      actions.style.cssText = 'gap:6px;align-items:center;';
      if (isToggle) {
        const t = el('button', {
          class: `sf-toggle ${isOn ? 'sf-on' : 'sf-off'}`,
          title: isOn ? 'Active' : 'Inactive',
          dataset: { toggle: k },
        });
        t.append(el('span', { class: 'sf-toggle-knob' }));
        actions.append(t);
      } else {
        actions.append(el('span', { class: 'sf-lock', title: 'System command', text: '🔒' }));
      }
    } else {
      actions.append(
        el('button', { class: 'sf-btn-edit', title: 'Edit', dataset: { edit: k }, text: '✎' }),
        el('button', { class: 'sf-btn-del', title: 'Delete', dataset: { del: k }, text: '🗑' })
      );
    }
    row.append(actions);
    return row;
  }

  // ── List delegation ─────────────────────────────────────
  function bindListDelegation() {
    ui.list.onclick = async (e) => {
      const cb = e.target.closest('[data-cb]');
      if (cb && cb.tagName === 'INPUT') {
        cb.checked ? selectedRows.add(cb.dataset.cb) : selectedRows.delete(cb.dataset.cb);
        updateBulkBar();
        return;
      }
      const editBtn = e.target.closest('[data-edit]');
      if (editBtn) return edit(editBtn.dataset.edit);

      const delBtn = e.target.closest('[data-del]');
      if (delBtn) {
        await StateService.removeCommand(delBtn.dataset.del);
        selectedRows.delete(delBtn.dataset.del);
        render();
        showToast('Command removed.');
        return;
      }
      const toggleBtn = e.target.closest('[data-toggle]');
      if (toggleBtn) {
        const cmd = StateService.getCommands()[toggleBtn.dataset.toggle];
        if (cmd) CommandService.run(cmd);
        return;
      }
      const groupEdit = e.target.closest('[data-group-edit]');
      if (groupEdit) {
        e.stopPropagation();
        const header = groupEdit.closest('.sf-group-header');
        header.querySelector('.sf-group-name').style.display = 'none';
        const input = header.querySelector('.sf-group-name-input');
        input.style.display = 'inline-block';
        input.focus();
        input.select();
        return;
      }
      const groupDel = e.target.closest('[data-group-del]');
      if (groupDel && !groupDel.hasAttribute('disabled')) {
        e.stopPropagation();
        if (!(await StateService.deleteGroup(groupDel.dataset.groupDel))) {
          showToast('⚠️ Cannot delete — group still has commands.');
        } else {
          showToast('Group deleted.');
          render();
        }
        return;
      }
      const header = e.target.closest('.sf-group-header');
      if (header && !e.target.closest('.sf-group-actions') && !e.target.closest('.sf-group-name-input')) {
        const gName = header.dataset.groupName;
        collapsedGroups[gName] = !collapsedGroups[gName];
        render();
      }
    };

    ui.list.onkeydown = (e) => {
      const input = e.target.closest('[data-group-rename]');
      if (!input) return;
      if (e.key === 'Enter') input.blur();
      if (e.key === 'Escape') {
        input.closest('.sf-group-header').querySelector('.sf-group-name').style.display = '';
        input.style.display = 'none';
      }
    };
  }

  function bindGroupRename() {
    root.querySelector("[data-role='list']").addEventListener(
      'focusout',
      async (e) => {
        const input = e.target.closest('[data-group-rename]');
        if (!input) return;
        const id = input.dataset.groupRename;
        const newName = input.value.trim();
        if (!newName) {
          input.value = StateService.getGroups()[id]?.name || '';
          return;
        }
        const newId = await StateService.renameGroup(id, newName);
        if (newId === false) {
          showToast('⚠️ Group name already exists.');
          input.value = StateService.getGroups()[id]?.name || '';
        } else {
          showToast(`Group renamed to "${newName}".`);
          render();
        }
      },
      true
    );
  }

  // ── Drag & drop ─────────────────────────────────────────
  function bindDragDrop() {
    ui.list.ondragstart = (e) => {
      const row = e.target.closest('[data-cmd-key]');
      const header = e.target.closest('.sf-group-header[draggable]');
      if (row) {
        dragState = { type: 'row', key: row.dataset.cmdKey, fromGroup: row.dataset.cmdGroup };
        row.classList.add('sf-dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', row.dataset.cmdKey);
      } else if (header) {
        dragState = { type: 'group', id: header.dataset.groupId, name: header.dataset.groupName };
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', header.dataset.groupId);
      }
    };
    ui.list.ondragend = () => {
      ui.list.querySelectorAll('.sf-dragging,.sf-drag-over').forEach((n) =>
        n.classList.remove('sf-dragging', 'sf-drag-over')
      );
      dragState = {};
    };
    ui.list.ondragover = (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      ui.list.querySelectorAll('.sf-drag-over').forEach((n) => n.classList.remove('sf-drag-over'));
      const gh = e.target.closest('.sf-group-header');
      const row = e.target.closest('.sf-row');
      if (gh) gh.classList.add('sf-drag-over');
      else if (row && dragState.type === 'row') row.classList.add('sf-drag-over');
    };
    ui.list.ondrop = async (e) => {
      e.preventDefault();
      ui.list.querySelectorAll('.sf-drag-over').forEach((n) => n.classList.remove('sf-drag-over'));
      if (dragState.type === 'row') {
        const gh = e.target.closest('.sf-group-header');
        if (gh && gh.dataset.groupName !== dragState.fromGroup) {
          await StateService.moveCommandToGroup(dragState.key, gh.dataset.groupName);
          showToast(`Moved "${dragState.key}" → ${gh.dataset.groupName}`);
          render();
        }
      } else if (dragState.type === 'group') {
        const th = e.target.closest('.sf-group-header');
        if (th && th.dataset.groupId !== dragState.id) await reorderByDrop(dragState.id, th.dataset.groupId);
      }
      dragState = {};
    };
  }

  async function reorderByDrop(draggedId, targetId) {
    const sorted = StateService.getGroupsSorted();
    const from = sorted.findIndex((g) => g.id === draggedId);
    const to = sorted.findIndex((g) => g.id === targetId);
    if (from < 0 || to < 0 || from === to) return;
    const [moved] = sorted.splice(from, 1);
    sorted.splice(to, 0, moved);
    await StateService.reorderGroups(sorted.map((g) => g.id));
    render();
  }

  // ── Bulk move ───────────────────────────────────────────
  function updateBulkBar() {
    const visible = selectedRows.size > 0;
    ui.bulkBar.classList.toggle('sf-visible', visible);
    if (visible) ui.bulkCount.textContent = `${selectedRows.size} selected`;
  }
  async function doBulkMove() {
    const target = ui.bulkGroup.value;
    if (!target) return;
    for (const key of selectedRows) {
      if (!StateService.getCommands()[key]?.system) await StateService.moveCommandToGroup(key, target);
    }
    showToast(`Moved ${selectedRows.size} command(s) → ${target}`);
    selectedRows.clear();
    render();
  }

  // ── Validation ──────────────────────────────────────────
  function bindLiveValidation() {
    [ui.key, ui.shortcut, ui.path].forEach((i) => i.addEventListener('input', runLiveValidation));
  }
  function runLiveValidation() {
    const errors = ValidationService.validateForm(
      ui.key.value.trim(),
      ui.shortcut.value.trim().toUpperCase(),
      ui.path.value.trim(),
      editKey
    );
    ['key', 'label', 'shortcut', 'path'].forEach((f) => setFieldError(f, ''));
    errors.forEach((e) => setFieldError(e.field, e.message));
    setInputError(ui.key, errors.some((e) => e.field === 'key'));
    setInputError(ui.shortcut, errors.some((e) => e.field === 'shortcut'));
    setInputError(ui.path, errors.some((e) => e.field === 'path'));
  }
  function setFieldError(field, msg) {
    const el2 = root.querySelector(`[data-err="${field}"]`);
    if (el2) el2.textContent = msg;
  }
  function setInputError(input, has) {
    input?.classList.toggle('sf-error', has);
  }
  function clearValidation() {
    ['key', 'label', 'shortcut', 'path'].forEach((f) => setFieldError(f, ''));
    [ui.key, ui.label, ui.shortcut, ui.path].forEach((i) => i?.classList.remove('sf-error'));
  }

  // ── Shortcut recorder ───────────────────────────────────
  function normKey(k) {
    if (k === 'Control') return 'CTRL';
    if (k === 'Alt') return 'ALT';
    if (k === 'Shift') return 'SHIFT';
    if (k === 'Meta') return 'CMD';
    return (k || '').toUpperCase();
  }
  /**
   * Layout-independent key label from a keyboard event. Prefers e.code for
   * A–Z / 0–9 so a recorded shortcut matches what CommandService detects at
   * runtime (Alt+letter yields symbols in e.key on non-US layouts).
   */
  function recordKey(e) {
    const code = e.code || '';
    if (/^Key[A-Z]$/.test(code)) return code.slice(3);
    if (/^Digit[0-9]$/.test(code)) return code.slice(5);
    if (/^Numpad[0-9]$/.test(code)) return code.slice(6);
    return normKey(e.key);
  }
  function stopRecording() {
    clearInterval(recorderBlink);
    ui.record.textContent = '●';
    ui.record.style.opacity = '1';
    ui.record.classList.remove('sf-recording');
    ui.record.dataset.recording = 'false';
  }
  function handleRecordingButton() {
    const recording = ui.record.dataset.recording === 'true';
    ui.record.dataset.recording = String(!recording);
    if (!recording) {
      ui.record.textContent = '■';
      ui.shortcut.value = '';
      ui.record.classList.add('sf-recording');
      recorderBlink = setInterval(() => {
        ui.record.style.opacity = ui.record.style.opacity === '0.4' ? '1' : '0.4';
      }, 400);
      ui.shortcut.focus();
      const onKeyDown = (e) => {
        if (ui.record.dataset.recording === 'false') {
          document.removeEventListener('keydown', onKeyDown);
          document.removeEventListener('keyup', onKeyUp);
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        const parts = [];
        if (e.ctrlKey) parts.push('CTRL');
        if (e.altKey) parts.push('ALT');
        if (e.shiftKey) parts.push('SHIFT');
        if (e.metaKey) parts.push('CMD');
        const k = recordKey(e);
        if (!['CTRL', 'ALT', 'SHIFT', 'CMD'].includes(k)) parts.push(k);
        ui.shortcut.value = parts.join('+');
      };
      const onKeyUp = (e) => {
        if (ui.record.dataset.recording === 'false') return;
        const k = recordKey(e);
        if (!['CTRL', 'ALT', 'SHIFT', 'CMD'].includes(k)) {
          stopRecording();
          document.removeEventListener('keydown', onKeyDown);
          document.removeEventListener('keyup', onKeyUp);
        }
      };
      document.addEventListener('keydown', onKeyDown);
      document.addEventListener('keyup', onKeyUp);
    } else {
      stopRecording();
    }
  }

  // ── Events ──────────────────────────────────────────────
  function bindEvents() {
    root.addEventListener('click', async (e) => {
      const a = e.target.closest('[data-action]')?.dataset.action;
      if (!a) return;
      if (a === 'close') close();
      else if (a === 'resetSearch') resetSearch();
      else if (a === 'add') await add();
      else if (a === 'clear') clear();
      else if (a === 'export') await exportCSV();
      else if (a === 'template') downloadTemplate();
      else if (a === 'recordShortcut') handleRecordingButton();
      else if (a === 'addGroup') await addGroup();
      else if (a === 'capturePage') await captureCurrentPage();
      else if (a === 'expandAll') {
        collapsedGroups = {};
        render();
      } else if (a === 'collapseAll') {
        StateService.getGroupsSorted().forEach((g) => (collapsedGroups[g.name] = true));
        render();
      } else if (a === 'bulkMove') await doBulkMove();
      else if (a === 'bulkClear') {
        selectedRows.clear();
        render();
      } else if (a === 'reset') {
        if (confirm('Reset all commands to defaults? This cannot be undone.')) {
          await StateService.reset();
          selectedRows.clear();
          collapsedGroups = {};
          render();
          showToast('Commands reset to defaults.');
        }
      } else if (a === 'impReload') await loadImportData();
      else if (a === 'impSelAll') impSetVisibleSelected(true);
      else if (a === 'impSelNone') impSetVisibleSelected(false);
      else if (a === 'impAutoSc') impAutoAssignShortcuts();
      else if (a === 'impImport') await impDoImport();
      else if (a === 'impExport') impExportCSV();
    });

    root.addEventListener('change', (e) => {
      if (e.target.dataset.action === 'import') importCSV(e);
    });
    root.addEventListener('input', (e) => {
      if (e.target.dataset.role === 'search') render();
      if (e.target.dataset.role === 'imp-search') renderImport();
    });
    root.addEventListener('change', (e) => {
      if (e.target.dataset.role === 'imp-module') renderImport();
    });
    root.querySelectorAll('.sf-tab').forEach((btn) => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
    root.querySelectorAll('[data-sort]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const f = btn.dataset.sort;
        if (sortField === f) sortDir *= -1;
        else {
          sortField = f;
          sortDir = 1;
        }
        render();
      })
    );
    ui.overlay.addEventListener('click', close);
    bindLiveValidation();
  }

  // ── CRUD ────────────────────────────────────────────────
  async function add() {
    const key = ui.key.value.trim();
    const label = ui.label.value.trim();
    const path = ui.path.value.trim();
    const shortcut = ui.shortcut.value.trim().toUpperCase();
    const group = ui.group.value || 'General';
    const errors = ValidationService.validateForm(key, shortcut, path, editKey);
    if (errors.length) return errors.forEach((e) => setFieldError(e.field, e.message));

    if (editKey) await StateService.updateCommand(editKey, key, { label, path, shortcut, group, system: false });
    else await StateService.addCommand(key, { label, path, shortcut, group, system: false });

    showToast(editKey ? `Command "${key}" updated.` : `Command "${key}" added.`);
    editKey = null;
    clear();
    render();
  }

  async function addGroup() {
    const name = ui.newGroup.value.trim();
    const errEl = root.querySelector("[data-err='group-create']");
    errEl.textContent = '';
    if (!name) return (errEl.textContent = 'Name is required.');
    const result = await StateService.addGroup(name);
    if (!result) return (errEl.textContent = 'Group already exists.');
    ui.newGroup.value = '';
    showToast(`Group "${name}" created.`);
    render();
  }

  // ── Module 3: capture the current page as a command ─────
  async function captureCurrentPage() {
    const msg = ui.quickAddMsg;
    const path = location.pathname + location.search;
    if (!path.startsWith('/')) {
      if (msg) msg.textContent = 'This page URL is not a navigable SF path.';
      return;
    }
    // Prefer the safe SF page title/module; fall back to document.title.
    let label = document.title.trim();
    try {
      const ctx = PageContextService.readPageHeader();
      const mod = ctx?.pageInfo?.moduleId;
      if (mod && (!label || label.length > 60)) label = mod;
    } catch {
      /* ignore */
    }
    label = (label || 'Captured page').slice(0, 80);
    const taken = new Set(Object.keys(StateService.getCommands()));
    const key = suggestKey(label, taken);
    await StateService.addCommand(key, {
      group: 'Captured',
      label,
      path,
      shortcut: '',
      function: '',
      toggleable: false,
      system: false,
    });
    if (msg) msg.textContent = `Added "${label}" (key: ${key}).`;
    render();
  }

  function resetSearch() {
    ui.search.value = '';
    render();
  }
  function clear() {
    ui.key.value = ui.label.value = ui.path.value = ui.shortcut.value = '';
    editKey = null;
    clearValidation();
  }
  function edit(key) {
    const c = StateService.getCommands()[key];
    if (!c) return;
    editKey = key;
    ui.key.value = key;
    ui.label.value = c.label || '';
    ui.path.value = c.path || '';
    ui.shortcut.value = c.shortcut || '';
    refreshGroupSelects(c.group || 'General');
    clearValidation();
    switchTab('commands');
    ui.key.focus();
  }

  // ── CSV import/export ───────────────────────────────────
  function importCSV(e) {
    const defaults = StateService.getDefaultCommands();
    const file = e.target.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = async (ev) => {
      let count = 0;
      const lines = String(ev.target.result).split('\n');
      for (let idx = 0; idx < lines.length; idx++) {
        if (idx === 0) continue;
        const [group, key, label, path, shortcut] = lines[idx].split(',');
        if (!key || !path || defaults[key]) continue;
        await StateService.addCommand(key.trim(), {
          group: (group || 'General').trim(),
          label: (label || '').trim(),
          path: path.trim(),
          shortcut: (shortcut || '').trim().toUpperCase(),
          function: '',
          toggleable: false,
          system: false,
        });
        count++;
      }
      render();
      showToast(`Imported ${count} command(s).`);
      e.target.value = '';
    };
    r.readAsText(file);
  }

  async function exportCSV() {
    const defaults = StateService.getDefaultCommands();
    let csv = 'group,key,label,path,shortcut\n';
    csv += Object.entries(StateService.getCommands())
      .filter(([k]) => !defaults[k])
      .map(([k, v]) => `${v.group || ''},${k},${v.label || ''},${v.path},${v.shortcut || ''}`)
      .join('\n');
    download(csv, 'sf-plugin-commands.csv', 'text/csv');
    showToast('CSV exported.');
  }
  function downloadTemplate() {
    const csv =
      'group,key,label,path,shortcut\nHR Tools,example,My Link,/sf/home,ALT+X\nReporting,report,My Report,/sf/reports,';
    download(csv, 'sf-plugin-template.csv', 'text/csv');
  }
  function download(content, filename, type) {
    const a = el('a', { href: URL.createObjectURL(new Blob([content], { type })), download: filename });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ── Open/close ──────────────────────────────────────────
  function open() {
    ui.panel.classList.add('sf-open');
    ui.overlay.style.display = 'block';
  }
  function close() {
    ui.panel.classList.remove('sf-open');
    ui.overlay.style.display = 'none';
  }
  function toggle() {
    ui.panel.classList.contains('sf-open') ? close() : open();
  }
  function updateToggleState(key, on) {
    toggleStates[key] = on;
    render();
  }

  function showToast(msg) {
    document.querySelector('.sf-toast.sf-info-toast')?.remove();
    const t = el('div', { class: 'sf-toast sf-info-toast', text: msg });
    document.body.appendChild(t);
    setTimeout(() => {
      t.style.opacity = '0';
      setTimeout(() => t.remove(), 400);
    }, 2400);
  }

  function addShellItemButton() {
    const ctrl = SuccessFactorsAdapter.getShellbarController();
    if (!ctrl?.addShellbarItem) return;
    if (!document.getElementById('sf-plugin-shell-headerItem-button')) {
      ctrl.addShellbarItem({
        icon: 'keyboard-and-mouse',
        text: 'Power User Tool',
        press: () => toggle(),
        id: 'sf-plugin-shell-headerItem-button',
        stableDomRef: 'sf-plugin-shell-headerItem-button',
        helpId: 'sf-plugin-shell-headerItem-button',
        title: 'Power User Tool',
      });
    }
    if (!document.getElementById('sf-plugin-shell-headerItem-darkMode')) {
      ctrl.addShellbarItem({
        icon: 'dark-mode',
        text: 'Switch Dark Mode',
        press: () => CommandService.toggleDarkMode(),
        id: 'sf-plugin-shell-headerItem-darkMode',
        stableDomRef: 'sf-plugin-shell-headerItem-darkMode',
        helpId: 'sf-plugin-shell-headerItem-darkMode',
        title: 'Switch Dark Mode',
      });
    }
  }

  // ── Import Actions tab ──────────────────────────────────
  /** Keys already in use (existing commands) as a lowercase Set. */
  function existingKeySet() {
    return new Set(Object.keys(StateService.getCommands()).map((k) => k.toLowerCase()));
  }
  /** Normalized shortcuts already in use as a Set. */
  function existingShortcutSet() {
    return new Set(
      Object.values(StateService.getCommands())
        .map((c) => normShortcut(c.shortcut))
        .filter(Boolean)
    );
  }

  async function loadImportData() {
    ui.impList.textContent = '';
    ui.impList.appendChild(el('div', { style: 'padding:20px;text-align:center;color:#888;' }, 'Fetching actions from SuccessFactors…'));
    let rows;
    try {
      const text = await SuccessFactorsAdapter.fetchActionsExport();
      rows = parseCSV(text);
    } catch (e) {
      ui.impList.textContent = '';
      ui.impList.appendChild(
        el('div', { style: 'padding:20px;text-align:center;color:#bb0000;' }, `Failed: ${e.message} — you can still use Import CSV on the Commands tab.`)
      );
      return;
    }

    const takenKeys = existingKeySet();
    impModel = rows.map((r) => {
      const label = r.label || r.actionId || '(unnamed)';
      const path = r.link || '';
      const nav = isNavigable(path);
      return {
        label,
        path,
        module: (r.module || 'General').trim(),
        navigable: nav,
        selected: false,
        key: nav ? suggestKey(label, takenKeys) : '',
        shortcut: '',
      };
    });

    // module dropdown
    const mods = [...new Set(impModel.map((m) => m.module))].sort();
    ui.impModule.textContent = '';
    ui.impModule.appendChild(el('option', { value: '' }, 'All modules'));
    mods.forEach((m) =>
      ui.impModule.appendChild(el('option', { value: m }, `${m} (${impModel.filter((x) => x.module === m).length})`))
    );
    if (mods.includes('Admin')) ui.impModule.value = 'Admin';
    renderImport();
  }

  function impVisible() {
    const mod = ui.impModule.value;
    const q = (ui.impSearch.value || '').toLowerCase();
    return impModel.filter(
      (m) => (!mod || m.module === mod) && (!q || m.label.toLowerCase().includes(q) || m.path.toLowerCase().includes(q))
    );
  }

  /** Compute collision/validity flags across the selected batch + existing state. */
  function impFlags() {
    const seenK = existingKeySet();
    const seenS = existingShortcutSet();
    const kBad = new Set();
    const sBad = new Set();
    // Track within-batch duplicates
    const batchK = new Map();
    const batchS = new Map();
    impModel
      .filter((m) => m.selected && m.navigable)
      .forEach((m) => {
        const k = (m.key || '').trim().toLowerCase();
        if (k.length < MIN_KEY_LEN || seenK.has(k) || batchK.has(k)) kBad.add(m);
        batchK.set(k, m);
        const s = normShortcut(m.shortcut);
        if (s) {
          if (!SHORTCUT_RE.test(m.shortcut.trim()) || seenS.has(s) || batchS.has(s)) sBad.add(m);
          batchS.set(s, m);
        }
      });
    return { kBad, sBad };
  }

  function renderImport() {
    const rows = impVisible();
    const { kBad, sBad } = impFlags();
    ui.impList.textContent = '';

    if (!rows.length) {
      ui.impList.appendChild(el('div', { style: 'padding:20px;text-align:center;color:#888;' }, 'No matching actions.'));
      updateImpSummary(kBad, sBad);
      return;
    }

    rows.forEach((m) => {
      const row = el('div', { class: 'sf-row', style: 'padding-left:10px;' + (m.navigable ? '' : 'opacity:.45;') });

      const cbWrap = el('div', { class: 'sf-row-cb' });
      const cb = el('input', { type: 'checkbox' });
      cb.checked = m.selected;
      cb.disabled = !m.navigable;
      cb.addEventListener('change', () => {
        m.selected = cb.checked;
        renderImport();
      });
      cbWrap.appendChild(cb);
      row.appendChild(cbWrap);

      // label
      row.appendChild(el('div', { class: 'sf-row-label', title: m.label }, m.label + (m.navigable ? '' : '  (non-navigable)')));

      // key input
      const keyWrap = el('div', { style: 'flex:0 0 120px;' });
      if (m.navigable) {
        const kIn = el('input', { class: 'sf-input', value: m.key, placeholder: 'key (3+)', style: 'height:28px;font-size:12px;' });
        if (kBad.has(m)) kIn.classList.add('sf-error');
        kIn.addEventListener('input', () => {
          m.key = kIn.value.trim();
          impLiveFlags();
        });
        keyWrap.appendChild(kIn);
      } else keyWrap.appendChild(el('span', { style: 'color:#bbb;' }, '—'));
      row.appendChild(keyWrap);

      // shortcut input + record button
      const scWrap = el('div', { style: 'flex:0 0 160px;display:flex;gap:3px;align-items:center;' });
      if (m.navigable) {
        const sIn = el('input', { class: 'sf-input', value: m.shortcut, placeholder: 'e.g. ALT+X', style: 'height:28px;font-size:12px;flex:1;' });
        if (sBad.has(m)) sIn.classList.add('sf-error');
        sIn.addEventListener('input', () => {
          m.shortcut = sIn.value.trim().toUpperCase();
          impLiveFlags();
        });
        const recBtn = el('button', { class: 'sf-record-btn', title: 'Record shortcut', style: 'width:24px;height:24px;font-size:14px;' }, '●');
        recBtn.addEventListener('click', () => recordInto(recBtn, sIn, (val) => {
          m.shortcut = val;
          impLiveFlags();
        }));
        scWrap.appendChild(sIn);
        scWrap.appendChild(recBtn);
      } else scWrap.appendChild(el('span', { style: 'color:#bbb;' }, '—'));
      row.appendChild(scWrap);

      // module + path
      row.appendChild(el('div', { style: 'flex:0 0 110px;font-size:12px;color:#6a6d70;' }, m.module));
      row.appendChild(el('div', { class: 'sf-row-path', title: m.path }, m.path));

      ui.impList.appendChild(row);
    });
    updateImpSummary(kBad, sBad);
  }

  function impLiveFlags() {
    // cheap re-render keeps behaviour simple and correct
    renderImport();
  }

  function updateImpSummary(kBad, sBad) {
    const sel = impModel.filter((m) => m.selected && m.navigable).length;
    const problems = kBad.size + sBad.size;
    ui.impSummary.textContent = `${sel} selected${problems ? ` · ${problems} to fix` : sel ? ' · ready' : ''}`;
    ui.impSummary.style.color = problems ? '#bb0000' : '#6a6d70';
    const btn = root.querySelector("[data-action='impImport']");
    if (btn) {
      btn.disabled = sel === 0 || problems > 0;
      btn.style.opacity = btn.disabled ? '0.5' : '1';
    }
  }

  function impSetVisibleSelected(v) {
    impVisible().forEach((m) => {
      if (m.navigable) m.selected = v;
    });
    renderImport();
  }

  function impAutoAssignShortcuts() {
    const taken = existingShortcutSet();
    impModel.forEach((m) => {
      if (m.shortcut) taken.add(normShortcut(m.shortcut));
    });
    let n = 0;
    impModel.forEach((m) => {
      if (m.selected && m.navigable && !m.shortcut) {
        const sc = suggestShortcut(m.label, taken);
        if (sc) {
          m.shortcut = sc;
          n++;
        }
      }
    });
    showToast(n ? `Assigned ${n} shortcut(s).` : 'No free shortcuts available.');
    renderImport();
  }

  async function impDoImport() {
    const { kBad, sBad } = impFlags();
    if (kBad.size || sBad.size) {
      showToast('Resolve conflicts first.');
      return;
    }
    const chosen = impModel.filter((m) => m.selected && m.navigable);
    if (!chosen.length) {
      showToast('Nothing selected.');
      return;
    }
    for (const m of chosen) {
      await StateService.addCommand(m.key, {
        group: m.module || 'General',
        label: m.label,
        path: m.path,
        shortcut: m.shortcut || '',
        function: '',
        toggleable: false,
        system: false,
      });
    }
    showToast(`Imported ${chosen.length} command(s).`);
    chosen.forEach((m) => (m.selected = false));
    // Re-suggest keys for the rest so they dedupe against the newly added ones
    const takenKeys = existingKeySet();
    impModel.forEach((m) => {
      if (m.navigable && !m.selected) {
        // keep user-edited keys; only refresh auto ones that now collide
        if (!isValidKey(m.key, new Set([...takenKeys].filter((k) => k !== m.key.toLowerCase())))) {
          m.key = suggestKey(m.label, takenKeys);
        } else {
          takenKeys.add(m.key.toLowerCase());
        }
      }
    });
    QuickLauncher.refresh?.();
    render();
    renderImport();
  }

  function impExportCSV() {
    const chosen = impModel.filter((m) => m.selected && m.navigable);
    if (!chosen.length) {
      showToast('Nothing selected.');
      return;
    }
    const clean = (s) => String(s).replace(/,/g, ' ');
    let csv = 'group,key,label,path,shortcut\n';
    csv += chosen.map((m) => `${clean(m.module)},${m.key},${clean(m.label)},${m.path},${m.shortcut || ''}`).join('\n');
    download(csv, 'sf-actions-selected.csv', 'text/csv');
    showToast(`Exported ${chosen.length} row(s).`);
  }

  /** Generic shortcut recorder used by import rows (layout-independent). */
  function recordInto(btn, input, onDone) {
    const recording = btn.dataset.recording === 'true';
    if (recording) {
      btn.dataset.recording = 'false';
      btn.textContent = '●';
      btn.classList.remove('sf-recording');
      return;
    }
    btn.dataset.recording = 'true';
    btn.textContent = '■';
    btn.classList.add('sf-recording');
    input.value = '';
    const onKeyDown = (e) => {
      if (btn.dataset.recording !== 'true') {
        cleanup();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      const parts = [];
      if (e.ctrlKey) parts.push('CTRL');
      if (e.altKey) parts.push('ALT');
      if (e.shiftKey) parts.push('SHIFT');
      if (e.metaKey) parts.push('CMD');
      const k = recordKey(e);
      if (!['CTRL', 'ALT', 'SHIFT', 'CMD'].includes(k)) parts.push(k);
      input.value = parts.join('+');
    };
    const onKeyUp = (e) => {
      if (btn.dataset.recording !== 'true') return;
      const k = recordKey(e);
      if (!['CTRL', 'ALT', 'SHIFT', 'CMD'].includes(k)) {
        btn.dataset.recording = 'false';
        btn.textContent = '●';
        btn.classList.remove('sf-recording');
        onDone(input.value.trim().toUpperCase());
        cleanup();
      }
    };
    function cleanup() {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('keyup', onKeyUp, true);
    }
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('keyup', onKeyUp, true);
  }

  return { init, open, close, toggle, showToast, updateToggleState, addShellItemButton };
})();
