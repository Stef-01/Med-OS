/* ranked.mjs (ui): the ranked card in the lobby, the search for a match and the leaderboard (founder 2026-10-25).
   The rules are duel/ranked.mjs; the server pairs, rates and ranks (0003_pup_ranked.sql).

     rankCard(me)           the lobby's card: your tier on its colour, your rating, how far to the next tier (or how
                            many placing games are left), Find a match, and the ladder
     openSearch(ctx)        a sheet that asks the server for a match every 2 s, shows how long and how wide, and opens
                            the duel the moment there is one; closing it leaves the queue
     openLadder(ctx)        the leaderboard: Ranked (by rating) or This week (by wins in 7 days); you are marked and,
                            if far down, pinned at the foot */

import { tierOf, ranked, byRating, byWeek, PLACING } from '../duel/ranked.mjs';
import { icon } from './icons.mjs';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const POLL_MS = 2000;

export function rankCard(p) {
  const t = tierOf(p?.rating, p?.ranked);
  const sub = t.placing ? `Placing: ${PLACING - (p?.ranked || 0)} ${PLACING - (p?.ranked || 0) === 1 ? 'game' : 'games'} to go` : t.next ? `${t.toNext} to ${t.nextName}` : 'Top tier';
  return `<div class="pd-rank" data-tier="${t.id}">
    <span class="pd-tier" aria-hidden="true">${icon('shield')}</span>
    <div class="pd-rank-txt"><b>${t.name}</b><span><span class="pd-rating">${p?.rating ?? 1000}</span> rating</span><small>${sub}</small></div>
    <button class="pd-ib pd-rank-ladder" type="button" data-pd="ladder" aria-label="Leaderboard" title="Leaderboard">${icon('trophy')}</button>
  </div>
  <button class="pd-btn pd-pri" type="button" data-pd="ranked">${icon('zap')}Find a ranked match</button>`;
}

/* ctx: { sheet, closeSheet, guard, transport, me, makeSetup, onMatch(duel), say } */
export function openSearch(ctx) {
  let timer = 0, t0 = Date.now(), done = false, el;
  const stop = async () => { done = true; clearTimeout(timer); clearInterval(clock); try { await ctx.transport.unqueue(ctx.me); } catch { /* a stale ticket drops itself in 15 s */ } };
  ctx.sheet(`
    <div class="pd-search" role="status" aria-live="polite">
      <span class="pd-radar" aria-hidden="true"><i></i><i></i><b>${icon('zap')}</b></span>
      <h2 class="pd-sheet-title">Finding a match</h2>
      <p class="pd-search-line"><span class="pd-search-time">0:00</span><span class="pd-search-win"></span></p>
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

/* ctx: { sheet, face, ib, transport, me, say } */
export async function openLadder(ctx) {
  const V = { tab: 'rating' };
  let list = null, err = '', el;
  ctx.sheet(`
    <div class="pd-sheet-head"><span></span><h2 class="pd-sheet-title">Leaderboard</h2><span></span>${ctx.ib('shut', 'x', 'Close')}</div>
    <div class="pd-wtabs pd-ltabs" role="tablist" aria-label="Board"><button type="button" role="tab" data-lt="rating" id="pd-lt-rating" aria-controls="pd-lboard">${icon('shield')}<span>Ranked</span></button><button type="button" role="tab" data-lt="week" id="pd-lt-week" aria-controls="pd-lboard">${icon('clock')}<span>This week</span></button></div>
    <ol class="pd-lboard" id="pd-lboard" role="tabpanel"></ol>
    <p class="pd-lnote"></p>`, root => {
    el = root;
    el.querySelector('.pd-ltabs').addEventListener('click', e => { const b = e.target.closest('[data-lt]'); if (b) { V.tab = b.dataset.lt; paint(); } });
    el.querySelector('.pd-ltabs').addEventListener('keydown', e => { if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return; e.preventDefault(); V.tab = V.tab === 'rating' ? 'week' : 'rating'; paint(); el.querySelector(`[data-lt="${V.tab}"]`).focus(); });
    paint();
  }, { label: 'Leaderboard', cls: 'pd-ladder' });
  try { list = await ctx.transport.leaderboard(ctx.me); } catch (e) { err = e.message || 'Could not load the leaderboard'; }
  if (el?.isConnected) paint();

  function paint() {
    el.querySelectorAll('[data-lt]').forEach(b => { const on = b.dataset.lt === V.tab; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
    const ol = el.querySelector('.pd-lboard'), note = el.querySelector('.pd-lnote');
    ol.setAttribute('aria-labelledby', `pd-lt-${V.tab}`);
    if (!list) { ol.innerHTML = err ? '' : Array.from({ length: 5 }, () => '<li class="pd-lrow pd-skel" aria-hidden="true"><i></i><i></i><i></i></li>').join(''); note.textContent = err; return; }
    const week = V.tab === 'week';
    const rows = ranked(list, week ? byWeek : byRating, p => (week ? p.week : p.rating));
    const mine = rows.findIndex(p => p.id === ctx.me.id), TOP = 50;
    const shown = rows.slice(0, TOP);
    ol.replaceChildren(...shown.map(row), ...(mine >= TOP ? [Object.assign(document.createElement('li'), { className: 'pd-lgap', ariaHidden: 'true' }), row(rows[mine])] : []));
    note.textContent = rows.length < 2 ? 'Just you so far. Invite a mate to start the ladder.' : week ? 'Duel wins in the last 7 days.' : 'Ranked duels move your rating. Find a match from the lobby.';
    function row(p) {
      const li = document.createElement('li'), t = tierOf(p.rating, p.ranked), me = p.id === ctx.me.id;
      li.className = 'pd-lrow'; if (me) li.dataset.me = ''; li.dataset.tier = t.id;
      li.innerHTML = `<span class="pd-lplace">${p.place}</span><span class="pd-lface"></span><span class="pd-lname"><b></b><small>${t.placing ? 'Placing' : t.name}${me ? ' <em>You</em>' : ''}</small></span><span class="pd-lval"><b>${week ? p.week : p.rating}</b><small>${week ? (p.week === 1 ? 'win' : 'wins') : 'rating'}</small></span>`;
      li.querySelector('.pd-lname b').textContent = p.name;
      li.querySelector('.pd-lface').append(ctx.face(p.look));
      li.setAttribute('aria-label', `${p.place}. ${p.name}${me ? ' (you)' : ''}, ${week ? `${p.week} ${p.week === 1 ? 'win' : 'wins'} this week` : `${p.rating} rating, ${t.placing ? 'placing' : t.name}`}`);
      return li;
    }
  }
}
