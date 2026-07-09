/**
 * DOM helpers.
 *
 * Security note: the original userscript built rows with innerHTML and
 * user-controlled strings. This module centralises a hardened escape helper and
 * safe element builders so no module ever concatenates untrusted data into HTML.
 */

/** Escape a string for safe interpolation into HTML text/attribute context. */
export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Create an element with attributes and children. Text children are appended
 * as text nodes (never parsed as HTML), eliminating an entire class of XSS.
 */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v; // caller must guarantee trusted
    else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === 'dataset' && typeof v === 'object') {
      Object.assign(node.dataset, v);
    } else {
      node.setAttribute(k, v);
    }
  }
  for (const child of [].concat(children)) {
    if (child == null) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

/** Depth-first querySelectorAll that also descends into open shadow roots. */
export function findDeep(selector, root = document) {
  const results = [];
  (function traverse(node) {
    if (!node) return;
    if (node.querySelectorAll) results.push(...node.querySelectorAll(selector));
    if (node.shadowRoot) traverse(node.shadowRoot);
    node.childNodes?.forEach(traverse);
  })(root);
  return results;
}

/** Dispatch a synthetic bubbling click. */
export function triggerClick(target) {
  if (!target) return;
  target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
}

/** Small debounce used to throttle MutationObserver callbacks. */
export function debounce(fn, wait = 150) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}
