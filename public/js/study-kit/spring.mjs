/* study-kit/spring.mjs - Apple's springs on the web (founder 2026-10-26: "implement apple motion with spring based UI
   interaction systems"). WWDC 2018 Designing Fluid Interfaces: a spring is two numbers a designer can reason with,
   damping (1 is critically damped: no overshoot; 0.8 a little bounce, only after a gesture that carried momentum) and
   response (seconds to get there; not a duration: the settle time comes out of the physics). Mass 1, stiffness
   (2π/response)², damping coefficient 4πζ/response, which is exactly what SwiftUI's spring(response:dampingFraction:)
   uses.

     solve(spec, v0)          x(t) for a unit step 0 to 1 that starts at relative velocity v0 (1/s), analytically
     easing(spec)             the same step as a CSS linear() easing and its settle time: { ease, ms }
     animate(from, to, opts)  a requestAnimationFrame spring that can be re-targeted mid-flight from where it is, with
                              its velocity carried through (interruptible: never wait for an animation to finish)
     project(v)               where a flick at v px/s would come to rest (Apple's exponential deceleration, 0.998)
     rubberband(x, d)         the resistance past an edge: the further you pull, the less it follows
     sheetDrag(box, opts)     a bottom sheet you can drag down to close: 1:1 with the finger, rubber-banded upward,
                              released to where its momentum says (closed, or springing back with the finger's speed)

   Pure apart from animate() and sheetDrag(). prefers-reduced-motion: animate() jumps to the end, sheetDrag() still
   follows the finger but closes and returns without a spring. */

export const SPRING = Object.freeze({
  smooth: { damping: 1, response: 0.35 },      /* the default: a move, a fade in, a tab */
  snappy: { damping: 1, response: 0.25 },      /* a press released, a chip */
  sheet: { damping: 0.86, response: 0.42 },    /* a sheet arriving: a breath of settle */
  bouncy: { damping: 0.72, response: 0.38 },   /* after momentum, or a right answer landing */
  gentle: { damping: 1, response: 0.55 }       /* big surfaces, numbers counting up */
});
export const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/* position and velocity of a unit step (0 to 1) at time t (seconds) */
export function solve({ damping = 1, response = 0.35 } = {}, v0 = 0) {
  const w = (2 * Math.PI) / Math.max(0.01, response), z = Math.max(0, damping);
  if (z < 1) {
    const wd = w * Math.sqrt(1 - z * z), a = z * w, B = (a - v0) / wd;
    return t => { const e = Math.exp(-a * t), c = Math.cos(wd * t), s = Math.sin(wd * t); return { x: 1 - e * (c + B * s), v: e * ((a * c + a * B * s) - (-wd * s + B * wd * c)) }; };
  }
  if (z === 1) return t => { const e = Math.exp(-w * t); return { x: 1 - e * (1 + (w - v0) * t), v: e * (v0 + (w * w - w * v0) * t) }; };
  const r1 = -w * (z - Math.sqrt(z * z - 1)), r2 = -w * (z + Math.sqrt(z * z - 1)), c2 = (v0 + r1) / (r2 - r1), c1 = -1 - c2;
  return t => ({ x: 1 + c1 * Math.exp(r1 * t) + c2 * Math.exp(r2 * t), v: c1 * r1 * Math.exp(r1 * t) + c2 * r2 * Math.exp(r2 * t) });
}
/* how long until it is within 0.1 % of rest and nearly still (seconds, at 1 ms resolution, at most 3 s) */
export function settle(spec, v0 = 0) {
  const f = solve(spec, v0);
  let last = 0;
  for (let t = 0; t <= 3; t += 0.001) { const { x, v } = f(t); if (Math.abs(1 - x) > 0.001 || Math.abs(v) > 0.01) last = t; }
  return Math.min(3, last + 0.001);
}
/* the spring as a CSS easing: linear() through ~40 points (round to 4 places), and the transition time in ms */
export function easing(spec, v0 = 0, points = 40) {
  const T = settle(spec, v0), f = solve(spec, v0), out = [];
  for (let i = 0; i <= points; i++) { const t = (i / points) * T; out.push(+f(t).x.toFixed(4)); }
  out[out.length - 1] = 1;
  return { ease: `linear(${out.join(', ')})`, ms: Math.round(T * 1000) };
}

/* Apple's projection (Designing Fluid Interfaces sample): the rest point of a flick at v px/s */
export const project = (v, rate = 0.998) => ((v / 1000) * rate) / (1 - rate);
/* UIScrollView's rubber band: x past the edge, d the dimension, c 0.55 */
export const rubberband = (x, d, c = 0.55) => (x * d * c) / (d + c * Math.abs(x));

