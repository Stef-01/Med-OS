/* ui.mjs — popover, dialog, confirm and toast for the study overlays (study kit, plan 2026-10-19-001 unit K2; audit
   problem 2: "popover ×3, dialog ×3, toast ×3", one of them named `alert`).

   One implementation, the module's own class names: each overlay passes a class map once (its stylesheet keeps
   working, unit K3 owns the sheets), the kit owns the behaviour:
     popover(anchor, html | items, opts) -> {el, close} | null     one at a time; a second call on the same anchor
         toggles it closed. Clamped to the viewport, flipped above the anchor when there is no room below, arrow keys
         walk the items, aria-expanded on the anchor, closed by a click outside, by Escape, or when the overlay closes.
     dialog({title, body, action, small, kind, …}) -> {el, close, kind, onClose}   a stack per overlay root;
         closeTop(root) pops the newest; Escape closes the top one; a click on the scrim or [data-ui="close"] closes;
         focus goes to [autofocus] / [data-focus] / the close button, and back to what opened it (inside the overlay).
     confirm({title, message, confirm, danger}) -> Promise<boolean>   a dialog with Cancel and one action.
     toast(root, text, {tone, ms}) -> el       stacked in the root (three at most), tone as a class, gone after ms.
   Escape and the arrow keys reach here through the stack's hook: the topmost overlay's popover, then its top dialog,
   then the overlay's own onKey. Nothing here reads a module's state. */

import * as stack from './stack.mjs';
import { reduced } from './util.mjs';
import { icon } from './icons.mjs';

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MARGIN = 12, GAP = 6;
const ITEM = '[role="option"], [role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"], [data-v], button:not([disabled]), input:not([disabled])';

/* ---------------------------------------------------------------- popover */
let pop = null;   /* { el, anchor, root, close } */
export const popoverOf = anchor => (pop && (!anchor || pop.anchor === anchor) ? pop : null);

export function popover(anchor, content, { role = 'menu', onPick, align = 'left', cls = {}, root = document.body, itemSel = ITEM, size, origin = false, flip = true, focusSel = false } = {}) {
  if (pop && pop.anchor === anchor) { pop.close(); return null; }   /* the same chip again: a toggle */
  closePopover();
  const r0 = root;
  const el = document.createElement('div');
  el.className = cls.pop || 'kit-pop';
  if (role) el.setAttribute('role', role);
  el.innerHTML = Array.isArray(content) ? items(content, cls) : content;
  r0.appendChild(el);
  const r = anchor.getBoundingClientRect(), vw = innerWidth, vh = innerHeight;
  if (size) { const mw = Math.min(size.max, vw - 2 * MARGIN); el.style.minWidth = `${Math.min(mw, Math.max(r.width, size.min))}px`; el.style.maxWidth = `${mw}px`; }
  const w = el.offsetWidth, h = el.offsetHeight;
  let x = align === 'right' ? r.right - w : r.left;
  if (align === 'auto') { if (x + w > vw - MARGIN) x = Math.max(MARGIN, r.right - w); }   /* under the chip, else flush with its right edge */
  else x = Math.max(MARGIN, Math.min(x, vw - w - MARGIN));
  const below = !flip || r.bottom + GAP + h <= vh - MARGIN;
  el.style.left = `${x}px`;
  el.style.top = `${below ? r.bottom + GAP : Math.max(MARGIN, r.top - GAP - h)}px`;
  if (origin) el.style.transformOrigin = align === 'right' ? 'top right' : align === 'left' ? 'top left' : `${r.left + r.width / 2 - x}px top`;
  if (cls.down || cls.up) el.classList.add(below ? cls.down : cls.up);
  void el.offsetWidth;
  if (cls.in) el.classList.add(cls.in);
  anchor.setAttribute('aria-expanded', 'true');
  const close = () => {
    if (pop?.el !== el) return;
    pop = null;
    anchor.setAttribute('aria-expanded', 'false');
    const a = document.activeElement, inside = !a || a === document.body || el.contains(a);
    if (cls.out) { el.classList.remove(cls.in); el.classList.add(cls.out); setTimeout(() => el.remove(), reduced() ? 0 : 200); } else el.remove();
    if (inside && anchor.isConnected) anchor.focus({ preventScroll: true });   /* focus never falls to the body under the overlay */
  };
  pop = { el, anchor, root: r0, close, itemSel };
  if (onPick) el.addEventListener('click', e => {
    const b = e.target.closest('[data-v], [data-mi]'); if (!b || !el.contains(b)) return;
    e.stopPropagation();
    const it = Array.isArray(content) ? content[+b.dataset.mi] : b.dataset.v;
    if (Array.isArray(content) && !it.keep) close();   /* html popovers close themselves (a multi-select stays open) */
    onPick(it, b);
  });
  ((focusSel && el.querySelector('[aria-selected="true"], [aria-checked="true"]')) || el.querySelector(itemSel))?.focus({ preventScroll: true });
  return pop;
}
function items(list, cls) {
  return list.map((it, k) => it.hr ? '<hr>' : `<button class="${cls.item || 'kit-mi'}${it.sel ? ` ${cls.on || 'on'}` : ''}" data-mi="${k}" role="${it.sel != null ? 'option' : 'menuitem'}"${it.sel != null ? ` aria-selected="${!!it.sel}"` : ''}>
    <span class="${cls.check || 'kit-mi-c'}">${it.sel != null ? (it.sel ? icon('check') : '') : it.icon || ''}</span><span class="${cls.text || 'kit-mi-t'}">${esc(it.label)}${it.desc ? `<small>${esc(it.desc)}</small>` : ''}</span></button>`).join('');
}
export function closePopover(root) { if (pop && (!root || pop.root === root)) pop.close(); }

