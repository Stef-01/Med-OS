/* icons.mjs — the ONE icon table for the study overlays (study kit, plan 2026-10-19-001 unit K2; audit problem 2:
   "icon tables ×3 with different path strings for the same glyph", plus the three hand-drawn sets of the deck, the
   home and Notes). Tabler icons as eMedici draws them (24 px, stroke currentColor, round caps), named as Tabler names
   them (camelCase); the deck's own glyphs (close, tick, bin, star, flashcards, …) keep their drawings under their own
   keys. One key per glyph: the modules' old names (back, bm, done, ok, chevR, …) map onto these in one local line.

   icon(name, {strokeWidth, cls}) -> the <svg> markup (aria-hidden; '' for an unknown name, never "undefined").
   Stroke icons take the caller's stroke width (eMedici: 2; the deck's set: 1.8-2.4; the chip chevrons: 1.4); filled
   icons (the player glyphs, the flame) and the graduation cap ignore it. ICONS is the raw table for tests. */

const ATTR = 'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"';
const STROKE = `${ATTR} fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"`;
const FILL = `${ATTR} fill="currentColor" aria-hidden="true"`;
const fill = body => ({ fill: body });

export const ICONS = Object.freeze({
  /* ---- navigation ---- */
  chevronLeft: '<path d="M15 6l-6 6l6 6"/>',
  chevronRight: '<path d="M9 6l6 6l-6 6"/>',
  chevronDown: '<path d="M6 9l6 6l6-6"/>',
  selector: '<path d="M8 9l4-4l4 4M16 15l-4 4l-4-4"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',   /* the deck's softer x */
  search: '<circle cx="10" cy="10" r="7"/><path d="M21 21l-6-6"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  exit: '<path d="M10 8V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-2"/><path d="M15 12H3l3-3m0 6l-3-3"/>',
  circleArrowRight: '<circle cx="12" cy="12" r="9"/><path d="M16 12l-4-4M16 12H8M12 16l4-4"/>',
  /* ---- lists, sorting, filtering ---- */
  sortDescending: '<path d="M4 6h9M4 12h7M4 18h7M15 15l3 3 3-3M18 6v12"/>',
  arrowsSort: '<path d="M3 9l4-4l4 4M7 5v14M21 15l-4 4l-4-4M17 19V5"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  grip: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  dots: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  dotsDiagonal: '<path d="M7 17h.01M12 12h.01M17 7h.01"/>',
  circleDots: '<circle cx="12" cy="12" r="9"/><path d="M8 12h.01M12 12h.01M16 12h.01" stroke-width="2.6"/>',
  /* ---- marks ---- */
  check: '<path d="M5 12l5 5L20 7"/>',
  tick: '<path d="M5.5 12.5l4.2 4.2L18.5 7.8"/>',   /* the deck's heavier check */
  circleCheck: '<circle cx="12" cy="12" r="9"/><path d="M9 12l2 2l4-4"/>',
  circleX: '<circle cx="12" cy="12" r="9"/><path d="M10 10l4 4m0-4l-4 4"/>',
  squareCheck: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12l2 2l4-4"/>',
  squareX: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M10 10l4 4m0-4l-4 4"/>',
  circleDashed: '<path d="M8.56 3.69a9 9 0 0 0-2.92 1.95M3.69 8.56A9 9 0 0 0 3 12M3.69 15.44a9 9 0 0 0 1.95 2.92M8.56 20.31A9 9 0 0 0 12 21M15.44 20.31a9 9 0 0 0 2.92-1.95M20.31 15.44A9 9 0 0 0 21 12M20.31 8.56a9 9 0 0 0-1.95-2.92M15.44 3.69A9 9 0 0 0 12 3"/>',
  minus: '<path d="M5 12h14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  circleMinus: '<circle cx="12" cy="12" r="9"/><path d="M9 12h6"/>',
  circlePlus: '<circle cx="12" cy="12" r="9"/><path d="M9 12h6M12 9v6"/>',
  infoCircle: '<circle cx="12" cy="12" r="9"/><path d="M12 9h.01M11 12h1v4h1"/>',
  alert: '<path d="M12 9v4M12 17h.01"/><path d="M10.4 3.9L2.6 17a1.9 1.9 0 0 0 1.6 2.9h15.6a1.9 1.9 0 0 0 1.6-2.9L13.6 3.9a1.9 1.9 0 0 0-3.2 0z"/>',
  star: '<path d="M12 3.8l2.5 5.1 5.6.8-4.05 3.95.96 5.6L12 16.6l-5.01 2.65.96-5.6L3.9 9.7l5.6-.8z"/>',
  bookmark: '<path d="M18 7v14l-6-4l-6 4V7a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4z"/>',
  eye: '<path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0-4 0"/><path d="M21 12c-2.4 4-5.4 6-9 6c-3.6 0-6.6-2-9-6c2.4-4 5.4-6 9-6c3.6 0 6.6 2 9 6"/>',
  eyeOff: '<path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M16.7 16.7A8.7 8.7 0 0 1 12 18c-3.6 0-6.6-2-9-6c1.3-2.1 2.7-3.7 4.3-4.7M9.9 6.2A9 9 0 0 1 12 6c3.6 0 6.6 2 9 6c-.7 1.1-1.4 2.1-2.2 3M3 3l18 18"/>',
  /* ---- objects ---- */
  bulb: '<path d="M3 12h1m8-9v1m8 8h1M5.6 5.6l.7.7m12.1-.7l-.7.7M9 16a5 5 0 1 1 6 0a3.5 3.5 0 0 0-1 3a2 2 0 0 1-4 0a3.5 3.5 0 0 0-1-3M9.7 17h4.6"/>',
  bolt: '<path d="M13 3L4 14h7l-1 7l9-11h-7z"/>',
  paw: '<path d="M14.7 13.5c-1.1-2-1.44-2.5-2.7-2.5s-1.74.76-2.84 2.75c-.94 1.7-2.85 1.84-3.32 3.29-.1.27-.15.68-.14.96 0 1.18.79 2 1.8 2 1.26 0 3-1 4.5-1s3.24 1 4.5 1c1.01 0 1.8-.82 1.8-2 0-.28-.05-.7-.15-.96-.47-1.45-2.51-1.84-3.45-3.54z"/><path d="M20.19 8.08A1 1 0 0 0 19.78 8c-.74.01-1.56.75-1.99 1.87-.52 1.33-.28 2.7.54 3.05.13.06.27.08.4.08.74 0 1.58-.74 2.02-1.87.51-1.33.27-2.7-.56-3.05z"/><path d="M9.47 9c.06 0 .11 0 .17-.01.94-.13 1.53-1.35 1.32-2.72C10.75 4.97 9.9 4 9.03 4c-.06 0-.11 0-.17.01-.94.13-1.53 1.35-1.32 2.72C7.75 8.03 8.6 9 9.47 9z"/><path d="M16.46 6.73c.21-1.37-.38-2.59-1.32-2.72A1.16 1.16 0 0 0 14.97 4c-.88 0-1.73.97-1.93 2.27-.21 1.37.38 2.59 1.32 2.72.06.01.11.01.17.01.88 0 1.73-.97 1.93-2.27z"/><path d="M5.69 12.92c.82-.35 1.05-1.72.54-3.05C5.79 8.74 4.95 8 4.22 8c-.14 0-.28.03-.41.08-.82.35-1.05 1.72-.54 3.05.44 1.13 1.27 1.87 2.01 1.87.14 0 .28-.03.41-.08z"/>',
  report: '<path d="M8 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5.7M18 12V7a2 2 0 0 0-2-2h-2"/><rect x="8" y="3" width="6" height="4" rx="2"/><circle cx="18" cy="18" r="4"/><path d="M18 16.5V18l.5.5"/>',
  reportAnalytics: '<path d="M8 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="8" y="3" width="8" height="4" rx="2"/><path d="M9 17v-4M12 17v-6M15 17v-2"/>',
  clipboardCheck: '<path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="2"/><path d="M9 14l2 2l4-4"/>',
  history: '<path d="M12 8v4l2 2"/><path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
  stopwatch: '<path d="M5 13a7 7 0 1 0 14 0a7 7 0 0 0-14 0zM14.5 10.5L12 13M17 8l1-1M14 3h-4"/>',
  reload: '<path d="M19.9 13A8 8 0 1 1 19 9.5M20 4v5h-5"/>',
  refresh: '<path d="M20 11A8.1 8.1 0 0 0 4.5 9M4 5v4h4M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"/>',
  shuffle: '<path d="M18 4l3 3l-3 3M18 20l3-3l-3-3"/><path d="M3 7h3a5 5 0 0 1 5 5a5 5 0 0 0 5 5h5M21 7h-5a4.98 4.98 0 0 0-3 1m-4 8a5 5 0 0 1-3 1H3"/>',
  sidebar: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 4v16M15 10l-2 2 2 2"/>',
  sidebarOpen: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 4v16M14 10l2 2-2 2"/>',
  share: '<path d="M8 9H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1M12 14V3M9 6l3-3 3 3"/>',
  cards: '<rect x="3.5" y="6" width="13" height="14" rx="2.5"/><path d="M8 3.5h10a2.5 2.5 0 0 1 2.5 2.5v11"/>',
  flashcards: '<rect x="3.5" y="7.5" width="13" height="13" rx="2.5"/><path d="M7.5 7.5V6a2.5 2.5 0 0 1 2.5-2.5h8A2.5 2.5 0 0 1 20.5 6v8a2.5 2.5 0 0 1-2.5 2.5h-1.5"/>',
  pencil: '<path d="M4 20h4L18.5 9.5a2.83 2.83 0 0 0-4-4L4 16v4M13.5 6.5l4 4"/>',
  marker: '<path d="M3 19h4L17.5 8.5a2.83 2.83 0 0 0-4-4L3 15v4"/><path d="M12.5 5.5l4 4M14 19h7"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
  bin: '<path d="M4.5 7h15M9.5 7V4.8h5V7M6.5 7l.9 12.2h9.2L17.5 7M10.2 10.5v5.5M13.8 10.5v5.5"/>',   /* the deck's trash */
  play: '<path d="M7 4v16l13-8z"/>',
  circlePlay: '<circle cx="12" cy="12" r="9"/><path d="M10 9l5 3l-5 3z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6L18 18M6 18l1.4-1.4M16.6 7.4L18 6"/>',
  book: '<path d="M5 4.5h10.5a3 3 0 0 1 3 3V19.5H8a3 3 0 0 1-3-3z"/><path d="M5 16.5a3 3 0 0 1 3-3h10.5M9 8.5h6"/>',
  listRadio: '<circle cx="6.5" cy="7" r="2.2"/><circle cx="6.5" cy="17" r="2.2"/><circle cx="6.5" cy="17" r=".4" fill="currentColor"/><path d="M11.5 7h8M11.5 17h8"/>',
  checkbox: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8.5 12.2l2.4 2.4 4.6-5"/>',
  briefcase: '<rect x="3.5" y="7" width="17" height="12.5" rx="2.5"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3.5 12.5h17"/>',
  maximize: '<path d="M16 4h4v4M14 10l6-6M8 20H4v-4M4 20l6-6M16 20h4v-4M14 14l6 6M8 4H4v4M4 4l6 6"/>',
  users: '<circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2M16 3.13a4 4 0 0 1 0 7.75M21 21v-2a4 4 0 0 0-3-3.85"/>',
  stethoscope:'<path d="M6 3.5v5a4 4 0 0 0 8 0v-5"/><path d="M10 12.5v2a4.5 4.5 0 0 0 9 0v-2"/><circle cx="19" cy="10.5" r="2"/>',
  /* ---- filled ---- */
  flame: fill('<path d="M10 2c0 3.5-5 6-5 11a7 7 0 0 0 14 0c0-2.6-1.4-4.6-2.6-5.9a.6.6 0 0 0-1 .3c-.3 1.6-1 2.8-2 3.4C14 7.5 12.5 4.3 10.6 2.2A.4.4 0 0 0 10 2z"/>'),
  playFilled: fill('<path d="M6 4v16a1 1 0 0 0 1.52.85l13-8a1 1 0 0 0 0-1.7l-13-8A1 1 0 0 0 6 4z"/>'),
  pauseFilled: fill('<rect x="5" y="4" width="5" height="16" rx="1.5"/><rect x="14" y="4" width="5" height="16" rx="1.5"/>'),
  nextFilled: fill('<path d="M2 5v14a1 1 0 0 0 1.54.84L13 13.6V19a1 1 0 0 0 1.54.84l9-7a1 1 0 0 0 0-1.68l-9-7A1 1 0 0 0 13 5v5.4L3.54 4.16A1 1 0 0 0 2 5z" transform="scale(.92) translate(1 1)"/>'),
  stopFilled: fill('<rect x="5" y="5" width="14" height="14" rx="2.5"/>'),
  /* the home's graduation cap keeps its own colour (the Learn brand mark) */
  cap: { raw: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#c9a4ff" d="M12 4 1.5 9 12 14l8.5-4.05V16h1.5V9z"/><path fill="#c9a4ff" d="M5.5 12.3v3.6c0 1.6 2.9 3.1 6.5 3.1s6.5-1.5 6.5-3.1v-3.6L12 15.4z"/></svg>' },
});

export function icon(name, { strokeWidth = 2, cls = '' } = {}) {
  const v = ICONS[name];
  if (!v) return '';
  const c = cls ? ` class="${cls}"` : '';
  if (typeof v === 'string') return `<svg ${STROKE} stroke-width="${strokeWidth}"${c}>${v}</svg>`;
  if (v.fill) return `<svg ${FILL}${c}>${v.fill}</svg>`;
  return cls ? v.raw.replace('<svg ', `<svg${c} `) : v.raw;
}