/* a spring from `from` to `to`, calling onFrame(value) each frame; returns a handle:
     h.to(target, opts?)   re-target from the current value and velocity (no jump, no brick wall)
     h.stop()              h.value, h.velocity   the live state */
export function animate(from, to, { spec = SPRING.smooth, velocity = 0, onFrame, onDone } = {}) {
  const h = { value: from, velocity, done: false };
  let x0 = from, x1 = to, f, t0, raf = 0;
  const start = (v, s) => { const span = x1 - x0; f = solve(s, Math.abs(span) > 1e-6 ? v / span : 0); t0 = performance.now(); };
  const tick = now => {
    const t = (now - t0) / 1000, span = x1 - x0, { x, v } = f(t);
    h.value = x0 + span * x; h.velocity = v * span;
    const rest = Math.abs(h.value - x1) < Math.max(0.01, Math.abs(span) * 0.001) && Math.abs(h.velocity) < Math.max(0.05, Math.abs(span) * 0.01);
    if (rest || t > 3) { h.value = x1; h.velocity = 0; h.done = true; onFrame?.(x1); onDone?.(); return; }
    onFrame?.(h.value); raf = requestAnimationFrame(tick);
  };
  h.to = (target, o = {}) => { cancelAnimationFrame(raf); x0 = h.value; x1 = target; h.done = false; start(o.velocity ?? h.velocity, o.spec || spec); if (reducedMotion()) { h.value = target; onFrame?.(target); onDone?.(); return h; } raf = requestAnimationFrame(tick); return h; };
  h.stop = () => { cancelAnimationFrame(raf); h.done = true; };
  if (reducedMotion()) { h.value = to; onFrame?.(to); queueMicrotask(() => onDone?.()); return h; }
  start(velocity, spec); raf = requestAnimationFrame(tick);
  return h;
}

/* a bottom sheet you drag down to close. box: the sheet; grab: where a drag may start (its header, a grabber); a drag
   that starts in a scrolled list only takes over at the list's top. onClose(): close it (the caller's own close, which
   animates from where the sheet now is). Phones only (a sheet at the bottom): the caller checks the layout */
export function sheetDrag(box, { grab = box, scroller = null, onClose } = {}) {
  let id = null, y0 = 0, y = 0, hist = [], live = null, active = false;
  const set = v => { box.style.transform = `translateY(${v}px)`; };
  const down = e => {
    if (e.button > 0 || id != null) return;
    if (!grab.contains(e.target) && !(scroller && scroller.contains(e.target) && scroller.scrollTop <= 0)) return;
    if (e.target.closest('input, textarea, select, [contenteditable], .os-wrap')) return;
    id = e.pointerId; y0 = e.clientY - (live ? live.value : 0); hist = [[e.timeStamp, e.clientY]]; active = false;
  };
  const move = e => {
    if (e.pointerId !== id) return;
    const dy = e.clientY - y0;
    if (!active) {   /* a small threshold before it is a drag, so a tap stays a tap and a scroll stays a scroll */
      if (Math.abs(dy) < 8) return;
      if (dy < 0 || (scroller && scroller.contains(e.target) && scroller.scrollTop > 0)) { id = null; return; }
      active = true; live?.stop(); box.setPointerCapture?.(id); box.style.transition = 'none'; box.classList.add('dragging');
    }
    e.preventDefault();
    y = dy > 0 ? dy : rubberband(dy, box.offsetHeight || 600);
    set(y); hist.push([e.timeStamp, e.clientY]); if (hist.length > 6) hist.shift();
  };
  const up = e => {
    if (e.pointerId !== id) return;
    id = null; if (!active) return;
    active = false; box.classList.remove('dragging');
    const [ta, ya] = hist[0], [tb, yb] = hist[hist.length - 1], v = tb > ta ? ((yb - ya) / (tb - ta)) * 1000 : 0;   /* px/s over the last few moves */
    const h = box.offsetHeight || 600, rest = y + project(v);
    if (rest > h * 0.45 || v > 900) { box.style.transition = ''; onClose?.(v); return; }
    live = animate(y, 0, { spec: v < -50 ? SPRING.sheet : SPRING.bouncy, velocity: v, onFrame: set, onDone: () => { box.style.transform = ''; box.style.transition = ''; live = null; } });
  };
  box.addEventListener('pointerdown', down);
  box.addEventListener('pointermove', move, { passive: false });
  box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
  return () => { box.removeEventListener('pointerdown', down); box.removeEventListener('pointermove', move); box.removeEventListener('pointerup', up); box.removeEventListener('pointercancel', up); };
}
