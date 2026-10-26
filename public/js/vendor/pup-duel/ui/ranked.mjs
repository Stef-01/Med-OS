/* ranked.mjs (ui): the ranked card in the lobby, the search for a match and the leaderboard (founder 2026-10-25).
   The rules are duel/ranked.mjs; the server pairs, rates and ranks (0003_pup_ranked.sql).

     rankCard(me)           the lobby's card: your tier on its colour, your rating, how far to the next tier (or how
                            many placing games are left), Find a match, and the ladder
     openSearch(ctx)        a sheet that asks the server for a match every 2 s, shows how long and how wide, and opens
                            the duel the moment there is one; closing it leaves the queue
     lobbyBoard(root, ctx)  the lobby's leaderboard: Week, Month or All time, the top three and you, See all
     openLadder(ctx)        the whole leaderboard in a sheet, the same toggle; you are marked and, if far down, pinned
                            at the foot after a gap */

import { tierOf, ranked, byRating, PLACING } from '../duel/ranked.mjs';
import { icon } from './icons.mjs';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const POLL_MS = 2000;

export function rankCard(p) {
  const t = tierOf(p?.rating, p?.ranked);
  const sub = t.placing ? `${PLACING - (p?.ranked || 0)} ranked ${PLACING - (p?.ranked || 0) === 1 ? 'game' : 'games'} to your first tier` : t.next ? `${t.toNext} to ${t.nextName}` : 'Top tier';
  return `<h2 class="pd-vh">Ranked</h2><div class="pd-rank" data-tier="${t.placing ? 'placing' : t.id}">
    <span class="pd-tier" aria-hidden="true">${icon('shield')}</span>
    <div class="pd-rank-txt"><b>${t.placing ? 'Placing' : t.name}</b><span><span class="pd-rating">${p?.rating ?? 1000}</span> rating</span><small>${sub}</small></div>
  </div>
  <button class="pd-btn pd-pri" type="button" data-pd="ranked">${icon('zap')}Find a ranked match</button>`;
}

/* ctx: { sheet, closeSheet, guard, transport, me, makeSetup, onMatch(duel), say } */
export function openSearch(ctx) {
  let timer = 0, t0 = Date.now(), done = false, el;
  const stop = async () => { done = true; clearTimeout(timer); clearInterval(clock); try { await ctx.transport.unqueue(ctx.me); } catch { /* a stale ticket drops itself in 15 s */ } };
  ctx.sheet(`
    <div class="pd-search">
      <span class="pd-radar" aria-hidden="true"><i></i><i></i><b>${icon('zap')}</b></span>
      <h2 class="pd-sheet-title">Finding a match</h2>
      <p class="pd-search-line"><span class="pd-search-time" aria-hidden="true">0:00</span><span class="pd-search-win" role="status" aria-live="polite"></span></p>
      <p class="pd-err" role="alert"></p>
    </div>
    <button class="pd-btn" type="button" data-pd="stop">Cancel</button>`, root => {
    el = root;
    el.querySelector('[data-pd="stop"]').addEventListener('click', () => { stop(); ctx.closeSheet(true); });
    ctx.guard(() => { if (!done) stop(); return true; });
    ask();
  }, { label: 'Finding a ranked match' });
  const clock = setInterval(() => {
    if (!el?.isConnected) { clearInterval(clock); return; }
    const s = Math.floor((Date.now() - t0) / 1000);
    el.querySelector('.pd-search-time').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }, 500);
  async function ask() {
    if (done) return;
    try {
      const r = await ctx.transport.queue(ctx.me, ctx.makeSetup());
      if (done) return;
      el.querySelector('.pd-err').textContent = '';
      if (r?.duel) { done = true; clearInterval(clock); ctx.closeSheet(true); ctx.onMatch(r.duel); return; }
      const w = r?.window == null ? null : r.window;
      el.querySelector('.pd-search-win').textContent = w == null ? 'Anyone' : `Within ${w} rating`;
    } catch (e) { if (!done) el.querySelector('.pd-err').textContent = e.server ? e.message : `Can't reach the server. Retrying.`; }
    if (!done) timer = setTimeout(ask, POLL_MS);
  }
  return { stop };
}

