/* util.mjs — small helpers every study overlay wrote for itself (study kit, plan 2026-10-19-001 unit K2):
   the wide-layout and reduced-motion media queries, relative time and the en-AU date format. One answer each: the
   audit found "just now" meant under 60 s in one module and under 45 s in another. */

export const WIDE = '(min-width: 900px)';
export const wide = () => { try { return matchMedia(WIDE).matches; } catch { return false; } };
export const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

export function fmtDate(ms) {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '';
  try { return d.toLocaleString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch { return ''; }
}
/* grow or fold an element by its scroll height: eMedici's HeightTransition (HeightTransition.vue sets height 0 → scrollHeight;
   .height-transition-enter-from is opacity 0 + translateY(-10px), .45s --ease-out, clip-path inset(0)). Instant under
   reduced motion or without WAAPI. An element already animating is cut to its end state first, so a double tap never
   leaves it half-folded. */
export const EASE_OUT = 'cubic-bezier(.36,.66,.04,1)', DUR = 450;
export function heightAnim(el, open, done) {
  if (!el) return;
  el.getAnimations?.().forEach(a => a.finish());
  if (reduced() || !el.animate) { el.style.height = ''; done?.(); return; }
  const h = el.scrollHeight;
  el.style.overflow = 'hidden'; el.style.clipPath = 'inset(0)';
  const from = { height: '0px', opacity: 0, transform: 'translateY(-10px)' }, to = { height: `${h}px`, opacity: 1, transform: 'none' };
  const an = el.animate(open ? [from, to] : [to, from], { duration: DUR, easing: EASE_OUT });
  an.onfinish = () => { el.style.overflow = ''; el.style.clipPath = ''; done?.(); };
}
/* a burst of particles from an anchor (full marks); the particle carries the module's class for its size and shape.
   Defaults are the deck's radial burst. `up` is eMedici's dom-confetti shape (animate.ts confetti(): angle 90, spread 90,
   startVelocity 20, 20 pieces, 2000 ms, one colour): an upward spray under gravity. `colors` may be CSS variables when
   the root resolves them. */
/* eMedici's pulse() (shared/utils/animate.ts): a scale peak at the midpoint, ease-in-out; nothing under reduced motion.
   Bookmarks on save, counters on growth, a card on Add to Queue. */
export function pulse(el, scale = 1.1, ms = 200) {
  if (!el || !el.animate || reduced()) return;
  try { el.animate([{ transform: `scale(${scale})`, offset: 0.5 }], { duration: ms, easing: 'ease-in-out' }); } catch {}
}
export function confetti(root, anchor, { cls = 'kit-conf', n = 28, colors, ms, up = false } = {}) {
  if (reduced() || !anchor || !root) return;
  const r = anchor.getBoundingClientRect(), x = up ? r.left + r.width / 2 : r.left + Math.min(r.width, 60) / 2 + 14, y = r.top + r.height / 2;
  const cols = colors || ['#00b7db', '#00a37a', '#f2a20d', '#f24e0d', '#a7a9ff', '#ededed'];
  for (let k = 0; k < n; k++) {
    const p = document.createElement('i');
    p.className = cls;
    p.style.cssText = `left:${x}px;top:${y}px;background:${cols[k % cols.length]};`;
    root.appendChild(p);
    const ang = up ? -Math.PI / 2 + (Math.random() - 0.5) * Math.PI / 2 : Math.random() * Math.PI * 2;
    const v = up ? 90 + Math.random() * 110 : 60 + Math.random() * 110;
    const dx = Math.cos(ang) * v, dy = Math.sin(ang) * v - (up ? 0 : 70);
    const dur = ms || 900 + Math.random() * 400;
    p.animate([{ transform: 'translate(-50%,-50%) rotate(0) scale(1)', opacity: 1 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${Math.random() * 540}deg) scale(1)`, opacity: 1, offset: up ? 0.35 : 0.6 },
      { transform: `translate(calc(-50% + ${dx * (up ? 1.6 : 1.2)}px), calc(-50% + ${dy + (up ? 260 : 120)}px)) rotate(${Math.random() * 720}deg) scale(.6)`, opacity: 0 }],
    { duration: dur, easing: up ? 'cubic-bezier(.2,.6,.4,1)' : 'cubic-bezier(.2,.7,.3,1)' }).onfinish = () => p.remove();
  }
}

/* "just now" under a minute, then minutes, hours, days, then the date */
export function ago(ms, now = Date.now()) {
  const s = Math.round((now - ms) / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60); if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.round(h / 24); if (d < 30) return `${d} day${d === 1 ? '' : 's'} ago`;
  try { return new Date(ms).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return ''; }
}
