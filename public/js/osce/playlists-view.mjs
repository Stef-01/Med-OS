/* osce/playlists-view.mjs - Playlists, the community library of question playlists (founder 2026-10-26: "spotify styled
   community playlist style library for Questions where people can make their personal questions live and they can get
   favourited and can see trending questions ... a completley different set to the games standard question library").
   The server: supabase/migrations/0011_playlists.sql (the account's token on every call). The pure part:
   library/playlists.mjs. Its own overlay, so it stacks over Duel a Mate when the duel's question picker opens it.

     Browse    search, Trending / New / Top / Favourites / Yours, a "Trending this week" row of covers, then the list
     Detail    the cover, who made it, its questions, Play (in a duel, or on its own against the AI), favourite, report
               (unpublish when it is yours)
     Publish   one of your decks (Your questions) as a playlist: a name and a line about it
   Plain text throughout (esc). */
import { esc } from '../core.mjs';
import { icon } from '../study-kit/icons.mjs';
import { createOverlay } from '../study-kit/overlay.mjs';
import { notify, I } from './state.mjs';
import { account } from '../study-kit/sync.mjs';
import { rpc } from './account.mjs';
import * as api from '../library/api.mjs';
import { starName } from './unlock.mjs';
import { albumHtml, coverFor, drawDogs, starOf, starOwned, refreshOwned, setPending, FINISH } from './albums.mjs';
import { SORTS, sortOf, toDuel, count, publishError, clean, LIMITS } from '../library/playlists.mjs';

let shell = null, onPlay = null;
const V = { sort: 'trending', q: '', list: [], trend: [], picks: [], view: 'browse', cur: null, busy: false, err: '', pub: null };
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const body = () => shell.el.querySelector('.os-plbody');

/* open it: onPlay(questions, name) plays a playlist in the duel that asked; without one, Play opens the duel itself */
export function openPlaylists({ onPlay: play = null, opener = null } = {}) {
  onPlay = play;
  if (!shell) {
    shell = createOverlay({ cls: 'os os-pl', label: 'Playlists', onKey: e => { if (e.key === 'Escape') { e.preventDefault(); back(); } } });
    shell.el.innerHTML = `<header class="os-plhead"><button class="os-btn os-plx" data-pl="back" aria-label="Close">${I.x}</button><h2>Playlists</h2><span></span></header><div class="os-plbody"></div>`;
    shell.el.addEventListener('click', onClick);
    shell.el.addEventListener('input', onInput);
    /* a page's header is clear over its cover's colours, and frosted once they scroll away under it */
    body().addEventListener('scroll', () => shell.el.classList.toggle('os-pl--scrolled', body().scrollTop > 180), { passive: true });
    shell.el.addEventListener('submit', e => { e.preventDefault(); if (e.target.matches('[data-pl-form="publish"]')) publish(e.target); });
  }
  V.view = 'browse'; V.cur = null; V.err = ''; V.painted = null;
  shell.open(opener || document.activeElement);
  paint(); load(); loadPicks(); refreshOwned().then(paint, () => {});
}
export const closePlaylists = () => shell?.close();

function back() {
  if (V.view !== 'browse') { V.view = 'browse'; V.cur = null; V.pub = null; paint(); return; }
  shell.close();
}

async function call(fn, args) {
  const a = account(); if (!a) throw new Error('Sign in first');
  return rpc(fn, { p_token: a.token, ...args });
}
/* MDosce picks (public/playlists/picks.json, founder 2026-10-28): featured packs written from open guidelines, there for
   everyone, signed in or not; they live in the file, not the server, so they have no favourites or plays */
