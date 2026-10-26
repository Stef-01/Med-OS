/* duel.mjs: the duel on screen. Sign in with a name and a 4-digit PIN, a lobby of mates, a challenge, the match
   (both dogs facing each other, the question, the clock, the reveal), the result and the dressing room.
   Minimal on purpose (Impeccable's craft floor; docs/plans/2026-10-24-001-pup-duel.md, "The screens"): one primary
   action a screen; a drawn icon where a word is not needed (icons.mjs; an icon-only control carries its name for a
   screen reader); the reading (why an answer is right) after the game, in its review, not between rounds. Phone
   first: every screen works at 320 px. All text a player or a pack wrote goes in through textContent.

   const ui = mountDuel(root, { transport, pack, onClose, onResult });   // ui.destroy()

   transport  supabaseTransport(config) | localTransport() | null (practice only)
   pack       a normalised question pack (pack.mjs)
   look       optional: () => the host's own dog and wear (a host with its own wardrobe), else the duel's store and
              locker (store.mjs: pieces bought with bones earned in duels; the server keeps the wallet)
   keys       'document' (default) listens for keys itself; 'host' leaves them to the host, which calls ui.key(e) from its
              own key owner (Med-OS's overlay stack captures every key) and gets true back when the duel used it */

import { RULES, EMOTES, makeSetup, outcome } from '../duel/core.mjs';
import { createSession } from '../duel/session.mjs';
import { createLobby, settleCrossed, offerFrom } from '../duel/lobby.mjs';
import { practiceWorld, BOT } from '../duel/bot.mjs';
import { nameError, pinError, normName, normLook, DOGS, DEFAULT_DOG, dogName } from '../duel/accounts.mjs';
import { topicsOf } from '../duel/pack.mjs';
import { freshSeed } from '../duel/rng.mjs';
import { fitOwned } from '../duel/wallet.mjs';
import { openStore, storeTile, loadoutsPanel, bones } from './store.mjs';
import { ITEMS, SETS, wearMsg, SLOT_NAME, VB, itemOf } from '../pup/wardrobe.mjs';
import { coatsFor, COLLARS } from '../pup/rig/coats.mjs';
import { still, lookDog } from '../pup/rig/still.mjs';
import { icon } from './icons.mjs';

const BASE = new URL('../', import.meta.url);
export const RIG = new URL('pup/rig/index.html', BASE).href;
export const ICON = dog => new URL(`pup/rig/icons/${DOGS.some(d => d.id === dog) ? dog : DEFAULT_DOG}.png`, BASE).href;
const CSS = new URL('ui/duel.css', BASE).href;
const LETTERS = 'ABCDEF';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => Math.round(n).toLocaleString('en-AU');
const EXPR = { idle: 'happy', think: 'lockedin', wait: 'curious', right: 'excited', wrong: 'sad', win: 'overjoyed', loss: 'puppy', draw: 'bashful', emote: 'goofy' };
const EMOTE_ICON = { gg: 'thumb', woof: 'paw', wow: 'star', close: 'oof' };
const STATUS = { think: ['more', 'Thinking'], done: ['check', 'Answered'], lock: ['check', 'Locked in'], ok: ['check', 'Right'], no: ['x', 'Wrong'] };
const BETA = '<span class="pd-beta">Beta</span>';
/* a look as this build can draw it: its dog, coat and collar known, its pieces in the wardrobe */
const lookOf = l => normLook(l, id => !!itemOf(id));
const ib = (pd, name, label, cls = '') => `<button class="pd-ib${cls ? ' ' + cls : ''}" type="button" data-pd="${pd}" aria-label="${esc(label)}" title="${esc(label)}">${icon(name)}</button>`;
const setupLine = s => `${s?.rounds || '?'} questions, ${s?.secs || '?'} seconds each${s?.topic ? `, ${s.topic}` : ''}`;
const breedOf = id => DOGS.find(d => d.id === id) || DOGS.find(d => d.id === DEFAULT_DOG);

function loadCss() {
  if (document.querySelector('link[data-pup-duel]')) return Promise.resolve();
  return new Promise(res => {
    const l = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: CSS });
    l.dataset.pupDuel = '';
    l.onload = l.onerror = () => res();
    document.head.append(l);
  });
}

/* a dog in an iframe of the rig, in its look; `.expr(id)` changes its face, `.dress(look)` its look in place (another
   dog, coat or collar redraws it at once; a new piece pops on) */
function dogFrame(look, { mirror = false, label = '' } = {}) {
  const box = document.createElement('div');
  box.className = 'pd-dog' + (mirror ? ' pd-mirror' : '');
  const f = document.createElement('iframe');
  let cur = lookOf(look), ready = false, wantExpr = null;
  const q = new URLSearchParams({ embed: '1', dog: cur.dog, expr: 'happy' });
  if (cur.coat) q.set('coat', cur.coat);
  if (cur.collar) q.set('collar', cur.collar);
  f.src = `${RIG}?${q}`;
  f.title = label; f.setAttribute('aria-hidden', 'true'); f.tabIndex = -1;
  box.append(f);
  const send = m => { try { f.contentWindow?.postMessage(m, location.origin); } catch { /* not ready */ } };
  const skin = L => ({ dob: 'skin', dog: L.dog, coat: L.coat || '', collar: L.collar || '' });
  let loadedAs = cur;
  f.addEventListener('load', () => {
    ready = true;
    if (cur.dog !== loadedAs.dog || cur.coat !== loadedAs.coat || cur.collar !== loadedAs.collar) send(skin(cur));
    send(wearMsg(cur.wear, false)); if (wantExpr) send({ dob: 'expr', id: wantExpr });
    loadedAs = cur;
  });
  return {
    el: box,
    expr(id) { if (wantExpr === id) return; wantExpr = id; if (ready) send({ dob: 'expr', id }); },
    tap() { if (ready) send({ dob: 'tap' }); },
    dress(look) {
      const n = lookOf(look), was = cur;
      cur = n;
      if (!ready) return;
      if (n.dog !== was.dog || n.coat !== was.coat || n.collar !== was.collar) send(skin(n));
      if (JSON.stringify(n.wear) !== JSON.stringify(was.wear)) send(wearMsg(n.wear, false));
    }
  };
}

/* a dog's face, drawn once (the kit's still.mjs): for lists, tiles and the reveal's who-picked-what */
function face(look, cls = '') {
  const el = document.createElement('span');
  el.className = 'pd-face' + (cls ? ' ' + cls : '');
  el.append(still(lookDog(lookOf(look))));
  return el;
}
/* the setup as icons and numbers, the sentence for a screen reader */
function bits(s) {
  const el = document.createElement('span');
  el.className = 'pd-bits';
  el.innerHTML = `<span aria-hidden="true">${icon('q')}<b></b>${icon('timer')}<b></b></span><span class="pd-vh"></span>`;
  const [r, t] = el.querySelectorAll('b');
  r.textContent = s?.rounds ?? '?'; t.textContent = `${s?.secs ?? '?'}s`;
  el.querySelector('.pd-vh').textContent = setupLine(s);
  return el;
}
/* a list kept by key: a row whose key is unchanged is the same node (its face is not drawn again each poll) */
function keyed(list, items, keyOf, make) {
  const old = new Map([...list.children].map(n => [n.dataset.key, n]));
  const next = items.map(it => { const k = keyOf(it), n = old.get(k) || make(it); n.dataset.key = k; return n; });
  if (next.length !== list.children.length || next.some((n, i) => n !== list.children[i])) list.replaceChildren(...next);
}

