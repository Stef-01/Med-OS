/* stack.mjs — the overlay stack (study kit, plan 2026-10-19-001 unit K1).

   Learn's features are full-screen overlays that stack: the home (.lh) under the deck (.lx), Notes (.nt), the Question
   Bank (.mq), OSCE Practice (.os) and Case Studies (.cs). Before this module each one registered its own window-capture
   keydown listener and kept its own hand-written list of "overlays that may be above me"; the lists drifted and the
   app's global shortcuts (t, r, /, 1-9) leaked under OSCE (audit 2026-10-19, problem 1).

   The law: the topmost overlay owns every key. One window-capture keydown listener dispatches to the top entry's onKey,
   traps Tab inside it when onKey did not, and stops the event there: nothing below (another overlay, index.html's
   shortcuts) ever sees it. An overlay pushes itself on open and pops on close; `above(el)` replaces the lists.
   Pure bookkeeping apart from the one listener; `trap` is exported for modules that root the Tab ring in a dialog. */

const entries = [];   /* bottom → top: { el, onKey } */
let wired = false;

/* what Tab moves between: the same selector for every overlay (audit: four traps had four selectors, one lost inputs) */
export const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), summary, a[href], [tabindex]:not([tabindex="-1"])';

export function push(el, { onKey } = {}) {
  pop(el);
  entries.push({ el, onKey: typeof onKey === 'function' ? onKey : null });
  wire();
}
export function pop(el) {
  const i = entries.findIndex(x => x.el === el);
  if (i >= 0) entries.splice(i, 1);
}
export const top = () => entries[entries.length - 1] || null;
export const isTop = el => (top() ? top().el === el : false);
/* is another overlay stacked over this one? (replaces the ':not([hidden])' selector lists) */
export const above = el => { const i = entries.findIndex(x => x.el === el); return i >= 0 && i < entries.length - 1; };
export const depth = () => entries.length;

/* keep focus inside root: Tab from the last focusable wraps to the first, Shift+Tab the other way */
export function trap(e, root) {
  if (!root) return;
  const f = [...root.querySelectorAll(FOCUSABLE)].filter(x => x.getClientRects().length && getComputedStyle(x).visibility !== 'hidden');
  if (!f.length) return;
  const i = f.indexOf(document.activeElement);
  e.preventDefault();
  f[e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : (i + 1) % f.length].focus();
}

/* layers inside the top overlay that own a key before the overlay does: ui.mjs registers one for its popovers and
   dialogs (Escape closes the topmost popover, then the top dialog; arrows walk a popover; Tab stays in a dialog).
   A hook returns true when it handled the key; the overlay's onKey then never sees it. */
const hooks = [];
export function hook(fn) { if (typeof fn === 'function' && !hooks.includes(fn)) hooks.push(fn); }

function dispatch(e) {
  const t = top();
  if (!t) return;
  if (hooks.some(h => h(e, t))) { e.stopImmediatePropagation(); return; }
  if (t.onKey) t.onKey(e);
  if (e.key === 'Tab' && !e.defaultPrevented) trap(e, t.el);
  e.stopImmediatePropagation();
}
function wire() {
  if (wired || typeof window === 'undefined') return;
  wired = true;
  addEventListener('keydown', dispatch, true);
}