async function loadPicks() {
  if (V.picks.length) return;
  try { const r = await fetch('./playlists/picks.json', { cache: 'no-cache' }); if (r.ok) V.picks = ((await r.json()).packs || []).map(p => ({ ...p, id: `pick:${p.id}`, pick: true, n: (p.questions || []).length, owner_name: 'MDosce picks' })); } catch { /* the community still loads */ }
  if (V.view === 'browse') paint();
}
/* the cover's colours, blurred, behind a pick's hero card and the top of a playlist's page */
const washHtml = p => `<span class="os-plwash os-alb--${coverFor(p).style}" aria-hidden="true"></span>`;
const heroCard = p => {
  const st = starOf(p), tag = st ? (starOwned(st) ? `${starName(st)} unlocked` : `Unlock ${starName(st)}`) : 'MDosce pick';
  return `<li><button class="os-plcard os-plcard--hero" data-pl="open" data-id="${esc(p.id)}">${washHtml(p)}${coverHtml(p)}<span class="os-plcard-tx"><i>${esc(tag)}</i><b>${esc(p.title)}</b><small>${plural(p.n, 'question')}</small></span></button></li>`;
};
const picksHtml = () => (V.picks.length ? `<section class="os-plsec" aria-labelledby="os-plpk"><h3 class="os-plh" id="os-plpk">MDosce picks</h3><ul class="os-plcar os-plcar--hero" role="list">${V.picks.map(heroCard).join('')}</ul></section>` : '');
const card = p => `<li><button class="os-plcard" data-pl="open" data-id="${esc(p.id)}">${coverHtml(p)}<span class="os-plcard-tx"><b>${esc(p.title)}</b><small>${esc(p.owner_name || 'Someone')} · ${plural(p.n, 'question')}</small></span></button></li>`;
async function load() {
  if (!account()) { paint(); return; }
  V.busy = true; V.err = ''; paint();
  try {
    const [list, trend] = await Promise.all([
      call('pl_list', { p_sort: sortOf(V.sort), p_q: V.q, p_limit: 30, p_offset: 0 }),
      V.sort === 'trending' && !V.q ? call('pl_list', { p_sort: 'trending', p_q: '', p_limit: 8, p_offset: 0 }) : Promise.resolve(null)
    ]);
    V.list = Array.isArray(list) ? list : [];
    V.trend = Array.isArray(trend) ? trend.filter(p => p.week > 0) : [];
  } catch (e) { V.err = e.message || 'Playlists did not load.'; }
  V.busy = false; paint();
}

