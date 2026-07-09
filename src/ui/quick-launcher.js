import { StateService } from '../services/state-service.js';
import { SuccessFactorsAdapter } from '../services/successfactors-adapter.js';
import { UsageService, fuzzyMatch } from '../services/usage-service.js';
import { EnvironmentService } from '../services/environment-service.js';
import { el, esc } from '../utils/dom.js';

/**
 * QuickLauncher
 * -------------
 * Responsibility : floating top-left button that opens a grouped list of quick
 *                  links (commands whose path is a URL). Clicking a link opens
 *                  it in a new tab.
 * Public API     : init, setVisible, refresh, onManageClick
 * Dependencies   : StateService, SuccessFactorsAdapter, dom utils
 */
export const QuickLauncher = (() => {
  let menu = null;
  let container = null;
  let collapsed = {};
  let manageCb = () => {};
  let position = 'top-left';
  let lastSignature = null; // tracks the data the menu was last built from
  let dirty = true; // menu needs rebuilding before next open
  let searchQuery = ''; // Launcher 2.0 fuzzy filter

  const CORNER_CSS = {
    'top-left': 'top:10px; left:5px;',
    'top-right': 'top:10px; right:5px;',
    'bottom-left': 'bottom:10px; left:5px;',
    'bottom-right': 'bottom:10px; right:5px;',
  };

  function applyPosition() {
    if (!container) return;
    container.style.cssText = `position:fixed; ${CORNER_CSS[position] || CORNER_CSS['top-left']} z-index:999996;`;
    if (menu) {
      const isBottom = position.startsWith('bottom');
      const isRight = position.endsWith('right');
      // Open menu away from the screen edge the button sits on.
      menu.style.top = isBottom ? 'auto' : '40px';
      menu.style.bottom = isBottom ? '40px' : 'auto';
      menu.style.left = isRight ? 'auto' : '0';
      menu.style.right = isRight ? '0' : 'auto';
    }
  }

  function setPosition(pos) {
    position = pos || 'top-left';
    applyPosition();
  }

  function init(initialPosition) {
    position = initialPosition || 'top-left';
    const rootEl = el('div', { id: 'sfQuickLauncher-root' });
    container = el('div', { id: 'sfQuickLauncher-container' });

    const toggle = el('button', { id: 'sfQuickLauncher-toggle' });
    toggle.innerHTML =
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M6 2C4.9 2 4 2.9 4 4V22L12 18L20 22V4C20 2.9 19.1 2 18 2H6Z"/></svg> Quick Links';

    // Environment pill (Module 1). Non-blocking: fill in async once resolved.
    const envPill = el('span', {
      id: 'sf-ql-env',
      style:
        'display:none;align-items:center;gap:4px;margin-left:6px;padding:1px 7px;border-radius:10px;font-size:10px;background:rgba(255,255,255,.22);',
    });
    toggle.append(envPill);
    EnvironmentService.get()
      .then((env) => {
        envPill.textContent = `${env.icon} ${env.label}`;
        envPill.style.display = 'inline-flex';
      })
      .catch(() => {});

    const badge = el('span', {
      id: 'sf-keepalive-badge',
      title: 'Keep Alive is ON',
      style:
        'display:none;width:8px;height:8px;border-radius:50%;background:#4cff91;box-shadow:0 0 5px #4cff91;margin-left:4px;',
    });
    toggle.append(badge);

    menu = el('div', { id: 'sfQuickLauncher-menu' });
    container.append(toggle, menu);
    rootEl.append(container);
    document.body.appendChild(rootEl);
    applyPosition();

    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = menu.style.display === 'block';
      if (isOpen) {
        menu.style.display = 'none';
      } else {
        ensureBuilt(); // build only if data changed since last build
        menu.style.display = 'block';
      }
    });
    document.addEventListener('click', (e) => {
      if (menu.style.display === 'block' && !container.contains(e.target)) {
        menu.style.display = 'none';
      }
    });
  }

  function buildTree() {
    const cmds = StateService.getCommands();
    const sorted = StateService.getGroupsSorted();
    const tree = {};
    sorted.forEach((g) => {
      tree[g.name] = [];
    });
    Object.entries(cmds)
      .filter(([, v]) => v.path && v.path.startsWith('/'))
      .forEach(([k, v]) => {
        const g = (v.group || 'General').trim();
        (tree[g] = tree[g] || []).push([k, v]);
      });
    return tree;
  }

  /**
   * Cheap signature of the data that affects the menu (group order + each
   * navigable command's key/label/path/group). If unchanged, the existing DOM
   * is reused — no rebuild. This is what stops SF's DOM churn from forcing
   * constant re-renders.
   */
  function signature() {
    const cmds = StateService.getCommands();
    const groups = StateService.getGroupsSorted()
      .map((g) => g.name)
      .join('|');
    const links = Object.entries(cmds)
      .filter(([, v]) => v.path && v.path.startsWith('/'))
      .map(([k, v]) => `${k}:${v.label || ''}:${v.path}:${v.group || ''}`)
      .sort()
      .join('~');
    // Favorites affect the pinned section, so include them in the signature.
    const favs = UsageService.favorites().join(',');
    return `${groups}#${links}#fav:${favs}#q:${searchQuery}`;
  }

  /** Build the menu DOM only when the data that affects it actually changed. */
  function ensureBuilt() {
    if (!menu) return;
    const sig = signature();
    // Reuse existing DOM when the signature matches and the menu is populated —
    // regardless of the dirty hint, since the signature is authoritative.
    if (sig === lastSignature && menu.childElementCount > 0) {
      dirty = false;
      return;
    }
    build();
    lastSignature = sig;
    dirty = false;
  }

  /** Render a single command row with a favorite star. */
  function commandRow(k, v) {
    const item = el('div', { class: 'sf-ql-item', title: v.label || k });
    const star = el('span', {
      class: 'sf-ql-star',
      title: 'Favorite',
      style: 'flex:0 0 auto;cursor:pointer;',
      text: UsageService.isFavorite(k) ? '★' : '☆',
    });
    star.addEventListener('click', async (e) => {
      e.stopPropagation();
      await UsageService.toggleFavorite(k);
      dirty = true;
      ensureBuilt();
    });
    const label = el('span', { class: 'sf-ql-label', text: v.label || k });
    const arrow = el('span', { class: 'sf-ql-arrow', text: '↗' });
    item.append(star, label, arrow);
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      UsageService.touch(k);
      window.open(SuccessFactorsAdapter.navUrl(v.path), '_blank', 'noopener,noreferrer');
      menu.style.display = 'none';
    });
    return item;
  }

  function sectionHeader(text) {
    return el('div', {
      class: 'sf-ql-section',
      text,
      style: 'padding:5px 12px;font-size:10px;text-transform:uppercase;color:#8a8d90;font-weight:600;letter-spacing:.4px;background:#fafafa;',
    });
  }

  function build() {
    const cmds = StateService.getCommands();
    const navCmds = Object.fromEntries(
      Object.entries(cmds).filter(([, v]) => v.path && v.path.startsWith('/'))
    );
    const frag = document.createDocumentFragment();
    const q = searchQuery.trim();

    // ── Search box (Launcher 2.0) ──
    const searchWrap = el('div', { style: 'padding:8px 10px;border-bottom:1px solid #eee;background:#fff;' });
    const search = el('input', {
      class: 'sf-ql-search',
      placeholder: '🔍 search…',
      value: searchQuery,
      style: 'width:100%;height:30px;border:1px solid #ccc;border-radius:5px;padding:0 8px;font:inherit;font-size:13px;box-sizing:border-box;',
    });
    // Debounced-ish: rebuild on input but keep focus by re-querying the new node.
    search.addEventListener('input', () => {
      searchQuery = search.value;
      dirty = true;
      ensureBuilt();
      const again = menu.querySelector('.sf-ql-search');
      if (again) {
        again.focus();
        again.setSelectionRange(again.value.length, again.value.length);
      }
    });
    searchWrap.append(search);
    frag.append(searchWrap);

    const matches = (k, v) => !q || fuzzyMatch(q, v.label || k) || fuzzyMatch(q, v.path);

    // ── Favorites / Recent / Frequent (only when NOT searching) ──
    if (!q) {
      const favKeys = UsageService.favorites().filter((k) => navCmds[k]);
      if (favKeys.length) {
        frag.append(sectionHeader('★ Favorites'));
        favKeys.forEach((k) => frag.append(commandRow(k, navCmds[k])));
      }
      const recentKeys = UsageService.recent().filter((k) => navCmds[k]).slice(0, 8);
      if (recentKeys.length) {
        frag.append(sectionHeader('🕘 Recently used'));
        recentKeys.forEach((k) => frag.append(commandRow(k, navCmds[k])));
      }
      const freqKeys = UsageService.frequent(6).filter((k) => navCmds[k]);
      if (freqKeys.length) {
        frag.append(sectionHeader('🔥 Frequently used'));
        freqKeys.forEach((k) => frag.append(commandRow(k, navCmds[k])));
      }
    }

    // ── Grouped list (all commands, or search results) ──
    const tree = buildTree();
    let anyGroup = false;
    Object.entries(tree).forEach(([group, items]) => {
      const filtered = items.filter(([k, v]) => matches(k, v));
      if (!filtered.length) return;
      anyGroup = true;
      const isCollapsed = !!collapsed[group] && !q; // expand all while searching

      const header = el('div', { class: 'sf-ql-group-header' });
      header.innerHTML = `<span><span class="sf-arrow" style="display:inline-block;margin-right:5px;transition:transform .15s;transform:${
        isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)'
      };">▾</span>📁 ${esc(group)}<span style="margin-left:5px;font-size:10px;color:#888;font-weight:normal;">(${filtered.length})</span></span>`;

      const body = el('div', { style: `display:${isCollapsed ? 'none' : 'block'}` });
      header.addEventListener('click', () => {
        collapsed[group] = !collapsed[group];
        const arrow = header.querySelector('.sf-arrow');
        arrow.style.transform = collapsed[group] ? 'rotate(-90deg)' : 'rotate(0deg)';
        body.style.display = collapsed[group] ? 'none' : 'block';
      });
      frag.append(header);
      filtered.forEach(([k, v]) => body.append(commandRow(k, v)));
      frag.append(body);
    });

    if (!anyGroup && q) {
      frag.append(el('div', { style: 'padding:14px;color:#888;font-size:13px;' }, 'No matching commands.'));
    }

    const manage = el('div', { class: 'sf-ql-manage' });
    manage.innerHTML = '<span>⚙</span><span>Manage Commands</span>';
    manage.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.style.display = 'none';
      manageCb();
    });
    frag.append(manage);

    // Single DOM swap — replace all children in one operation.
    menu.replaceChildren(frag);
  }

  const setVisible = (visible) => {
    if (container) container.style.display = visible ? '' : 'none';
  };

  /**
   * Mark the menu as needing a rebuild. Does NOT touch the DOM — the actual
   * rebuild is deferred until the menu is next opened (and only if the data
   * truly changed). Safe to call frequently.
   */
  const refresh = () => {
    dirty = true;
    // If the menu is currently open, rebuild it now so the user sees the change.
    if (menu && menu.style.display === 'block') ensureBuilt();
  };

  const onManageClick = (cb) => {
    manageCb = cb || (() => {});
  };

  return { init, setVisible, refresh, onManageClick, setPosition };
})();