/* ---- the leaderboard: one board, three periods, in the lobby (top three and you) and in a sheet (everyone) ----
   Week and Month rank by duel wins in the last 7 and 30 days; All time is the ranked ladder, by rating. The period
   toggle is always on show, and the one chosen is remembered on this device */
export const PERIODS = [
  { id: 'week', label: 'Week', note: 'Duel wins in the last 7 days', unit: n => (n === 1 ? 'win' : 'wins') },
  { id: 'month', label: 'Month', note: 'Duel wins in the last 30 days', unit: n => (n === 1 ? 'win' : 'wins') },
  { id: 'all', label: 'All time', note: 'The ranked ladder: ranked duels move your rating', unit: () => 'rating' }
];
const PKEY = 'pup-duel:period';
export const savedPeriod = () => { try { const v = localStorage.getItem(PKEY); return PERIODS.some(p => p.id === v) ? v : 'week'; } catch { return 'week'; } };
const savePeriod = v => { try { localStorage.setItem(PKEY, v); } catch { /* private mode */ } };
const valueOf = (p, period) => (period === 'all' ? p.rating : p[period] || 0);

/* the rows for a period, placed (ties share a place); `limit` keeps the top and adds you after a gap when you are lower */
export function boardRows(list, period, meId, limit = Infinity) {
  const cmp = period === 'all' ? byRating : (a, b) => (b[period] || 0) - (a[period] || 0) || b.rating - a.rating || a.name.localeCompare(b.name);
  const rows = ranked(list.map(p => ({ ...p, week: p.week || 0, month: p.month || 0 })), cmp, p => valueOf(p, period));
  const mine = rows.findIndex(p => p.id === meId);
  return mine >= limit ? [...rows.slice(0, limit), { gap: true }, rows[mine]] : rows.slice(0, limit);
}