/* ---------- painting ---------- */
function paint() {
  if (!shell) return;
  shell.el.classList.toggle('os-pl--detail', V.view === 'detail');
  shell.el.querySelector('.os-plhead h2').textContent = V.view === 'detail' ? '' : V.view === 'publish' ? 'Publish a playlist' : 'Playlists';
  shell.el.querySelector('[data-pl="back"]').innerHTML = V.view === 'browse' ? I.x : I.back;
  shell.el.querySelector('[data-pl="back"]').setAttribute('aria-label', V.view === 'browse' ? 'Close' : 'Back');
  const out = !account() && V.view !== 'detail', mode = out ? 'out' : V.view, res = body().querySelector('.os-plres');
  /* browse again: only its results change, so the search keeps the keyboard and the chips their place */
  if (mode === 'browse' && V.painted === 'browse' && res) {
    res.innerHTML = browseRes();
    body().querySelectorAll('[data-pl="sort"]').forEach(c => { const on = c.dataset.v === V.sort; c.classList.toggle('on', on); c.setAttribute('aria-selected', on); });
    drawDogs(res); return;
  }
  const backTo = V.painted === 'detail' && mode !== 'detail';
  body().innerHTML = `<div class="os-plview${V.painted && V.painted !== mode ? (backTo ? ' os-plview--back' : '') : ' os-plview--still'}">${out ? signedOutHtml() : mode === 'detail' ? detailHtml() : mode === 'publish' ? publishHtml() : browseHtml()}</div>`;
  V.painted = mode;
  if (mode === 'detail') body().scrollTop = 0;   /* a page opens at its top, whatever the list was scrolled to */
  if (backTo && V.scroll) {
    body().scrollTop = V.scroll.top; body().querySelectorAll('.os-plcar').forEach((c, i) => { c.scrollLeft = V.scroll.car[i] || 0; });
    body().querySelector(`[data-pl="open"][data-id="${CSS.escape(V.scroll.id || '')}"]`)?.focus({ preventScroll: true });   /* back on the card you opened */
  }
  drawDogs(body());
}
const coverHtml = (p, cls = '') => albumHtml(p, cls.includes('--s') ? 's' : cls.includes('--l') ? 'l' : '');
/* a pick's star: what finishing it unlocks, or that it is yours */
function starHtml(p) {
  const st = starOf(p); if (!st) return '';
  const name = starName(st), mine = starOwned(st);
  return `<div class="os-plstar${mine ? ' on' : ''}"><span class="os-plstar-dog"><span class="os-alb-dog" data-dog="${esc(`${st.dog}|${mine ? 'overjoyed' : st.expr}|{}`)}"></span></span>
    <p><i>${mine ? 'Unlocked' : 'Reward'}</i><b>${mine ? `${esc(name)} is yours` : `Unlock ${esc(name)}`}</b>${mine ? `Pick ${esc(name)} and the ${esc(st.piece)} from your duel dogs.` : `Play ${FINISH.rounds}+ rounds at ${Math.round(FINISH.share * 100)}% or better to win ${esc(name)} and the ${esc(st.piece)}.`}</p></div>`;
}
function signedOutHtml() {
  return `${picksHtml()}<div class="os-plempty">${icon('users')}<p><strong>The community's playlists</strong><br>Sign in (Settings, Account) to browse them, favourite them and publish your own.</p></div>`;
}
function browseHtml() {
  return `<label class="os-plsearch">${icon('search')}<input name="plq" type="search" placeholder="Search playlists or people" value="${esc(V.q)}" autocomplete="off" enterkeyhint="search" aria-label="Search playlists"></label>
    <div class="os-plchips" role="tablist" aria-label="Order">${SORTS.map(s => `<button class="os-chip${V.sort === s.id ? ' on' : ''}" role="tab" aria-selected="${V.sort === s.id}" data-pl="sort" data-v="${s.id}">${esc(s.label)}</button>`).join('')}</div>
    <div class="os-plres">${browseRes()}</div>`;
}
function browseRes() {
  const row = p => `<li><button class="os-plrow" data-pl="open" data-id="${esc(p.id)}">${coverHtml(p, ' os-plcover--s')}<span class="os-plrow-tx"><b>${esc(p.title)}</b><small>${esc(p.owner_name || 'Someone')} · ${plural(p.n, 'question')}</small></span><span class="os-plfav${p.fav ? ' on' : ''}" aria-label="${p.favs} favourites">${icon('star')}${count(p.favs)}</span>${icon('chevronRight')}</button></li>`;
  return `${V.q ? '' : picksHtml()}
    ${V.trend.length ? `<section class="os-plsec" aria-labelledby="os-pltr"><h3 class="os-plh" id="os-pltr">Trending this week</h3><ul class="os-plcar" role="list">${V.trend.map(card).join('')}</ul></section>` : ''}
    ${V.err ? `<p class="os-plerr" role="alert">${esc(V.err)} <button class="os-link" data-pl="retry">Try again</button></p>` : ''}
    ${V.busy && !V.list.length ? '<p class="os-plmeta" role="status">Loading playlists…</p>' : V.list.length ? `<section class="os-plsec"><h3 class="os-plh">${V.q ? `Results for “${esc(V.q)}”` : esc(SORTS.find(s => s.id === V.sort).label)}</h3><ul class="os-pllist" role="list">${V.list.map(row).join('')}</ul></section>`
      : `<div class="os-plempty">${icon('cards')}<p><strong>${V.sort === 'faves' ? 'No favourites yet' : V.sort === 'mine' ? 'You have not published a playlist' : V.q ? 'Nothing matches' : 'No playlists yet'}</strong><br>${V.sort === 'mine' || !V.q ? 'Publish one of your decks and it is live for everyone.' : 'Try another word.'}</p></div>`}
    <button class="os-plpub" data-pl="publishview"><span class="os-plpub-ic">${icon('plus')}</span><span class="os-plrow-tx"><b>Publish a playlist</b><small>Put one of your decks live for everyone</small></span></button>`;
}
function detailHtml() {
  const p = V.cur; if (!p) return '<p class="os-plmeta" role="status">Loading…</p>';
  const qs = Array.isArray(p.questions) ? p.questions : [];
  return `<div class="os-pldetail">${washHtml(p)}${coverHtml(p, ' os-plcover--l')}
    <h2 class="os-pltitle" tabindex="-1">${esc(p.title)}</h2>
    <p class="os-plmeta">${esc(p.owner_name || 'Someone')} · ${plural(p.n, 'question')}${p.pick ? '' : ` · ${plural(p.favs, 'favourite')} · ${plural(p.plays, 'play')}`}</p>
    ${p.blurb ? `<p class="os-plblurb">${esc(p.blurb)}</p>` : ''}
    <div class="os-placts">${p.pick ? '' : `<button class="os-plfavbtn${p.fav ? ' on' : ''}" data-pl="fav" aria-pressed="${!!p.fav}">${icon('star')}<span class="os-vh">${p.fav ? 'Favourited' : 'Favourite'}</span></button>`}
      <button class="os-plplay" data-pl="play"><span>${onPlay ? 'Play these' : 'Play vs the AI'}</span><span class="os-plplay-ic">${icon('playFilled')}</span></button></div>
    ${starHtml(p)}
    <h3 class="os-plh">In this playlist</h3>
    <ol class="os-plqs">${qs.slice(0, 8).map(q => `<li><span>${esc(q.stem.length > 140 ? `${q.stem.slice(0, 140)}…` : q.stem)}</span></li>`).join('')}</ol>${qs.length > 8 ? `<p class="os-plmeta">and ${plural(qs.length - 8, 'more question')}</p>` : ''}
    ${p.pick ? `<p class="os-plsrc">Written for MDosce from ${esc(p.source)}. Check the current guideline before acting on a dose.</p>` : p.mine ? `<button class="os-link os-pldanger" data-pl="unpublish">Unpublish this playlist</button>` : `<button class="os-link" data-pl="report">Report this playlist</button>`}</div>`;
}
function publishHtml() {
  const decks = api.current().decks.filter(d => d.items.length);
  if (!decks.length) return `<div class="os-plempty">${icon('cards')}<p><strong>No decks to publish yet</strong><br>Upload questions in Your questions first; then any deck can go live here.</p></div>`;
  const P = V.pub || (V.pub = { deck: decks[0].id, title: decks[0].name, blurb: '', err: '' });
  return `<form class="os-plform" data-pl-form="publish" novalidate>
    <fieldset><legend class="os-plh">Which deck</legend><div class="os-plchips">${decks.map(d => `<button type="button" class="os-chip${P.deck === d.id ? ' on' : ''}" data-pl="pubdeck" data-id="${esc(d.id)}" aria-pressed="${P.deck === d.id}">${esc(d.name)}<span class="os-libn2">${d.items.length}</span></button>`).join('')}</div></fieldset>
    <label class="os-setf"><span>Name</span><input name="title" maxlength="${LIMITS.title}" value="${esc(P.title)}" autocomplete="off"></label>
    <label class="os-setf"><span>A line about it (optional)</span><textarea name="blurb" rows="2" maxlength="${LIMITS.blurb}" placeholder="What it covers, who it is for">${esc(P.blurb)}</textarea></label>
    <p class="os-plmeta">Everyone signed in can play it and favourite it. Publishing the same deck again updates the playlist. The first ${LIMITS.questions} questions are published.</p>
    <p class="os-plerr" role="alert">${esc(P.err || '')}</p>
    <button class="os-btn os-btn--lg os-primary" type="submit">${icon('share')}<span>Publish</span></button></form>`;
}

