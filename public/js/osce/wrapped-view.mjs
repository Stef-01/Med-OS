/* osce/wrapped-view.mjs - your month in Med-OS, wrapped (founder 2026-10-26: "Spotify Wrapped style gen z pop out end of
   every month"). A full-screen story of the month's Study (library/stats.mjs wrapped()): how much, the streak, your
   top specialty, how right you were, your glow-up and your nemesis, your study persona, the year you climbed to, and
   a card to send to the group chat. It opens by itself the first time OSCE opens in a new month (maybeWrapped), once
   per month per account; Your summary in Study opens any month again, and this month so far.

   Tap the right of the screen (or Space, or the arrow) for the next slide, the left to go back; slides move on by
   themselves after 6 s unless the device asks for reduced motion. Plain text throughout (esc). */
import { esc } from '../core.mjs';
import { ctx, notify, openDialog, closeDialog, topDialog, now } from './state.mjs';
import { wrapped, dueWrap, monthName, monthOf } from '../library/stats.mjs';
import { YEARS } from '../mcq/year.mjs';
import * as api from '../library/api.mjs';

const AUTO = 6000;
let W = null;   /* { month, w, i, slides, timer, el } */

/* the slides: [kicker, big, line, theme] */
export function slidesOf(w) {
  const m = monthName(w.month), s = [];
  s.push(['Med-OS', `${m}, wrapped`, 'Your month of studying, in a few slides. Tap to start.', 'intro']);
  s.push(['You answered', `${w.n} questions`, `${w.days === 1 ? 'in a single day' : `across ${w.days} days`}. ${w.n >= 300 ? 'Touch grass? Never heard of her.' : w.n >= 100 ? 'Lowkey a machine.' : 'Every rep counts, bestie.'}`, 'count']);
  s.push(['Your longest streak', `${w.streak} day${w.streak === 1 ? '' : 's'}`, w.streak >= 7 ? 'Consistency this good should be illegal.' : w.streak >= 3 ? 'Showing up on repeat. We love to see it.' : `Next month is the comeback arc.`, 'streak']);
  if (w.top) s.push(['Your #1 specialty', w.top.id, `${w.top.n} questions on it. It's giving specialist.`, 'top']);
  s.push(['You got', `${w.acc}% right`, w.acc >= 80 ? 'You ate and left no crumbs.' : w.acc >= 65 ? 'Solid. Main character energy.' : 'The plot is still developing, and that is the point.', 'acc']);
  if (w.glow) s.push(['Your glow-up', w.glow.id, `${w.glow.acc}% right. Certified expert behaviour.`, 'glow']);
  if (w.nemesis && w.nemesis.acc < 70) s.push(['Your nemesis', w.nemesis.id, `${w.nemesis.acc}% right. It's not personal. Or is it? Your summary has a plan.`, 'nemesis']);
  s.push(['Your study persona', w.vibe.name, `${w.vibe.line} Peak hour: ${hourLabel(w.peak)}.`, `vibe-${w.vibe.id}`]);
  if (w.maxYear) s.push(['You climbed to', YEARS[w.maxYear].label, w.maxYear >= 4 ? 'Final-year content. Intern who?' : `${YEARS[w.maxYear].name}. From first principles up.`, 'year']);
  s.push(['', 'card', '', 'final']);
  return s;
}
const hourLabel = h => `${((h + 11) % 12) + 1} ${h < 12 ? 'am' : 'pm'}`;
export const shareText = w => [`My ${monthName(w.month)} on Med-OS, wrapped:`, `${w.n} questions · ${w.acc}% right · ${w.streak}-day streak`, w.top ? `Top specialty: ${w.top.id}` : '', `Persona: ${w.vibe.name}`, 'mdosce.vercel.app'].filter(Boolean).join('\n');

/* on opening OSCE: the latest finished month you have not seen, once */
export function maybeWrapped() {
  const m = dueWrap(api.studyMem(), now());
  if (m && !topDialog()) openWrapped(m);
}

