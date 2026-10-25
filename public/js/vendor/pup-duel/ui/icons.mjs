/* icons.mjs: the duel's icons, drawn on a 24 unit grid in one 2-unit stroke with round ends, in the text colour.
   One family for every control, so a word is only needed where a picture is not enough; each use carries its own
   accessible name (the icon itself is aria-hidden). */

const P = {
  x: 'M6 6l12 12M18 6L6 18',
  back: 'M15 5l-7 7 7 7',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  bot: 'M8 8h8a4 4 0 0 1 4 4v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-3a4 4 0 0 1 4-4zM12 4v4M9.5 13.5h.01M14.5 13.5h.01',
  zap: 'M13 3L5 13.5h6L10 21l8-10.5h-6L13 3z',
  repeat: 'M17 3l3 3-3 3M4 11V9.5A3.5 3.5 0 0 1 7.5 6H20M7 21l-3-3 3-3M20 13v1.5a3.5 3.5 0 0 1-3.5 3.5H4',
  home: 'M4 11l8-7 8 7M6 9.5V20h12V9.5',
  list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  shirt: 'M9 4l-5 2.5 1.5 4.5H8v9h8v-9h2.5L20 6.5 15 4a3 3 0 0 1-6 0z',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7.5V12l3 2',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H5v1.5A3 3 0 0 0 8 10.5M16 6h3v1.5a3 3 0 0 1-3 3M12 13v4M8.5 20h7M10 17h4',
  crown: 'M4 8l4.5 4L12 6l3.5 6L20 8l-2 10H6L4 8z',
  share: 'M12 15V4M8 8l4-4 4 4M5 12v7h14v-7',
  lock: 'M7 11h10v9H7zM9 11V8a3 3 0 0 1 6 0v3',
  timer: 'M12 6a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM12 10v3.5M10 3h4',
  hash: 'M5 9h14M5 15h14M10 4L8 20M16 4l-2 16',
  tag: 'M4 4h7l9 9-7 7-9-9V4zM8.5 8.5h.01',
  thumb: 'M7 11v9H4v-9h3zM7 11l4-7a2 2 0 0 1 3.5 1.8L13.5 10H19a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 17.8 20H7',
  paw: 'M8 4.5a1.5 2 0 1 0 0 4 1.5 2 0 0 0 0-4zM16 4.5a1.5 2 0 1 0 0 4 1.5 2 0 0 0 0-4zM4.5 10a1.5 2 0 1 0 0 4 1.5 2 0 0 0 0-4zM19.5 10a1.5 2 0 1 0 0 4 1.5 2 0 0 0 0-4zM12 12c2.8 0 5 3.2 5 5.2a2.3 2.3 0 0 1-2.4 2.3c-1 0-1.6-.6-2.6-.6s-1.6.6-2.6.6A2.3 2.3 0 0 1 7 17.2C7 15.2 9.2 12 12 12z',
  star: 'M12 3.5l2.6 5.4 5.9.7-4.4 4 1.2 5.9L12 16.6l-5.3 2.9 1.2-5.9-4.4-4 5.9-.7L12 3.5z',
  oof: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8 15.5l1.6-1 1.6 1 1.6-1 1.6 1 1.6-1M9 10h.01M15 10h.01',
  palette: 'M12 3a9 9 0 0 0 0 18c1.2 0 1.8-.8 1.8-1.7 0-1.2-1-1.6-1-2.6 0-.9.8-1.7 1.8-1.7H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3zM7.5 12h.01M9.5 7.5h.01M14.5 7.5h.01',
  collar: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  hat: 'M3.5 17h17M6 17V11a6 6 0 0 1 12 0v6M9 7.5c1-.9 2.1-1.4 3-1.4',
  glasses: 'M3 12a3.5 3.5 0 1 0 7 0 3.5 3.5 0 0 0-7 0zM14 12a3.5 3.5 0 1 0 7 0 3.5 3.5 0 0 0-7 0zM10 11.5a2.5 2.5 0 0 1 4 0',
  bow: 'M12 10.5L5 6.5v11l7-4 7 4v-11l-7 4zM12 10.5v3',
  pack: 'M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7M6 7h12a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zM9 12h6'
};

export const ICONS = Object.keys(P);
export const icon = (name, cls = '') => `<svg class="pd-i${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${P[name] || ''}"/></svg>`;