/* ---------- events ---------- */
function onInput(e) {
  if (e.target.name === 'plq') { clearTimeout(V.qt); V.qt = setTimeout(() => { V.q = clean(e.target.value).slice(0, 60); load(); }, 260); }
  if (V.pub && (e.target.name === 'title' || e.target.name === 'blurb')) V.pub[e.target.name] = e.target.value;
}
async function onClick(e) {
  const b = e.target.closest('[data-pl]'); if (!b) return;
  const k = b.dataset.pl;
  if (k === 'back') return back();
  if (k === 'retry') return load();
  if (k === 'sort') { V.sort = sortOf(b.dataset.v); b.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' }); return load(); }
  if (k === 'open') return openOne(b.dataset.id);
  if (k === 'publishview') { V.view = 'publish'; V.pub = null; return paint(); }
  if (k === 'pubdeck') { const d = api.current().decks.find(x => x.id === b.dataset.id); V.pub = { ...V.pub, deck: b.dataset.id, title: V.pub.title && V.pub.title !== api.current().decks.find(x => x.id === V.pub.deck)?.name ? V.pub.title : d?.name || '' }; return paint(); }
  if (k === 'fav') return fav();
  if (k === 'play') return play();
  if (k === 'report') return report();
  if (k === 'unpublish') return unpublish();
}
async function openOne(id) {
  V.scroll = { id, top: body().scrollTop, car: [...body().querySelectorAll('.os-plcar')].map(c => c.scrollLeft) };
  if (id.startsWith('pick:')) { V.view = 'detail'; V.cur = V.picks.find(p => p.id === id) || null; if (!V.cur) V.view = 'browse'; paint(); shell.el.querySelector('.os-pltitle')?.focus?.(); return; }
  V.view = 'detail'; V.cur = null; paint();
  try { V.cur = await call('pl_get', { p_id: id }); } catch (e) { notify(e.message || 'That playlist did not open.', 'danger'); V.view = 'browse'; }
  paint(); shell.el.querySelector('.os-pltitle')?.focus?.();
}
async function fav() {
  const p = V.cur, on = !p.fav;
  p.fav = on; p.favs += on ? 1 : -1; favPaint();
  try { p.favs = await call('pl_fav', { p_id: p.id, p_on: on }); const r = V.list.find(x => x.id === p.id); if (r) { r.fav = on; r.favs = p.favs; } }
  catch (e) { p.fav = !on; p.favs += on ? -1 : 1; notify(e.message || 'That did not save.', 'danger'); }
  favPaint();
}
/* the favourite button and the count, in place: focus stays on the button */
function favPaint() {
  const p = V.cur, b = body().querySelector('[data-pl="fav"]'), m = body().querySelector('.os-pldetail > .os-plmeta');
  if (!b) return;
  b.classList.toggle('on', !!p.fav); b.setAttribute('aria-pressed', !!p.fav); b.querySelector('span').textContent = p.fav ? 'Favourited' : 'Favourite';
  if (m) m.textContent = `${p.owner_name || 'Someone'} · ${plural(p.n, 'question')} · ${plural(p.favs, 'favourite')} · ${plural(p.plays, 'play')}`;
}
async function play() {
  const p = V.cur, qs = toDuel(p.questions);
  if (!qs.length) { notify('No playable questions in this playlist.', 'danger'); return; }
  if (!p.pick) call('pl_play', { p_id: p.id }).catch(() => {});
  setPending(starOf(p) ? { star: starOf(p), title: p.title, n: qs.length } : null);
  shell.close();
  if (onPlay) onPlay(qs, p.title);
  else { const { openDuelWith } = await import('./duel.mjs'); openDuelWith(qs, p.title); }
}
async function report() {
  try { await call('pl_report', { p_id: V.cur.id, p_reason: 'reported in the app' }); notify('Reported. Thank you.', 'success'); back(); }
  catch (e) { notify(e.message || 'That did not send.', 'danger'); }
}
async function unpublish() {
  try { await call('pl_unpublish', { p_id: V.cur.id }); notify('Unpublished.', 'success'); V.view = 'browse'; load(); }
  catch (e) { notify(e.message || 'That did not work.', 'danger'); }
}
async function publish(f) {
  const P = V.pub, err = publishError(P.title, P.blurb);
  if (err) { P.err = err; paint(); shell.el.querySelector('[name="title"]')?.focus(); return; }
  try {
    const card = await call('pl_publish', { p_deck: P.deck, p_title: clean(P.title), p_blurb: clean(P.blurb) });
    notify(`"${card.title}" is live.`, 'success');
    V.sort = 'mine'; V.view = 'browse'; V.pub = null; await load(); openOne(card.id);
  } catch (e) { P.err = e.message || 'That did not publish.'; paint(); }
}