export function openWrapped(month, { preview = false } = {}) {
  const w = wrapped(api.studyMem(), month);
  if (!w) return notify('Not enough this month for a Wrapped yet: 10 answers makes one.', '');
  const slides = slidesOf(w);
  const d = openDialog({ kind: 'wrapped', noHead: true, cls: 'os-dlg--wrap', onClose: () => { clearTimeout(W?.timer); if (!preview) seen(month); W = null; },
    body: `<div class="os-wrap" role="group" aria-roledescription="story" aria-label="${esc(monthName(month))}, wrapped">
      <div class="os-wrapbars" aria-hidden="true">${slides.map(() => '<span><i></i></span>').join('')}</div>
      <button class="os-wrapx" data-wrap="close" aria-label="Close">✕</button>
      <div class="os-wrapslide" aria-live="polite"></div>
      <button class="os-wraptap os-wraptap--l" data-wrap="prev" aria-label="Previous"></button><button class="os-wraptap os-wraptap--r" data-wrap="next" aria-label="Next"></button>
    </div>` });
  W = { month, w, i: 0, slides, timer: 0, el: d.el, preview };
  d.el.addEventListener('click', e => { const b = e.target.closest('[data-wrap]'); if (!b) return; const a = b.dataset.wrap; if (a === 'close' || a === 'done') return closeDialog(); if (a === 'next') return go(1); if (a === 'prev') return go(-1); if (a === 'share') return share(); if (a === 'image') return saveImage(); });
  paint();
  d.el.querySelector('[data-wrap="next"]').focus({ preventScroll: true });
}
function seen(month) {
  const m = api.studyMem(); m.wrap = { seen: [...new Set([...(m.wrap?.seen || []), month])].sort().slice(-24) }; api.saveStudy(m);
}
function go(n) {
  if (!W) return;
  const i = Math.max(0, Math.min(W.slides.length - 1, W.i + n));
  if (i === W.i && n > 0 && i === W.slides.length - 1) return;
  W.i = i; paint();
}
function paint() {
  if (!W) return;
  clearTimeout(W.timer);
  const [kick, big, line, theme] = W.slides[W.i], box = W.el.querySelector('.os-wrapslide'), wrap = W.el.querySelector('.os-wrap');
  wrap.dataset.theme = theme; wrap.dataset.i = String(W.i);
  W.el.querySelectorAll('.os-wrapbars span').forEach((s, k) => { s.className = k < W.i ? 'done' : k === W.i ? 'on' : ''; });
  if (theme === 'final') {
    const w = W.w;
    box.innerHTML = `<div class="os-wrapcard"><p class="os-wrapk">${esc(monthName(w.month))} on Med-OS</p>
      <dl><div><dt>Questions</dt><dd>${w.n}</dd></div><div><dt>Right</dt><dd>${w.acc}%</dd></div><div><dt>Streak</dt><dd>${w.streak}d</dd></div><div><dt>Days</dt><dd>${w.days}</dd></div></dl>
      ${w.top ? `<p><span>Top specialty</span><b>${esc(w.top.id)}</b></p>` : ''}<p><span>Persona</span><b>${esc(w.vibe.name)}</b></p>
      ${w.maxYear ? `<p><span>Climbed to</span><b>${esc(YEARS[w.maxYear].label)}</b></p>` : ''}</div>
      <div class="os-wrapacts"><button class="os-wrapbtn" data-wrap="image">Save the card</button><button class="os-wrapbtn os-wrapbtn--ghost" data-wrap="share">Copy for the group chat</button><button class="os-wrapbtn os-wrapbtn--ghost" data-wrap="done">Done</button></div>`;
  } else box.innerHTML = `${kick ? `<p class="os-wrapk">${esc(kick)}</p>` : ''}<p class="os-wrapbig">${esc(big)}</p><p class="os-wrapline">${esc(line)}</p>`;
  W.el.querySelector('.os-wraptap--r').hidden = theme === 'final';
  if (theme !== 'final' && !matchMedia('(prefers-reduced-motion: reduce)').matches) W.timer = setTimeout(() => go(1), AUTO);
}
/* the card as a picture for a story (1080 by 1920, Wrapped's own shape): drawn on a canvas, then the phone's share
   sheet when it takes files, else a download */