/* a click outside the popover (and not on its anchor, which toggles) closes it; capture, so the module's own click
   handler already sees it gone */
if (typeof document !== 'undefined') document.addEventListener('pointerdown', e => {
  if (pop && !pop.el.contains(e.target) && !pop.anchor.contains(e.target)) pop.close();
}, true);

/* ---------------------------------------------------------------- dialogs */
const dialogs = [];   /* bottom → top across every overlay: { el, box, root, kind, close, onClose, prevFocus } */
export const dialogsOf = root => dialogs.filter(d => d.root === root);
export const topDialog = root => { for (let i = dialogs.length - 1; i >= 0; i--) if (dialogs[i].root === root) return dialogs[i]; return null; };
export const dialogOf = (root, kind) => dialogs.find(d => d.root === root && d.kind === kind) || null;

/* cls: { wrap, scrim, box, small, head, close, title, titleTag, act, body, in, out, role } */
export function dialog({ title = '', body = '', action = '', small = false, kind = '', cls = {}, extra = '', noHead = false, bare = false, label = '', root = document.body, onClose = null, closeMs = 220 } = {}) {
  closePopover();
  const prevFocus = document.activeElement;
  const el = document.createElement('div');
  el.className = cls.wrap || 'kit-dlg-wrap';
  const tag = cls.titleTag || 'h2';
  const head = noHead ? '' : `<header class="${cls.head || 'kit-dlg-h'}"><button class="${cls.close || 'kit-ic'}" data-ui="close" aria-label="Close">${icon('x')}</button><${tag}${cls.title ? ` class="${cls.title}"` : ''}>${esc(title)}</${tag}>${cls.act ? `<div class="${cls.act}">${action}</div>` : action || '<span></span>'}</header>`;
  const aria = `role="${cls.role || 'dialog'}" aria-modal="true" aria-label="${esc(label || title || kind)}"`;
  const inner = `${head}${cls.body ? `<div class="${cls.body}">${body}</div>` : body}`;
  if (bare) { el.setAttribute('role', cls.role || 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', label || title || kind); el.innerHTML = inner; }   /* the wrap is the dialog (a lightbox) */
  else el.innerHTML = `${cls.scrim ? `<div class="${cls.scrim}" data-ui="close"></div>` : ''}<div class="${[cls.box || 'kit-dlg', small ? cls.small || 'small' : '', extra].filter(Boolean).join(' ')}" ${aria}>${inner}</div>`;
  root.appendChild(el);
  const box = bare ? el : el.querySelector('[role]');
  const d = { el, box, root, kind, onClose, prevFocus, close: instant => closeDialog(d, instant) };
  dialogs.push(d);
  void el.offsetWidth;
  if (cls.in) el.classList.add(cls.in);
  el.addEventListener('click', e => { if (e.target === el || e.target.closest('[data-ui="close"]')) d.close(); });
  (box.querySelector('[autofocus], [data-focus]') || box.querySelector('[data-ui="close"], button:not([disabled])'))?.focus({ preventScroll: true });
  d.cls = cls; d.closeMs = closeMs;
  return d;
}
function closeDialog(d, instant) {
  const i = dialogs.indexOf(d);
  if (i < 0) return;
  dialogs.splice(i, 1);
  closePopover();
  d.onClose?.();
  const { cls } = d;
  if (instant || !cls.out && !cls.in) d.el.remove();
  else {
    if (cls.in) d.el.classList.remove(cls.in);
    if (cls.out) d.el.classList.add(cls.out);
    setTimeout(() => d.el.remove(), reduced() ? 0 : d.closeMs);
  }
  /* focus goes back to what opened the dialog, inside the overlay (e2e dom [shell/*]) */
  /* a repaint while it was open may have replaced the opener: its twin (the same data-os / data-ui / id) stands in */
  const twinOf = el => { if (!el) return null; for (const k of ['os', 'ui', 'pl']) if (el.dataset?.[k]) return d.root.querySelector(`[data-${k}="${CSS.escape(el.dataset[k])}"]`); return el.id ? d.root.querySelector(`#${CSS.escape(el.id)}`) : null; };
  const live = d.prevFocus?.isConnected ? d.prevFocus : twinOf(d.prevFocus);
  const from = live && d.root.contains(live) && live.getClientRects().length ? live : d.root.querySelector('button:not([disabled])');
  from?.focus({ preventScroll: true });
}
export function closeTop(root, instant) { const d = topDialog(root); if (d) d.close(instant); return !!d; }
export function closeAllDialogs(root, instant = true) { while (closeTop(root, instant)); }

/* cls (on top of the dialog's map): { confirm, crow, btn, danger, focus: 'cancel' | 'confirm' } */
export function confirm({ title = '', message = '', confirm: label = 'Confirm', cancel = 'Cancel', cls = {}, root, kind = 'confirm', small = true, extra = '' } = {}) {
  return new Promise(res => {
    let ok = false;
    const d = dialog({ kind, noHead: true, small, extra, cls, root, label: title || message, onClose: () => res(ok),
      body: `<div class="${cls.confirm || 'kit-confirm'}">${title ? `<h2>${esc(title)}</h2>` : ''}${message ? `<p>${esc(message)}</p>` : ''}
      <div class="${cls.crow || 'kit-crow'}"><button class="${cls.btn || 'kit-btn'}" data-ui="close"${cls.focus === 'cancel' ? ' autofocus' : ''}>${esc(cancel)}</button><button class="${cls.danger || cls.btn || 'kit-btn'}" data-ui="ok"${cls.focus === 'cancel' ? '' : ' autofocus'}>${esc(label)}</button></div></div>` });
    d.box.querySelector('[data-ui="ok"]').addEventListener('click', () => { ok = true; d.close(); });
  });
}

/* ---------------------------------------------------------------- toast */
export function toast(root, text, { tone = '', ms = 5000, cls = {} } = {}) {   /* eMedici AlertsElement.duration 5000 (P2 lift) */
  if (!root || !text) return null;
  const el = document.createElement('div');
  el.className = `${cls.item || 'kit-toast'}${tone ? ` ${tone}` : ''}`;
  el.setAttribute('role', 'status');
  el.textContent = text;
  root.appendChild(el);
  while (root.children.length > 3) root.firstElementChild.remove();
  void el.offsetWidth;
  el.classList.add(cls.in || 'in');
  setTimeout(() => { el.classList.remove(cls.in || 'in'); if (cls.out) el.classList.add(cls.out); setTimeout(() => el.remove(), 300); }, ms);
  return el;
}

/* ---------------------------------------------------------------- keys, through the stack */
export function onKey(e, top) {
  const root = top.el;
  const p = pop && pop.root === root ? pop : null;
  if (e.key === 'Escape') {
    if (p) { e.preventDefault(); const a = p.anchor; p.close(); if (a.isConnected) a.focus({ preventScroll: true }); return true; }
    if (closeTop(root)) { e.preventDefault(); return true; }
    return false;
  }
  if (p && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
    const os = [...p.el.querySelectorAll(p.itemSel)].filter(x => x.getClientRects().length), i = os.indexOf(document.activeElement);
    if (!os.length) return true;
    e.preventDefault(); os[(i + (e.key === 'ArrowDown' ? 1 : -1) + os.length) % os.length].focus({ preventScroll: true });
    return true;
  }
  if (e.key === 'Tab') { const d = topDialog(root); if (d) { stack.trap(e, d.el); return true; } }
  return false;
}
stack.hook(onKey);
