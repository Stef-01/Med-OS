/* overlay.mjs — the full-screen overlay shell (study kit, plan 2026-10-19-001 unit K2; audit problem 2: "overlay
   open/close ×5, with drift: only mcq restores documentElement.overflow, honours reduced motion and checks the opener
   is visible").

   createOverlay({cls, label, onKey, onClose, closeMs}) -> { el, open(opener), close(), isOpen }
     el      the overlay root: <div class="cls" role="dialog" aria-modal="true" aria-label="label" hidden>, appended to
             the body once; the module renders into it and keeps it for ever (an overlay is built once, opened many times).
     open    locks scrolling on the body AND the html element (the app page under an overlay can be wider than the phone,
             QA.md 5), shows the root with the `in` class (a reflow between, so the transition runs), and pushes it on the
             stack with the module's onKey: from now on the overlay owns every key.
     close   pops the stack, closes the kit's dialogs and popover that belong to this root, restores both overflows, runs
             the `out` class (gone at once under reduced motion, after closeMs otherwise), calls onClose, and returns
             focus to the opener only if it is still in the document and visible.
   The module keeps its own data-ready marks, timers and memory; this is only the shell. */

import * as stack from './stack.mjs';
import { reduced } from './util.mjs';
import { closePopover, closeAllDialogs } from './ui.mjs';

export function createOverlay({ cls = 'kit-overlay', label = '', onKey = null, onClose = null, closeMs = 220 } = {}) {
  const el = document.createElement('div');
  el.className = cls; el.hidden = true;
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', label);
  document.body.appendChild(el);
  let open = false, opener = null, prevBody = '', prevHtml = '', t = 0;
  return {
    el,
    get isOpen() { return open; },
    open(from) {
      if (open) return;
      open = true; opener = from || null;
      clearTimeout(t);
      prevBody = document.body.style.overflow; prevHtml = document.documentElement.style.overflow;
      document.body.style.overflow = 'hidden'; document.documentElement.style.overflow = 'hidden';
      el.hidden = false;
      el.classList.remove('out', 'in'); void el.offsetWidth; el.classList.add('in');
      stack.push(el, { onKey });
    },
    close() {
      if (!open) return;
      open = false;
      stack.pop(el);
      closeAllDialogs(el); closePopover(el);
      document.body.style.overflow = prevBody; document.documentElement.style.overflow = prevHtml;
      el.classList.add('out');
      const gone = () => { if (!open) { el.hidden = true; el.classList.remove('out', 'in'); } };
      if (reduced()) gone(); else t = setTimeout(gone, closeMs);
      onClose?.();
      if (opener && opener.isConnected && opener.getClientRects().length) opener.focus({ preventScroll: true });
      opener = null;
    },
  };
}