export function drawCard(cv, w) {
  const g = cv.getContext('2d'), W = cv.width = 1080, H = cv.height = 1920;
  const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#1db954'); bg.addColorStop(0.55, '#7b2ff7'); bg.addColorStop(1, '#ff3d77');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(0,0,0,.28)'; round(g, 90, 520, W - 180, 980, 56); g.fill();
  g.fillStyle = '#fff'; g.textBaseline = 'alphabetic';
  const font = (s, wt = 800) => `${wt} ${s}px system-ui, -apple-system, 'Segoe UI', sans-serif`;
  g.font = font(54); g.fillText('Med-OS', 90, 200);
  g.font = font(120, 900); wrap(g, `${monthName(w.month)}, wrapped`, 90, 360, W - 180, 128);
  const stats = [['Questions', String(w.n)], ['Right', `${w.acc}%`], ['Streak', `${w.streak}d`], ['Days', String(w.days)]];
  stats.forEach(([k, v], i) => { const x = 150 + (i % 2) * 420, y = 680 + Math.floor(i / 2) * 260; g.font = font(40, 700); g.globalAlpha = 0.8; g.fillText(k, x, y); g.globalAlpha = 1; g.font = font(130, 900); g.fillText(v, x, y + 130); });
  const rows = [['Top specialty', w.top?.id || '–'], ['Persona', w.vibe.name], ...(w.maxYear ? [['Climbed to', YEARS[w.maxYear].label]] : [])];
  rows.forEach(([k, v], i) => { const y = 1260 + i * 80; g.font = font(42, 600); g.globalAlpha = 0.8; g.fillText(k, 150, y); g.globalAlpha = 1; g.font = font(46, 800); g.textAlign = 'right'; g.fillText(v, W - 150, y); g.textAlign = 'left'; });
  g.font = font(44, 700); g.globalAlpha = 0.9; g.fillText('mdosce.vercel.app', 90, H - 120); g.globalAlpha = 1;
  return cv;
}
function round(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function wrap(g, text, x, y, max, lh) { let line = '', yy = y; for (const word of text.split(' ')) { const t = line ? `${line} ${word}` : word; if (g.measureText(t).width > max && line) { g.fillText(line, x, yy); line = word; yy += lh; } else line = t; } g.fillText(line, x, yy); }
async function saveImage() {
  if (!W) return;
  const cv = drawCard(document.createElement('canvas'), W.w), name = `med-os-${W.w.month}-wrapped.png`;
  const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
  if (!blob) return notify('Could not make the picture on this device.', 'danger');
  const file = new File([blob], name, { type: 'image/png' });
  try { if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], text: shareText(W.w) }); return; } } catch (e) { if (e?.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  notify('Saved. Post it to your story.', 'success');
}
async function share() {
  const t = shareText(W.w);
  try { if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ text: t }); else { await navigator.clipboard.writeText(t); notify('Copied. Paste it in the group chat.', 'success'); } }
  catch (e) { if (e?.name !== 'AbortError') notify('Could not copy on this device.', 'danger'); }
}
/* keys while the story is on top (osce.mjs onKey hands them over): arrows and Space move, Escape closes (the kit's) */
export function wrappedKey(e) {
  if (!W) return false;
  if (e.key === 'ArrowRight' || e.key === ' ') { go(1); return true; }
  if (e.key === 'ArrowLeft') { go(-1); return true; }
  return false;
}
export const wrappedMonthNow = () => monthOf(now());
