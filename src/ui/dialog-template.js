/**
 * Trusted static HTML shell for the main dialog. Contains NO user data — all
 * dynamic rows are built with safe DOM builders in ui-manager.js. Safe to
 * assign via innerHTML because every token here is authored, not user input.
 */
export const DIALOG_HTML = `
<div id="sf-overlay"></div>
<div class="sf-dialog" id="sf-dialog" role="dialog" aria-modal="true" aria-label="SF Power User Tool">
  <div class="sf-dlg-header">
    <div class="sf-dlg-title">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M6 2C4.9 2 4 2.9 4 4V22L12 18L20 22V4C20 2.9 19.1 2 18 2H6Z"/></svg>
      SF Power User Tool
    </div>
    <button class="sf-btn-icon" data-action="close" title="Close (Esc)" aria-label="Close">✕</button>
  </div>

  <div class="sf-env-banner" data-role="env-banner" style="display:none;"></div>

  <div class="sf-dlg-tabs">
    <button class="sf-tab sf-tab-active" data-tab="commands">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg>
      Commands
    </button>
    <button class="sf-tab" data-tab="features">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.47.47 0 0 0-.59.22L2.74 8.87a.47.47 0 0 0 .12.61l2.03 1.58c-.05.3-.07.63-.07.94s.02.64.07.94l-2.03 1.58a.47.47 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.47.47 0 0 0-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>
      Features
      <span class="sf-feat-badge" id="sf-feat-on-count"></span>
    </button>
    <button class="sf-tab" data-tab="import">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zm-8 2V5h2v6h1.17L12 13.17 9.83 11H11zm-6 7h14v2H5v-2z"/></svg>
      Import Actions
    </button>
  </div>

  <div class="sf-dlg-body" id="sf-pane-commands">
    <div class="sf-search-wrap">
      <input class="sf-input" data-role="search" placeholder="🔍  Search commands…" />
      <button class="sf-btn-ghost" data-action="resetSearch" title="Clear search">⟲</button>
    </div>

    <div class="sf-form-area">
      <div class="sf-field sf-field-key">
        <input class="sf-input" data-role="key" placeholder="key" />
        <span class="sf-err-msg" data-err="key"></span>
      </div>
      <div class="sf-field sf-field-label">
        <input class="sf-input" data-role="label" placeholder="label" />
        <span class="sf-err-msg" data-err="label"></span>
      </div>
      <div class="sf-field sf-field-shortcut">
        <div class="sf-shortcut-row">
          <input class="sf-input" data-role="shortcut" placeholder="e.g. ALT+X" style="flex:1;" />
          <button class="sf-record-btn" data-action="recordShortcut" data-recording="false" title="Record shortcut">●</button>
        </div>
        <span class="sf-err-msg" data-err="shortcut"></span>
      </div>
      <div class="sf-field sf-field-path">
        <input class="sf-input" data-role="path" placeholder="path e.g. /sf/home" />
        <span class="sf-err-msg" data-err="path"></span>
      </div>
      <div class="sf-field sf-field-group">
        <select class="sf-input" data-role="group" style="height:34px; padding:0 6px; cursor:pointer;"></select>
        <span class="sf-err-msg" data-err="group"></span>
      </div>
      <div class="sf-form-actions">
        <button class="sf-btn-primary" data-action="add" title="Add / Save command">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M19 11h-6V5h-2v6H5v2h6v6h2v-6h6z"/></svg>
          Save
        </button>
        <button class="sf-btn-default" data-action="clear" title="Clear form">Clear</button>
      </div>
    </div>

    <div class="sf-group-mgmt" style="border-bottom:none;padding-bottom:0;">
      <span class="sf-group-mgmt-label">⚡ Quick add:</span>
      <button class="sf-btn-xs sf-btn-xs-primary" data-action="capturePage" title="Add the page you're currently on as a command">+ Add current page</button>
      <span data-role="quickadd-msg" style="font-size:11px;color:#6a6d70;"></span>
    </div>

    <div class="sf-group-mgmt">
      <input class="sf-new-group-input" data-role="new-group" placeholder="New group name…" />
      <button class="sf-btn-xs sf-btn-xs-primary" data-action="addGroup">+ Add Group</button>
      <span data-err="group-create" style="color:#bb0000; font-size:11px;"></span>
      <div style="margin-left:auto; display:flex; gap:6px;">
        <button class="sf-btn-xs" data-action="expandAll">↕ Expand All</button>
        <button class="sf-btn-xs" data-action="collapseAll">↕ Collapse All</button>
      </div>
    </div>

    <div class="sf-bulk-bar" data-role="bulk-bar">
      <span data-role="bulk-count">0 selected</span>
      <span>→ Move to:</span>
      <select class="sf-bulk-select" data-role="bulk-group"></select>
      <button class="sf-btn-xs sf-btn-xs-primary" data-action="bulkMove">Move</button>
      <button class="sf-btn-xs" data-action="bulkClear" style="margin-left:4px;">✕ Clear</button>
    </div>

    <div class="sf-sort-bar">
      <span>Sort by:</span>
      <button class="sf-sort-btn" data-sort="key">Key</button>
      <button class="sf-sort-btn" data-sort="label">Label</button>
      <button class="sf-sort-btn" data-sort="shortcut">Shortcut</button>
      <span class="sf-sort-ind" data-role="sort-indicator"></span>
    </div>

    <div class="sf-col-header">
      <div style="flex:0 0 18px;"></div>
      <div style="flex:0 0 12px;"></div>
      <div style="flex:0 0 100px;">KEY</div>
      <div style="flex:2;">LABEL</div>
      <div style="flex:0 0 110px;">SHORTCUT</div>
      <div style="flex:3;">PATH</div>
      <div style="flex:0 0 80px; text-align:right;">ACTIONS</div>
    </div>

    <div class="sf-list" data-role="list"></div>
  </div>

  <div class="sf-dlg-body" id="sf-pane-features" style="display:none;">
    <div class="sf-feat-notice">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0;opacity:.55"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
      Feature states are saved automatically and restored on every page load.
    </div>
    <div class="sf-feat-grid" id="sf-feat-grid"></div>
  </div>

  <div class="sf-dlg-body" id="sf-pane-import" style="display:none;">
    <div class="sf-feat-notice">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0;opacity:.55"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
      Reads the Actions Search list live from SuccessFactors. Pick actions, adjust the suggested key/shortcut (keys need 3+ characters and must be unique), then import.
    </div>
    <div class="sf-search-wrap">
      <select class="sf-input" data-role="imp-module" style="flex:0 0 220px;cursor:pointer;"></select>
      <input class="sf-input" data-role="imp-search" placeholder="🔍  filter by label or path…" />
      <button class="sf-btn-ghost" data-action="impReload" title="Reload from SuccessFactors">↻</button>
    </div>
    <div class="sf-group-mgmt">
      <button class="sf-btn-xs" data-action="impSelAll">Select all (visible)</button>
      <button class="sf-btn-xs" data-action="impSelNone">Clear</button>
      <button class="sf-btn-xs" data-action="impAutoSc">⌨ Auto-assign shortcuts</button>
      <span data-role="imp-summary" style="margin-left:auto;font-size:12px;color:#6a6d70;">—</span>
    </div>
    <div class="sf-list" data-role="imp-list" style="max-height:340px;"></div>
    <div class="sf-dlg-footer" style="border-top:none;padding-left:0;padding-right:0;">
      <button class="sf-btn-default" data-action="impExport">Export selected as CSV</button>
      <button class="sf-btn-primary" data-action="impImport" style="margin-left:auto;">Import selected → commands</button>
    </div>
  </div>

  <div class="sf-dlg-footer">
    <label class="sf-import-label" title="Import commands from CSV">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/></svg>
      Import CSV
      <input type="file" data-action="import" accept=".csv" style="display:none;" />
    </label>
    <button class="sf-btn-default" data-action="export">Export CSV</button>
    <button class="sf-btn-default" data-action="template">Template</button>
    <button class="sf-btn-danger" data-action="reset">Reset Storage</button>
  </div>
</div>`;