function periodTabs(cur, idp) {
  return `<div class="pd-periods" role="tablist" aria-label="Leaderboard period">${PERIODS.map(p => `<button type="button" role="tab" id="${idp}-${p.id}" aria-controls="${idp}-panel" data-period="${p.id}" aria-selected="${p.id === cur}" tabindex="${p.id === cur ? 0 : -1}">${p.label}</button>`).join('')}</div>`;
}
function rowEl(p, period, meId, face) {
  if (p.gap) return Object.assign(document.createElement('li'), { className: 'pd-lgap', ariaHidden: 'true' });
  const li = document.createElement('li'), t = tierOf(p.rating, p.ranked), me = p.id === meId, v = valueOf(p, period), P = PERIODS.find(x => x.id === period);
  li.className = 'pd-lrow'; if (me) li.dataset.me = ''; li.dataset.tier = t.id; li.dataset.place = p.place;
  li.innerHTML = `<span class="pd-vh"></span><span class="pd-lplace" aria-hidden="true">${p.place}</span><span class="pd-lface" aria-hidden="true"></span><span class="pd-lname" aria-hidden="true"><span class="pd-lnm"><b></b>${me ? '<em>You</em>' : ''}</span><small>${t.placing ? 'Placing' : t.name}</small></span><span class="pd-lval" aria-hidden="true"><b>${v}</b><small>${P.unit(v)}</small></span>`;
  li.querySelector('.pd-lname b').textContent = p.name;
  li.querySelector('.pd-lface').append(face(p.look));
  li.querySelector('.pd-vh').textContent = `${p.place}. ${p.name}${me ? ' (you)' : ''}, ${v} ${P.unit(v)}, ${t.placing ? 'placing' : t.name}`;
  return li;
}
/* a board in `root`: the toggle, the list, the line under it. ctx: { face, meId, limit, list() (null while loading), onPeriod } */
function board(root, ctx, idp) {
  let period = savedPeriod();
  root.innerHTML = `${periodTabs(period, idp)}<ol class="pd-lboard${ctx.limit < Infinity ? ' pd-lmini' : ''}" role="tabpanel" id="${idp}-panel" tabindex="0"></ol><p class="pd-lnote"></p>`;
  const tabs = root.querySelector('.pd-periods'), ol = root.querySelector('.pd-lboard'), note = root.querySelector('.pd-lnote');
  const pick = id => { period = id; savePeriod(id); paint(); ctx.onPeriod?.(id); };
  tabs.addEventListener('click', e => { const b = e.target.closest('[data-period]'); if (b) pick(b.dataset.period); });
  tabs.addEventListener('keydown', e => {
    const i = PERIODS.findIndex(p => p.id === period), n = { ArrowRight: 1, ArrowLeft: -1 }[e.key], to = e.key === 'Home' ? 0 : e.key === 'End' ? PERIODS.length - 1 : n ? (i + n + PERIODS.length) % PERIODS.length : -1;
    if (to < 0) return;
    e.preventDefault(); pick(PERIODS[to].id); tabs.querySelector(`[data-period="${period}"]`).focus();
  });
  function paint() {
    if (ctx.follow) period = savedPeriod();   // the lobby's board follows a period chosen in the sheet
    tabs.querySelectorAll('[data-period]').forEach(b => { const on = b.dataset.period === period; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
    ol.setAttribute('aria-labelledby', `${idp}-${period}`);
    const list = ctx.list(), P = PERIODS.find(p => p.id === period);
    if (!list) {
      const err = ctx.error?.() || '';
      ol.innerHTML = err ? '' : Array.from({ length: Math.min(ctx.limit, 5) }, () => '<li class="pd-lrow pd-skel" aria-hidden="true"><i></i><i></i><i></i></li>').join('');
      note.textContent = err; return;
    }
    ol.replaceChildren(...boardRows(list, period, ctx.meId, ctx.limit).map(p => rowEl(p, period, ctx.meId, ctx.face)));
    const quiet = period !== 'all' && !list.some(p => (p[period] || 0) > 0);
    note.textContent = list.length < 2 ? 'Just you so far. Invite a mate to start the ladder.' : quiet ? `No duel wins in the last ${period === 'week' ? '7' : '30'} days yet. Win one to top the board.` : P.note;
  }
  paint();
  return { paint, get period() { return period; } };
}

/* the lobby's board: the top three and you, the toggle, See all */
export function lobbyBoard(root, ctx) {
  root.innerHTML = `<div class="pd-whead"><h2 class="pd-h2" id="pd-h-board">Leaderboard</h2><button class="pd-link pd-seeall" type="button" data-pd="ladder">See all</button></div><div class="pd-board"></div>`;
  return board(root.querySelector('.pd-board'), { ...ctx, limit: 3, follow: true }, 'pd-lp');
}

/* ctx: { sheet, face, ib, transport, me, say } */
export async function openLadder(ctx) {
  let list = null, err = '', b = null;
  ctx.sheet(`
    <div class="pd-sheet-head"><span></span><h2 class="pd-sheet-title">Leaderboard</h2><span></span>${ctx.ib('shut', 'x', 'Close')}</div>
    <div class="pd-board pd-board-full"></div>`, root => {
    b = board(root.querySelector('.pd-board'), { face: ctx.face, meId: ctx.me.id, limit: 50, list: () => list, error: () => err, onPeriod: ctx.onPeriod }, 'pd-ls');
  }, { label: 'Leaderboard', cls: 'pd-ladder' });
  try { list = await ctx.transport.leaderboard(ctx.me); } catch (e) { err = e.message || 'Could not load the leaderboard'; }
  b?.paint();
}