export function mountDuel(root, { transport = null, pack = { questions: [] }, look: hostLook = null, storage = globalThis.localStorage, storeKey = 'pup-duel', practice = true, title = 'Duel', keys = 'document', onClose = () => {}, onResult = () => {} } = {}) {
  const storeAt = `${storeKey}:${transport?.name || 'none'}`;
  const remembered = () => { try { return JSON.parse(storage.getItem(storeAt)) || null; } catch { return null; } };
  const remember = me => { try { if (me) storage.setItem(storeAt, JSON.stringify(me)); else storage.removeItem(storeAt); } catch { /* private mode */ } };
  const S = { screen: '', me: null, lobby: null, lv: null, session: null, world: null, worldMe: null, t: transport, err: '', busy: false, raf: 0, dogs: {}, hero: null, match: null, sheet: null, crossT: 0, rejoin: false, wallet: null };
  root.classList.add('pd');
  root.innerHTML = '<div class="pd-shell"></div><div class="pd-live" aria-live="polite"></div>';
  const shell = root.querySelector('.pd-shell'), liveEl = root.querySelector('.pd-live');
  const say = text => { liveEl.textContent = ''; setTimeout(() => { liveEl.textContent = text; }, 30); };
  const topics = topicsOf(pack);
  const top = (left, right = '<span></span>') => `<header class="pd-top">${left}<h1 class="pd-h1"><span>${esc(title)}</span>${BETA}</h1>${right}</header>`;

  /* ---- sign in: a name and a PIN, or a new player picking a dog ---- */
  function showAuth(step = 'name', draft = {}) {
    stopAll(); S.screen = 'auth';
    const dog = draft.dog || DEFAULT_DOG;
    shell.innerHTML = `${top(step === 'name' ? ib('close', 'x', 'Close the duel') : ib('back', 'back', 'Back'))}
      <main class="pd-main pd-auth">
        <div class="pd-stage"></div>
        ${step === 'name' ? `${transport ? `
        <form class="pd-form" data-pd="signin" novalidate>
          <label class="pd-field"><span>Name</span><input name="name" autocomplete="username" autocapitalize="words" maxlength="20" required value="${esc(draft.name || '')}"></label>
          <p class="pd-err" role="alert" data-for="name">${draft.bad === 'name' ? esc(S.err) : ''}</p>
          <label class="pd-field"><span>PIN</span><input name="pin" type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="current-password" maxlength="4" required value="${esc(draft.pin || '')}"></label>
          <p class="pd-err" role="alert" data-for="pin">${draft.bad === 'name' ? '' : esc(S.err)}</p>
          <button class="pd-btn pd-pri" type="submit" data-act="login">Play</button>
          <button class="pd-link" type="button" data-pd="new">New player</button>
        </form>` : '<p class="pd-note">Duels with mates are off on this site</p>'}
        ${practice ? `<button class="pd-btn${transport ? ' pd-ghost' : ' pd-pri'}" type="button" data-pd="practice">${icon('bot')}Practice</button>` : ''}` : `
        <form class="pd-form" data-pd="create">
          <p class="pd-pickname" aria-live="polite"></p>
          <div class="pd-dogs" role="radiogroup" aria-label="Your dog"></div>
          <p class="pd-err" role="alert">${esc(S.err)}</p>
          <button class="pd-btn pd-pri" type="submit">Play as ${esc(normName(draft.name))}</button>
        </form>`}
      </main>`;
    const preview = dogFrame({ dog }, { label: 'Your dog' });
    shell.querySelector('.pd-stage').append(preview.el);
    const form = shell.querySelector('form');
    if (step === 'create') {
      const grid = shell.querySelector('.pd-dogs'), named = shell.querySelector('.pd-pickname');
      const nameIt = id => { const d = breedOf(id); named.textContent = `${d.name} · ${d.breedName}`; };
      grid.append(...DOGS.map(d => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'pd-dogpick'; b.dataset.dog = d.id; b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', String(d.id === dog)); b.setAttribute('aria-label', `${d.name}, ${d.breedName}`); b.title = d.hint;
        b.append(face({ dog: d.id }));
        b.addEventListener('click', () => {
          grid.querySelectorAll('.pd-dogpick').forEach(x => x.setAttribute('aria-checked', String(x === b)));
          preview.dress({ dog: d.id }); preview.tap(); nameIt(d.id);
        });
        return b;
      }));
      nameIt(dog);
    }
    form?.addEventListener('submit', async e => {
      e.preventDefault();
      if (S.busy) return;
      if (step === 'name') {
        const name = form.name.value, pin = form.pin.value;
        S.err = nameError(name) || pinError(pin);
        if (S.err) return showAuth('name', { name, pin, bad: nameError(name) ? 'name' : 'pin' });
        await busy(async () => { const me = await transport.login(name, pin); signedIn(me); }, () => showAuth('name', { name, pin }));
      } else {
        const pick = form.querySelector('[aria-checked="true"]')?.dataset.dog || DEFAULT_DOG;
        await busy(async () => { const me = await transport.register(draft.name, draft.pin, { dog: pick, wear: {} }); signedIn(me); }, () => showAuth('create', { ...draft, dog: pick }));
      }
    });
    shell.querySelector('[data-pd="new"]')?.addEventListener('click', () => {
      const name = form.name.value, pin = form.pin.value, bad = nameError(name) || pinError(pin);
      S.err = bad;
      showAuth(bad ? 'name' : 'create', { name, pin, dog: DEFAULT_DOG, bad: nameError(name) ? 'name' : 'pin' });
    });
    shell.querySelector('[data-pd="back"]')?.addEventListener('click', () => { S.err = ''; showAuth('name', draft); });
    wireCommon();
    /* an error is about one field: it says so to a screen reader, and the cursor goes there */
    const bad = S.err && draft.bad && shell.querySelector(`input[name="${draft.bad}"]`);
    if (bad) { bad.setAttribute('aria-invalid', 'true'); bad.setAttribute('aria-describedby', 'pd-autherr'); shell.querySelector(`.pd-err[data-for="${draft.bad}"]`)?.setAttribute('id', 'pd-autherr'); }
    S.err = '';
    (bad || [...shell.querySelectorAll('input')].find(i => !i.value) || shell.querySelector('.pd-dogpick[aria-checked="true"], input'))?.focus({ preventScroll: true });
  }
  async function busy(fn, onErr) {
    S.busy = true; root.dataset.busy = '';
    try { await fn(); } catch (e) { S.err = e.message || 'Something went wrong'; onErr?.(); } finally { S.busy = false; delete root.dataset.busy; }
  }
  function signedIn(me) { S.me = me; S.t = transport; S.world = null; remember(me); S.err = ''; showLobby(); }

  /* ---- the lobby: you, the duels that wait on you, your mates (and Rex, the practice bot), what happened ---- */
  function myLook() {
    const base = lookOf(S.lv?.self?.look || S.me?.look);
    if (hostLook) { const h = hostLook(); if (h) return lookOf(h); }
    return base;   /* the server keeps a look with owned pieces only (0002_pup_store.sql) */
  }
  /* the wallet: { ok: true, bones, owned: Set, loadouts } once the server answers; { ok: false } on a server without
     the store yet (0002 not run: its functions are not there), which leaves the duel as it was */
  const asWallet = w => ({ ok: true, bones: w.bones, earned: w.earned, owned: new Set(w.owned || []), loadouts: w.loadouts || [] });
  async function loadWallet() {
    if (hostLook || !S.t?.wallet || !S.me) { S.wallet = { ok: false }; return S.wallet; }
    const was = S.wallet;
    try { S.wallet = asWallet(await S.t.wallet(S.me)); } catch (e) { S.wallet = was?.ok && !e.server ? was : { ok: false, why: e.message }; }
    paintWallet(was);
    S.onWallet?.();
    return S.wallet;
  }
  /* the bone count in the lobby's header, a tap from the store; it pops when a duel has paid */
  function paintWallet(was) {
    const b = S.screen === 'lobby' && shell.querySelector('[data-pd="store"]');
    if (!b) return;
    const w = S.wallet;
    b.querySelector('.pd-wbal').innerHTML = w?.ok ? bones(w.bones) : '';
    b.setAttribute('aria-label', w?.ok ? `Store, ${w.bones} bones` : 'Store');
    if (w?.ok && was?.ok && w.bones > was.bones) { b.classList.remove('pd-pop'); void b.offsetWidth; b.classList.add('pd-pop'); say(`${w.bones - was.bones} bones earned`); }
  }
  /* what the store screen needs from the duel: the wallet, the look, and the calls that change them */
  function storeCtx(back = null) {
    const ctx = {
      sheet, dogFrame, back,
      wallet: () => S.wallet,
      look: () => myLook(),
      async buy(id, price, day) { S.wallet = asWallet(await S.t.buy(S.me, id, price, day)); await wearLook({ ...myLook(), wear: { ...myLook().wear, [itemOf(id).slot]: id } }); },
      async buySet(id, price) {
        S.wallet = asWallet(await S.t.buySet(S.me, id, price));
        const wear = { ...myLook().wear }; for (const i of SETS.find(x => x.id === id).items) wear[itemOf(i).slot] = i;
        await wearLook({ ...myLook(), wear });
      },
      wear: look => wearLook(look)
    };
    S.onWallet = () => ctx.onWallet?.();
    return ctx;
  }
  async function wearLook(look) {
    const p = await (S.lobby ? S.lobby.look(lookOf(look)) : S.t.touch(S.me, lookOf(look)));
    S.me = { ...S.me, look: p.look }; remember(S.me);
    if (S.lv?.self) S.lv = { ...S.lv, self: { ...S.lv.self, look: p.look } };
    paintLobby();
    return p;
  }
  async function openShop(opts = {}, back = null) {
    if (hostLook) return;
    if (!S.wallet) loadWallet();
    openStore(storeCtx(back), opts);
  }
  function showLobby() {
    stopAll(); S.screen = 'lobby';
    shell.innerHTML = `${top(ib('close', 'x', 'Close the duel'), ib('menu', 'more', 'Menu'))}
      <main class="pd-main pd-lobby">
        <section class="pd-me" aria-label="You">
          ${hostLook ? '<div class="pd-me-dog"></div>' : `<button class="pd-me-dog" type="button" data-pd="dress" aria-label="Dress your dog"><span class="pd-badge">${icon('shirt')}</span></button>`}
          <div class="pd-me-txt"><h2 class="pd-name"></h2><p class="pd-rec"></p>${hostLook ? '' : `<button class="pd-wallet" type="button" data-pd="store" aria-label="Store">${icon('bag')}<span class="pd-wbal"></span></button>`}</div>
        </section>
        <section class="pd-sec" data-sec="invites" hidden><h2 class="pd-h2">Invites</h2><div class="pd-list"></div></section>
        <section class="pd-sec" data-sec="mine" hidden><h2 class="pd-h2">Duels</h2><div class="pd-list"></div></section>
        <section class="pd-sec" data-sec="mates"><h2 class="pd-h2">Mates</h2><div class="pd-grid"></div></section>
        <section class="pd-sec" data-sec="past" hidden><h2 class="pd-h2">Recent</h2><div class="pd-list"></div></section>
        <p class="pd-err" role="alert"></p>
      </main>`;
    wireCommon();
    shell.querySelector('[data-pd="menu"]').addEventListener('click', openMenu);
    shell.querySelector('[data-pd="dress"]')?.addEventListener('click', () => openDress());
    shell.querySelector('[data-pd="store"]')?.addEventListener('click', () => openShop());
    if (!S.t) return;
    S.lobby = createLobby({ transport: S.t, me: S.me, onChange: lv => { S.lv = lv; paintLobby(); } });
    S.lobby.start();
    paintLobby();
    paintWallet(); loadWallet();
  }
  function paintLobby() {
    if (S.screen !== 'lobby') return;
    const lv = S.lv || { mates: [], invites: [], waiting: [], live: [], past: [], self: null, loaded: false };
    const self = lv.self || S.me, look = myLook();
    shell.querySelector('.pd-name').textContent = self?.name || '';
    shell.querySelector('.pd-rec').textContent = self ? `${self.wins || 0} won · ${self.losses || 0} lost${self.draws ? ` · ${self.draws} drawn` : ''}` : '';
    const holder = shell.querySelector('.pd-me-dog');
    if (!S.hero || !holder.contains(S.hero.el)) { S.hero = dogFrame(look, { label: dogName(look.dog) }); holder.prepend(S.hero.el); }
    else S.hero.dress(look);
    const sec = (name, show) => { const s = shell.querySelector(`[data-sec="${name}"]`); s.hidden = !show; return s.querySelector('.pd-list, .pd-grid'); };
    keyed(sec('invites', lv.invites.length > 0), lv.invites, d => `${d.id}|${JSON.stringify(d.them?.look)}|${d.them?.name}`, inviteRow);
    const mine = [...lv.live, ...lv.waiting];
    keyed(sec('mine', mine.length > 0), mine, d => `${d.id}|${d.status}|${JSON.stringify(d.them?.look)}`, duelRow);
    const tiles = [...lv.mates.map(p => ({ p })), ...(practice ? [{ bot: true }] : []), ...(lv.loaded ? [{ invite: true }] : [])];
    keyed(sec('mates', true), tiles, t => (t.p ? `m|${t.p.id}|${t.p.name}|${!!t.p.online}|${JSON.stringify(t.p.look)}` : t.bot ? 'bot' : 'invite'), mateTile);
    keyed(sec('past', lv.past.length > 0), lv.past, d => `${d.id}|${d.status}|${JSON.stringify(d.them?.look)}`, pastRow);
    /* back from a reload (or a phone that slept) in the middle of a duel: straight back into it, once */
    if (S.rejoin && lv.loaded) { S.rejoin = false; if (lv.live.length === 1) { openDuel(lv.live[0]); return; } }
    shell.querySelector('.pd-lobby > .pd-err').textContent = lv.error ? `Can't reach the server. Retrying.` : '';
  }
  function row(cls, look) {
    const r = document.createElement('div');
    r.className = `pd-row ${cls}`;
    r.append(face(look), Object.assign(document.createElement('span'), { className: 'pd-rtx' }));
    r.lastChild.innerHTML = '<b></b>';
    return r;
  }
  function inviteRow(d) {
    const r = row('pd-duelrow', d.them?.look);
    r.querySelector('b').textContent = d.them?.name || 'A mate';
    r.querySelector('.pd-rtx').append(bits(d.setup));
    const acts = document.createElement('span'); acts.className = 'pd-acts';
    acts.innerHTML = `<button class="pd-btn pd-sm pd-pri" type="button">${icon('zap')}Duel</button>${ib('decline', 'x', 'Decline')}`;
    acts.querySelector('.pd-pri').setAttribute('aria-label', `Accept ${d.them?.name || 'the'} challenge`);
    acts.querySelector('.pd-pri').addEventListener('click', () => openDuel(d, { accept: true }));
    acts.querySelector('[data-pd="decline"]').addEventListener('click', () => declineDuel(d));
    r.append(acts);
    return r;
  }
  function duelRow(d) {
    const live = d.status === 'live', r = row('pd-duelrow pd-tap', d.them?.look), b = document.createElement('button');
    r.querySelector('b').textContent = d.them?.name || 'Your mate';
    const st = document.createElement('small'); st.className = live ? 'pd-on' : ''; st.textContent = live ? 'Live' : 'Waiting';
    r.querySelector('.pd-rtx').append(st);
    b.type = 'button'; b.className = 'pd-cover'; b.setAttribute('aria-label', `${live ? 'Play' : 'Open'} the duel with ${d.them?.name || 'your mate'}`);
    b.addEventListener('click', () => openDuel(d));
    r.append(b, Object.assign(document.createElement('span'), { className: 'pd-chev', innerHTML: icon('back', 'pd-flip') }));
    return r;
  }
  function mateTile(t) {
    const b = document.createElement('button');
    b.type = 'button';
    if (t.invite) {
      b.className = 'pd-tile pd-invite'; b.dataset.pd = 'invite';
      b.innerHTML = `<span class="pd-face pd-faceic">${icon('share')}</span><b>Invite</b>`;
      b.setAttribute('aria-label', 'Invite a mate: share this page');
      b.addEventListener('click', () => invite(b));
      return b;
    }
    if (t.bot) {
      b.className = 'pd-tile pd-bot'; b.dataset.pd = 'practice';
      b.append(face(BOT.look));
      b.insertAdjacentHTML('beforeend', `<b></b><span class="pd-tbadge">${icon('bot')}</span>`);
      b.querySelector('b').textContent = BOT.name;
      b.setAttribute('aria-label', `Practice with ${BOT.name}, a bot on this device`);
      b.addEventListener('click', startPractice);
      return b;
    }
    const p = t.p;
    b.className = 'pd-tile pd-mate';
    b.append(face(p.look));
    b.insertAdjacentHTML('beforeend', '<b></b>');
    b.querySelector('b').textContent = p.name;
    b.insertAdjacentHTML('beforeend', `<span class="pd-tbadge" aria-hidden="true">${icon('zap')}</span>`);
    b.classList.toggle('pd-online', !!p.online);
    b.setAttribute('aria-label', `Challenge ${p.name}${p.online ? ', online' : ''}, ${p.wins || 0} won, ${p.losses || 0} lost`);
    b.addEventListener('click', () => openSetup(p));
    return b;
  }
  function pastRow(d) {
    const res = d.result || {}, mine = res.score?.[S.me.id], theirs = res.score?.[d.them?.id];
    const out = d.status === 'done' ? (res.winner === null ? 'draw' : res.winner === S.me.id ? 'win' : 'loss') : d.status;
    const r = row('pd-past', d.them?.look);
    r.querySelector('b').textContent = d.them?.name || 'A mate';
    if (mine !== undefined) { const s = document.createElement('small'); s.className = 'pd-num'; s.textContent = `${fmt(mine)}–${fmt(theirs ?? 0)}`; r.querySelector('.pd-rtx').append(s); }
    const pill = document.createElement('span');
    pill.className = 'pd-pill'; pill.dataset.out = out;
    pill.textContent = { win: 'Won', loss: 'Lost', draw: 'Draw', declined: 'Declined', cancelled: 'Called off' }[out] || '';
    r.append(pill);
    return r;
  }
  async function invite(b) {
    const url = location.href.split('#')[0], label = b.querySelector('b');
    try {
      if (navigator.share) { await navigator.share({ title, url }); return; }
      await navigator.clipboard.writeText(url);
      label.textContent = 'Copied'; say('Link copied'); setTimeout(() => { label.textContent = 'Invite'; }, 1800);
    } catch { /* cancelled, or no clipboard: nothing to say */ }
  }
  async function declineDuel(d) {
    const s = createSession({ transport: S.t, me: S.me, duel: d });
    s.start(); s.decline(); setTimeout(() => s.stop(), 4000);
    S.lobby?.nudge(d.a, { type: 'declined', duel: d.id });
    setTimeout(() => S.lobby?.refresh(), 600);
  }

  /* ---- sheets: the menu, the challenge, the dressing room, the review, leaving ---- */
  function sheet(html, wire, { full = false, label = '' } = {}) {
    closeSheet();
    const el = document.createElement('div');
    el.className = 'pd-sheet-wrap';
    el.innerHTML = `<div class="pd-scrim" data-pd="shut"></div><div class="pd-sheet${full ? ' pd-full' : ''}" role="dialog" aria-modal="true"${label ? ` aria-label="${esc(label)}"` : ''}>${html}</div>`;
    S.sheetFrom = document.activeElement; root.append(el); S.sheet = el;
    el.querySelectorAll('[data-pd="shut"]').forEach(b => b.addEventListener('click', closeSheet));
    wire(el.querySelector('.pd-sheet'));
    el.querySelector('.pd-sheet button:not([data-pd="shut"]), .pd-sheet select')?.focus({ preventScroll: true });
  }
  function closeSheet() {
    const from = S.sheetFrom; S.sheet?.remove(); S.sheet = null; S.sheetFrom = null;
    if (from?.isConnected) from.focus({ preventScroll: true });   // back on what opened it
  }
  function openMenu() {
    sheet(`<button class="pd-btn" type="button" data-pd="signout">Sign out</button>`, el => {
      el.querySelector('[data-pd="signout"]').addEventListener('click', () => { remember(null); S.me = null; S.hero = null; S.wallet = null; showAuth(); });
    }, { label: 'Menu' });
  }
  function openSetup(mate, last = null) {
    const opt = last || { rounds: RULES.rounds, secs: RULES.secs, topic: '' };
    const seg = (name, ic, label, vals, cur, f) => `<div class="pd-segrow"><span class="pd-segic" aria-hidden="true">${icon(ic)}</span><div class="pd-seg" role="radiogroup" aria-label="${label}">${vals.map(v => `<button type="button" role="radio" data-${name}="${v}" aria-checked="${v === cur}">${f(v)}</button>`).join('')}</div></div>`;
    sheet(`
      <div class="pd-vsmini" aria-hidden="true"></div>
      <h2 class="pd-sheet-title"></h2>
      ${seg('rounds', 'q', 'Questions', RULES.roundChoices, opt.rounds, v => v)}
      ${seg('secs', 'timer', 'Seconds each', RULES.secsChoices, opt.secs, v => `${v}s`)}
      ${topics.length > 1 ? `<label class="pd-segrow"><span class="pd-segic" aria-hidden="true">${icon('tag')}</span><select name="topic" aria-label="Topic"><option value="">Every topic</option>${topics.map(t => `<option value="${esc(t.topic)}"${t.topic === opt.topic ? ' selected' : ''}>${esc(t.topic)}</option>`).join('')}</select><span class="pd-chevsel" aria-hidden="true">${icon('chev')}</span></label>` : ''}
      <p class="pd-err" role="alert"></p>
      <button class="pd-btn pd-pri" type="button" data-pd="send">${icon('zap')}Duel</button>`, el => {
      el.querySelector('.pd-vsmini').append(face(myLook()), face(mate.look, 'pd-mirror'));
      el.querySelector('.pd-sheet-title').textContent = mate.name;
      el.querySelectorAll('.pd-seg').forEach(g => g.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; g.querySelectorAll('button').forEach(x => x.setAttribute('aria-checked', String(x === b))); }));
      el.querySelector('[data-pd="send"]').addEventListener('click', async () => {
        const rounds = +el.querySelector('[data-rounds][aria-checked="true"]').dataset.rounds, secs = +el.querySelector('[data-secs][aria-checked="true"]').dataset.secs;
        const topic = el.querySelector('select')?.value || '';
        const setup = makeSetup(pack, { rounds, secs, topic, seed: freshSeed(), title: pack.title });
        if (!setup.questions.length) { el.querySelector('.pd-err').textContent = 'No questions to play.'; return; }
        await busy(async () => {
          const d = await challengeMate(mate.id, setup);
          closeSheet(); openDuel({ ...d, them: mate }, { accept: d.b === S.me.id });
        }, () => { el.querySelector('.pd-err').textContent = S.err; });
      });
    }, { label: `Challenge ${mate.name}` });
  }

  /* the locker (the dressing room): a live preview of the dog, and one tab each for the dog, its coat, its collar and
     the four slots, each slot with the pieces you own and a way to the store; and three saved loadouts. The line
     under the preview names what was just chosen. `draft` is a look in progress (back from the store) */
  const TABS = [['dog', 'paw', 'Dog'], ['coat', 'palette', 'Coat'], ['collar', 'collar', 'Collar'], ['head', 'hat', SLOT_NAME.head], ['face', 'glasses', SLOT_NAME.face], ['neck', 'bow', SLOT_NAME.neck], ['back', 'pack', SLOT_NAME.back]];
  function openDress(draft = null, startTab = 'dog') {
    if (hostLook) return;
    if (!S.wallet) loadWallet();
    const owned = () => (S.wallet?.ok ? S.wallet.owned : new Set()), cur = structuredClone(draft || fitOwned(myLook(), owned()));
    sheet(`
      <header class="pd-top pd-dresstop">${ib('shut', 'back', 'Cancel')}<h2 class="pd-h1"><span>Locker</span></h2>${ib('loadouts', 'layers', 'Loadouts')}</header>
      <div class="pd-preview"></div>
      <p class="pd-chosen" aria-live="polite"></p>
      <div class="pd-tabs" role="tablist" aria-label="Dress up">${TABS.map(([id, ic, name], i) => `<button type="button" role="tab" data-tab="${id}" aria-selected="${i === 0}" aria-controls="pd-panel" aria-label="${esc(name)}" title="${esc(name)}">${icon(ic)}</button>`).join('')}</div>
      <div class="pd-panel" id="pd-panel" role="tabpanel"></div>
      <div class="pd-dressbar"><button class="pd-btn pd-pri" type="button" data-pd="save">${icon('check')}Save</button></div>`, el => {
      const prev = dogFrame(cur, { label: 'Your dog' }), panel = el.querySelector('.pd-panel'), chosen = el.querySelector('.pd-chosen');
      el.querySelector('.pd-preview').append(prev.el);
      let tab = 'dog';
      /* "<tab> · <its pick>": it names the icon tab and what is on the dog for it */
      const pickName = id => {
        const d = breedOf(cur.dog);
        if (id === 'dog') return `${d.name} (${d.breedShort})`;
        if (id === 'coat') { const own = cur.coat ? null : coatsFor(cur.dog).find(k => k.from === cur.dog); return (own || coatsFor(cur.dog).find(k => k.id === cur.coat) || {}).name || ''; }
        if (id === 'collar') { const k = COLLARS.find(c => c.id === cur.collar) || COLLARS.find(c => c.hex === lookDog({ dog: cur.dog }).pal.collar); return k ? k.name : 'Its own'; }
        return cur.wear[id] ? itemOf(cur.wear[id]).name : 'None';
      };
      const label = () => { const t = TABS.find(x => x[0] === tab); chosen.textContent = t ? `${t[2]} · ${pickName(tab)}` : 'Loadouts'; };
      const coatTab = () => { el.querySelector('[data-tab="coat"]').hidden = coatsFor(cur.dog).length < 2; };   // a breed of one coat has nothing to choose
      const update = () => { prev.dress(cur); label(); };
      const radio = (b, on) => b.setAttribute('aria-checked', String(on));
      const tabs = {
        dog() {
          const g = document.createElement('div'); g.className = 'pd-dogs'; g.setAttribute('role', 'radiogroup'); g.setAttribute('aria-label', 'Dog');
          g.append(...DOGS.map(d => {
            const b = document.createElement('button');
            b.type = 'button'; b.className = 'pd-dogpick'; b.dataset.dog = d.id; b.setAttribute('role', 'radio'); radio(b, d.id === cur.dog);
            b.setAttribute('aria-label', `${d.name}, ${d.breedName}`); b.title = d.hint;
            b.append(face({ dog: d.id, collar: cur.collar }));
            b.addEventListener('click', () => {
              /* a coat carries over where the new breed has one of that name (black and tan, cream), else its own */
              if (cur.coat && !coatsFor(d.id).some(k => k.id === cur.coat && k.from !== d.id)) delete cur.coat;
              cur.dog = d.id; g.querySelectorAll('.pd-dogpick').forEach(x => radio(x, x === b));
              update(); coatTab(); prev.tap();
            });
            return b;
          }));
          return g;
        },
        coat() {   /* the breed's coats; the dog's own is the empty id, the look's default */
          return swatches('Coat', coatsFor(cur.dog).map(k => ({ id: k.from === cur.dog ? '' : k.id, name: k.name, colors: k.swatch })), cur.coat || '', v => { if (v) cur.coat = v; else delete cur.coat; });
        },
        collar() {   /* the dog's own colour first, then every other */
          const own = lookDog({ dog: cur.dog }).pal.collar;
          if (COLLARS.find(k => k.id === cur.collar)?.hex === own) delete cur.collar;
          return swatches('Collar', [{ id: '', name: 'Its own', colors: [own] }, ...COLLARS.filter(k => k.hex !== own).map(k => ({ id: k.id, name: k.name, colors: [k.hex] }))], cur.collar || '', v => { if (v) cur.collar = v; else delete cur.collar; });
        }
      };
      function swatches(label, opts, now, set) {
        const g = document.createElement('div'); g.className = 'pd-swatches'; g.setAttribute('role', 'radiogroup'); g.setAttribute('aria-label', label);
        g.append(...opts.map(o => {
          const b = document.createElement('button');
          b.type = 'button'; b.className = 'pd-swatch'; b.dataset.v = o.id; b.setAttribute('role', 'radio'); radio(b, o.id === now);
          b.setAttribute('aria-label', o.name); b.title = o.name;
          b.innerHTML = `<i style="--a:${o.colors[0]};--b:${o.colors[1] || o.colors[0]}"></i>`;
          b.addEventListener('click', () => { set(o.id); g.querySelectorAll('.pd-swatch').forEach(x => radio(x, x === b)); update(); });
          return b;
        }));
        return g;
      }
      function pieces(slot) {
        const g = document.createElement('div'); g.className = 'pd-pieces';
        /* the pieces you own for the slot, then the store's door for more */
        const list = ITEMS.filter(i => i.slot === slot && !i.exclusive && owned().has(i.id)).sort((a, b) => a.price - b.price || a.name.localeCompare(b.name));
        const none = document.createElement('button');
        none.type = 'button'; none.className = 'pd-piece pd-none'; none.dataset.slot = slot; none.dataset.id = '';
        none.setAttribute('aria-label', `No ${SLOT_NAME[slot].toLowerCase()}`); none.innerHTML = icon('x');
        g.append(none, ...list.map(it => {
          const b = document.createElement('button');
          b.type = 'button'; b.className = 'pd-piece'; b.dataset.id = it.id; b.dataset.slot = slot; b.dataset.r = it.rarity;
          b.setAttribute('aria-label', it.name); b.title = it.name;
          b.innerHTML = `<svg viewBox="${it.tile || it.vb || VB[slot]}" aria-hidden="true">${it.icon || it.svg}</svg>`;
          return b;
        }));
        if (S.t?.wallet) g.append(storeTile(slot, sl => openShop({ slot: sl }, () => openDress(cur, sl))));
        const mark = () => g.querySelectorAll('.pd-piece').forEach(x => x.setAttribute('aria-pressed', String((cur.wear[slot] || '') === x.dataset.id)));
        g.addEventListener('click', e => {
          const b = e.target.closest('.pd-piece'); if (!b || b.disabled || b.dataset.pd === 'toshop') return;
          if (b.dataset.id) cur.wear[slot] = b.dataset.id; else delete cur.wear[slot];
          mark(); update();
        });
        mark();
        const wrap = document.createElement('div'); wrap.append(g);
        return wrap;
      }
      /* the loadouts: Save keeps the look on the dog in one of three; Wear puts one on (the room's Save keeps it) */
      tabs.loadouts = () => loadoutsPanel({
        wallet: S.wallet, face, cur: () => lookOf(cur),
        onWear(look, name) {
          const l = lookOf(fitOwned(look, owned()));
          for (const k of ['dog', 'coat', 'collar', 'wear']) { if (l[k] === undefined) delete cur[k]; else cur[k] = structuredClone(l[k]); }
          update(); coatTab(); prev.tap(); chosen.textContent = `Loadouts · ${name}`;
        },
        async onSave(slot, name, look) {
          await busy(async () => { S.wallet = asWallet(await S.t.loadout(S.me, slot, name, look)); show('loadouts'); chosen.textContent = `Loadouts · saved as ${S.wallet.loadouts.find(l => l.slot === slot)?.name || name}`; }, () => { chosen.textContent = S.err; });
        }
      });
      const show = id => {
        tab = id;
        if (id === 'loadouts') chosen.textContent = 'Loadouts'; else label();
        el.querySelectorAll('[role="tab"]').forEach(t => t.setAttribute('aria-selected', String(t.dataset.tab === id)));
        el.querySelector('[data-pd="loadouts"]').setAttribute('aria-pressed', String(id === 'loadouts'));
        panel.replaceChildren(tabs[id] ? tabs[id]() : pieces(id));
        /* the one chosen in view (Heidi is far down the dogs), moving only the panel */
        panel.scrollTop = 0;
        const on = panel.querySelector('[aria-checked="true"], [aria-pressed="true"]'), pr = panel.getBoundingClientRect(), r = on?.getBoundingClientRect();
        if (r && r.bottom > pr.bottom) panel.scrollTop = r.bottom - pr.bottom + 16;
        panel.setAttribute('aria-label', TABS.find(t => t[0] === id)?.[2] || 'Loadouts');
      };
      el.querySelector('.pd-tabs').addEventListener('click', e => { const t = e.target.closest('[role="tab"]'); if (t) show(t.dataset.tab); });
      el.querySelector('[data-pd="loadouts"]').addEventListener('click', () => show(tab === 'loadouts' ? 'dog' : 'loadouts'));
      show(startTab); coatTab();
      /* the wallet arrives after the room opens (or changes): the slot's pieces are drawn again */
      S.onWallet = () => { if (el.isConnected && tab !== 'dog' && tab !== 'coat' && tab !== 'collar') show(tab); };
      el.querySelector('[data-pd="save"]').addEventListener('click', async () => {
        const look = lookOf(cur);
        await busy(async () => { await wearLook(look); closeSheet(); }, () => { chosen.textContent = S.err; });
      });
    }, { full: true, label: 'Locker' });
  }
  function openReview(st, me, opp) {
    const ai = st.setup.questions.some(q => q.origin === 'ai');
    sheet(`<div class="pd-sheet-head"><span></span><h2 class="pd-sheet-title">Review</h2>${ai ? '<span class="pd-qtag">AI-written</span>' : ''}${ib('shut', 'x', 'Close')}</div><ol class="pd-review"></ol>`, el => {
      el.querySelector('.pd-review').append(...st.setup.questions.map((q, i) => {
        const R = st.rounds[i], a = R?.answers[me], b = R?.answers[opp], li = document.createElement('li');
        li.className = 'pd-rv'; li.dataset.ok = a?.ok ? '1' : '0';
        li.innerHTML = `<p class="pd-rv-q"></p><p class="pd-rv-a">${icon('check')}<span></span></p>`;
        li.querySelector('.pd-rv-q').textContent = q.stem;
        li.querySelector('.pd-rv-a span').textContent = q.options[q.answer];
        if (a && a.choice !== null && a.choice !== undefined && !a.ok) {
          li.insertAdjacentHTML('beforeend', `<p class="pd-rv-no">${icon('x')}<span></span></p>`);
          li.lastChild.querySelector('span').textContent = q.options[a.choice];
          if (q.notes?.[a.choice]) { const n = document.createElement('p'); n.className = 'pd-rv-why'; n.textContent = q.notes[a.choice]; li.append(n); }
        }
        if (q.why) { const w = document.createElement('p'); w.className = 'pd-rv-why'; w.textContent = q.why; li.append(w); }
        const who = document.createElement('p'); who.className = 'pd-rv-who';
        for (const [look, ans, name] of [[myLook(), a, 'You'], [S.match?.them?.look, b, S.match?.them?.name || 'Them']]) {
          const w = document.createElement('span');
          w.append(face(look, 'pd-rv-face'));
          w.insertAdjacentHTML('beforeend', `<span class="${ans?.ok ? 'pd-yes' : 'pd-nay'}">${icon(ans?.ok ? 'check' : 'x')}</span><span class="pd-vh"></span>`);
          w.lastChild.textContent = `${name} ${ans?.ok ? 'right' : 'wrong'}`;
          who.append(w);
        }
        li.append(who);
        return li;
      }));
    }, { label: 'Review' });
  }

  /* ---- practice ---- */
  async function startPractice() {
    stopAll();
    await busy(async () => {
      const look = myLook();
      const w = await practiceWorld({ name: S.me?.name || 'You', look });
      S.world = w; S.t = w.transport; S.worldMe = w.me;
      const setup = makeSetup(pack, { rounds: RULES.rounds, secs: RULES.secs, seed: freshSeed(), title: pack.title });
      if (!setup.questions.length) throw new Error('No questions to play.');
      const d = await w.transport.challenge(w.me, w.bot.id, setup);
      openDuel({ ...d, them: { ...w.bot, look: BOT.look } }, { practice: true });
    }, () => { S.screen === 'lobby' ? paintLobby() : showAuth(); });
  }

  /* ---- the match ---- */
  function openDuel(d, { practice: isPractice = !!S.world, accept = false } = {}) {
    stopAll(true);
    S.screen = 'match';
    const me = isPractice ? S.worldMe : S.me, t = isPractice ? S.world.transport : S.t;
    const mine = d.a === me.id, them = d.them || (S.lv?.mates || []).find(p => p.id === (mine ? d.b : d.a)) || { name: 'Your mate', look: { dog: 'rosie', wear: {} } };
    const myL = myLook(), theirL = lookOf(them.look || { dog: 'rosie' });
    const side = who => `<div class="pd-side pd-${who}"><div class="pd-dogslot">${who === 'theirs' ? '<span class="pd-say" hidden></span>' : ''}</div>
      <div class="pd-meta"><b class="pd-pname"></b><span class="pd-scorerow"><span class="pd-score">0</span><i class="pd-gain"></i></span><i class="pd-status"></i></div></div>`;
    shell.innerHTML = `
      <header class="pd-top pd-mtop">${ib('leave', 'x', 'Leave the duel')}<div class="pd-dots" aria-hidden="true"></div><span class="pd-qtag" hidden></span></header>
      <main class="pd-main pd-match">
        <section class="pd-versus">${side('mine')}${side('theirs')}</section>
        <div class="pd-timer" aria-hidden="true"><i></i></div>
        <article class="pd-q" aria-live="off">
          <p class="pd-stem"></p>
          <div class="pd-opts"></div>
          <div class="pd-why" hidden></div>
        </article>
        <div class="pd-hold" hidden><div class="pd-hold-in"><p class="pd-big"></p><p class="pd-hold-sub"></p><div class="pd-hold-acts"></div></div></div>
        <footer class="pd-emotes" aria-label="Emotes">${Object.keys(EMOTE_ICON).map(k => `<button type="button" class="pd-emote" data-e="${k}" aria-label="${esc(EMOTES[k])}" title="${esc(EMOTES[k])}">${icon(EMOTE_ICON[k])}</button>`).join('')}</footer>
        <p class="pd-net" hidden></p>
      </main>`;
    wireCommon();
    const theirName = them.name || 'Your mate';
    shell.querySelector('.pd-mine .pd-pname').textContent = 'You';
    shell.querySelector('.pd-theirs .pd-pname').textContent = theirName;
    const myDog = dogFrame(myL, { label: 'Your dog' }), theirDog = dogFrame(theirL, { mirror: true, label: `${theirName}'s dog` });
    shell.querySelector('.pd-mine .pd-dogslot').append(myDog.el);
    shell.querySelector('.pd-theirs .pd-dogslot').append(theirDog.el);
    S.dogs = { me: myDog, them: theirDog };
    /* the two faces that mark who picked what on a reveal: drawn once, moved to the option each picked */
    S.match = { d, me, them, t, practice: isPractice, last: {}, round: -1, revealed: -1, emoteN: 0, reported: false, faces: { me: face(myL, 'pd-pick'), them: face(theirL, 'pd-pick') } };
    S.match.faces.me.dataset.who = 'me'; S.match.faces.them.dataset.who = 'them';
    shell.querySelector('[data-pd="leave"]').addEventListener('click', confirmLeave);
    shell.querySelectorAll('.pd-emote').forEach(b => b.addEventListener('click', () => { if (S.session?.emote(b.dataset.e)) { b.classList.add('pd-sent'); setTimeout(() => b.classList.remove('pd-sent'), 600); S.dogs.me.expr(EXPR.emote); } }));
    S.session = createSession({ transport: t, me, duel: d, onChange: v => { S.view = v; paintMatch(); } });
    S.session.start();
    if (accept) S.session.accept();
    if (!isPractice && d.a === me.id && (d.status || 'invited') === 'invited') watchCrossed(d, me, them);
    tick();
  }
  /* crossed challenges (both tapped Rematch, or challenged each other at once): every phone settles on the same
     duel without asking anybody (lobby.mjs settleCrossed: the smallest open id, or one that just went live) */
  function watchCrossed(d, me, them) {
    clearInterval(S.crossT);
    S.crossT = setInterval(async () => {
      if (S.screen !== 'match' || S.match?.d.id !== d.id || S.view?.state.phase !== 'invited') { clearInterval(S.crossT); return; }
      try {
        const to = settleCrossed(me.id, them.id, d, await S.t.inbox(S.me));
        if (!to || S.match?.d.id !== d.id || S.view?.state.phase !== 'invited') return;
        clearInterval(S.crossT);
        S.session.leave();
        openDuel({ ...to.duel, them }, { accept: to.accept });
      } catch { /* the next tick */ }
    }, 2000);
  }
  function pick(i) {
    if (!S.session?.answer(i, S.match?.round)) return;
    S.dogs.me.expr(EXPR.wait);
    paintMatch();
  }
  function tick() {
    cancelAnimationFrame(S.raf);
    const step = () => {
      if (S.screen !== 'match' || !S.session) return;
      const v = S.session.view(); S.view = v;
      const bar = shell.querySelector('.pd-timer i'), s = v.stage, secs = v.state.setup.secs * 1000;
      if (bar) {
        const live = s.name === 'question' || s.name === 'locked';
        bar.parentElement.classList.toggle('pd-on', live);
        bar.style.transform = `scaleX(${live ? Math.max(0, s.left / secs).toFixed(4) : 0})`;
        bar.parentElement.classList.toggle('pd-low', live && s.left < 5000);
        /* the bar is hidden from a screen reader (a frame-by-frame value is noise); the low-time warning is said once */
        if (s.name === 'question' && s.left > 0 && s.left < 5000 && S._low !== s.round) { S._low = s.round; say('5 seconds left'); }
      }
      const h = shell.querySelector('.pd-big');
      if (s.name === 'ready' && h) h.textContent = String(Math.max(1, Math.ceil(s.left / 1000)));
      const up = s.name === 'question' && s.left <= 0;   /* time is up: the options lock until the blank answer lands */
      if (S._stage !== s.name || S._round !== s.round || S._up !== up) { S._stage = s.name; S._round = s.round; S._up = up; paintMatch(); }
      S.raf = requestAnimationFrame(step);
    };
    S.raf = requestAnimationFrame(step);
  }
  function setStatus(el, k) {
    if (el.dataset.k === k) return;
    el.dataset.k = k;
    el.innerHTML = k ? `${icon(STATUS[k][0])}<span class="pd-vh">${STATUS[k][1]}</span>` : '';
  }
  function paintMatch() {
    const v = S.view, M = S.match;
    if (S.screen !== 'match' || !v || !M) return;
    const st = v.state, s = v.stage, me = v.me, opp = v.opp, q = v.question, secs = st.setup.secs;
    /* the header: a dot per round, filled as they close */
    const dots = shell.querySelector('.pd-dots');
    if (dots.childElementCount !== st.rounds.length) dots.replaceChildren(...st.rounds.map(() => document.createElement('i')));
    st.rounds.forEach((R, i) => {
      const dot = dots.children[i], a = R.answers[me];
      dot.className = R.closed ? (a?.ok ? 'pd-ok' : 'pd-no') : i === st.round && st.phase === 'live' ? 'pd-now' : '';
    });
    /* scores move on the reveal, never before: a jump while they are still thinking would tell them you were right */
    const shown = p => st.rounds.reduce((t, R) => t + (R.closed ? R.answers[p]?.pts || 0 : 0), 0);
    for (const [sel, p] of [['.pd-mine .pd-score', me], ['.pd-theirs .pd-score', opp]]) {
      const el = shell.querySelector(sel), txt = fmt(shown(p));
      if (el.textContent !== txt) { el.textContent = txt; el.classList.remove('pd-bump'); void el.offsetWidth; if (txt !== '0') el.classList.add('pd-bump'); }
      const gain = el.nextElementSibling, R = s.name === 'reveal' && st.rounds[s.round], g = R?.closed && R.answers[p]?.ok ? `+${fmt(R.answers[p].pts)}` : '';
      if (gain.textContent !== g) gain.textContent = g;
    }
    /* their status: never what they picked until the round closes */
    const live = s.name === 'question' || s.name === 'locked', rv = s.name === 'reveal' ? st.rounds[s.round] : null;
    setStatus(shell.querySelector('.pd-theirs .pd-status'), live ? (v.theirs ? 'done' : 'think') : rv ? (rv.answers[opp]?.ok ? 'ok' : 'no') : '');
    setStatus(shell.querySelector('.pd-mine .pd-status'), s.name === 'locked' ? 'lock' : rv ? (rv.answers[me]?.ok ? 'ok' : 'no') : '');
    shell.querySelector('.pd-theirs').classList.toggle('pd-done', !!v.theirs && live);
    if (v.theirs && M.last.theirs !== `${s.round}`) { M.last.theirs = `${s.round}`; if (s.name === 'question') say(`${M.them.name || 'Your mate'} answered`); }
    /* an emote from them shows over their dog */
    const em = st.emotes.filter(e => e.by === opp);
    if (em.length > M.emoteN) {
      M.emoteN = em.length;
      const b = shell.querySelector('.pd-say'), e = em.at(-1).e;
      b.innerHTML = `${icon(EMOTE_ICON[e] || 'paw')}<span class="pd-vh"></span>`; b.lastChild.textContent = EMOTES[e] || '';
      b.hidden = false; S.dogs.them.expr(EXPR.emote); S.dogs.them.tap(); say(`${M.them.name || 'Your mate'}: ${EMOTES[e] || ''}`);
      clearTimeout(M.sayT); M.sayT = setTimeout(() => { b.hidden = true; }, 2600);
    }
    /* the question card */
    const card = shell.querySelector('.pd-q'), hold = shell.querySelector('.pd-hold');
    const showQ = q && (live || s.name === 'reveal');
    card.hidden = !showQ;
    if (showQ) {
      if (M.round !== s.round) {
        M.round = s.round;
        const tag = shell.querySelector('.pd-qtag');
        tag.textContent = q.origin === 'ai' ? 'AI-written' : ''; tag.hidden = q.origin !== 'ai';
        shell.querySelector('.pd-stem').textContent = q.stem;
        if (s.name === 'question') say(`Question ${s.round + 1} of ${st.rounds.length}. ${secs} seconds.`);
        const opts = shell.querySelector('.pd-opts');
        opts.replaceChildren(...q.options.map((o, i) => {
          const b = document.createElement('button'); b.type = 'button'; b.className = 'pd-opt'; b.dataset.i = i;
          b.innerHTML = '<kbd></kbd><span></span><em class="pd-who"></em>';
          b.querySelector('kbd').textContent = LETTERS[i]; b.querySelector('span').textContent = o;
          b.addEventListener('click', () => pick(i));
          return b;
        }));
        shell.querySelector('.pd-why').hidden = true;
        S.dogs.me.expr(EXPR.think); S.dogs.them.expr(EXPR.think);
      }
      /* the log's answer, once it has one, over this phone's pick: the same player on another phone may have answered
         first, and the round counts that one */
      const picked = v.mine ? v.mine.choice : v.picked;
      const R = st.rounds[s.round], reveal = s.name === 'reveal' && R?.closed;
      shell.querySelectorAll('.pd-opt').forEach((b, i) => {
        b.disabled = s.name !== 'question' || picked !== undefined || s.left <= 0;
        b.classList.toggle('pd-picked', picked === i);
        b.classList.toggle('pd-right', !!reveal && i === q.answer);
        b.classList.toggle('pd-wrong', !!reveal && picked === i && i !== q.answer);
        b.classList.toggle('pd-miss', !!reveal && R.answers[opp]?.choice === i && i !== q.answer && picked !== i);
        b.setAttribute('aria-pressed', String(picked === i));
      });
      const why = shell.querySelector('.pd-why');
      if (reveal && M.revealed !== s.round) {
        M.revealed = s.round;
        const a = R.answers[me], b = R.answers[opp], opts = shell.querySelectorAll('.pd-opt');
        /* who picked what: each dog's face on its option */
        for (const [k, ans] of [['me', a], ['them', b]]) { const o = opts[ans?.choice]; if (o && ans.choice !== null) o.querySelector('.pd-who').append(M.faces[k]); else M.faces[k].remove(); }
        why.innerHTML = '<p class="pd-pts"></p>';
        const pts = why.querySelector('.pd-pts');
        pts.textContent = a?.ok ? `+${fmt(a.pts)}` : a && a.choice != null ? 'Wrong' : 'Too slow';
        pts.classList.toggle('pd-good', !!a?.ok);
        why.hidden = false;
        S.dogs.me.expr(a?.ok ? EXPR.right : EXPR.wrong); S.dogs.them.expr(b?.ok ? EXPR.right : EXPR.wrong);
        if (a?.ok) S.dogs.me.tap();
        say(`${a?.ok ? 'Right' : 'Wrong'}. ${M.them.name || 'Your mate'} was ${b?.ok ? 'right' : 'wrong'}. ${fmt(st.score[me])} to ${fmt(st.score[opp])}.`);
      } else if (!reveal) { why.hidden = true; M.faces.me.remove(); M.faces.them.remove(); }
    }
    shell.querySelector('.pd-match').toggleAttribute('data-live', st.phase === 'live' || st.phase === 'done');
    /* the holds: waiting for an accept, the countdown, the end. An ending shows only once the log agrees (v.firm):
       this phone's own reply can run ahead of a move it has not polled yet */
    const big = shell.querySelector('.pd-big'), sub = shell.querySelector('.pd-hold-sub'), acts = shell.querySelector('.pd-hold-acts');
    const fp = v.firm.phase, them = M.them.name || 'your mate';
    let holdOn = true;
    hold.dataset.k = '';
    if (st.phase === 'invited') {
      if (me === st.b) { big.textContent = `${M.them.name || 'A mate'} challenges you`; setBits(st.setup); setActs([['Play', 'pri', 'check', () => S.session.accept()], ['Decline', '', 'x', () => { S.session.decline(); setTimeout(showLobbyOrAuth, 800); }]]); }
      else { big.textContent = `Waiting for ${them}`; setBits(st.setup); setActs([['Cancel', '', 'x', () => { S.session.leave(); setTimeout(showLobbyOrAuth, 800); }]]); }
    } else if (s.name === 'ready') { hold.dataset.k = 'count'; sub.textContent = 'Get ready'; setActs([]); }
    else if (s.name === 'wait') { big.textContent = '…'; sub.textContent = 'Starting'; setActs([]); }
    else if (fp === 'declined' || fp === 'cancelled') { big.textContent = fp === 'declined' ? 'Declined' : 'Called off'; sub.textContent = ''; setActs([['Back', 'pri', 'home', showLobbyOrAuth]]); }
    else if (fp === 'done' && s.name !== 'reveal') { holdOn = false; showResults(); return; }
    else if (st.phase !== 'live' && s.name !== 'reveal') { big.textContent = '…'; sub.textContent = 'Checking the result'; setActs([]); }
    else holdOn = false;
    hold.hidden = !holdOn;
    function setBits(setup) { sub.replaceChildren(bits(setup)); }
    function setActs(list) {
      const sig = list.map(x => x[0]).join('|');
      if (acts.dataset.sig === sig) return;
      acts.dataset.sig = sig;
      acts.replaceChildren(...list.map(([label, kind, ic, fn]) => { const b = document.createElement('button'); b.type = 'button'; b.className = `pd-btn${kind ? ' pd-' + kind : ''}`; b.innerHTML = `${icon(ic)}<span></span>`; b.lastChild.textContent = label; b.addEventListener('click', fn); return b; }));
    }
    /* the network, only when it matters */
    const net = shell.querySelector('.pd-net'), sending = v.sending.find(x => x.tries > 0);
    const away = st.phase === 'live' && v.mine && !v.theirs && s.name === 'locked' && s.left <= 0;
    net.hidden = !(sending || away);
    net.textContent = sending ? 'Reconnecting… your answer is safe' : away ? `${M.them.name || 'Your mate'} seems away` : '';
  }
  function showLobbyOrAuth() { if (S.world) { S.world.stop(); S.world = null; S.t = transport; } if (S.me) showLobby(); else showAuth(); }
  function confirmLeave() {
    const st = S.view?.state;
    if (!st || st.phase !== 'live') { S.session?.leave?.(); showLobbyOrAuth(); return; }
    sheet(`<h2 class="pd-sheet-title">Leave the duel?</h2><p class="pd-sub"></p>
      <button class="pd-btn pd-danger" type="button" data-pd="go">Leave</button><button class="pd-btn" type="button" data-pd="shut">Keep playing</button>`, el => {
      el.querySelector('.pd-sub').textContent = `${S.match.them.name || 'Your mate'} wins if you go.`;
      el.querySelector('[data-pd="go"]').addEventListener('click', () => { S.session.leave(); closeSheet(); });   // the leave row ends the game and paints the result
    }, { label: 'Leave the duel?' });
  }

  /* ---- the result: the dogs react, a crown on the winner, the score and each round under each dog ---- */
  function showResults() {
    const v = S.view, M = S.match;
    if (!v || !M || S.screen === 'results') return;
    S.screen = 'results';
    cancelAnimationFrame(S.raf);
    const st = v.firm, me = v.me, opp = v.opp, out = outcome(st, me) || 'loss', them = M.them.name || 'Your mate';
    const head = out === 'win' ? 'You win!' : out === 'draw' ? 'A draw' : `${them} wins`;
    const why = st.reason === 'leave' ? (st.winner === me ? `${them} left` : 'You left') : st.reason === 'forfeit' ? (st.winner === me ? `${them} went quiet` : 'You went quiet') : '';
    const main = shell.querySelector('.pd-main');
    main.classList.add('pd-over');
    shell.querySelector('.pd-q').hidden = true; shell.querySelector('.pd-hold').hidden = true; shell.querySelector('.pd-timer').hidden = true; shell.querySelector('.pd-net').hidden = true;
    shell.querySelector('.pd-mtop .pd-qtag').hidden = true;
    shell.querySelectorAll('.pd-status').forEach(el => setStatus(el, ''));
    const verdict = document.createElement('section');
    verdict.className = 'pd-verdict';
    verdict.dataset.out = out;
    verdict.innerHTML = '<h2 class="pd-big" tabindex="-1"></h2><p class="pd-reason" hidden></p>';
    verdict.querySelector('.pd-big').textContent = head;
    if (why) { verdict.querySelector('.pd-reason').textContent = why; verdict.querySelector('.pd-reason').hidden = false; }
    const res = document.createElement('section');
    res.className = 'pd-result';
    res.dataset.out = out;
    res.innerHTML = `<div class="pd-tally"><span><b></b><span class="pd-rounds"></span></span><span><b></b><span class="pd-rounds"></span></span></div>
      <div class="pd-acts"><button class="pd-btn pd-pri" type="button" data-pd="again">${icon('repeat')}<span>Rematch</span></button><button class="pd-btn" type="button" data-pd="review">${icon('list')}<span>Review</span></button>${ib('lobby', 'home', M.practice ? 'Done' : 'Back to the lobby')}</div>`;
    const [mine, theirs] = res.querySelectorAll('.pd-tally > span');
    const dots = (el, p) => {
      /* right, wrong, or no answer in time */
      el.append(...st.rounds.map(R => { const a = R.answers[p]; return Object.assign(document.createElement('i'), { className: a?.ok ? 'pd-ok' : a && a.choice != null ? 'pd-no' : 'pd-skip' }); }));
      el.setAttribute('role', 'img');
      el.setAttribute('aria-label', `${st.right[p]} of ${st.rounds.length} right`);
    };
    mine.querySelector('b').textContent = fmt(st.score[me]); dots(mine.querySelector('.pd-rounds'), me);
    theirs.querySelector('b').textContent = fmt(st.score[opp]); dots(theirs.querySelector('.pd-rounds'), opp);
    /* the winner's crown, by their score (over the dog, a tall hat or an ear would meet it) */
    if (st.winner) (st.winner === me ? mine : theirs).querySelector('b').insertAdjacentHTML('afterbegin', `<span class="pd-crown" aria-hidden="true">${icon('crown')}</span>`);
    main.insertBefore(verdict, shell.querySelector('.pd-versus'));
    main.insertBefore(res, shell.querySelector('.pd-emotes'));
    shell.querySelector('.pd-dots').replaceChildren();
    S.dogs.me.expr(out === 'win' ? EXPR.win : out === 'draw' ? EXPR.draw : EXPR.loss);
    S.dogs.them.expr(out === 'loss' ? EXPR.win : out === 'draw' ? EXPR.draw : EXPR.loss);
    if (out === 'win') S.dogs.me.tap();
    say(`${head}. ${fmt(st.score[me])} to ${fmt(st.score[opp])}.`);
    res.querySelector('[data-pd="lobby"]').addEventListener('click', showLobbyOrAuth);
    res.querySelector('[data-pd="again"]').addEventListener('click', () => rematch(st));
    res.querySelector('[data-pd="review"]').addEventListener('click', () => openReview(st, me, opp));
    verdict.querySelector('.pd-big').focus({ preventScroll: true });
    /* answering on a small phone leaves the view scrolled down to the options: bring the two dogs back into view, the
       winner's celebration is the point of this screen (whatever scrolls: the page here, a sheet in a host) */
    shell.scrollIntoView?.({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    if (!M.practice && M.them.id) watchRematch();
    if (!M.reported) { M.reported = true; try { onResult({ outcome: out, score: st.score[me], theirs: st.score[opp], right: st.right[me], rounds: st.rounds.length, practice: M.practice, reason: st.reason }); } catch { /* the host's */ } }
  }
  /* their rematch, while this phone shows the result: a new challenge from them in the inbox (the finished duel's
     own log has stopped being asked by then), and the big button plays it */
  function watchRematch() {
    const M = S.match;
    clearInterval(S.crossT);
    S.crossT = setInterval(async () => {
      if (S.screen !== 'results' || S.match !== M) { clearInterval(S.crossT); return; }
      try {
        const inv = offerFrom(S.me.id, M.them.id, await S.t.inbox(S.me));
        const b = shell.querySelector('[data-pd="again"]');
        if (!inv || !b || M.offer?.id === inv.id || S.match !== M) return;
        M.offer = inv;
        b.innerHTML = `${icon('zap')}<span>Accept rematch</span>`; b.classList.add('pd-offer');
        b.setAttribute('aria-label', `Accept the rematch ${M.them.name || 'your mate'} sent`);
        const ask = shell.querySelector('.pd-theirs .pd-say');
        if (ask) { clearTimeout(M.sayT); ask.className = 'pd-say pd-ask'; ask.innerHTML = `${icon('repeat')}<span>Rematch?</span>`; ask.hidden = false; }
        say(`${M.them.name || 'Your mate'} wants a rematch`);
      } catch { /* the next tick */ }
    }, 2500);
  }
  async function rematch(st) {
    const M = S.match, opt = { rounds: st.rounds.length, secs: st.setup.secs, topic: st.setup.topic || '' };
    if (M.practice) { await startPractice(); return; }
    if (M.offer) { openDuel({ ...M.offer, them: M.them }, { accept: true }); return; }
    const setup = makeSetup(pack, { ...opt, seed: freshSeed(), title: pack.title });
    await busy(async () => {
      const d = await challengeMate(M.them.id, setup);
      S.session?.rematch(d.id);
      openDuel({ ...d, them: M.them });
    }, () => {});
  }
  /* a challenge, and a nudge on the mate's channel so their lobby shows it at once (the poll covers a lost one) */
  async function challengeMate(opp, setup) {
    const d = await S.t.challenge(S.me, opp, setup);
    if (S.t.live) { try { const c = S.t.live(`pup-player-${opp}`, () => {}); c.send({ type: 'invite', duel: d.id, from: S.me.id }); setTimeout(() => c.close(), 4000); } catch { /* the poll covers it */ } }
    return d;
  }

  /* ---- plumbing ---- */
  function wireCommon() {
    shell.querySelector('[data-pd="close"]')?.addEventListener('click', () => { destroy(); onClose(); });
    shell.querySelectorAll('.pd-auth [data-pd="practice"]').forEach(b => b.addEventListener('click', startPractice));
  }
  function stopAll(keepWorld = false) {
    cancelAnimationFrame(S.raf); clearInterval(S.crossT);
    S.session?.stop(); S.session = null;
    S.lobby?.stop(); S.lobby = null;
    if (!keepWorld && S.world) { S.world.stop(); S.world = null; S.t = transport; }
    closeSheet();
    S.view = null; S._stage = null; S.hero = null;
  }
  function destroy() { stopAll(); if (keys === 'document') document.removeEventListener('keydown', onDocKey); root.replaceChildren(); root.classList.remove('pd'); }

  /* keys: Escape closes the top sheet, then asks before leaving a live duel, then closes; 1 to 6 or A to F answer */
  function key(e) {
    if (e.key === 'Escape') {
      if (S.sheet) closeSheet();
      else if (S.screen === 'match' && S.view?.state.phase === 'live') confirmLeave();
      else { destroy(); onClose(); }
      return true;
    }
    if (S.screen !== 'match' || S.sheet || e.metaKey || e.ctrlKey || e.altKey || e.target?.closest?.('input, select, textarea')) return false;
    const k = String(e.key || '').toLowerCase(), i = '123456'.includes(k) && k ? '123456'.indexOf(k) : 'abcdef'.includes(k) && k ? 'abcdef'.indexOf(k) : -1;
    if (i >= 0 && i < (S.view?.question?.options.length || 0)) { pick(i); return true; }
    return false;
  }
  const onDocKey = e => { if (key(e)) e.preventDefault(); };
  if (keys === 'document') document.addEventListener('keydown', onDocKey);

  /* start: the stylesheet, then a remembered player straight to the lobby */
  loadCss().then(async () => {
    const was = transport ? remembered() : null;
    if (was) {
      S.me = was; S.rejoin = true;
      showLobby();
      try { const p = await transport.touch(was); S.me = { ...was, ...p }; remember(S.me); } catch (e) { if (e.server) { remember(null); S.me = null; S.err = 'Please sign in again.'; showAuth(); } }
    } else showAuth();
  });
  return { destroy, key, get state() { return S; } };
}
