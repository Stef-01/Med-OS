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
import { SORTS, sortOf, cover, toDuel, count, publishError, clean, LIMITS } from '../library/playlists.mjs';

let shell = null, onPlay = null;
const V = { sort: 'trending', q: '', list: [], trend: [], view: 'browse', cur: null, busy: false, err: '', pub: null };
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
    shell.el.addEventListener('submit', e => { e.preventDefault(); if (e.target.matches('[data-pl-form="publish"]')) publish(e.target); });
  }
  V.view = 'browse'; V.cur = null; V.err = '';
  shell.open(opener || document.activeElement);
  paint(); load();
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
  shell.el.querySelector('.os-plhead h2').textContent = V.view === 'detail' ? '' : V.view === 'publish' ? 'Publish a playlist' : 'Playlists';
  shell.el.querySelector('[data-pl="back"]').innerHTML = V.view === 'browse' ? I.x : I.back;
  shell.el.querySelector('[data-pl="back"]').setAttribute('aria-label', V.view === 'browse' ? 'Close' : 'Back');
  body().innerHTML = !account() ? signedOutHtml() : V.view === 'detail' ? detailHtml() : V.view === 'publish' ? publishHtml() : browseHtml();
}
const coverHtml = (p, cls = '') => `<span class="os-plcover${cls}" style="background:${cover(p.cover).css}" aria-hidden="true"><b>${esc(p.title)}</b>${icon('cards')}</span>`;
function signedOutHtml() {
  return `<div class="os-plempty">${icon('users')}<p><strong>Playlists are the community's questions</strong><br>Sign in (Settings, Account) to browse them, favourite them and publish your own.</p></div>`;
}
function browseHtml() {
  const row = p => `<li><button class="os-plrow" data-pl="open" data-id="${esc(p.id)}">${coverHtml(p, ' os-plcover--s')}<span class="os-plrow-tx"><b>${esc(p.title)}</b><small>${esc(p.owner_name || 'Someone')} · ${plural(p.n, 'question')}</small></span><span class="os-plfav${p.fav ? ' on' : ''}" aria-label="${p.favs} favourites">${icon('star')}${count(p.favs)}</span></button></li>`;
  return `<label class="os-plsearch">${icon('search')}<input name="plq" type="search" placeholder="Search playlists or people" value="${esc(V.q)}" autocomplete="off" enterkeyhint="search" aria-label="Search playlists"></label>
    <div class="os-plchips" role="tablist" aria-label="Order">${SORTS.map(s => `<button class="os-chip${V.sort === s.id ? ' on' : ''}" role="tab" aria-selected="${V.sort === s.id}" data-pl="sort" data-v="${s.id}">${esc(s.label)}</button>`).join('')}</div>
    ${V.trend.length ? `<section aria-labelledby="os-pltr"><h3 class="os-plh" id="os-pltr">Trending this week</h3><ul class="os-plcar" role="list">${V.trend.map(p => `<li><button class="os-plcard" data-pl="open" data-id="${esc(p.id)}">${coverHtml(p)}<small>${esc(p.owner_name || '')} · ${plural(p.n, 'question')}</small></button></li>`).join('')}</ul></section>` : ''}
    ${V.err ? `<p class="os-plerr" role="alert">${esc(V.err)} <button class="os-link" data-pl="retry">Try again</button></p>` : ''}
    ${V.busy && !V.list.length ? '<p class="os-plmeta" role="status">Loading playlists…</p>' : V.list.length ? `<h3 class="os-plh">${esc(SORTS.find(s => s.id === V.sort).label)}${V.q ? ` · "${esc(V.q)}"` : ''}</h3><ul class="os-pllist" role="list">${V.list.map(row).join('')}</ul>`
      : `<div class="os-plempty">${icon('cards')}<p><strong>${V.sort === 'faves' ? 'No favourites yet' : V.sort === 'mine' ? 'You have not published a playlist' : V.q ? 'Nothing matches' : 'No playlists yet'}</strong><br>${V.sort === 'mine' || !V.q ? 'Publish one of your decks and it is live for everyone.' : 'Try another word.'}</p></div>`}
    <button class="os-btn os-btn--lg os-primary os-plpub" data-pl="publishview">${icon('plus')}<span>Publish one of your decks</span></button>`;
}
function detailHtml() {
  const p = V.cur; if (!p) return '<p class="os-plmeta" role="status">Loading…</p>';
  const qs = Array.isArray(p.questions) ? p.questions : [];
  return `<div class="os-pldetail">${coverHtml(p, ' os-plcover--l')}
    <h2 class="os-pltitle">${esc(p.title)}</h2>
    <p class="os-plmeta">${esc(p.owner_name || 'Someone')} · ${plural(p.n, 'question')} · ${plural(p.favs, 'favourite')} · ${plural(p.plays, 'play')}</p>
    ${p.blurb ? `<p class="os-plblurb">${esc(p.blurb)}</p>` : ''}
    <div class="os-placts"><button class="os-btn os-btn--lg os-primary" data-pl="play">${icon('playFilled')}<span>${onPlay ? 'Play these' : 'Play vs the AI'}</span></button>
      <button class="os-btn os-btn--lg os-plfavbtn${p.fav ? ' on' : ''}" data-pl="fav" aria-pressed="${!!p.fav}">${icon('star')}<span>${p.fav ? 'Favourited' : 'Favourite'}</span></button></div>
    <h3 class="os-plh">In this playlist</h3>
    <ol class="os-plqs">${qs.slice(0, 8).map(q => `<li>${esc(q.stem.length > 140 ? `${q.stem.slice(0, 140)}…` : q.stem)}</li>`).join('')}</ol>${qs.length > 8 ? `<p class="os-plmeta">and ${plural(qs.length - 8, 'more question')}</p>` : ''}
    ${p.mine ? `<button class="os-link os-pldanger" data-pl="unpublish">Unpublish this playlist</button>` : `<button class="os-link" data-pl="report">Report this playlist</button>`}</div>`;
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
  if (e.target.name === 'plq') { clearTimeout(V.qt); V.qt = setTimeout(() => { V.q = clean(e.target.value).slice(0, 60); load().then(() => { const f = shell.el.querySelector('[name="plq"]'); if (f) { f.focus(); f.setSelectionRange(f.value.length, f.value.length); } }); }, 260); }
  if (V.pub && (e.target.name === 'title' || e.target.name === 'blurb')) V.pub[e.target.name] = e.target.value;
}
async function onClick(e) {
  const b = e.target.closest('[data-pl]'); if (!b) return;
  const k = b.dataset.pl;
  if (k === 'back') return back();
  if (k === 'retry') return load();
  if (k === 'sort') { V.sort = sortOf(b.dataset.v); return load(); }
  if (k === 'open') return openOne(b.dataset.id);
  if (k === 'publishview') { V.view = 'publish'; V.pub = null; return paint(); }
  if (k === 'pubdeck') { const d = api.current().decks.find(x => x.id === b.dataset.id); V.pub = { ...V.pub, deck: b.dataset.id, title: V.pub.title && V.pub.title !== api.current().decks.find(x => x.id === V.pub.deck)?.name ? V.pub.title : d?.name || '' }; return paint(); }
  if (k === 'fav') return fav();
  if (k === 'play') return play();
  if (k === 'report') return report();
  if (k === 'unpublish') return unpublish();
}
async function openOne(id) {
  V.view = 'detail'; V.cur = null; paint();
  try { V.cur = await call('pl_get', { p_id: id }); } catch (e) { notify(e.message || 'That playlist did not open.', 'danger'); V.view = 'browse'; }
  paint(); shell.el.querySelector('.os-pltitle')?.focus?.();
}
async function fav() {
  const p = V.cur, on = !p.fav;
  p.fav = on; p.favs += on ? 1 : -1; paint();
  try { p.favs = await call('pl_fav', { p_id: p.id, p_on: on }); const r = V.list.find(x => x.id === p.id); if (r) { r.fav = on; r.favs = p.favs; } }
  catch (e) { p.fav = !on; p.favs += on ? -1 : 1; notify(e.message || 'That did not save.', 'danger'); }
  paint();
}
async function play() {
  const p = V.cur, qs = toDuel(p.questions);
  if (!qs.length) { notify('No playable questions in this playlist.', 'danger'); return; }
  call('pl_play', { p_id: p.id }).catch(() => {});
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
