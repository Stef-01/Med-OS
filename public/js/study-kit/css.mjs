/* css.mjs — one stylesheet loader for the study overlays (study kit, plan 2026-10-19-001 unit K2).
   Each overlay loads its stylesheet on first open, never on page load. Six modules carried the same ten lines; this is
   the one copy: a <link data-kit-css="<href>"> added once, a shared promise per href, a failed load removed so the
   next open retries. Resolves to nothing; rejects with the href so the caller's error says which sheet. */

const loads = new Map();   /* href → promise */

export function loadCss(href) {
  if (loads.has(href)) return loads.get(href);
  const p = new Promise((res, rej) => {
    const had = document.querySelector(`link[data-kit-css="${CSS.escape(href)}"]`);
    if (had && had.sheet) return res();
    const l = had || document.createElement('link');
    l.rel = 'stylesheet'; l.href = href; l.dataset.kitCss = href;
    l.onload = () => res();
    l.onerror = () => { loads.delete(href); l.remove(); rej(new Error(`${href} did not load`)); };
    if (!had) document.head.appendChild(l);
  });
  loads.set(href, p);
  return p;
}
