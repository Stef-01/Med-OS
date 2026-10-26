/* osce/candidate.mjs - the candidate screen: a read-only page for the candidate's own phone while the examiner keeps the
   main device (patient script, marking sheet). The examiner's More menu makes a link that carries the station id and the
   clock as it stands (phase, seconds left, the moment it was read, the minutes of each phase); this page shows the
   Instructions to Candidate, any images in them, and the same countdown, ringing the bell at each change. When Part 2
   starts, the results the examiner hands over (and their scans) appear under the instructions. Nothing here writes to
   storage. Pure parts: candidateLink, parseCandidate. */
import { esc } from '../core.mjs';
import { safeHtml } from '../study-kit/safe.mjs';
import { figureHtml } from '../study-kit/media.mjs';
import { loadCss } from '../study-kit/css.mjs';
import { osceLeft, osceTick, osceCleanStation, mmss, clampMin, phasesOf, phaseName, hasPart2, DEFAULT_TIMING } from './core.mjs';
import { I, bell, audio } from './state.mjs';
import { formatHtml, part2Html } from './session.mjs';

/* the link: the page's own address with the station and the clock in the query (no hash, no other params) */
export function candidateLink(href, sid, timer, timing, now) {
  const u = new URL(href);
  u.search = ''; u.hash = '';
  const left = Math.max(0, osceLeft(timer, now));
  u.searchParams.set('cand', sid);
  u.searchParams.set('c', timer && timer.c === 'mx' ? 'm' : timer && timer.c === 'station' ? 's' : 'r');
  u.searchParams.set('left', String(left));
  u.searchParams.set('t', String(now));
  u.searchParams.set('r', String(timing.reading));
  u.searchParams.set('s', String(timing.station));
  u.searchParams.set('m', String(timing.mx ?? 0));
  return u.toString();
}

/* the query -> { sid, timer, timing } or null when it is not a candidate link */
export function parseCandidate(search) {
  const q = new URLSearchParams(search || '');
  const sid = q.get('cand');
  if (!sid || !/^[\w-]{1,64}$/.test(sid)) return null;
  const t = Number(q.get('t')), left = Number(q.get('left'));
  if (!Number.isFinite(t) || !Number.isFinite(left) || left < 0 || left > 99 * 60) return null;
  const timing = { reading: clampMin(q.get('r'), DEFAULT_TIMING.reading), station: clampMin(q.get('s'), DEFAULT_TIMING.station), mx: clampMin(q.get('m'), q.has('m') ? 0 : DEFAULT_TIMING.mx, 0) };
  const c = { s: 'station', m: 'mx' }[q.get('c')] || 'reading';
  if (c === 'mx' && !timing.mx) return null;
  return { sid, timing, timer: { c, left: Math.round(left), at: t } };
}

/* the page: header, the clock, the instructions */
export async function renderCandidate(root, p) {
  await loadCss('./css/osce.css');
  root.className = 'os os-candpage'; root.hidden = false;
  root.innerHTML = `<header class="os-head"><div class="os-htitle"><h1 class="os-title">Candidate</h1><small class="os-sub"></small></div></header>
    <main class="os-main"><div class="os-sess"><div class="os-sbar"></div><div class="os-panes"><div class="os-pl"><div class="os-pscroll"><div class="os-pbody"><p class="os-kicker">Loading the station…</p></div></div></div></div></div></main>`;
  let st;
  try {
    const r = await fetch(`./osce/${encodeURIComponent(p.sid)}.json`, { cache: 'default' });
    st = r.ok ? osceCleanStation(await r.json()) : null;
  } catch { st = null; }
  const pane = root.querySelector('.os-pbody');
  if (!st) { pane.innerHTML = '<p class="os-kicker">That station did not load. Check the link and the connection.</p>'; return; }
  root.querySelector('.os-title').textContent = st.title;
  pane.innerHTML = `<div class="os-cpart2"></div><div class="os-sheet"><h2>Instructions to Candidate</h2><div class="os-html">${safeHtml(st.stem)}</div>${(st.media?.stem || []).map(figureHtml).join('')}
    ${formatHtml(p.timing)}
    ${st.tasks.length ? `<h3>Tasks</h3><ol class="os-tasks" role="list">${st.tasks.map((x, i) => `<li><span class="os-tn">${i + 1}</span><div class="os-html">${safeHtml(x)}</div></li>`).join('')}</ol>` : ''}</div>`;
  /* Part 2: the results arrive on this screen when the examiner's clock reaches it */
  const part2 = root.querySelector('.os-cpart2');
  const showPart2 = () => { if (part2.childElementCount || !hasPart2(st)) return; part2.innerHTML = part2Html(st); part2.scrollIntoView({ block: 'start' }); };
  let timer = p.timer;
  const bar = root.querySelector('.os-sbar');
  const paint = () => {
    const next = osceTick(timer, p.timing, Date.now());
    if (next !== timer) { timer = next; bell(); }
    if (timer.c === 'mx') showPart2();
    const fin = !timer.at;
    const left = fin ? 0 : osceLeft(timer, Date.now()), total = p.timing[timer.c] * 60, pr = Math.min(1, Math.max(0, 1 - left / total)), C = 43 * 2 * Math.PI;
    bar.innerHTML = fin ? `<div class="os-finished"><span class="os-fh">${I.done}<h5><span class="os-fh-long">Station </span>Finished</h5></span></div>`
      : `<div class="os-timer"><span class="os-ring${left <= 60 && timer.c !== 'reading' ? ' low' : ''}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pr * 100)}"><svg viewBox="0 0 100 100"><circle class="os-ring-t" r="43" cx="50" cy="50"/><circle class="os-ring-s" r="43" cx="50" cy="50" transform="rotate(-90 50 50)" stroke-linecap="round" stroke-dasharray="${C * pr} ${C}" style="opacity:${pr ? 1 : 0}"/></svg></span>
        <div class="os-tcomps">${phasesOf(p.timing).map((k, i, ps) => `<div class="os-tc${k === timer.c ? ' cur' : ' off'}" title="${phaseName(k, true)}"><small>${phaseName(k)}</small><b>${k === timer.c ? mmss(left) : `${i < ps.indexOf(timer.c) ? 0 : p.timing[k]}:00`}</b></div>`).join('')}</div></div>`;
    root.querySelector('.os-sub').innerHTML = esc(fin ? 'Time is up' : phaseName(timer.c, true));
    if (fin) clearInterval(iv);
  };
  const iv = setInterval(paint, 250);
  document.addEventListener('pointerdown', () => audio(), { once: true });   /* the bell needs one tap to be allowed to ring */
  paint();
}
