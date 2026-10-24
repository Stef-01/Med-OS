/* duel.mjs: the duel on screen. Sign in with a name and a 4-digit PIN, a lobby of mates, a challenge, the match
   (both dogs facing each other, the question, the clock, the reveal) and the result. Phone first: every screen
   works at 320 px. All text a player or a pack wrote goes in through textContent.

   const ui = mountDuel(root, { transport, pack, onClose, onResult });   // ui.destroy()

   transport  supabaseTransport(config) | localTransport() | null (practice only)
   pack       a normalised question pack (pack.mjs)
   look       optional: () => the host's own dog and wear (Optimus passes its mascot's), else the duel locker
   keys       'document' (default) listens for keys itself; 'host' leaves them to the host, which calls ui.key(e) from its
              own key owner (Med-OS's overlay stack captures every key) and gets true back when the duel used it */

import { RULES, EMOTES, makeSetup, outcome } from '../duel/core.mjs';
import { createSession } from '../duel/session.mjs';
import { createLobby } from '../duel/lobby.mjs';
import { practiceWorld, BOT } from '../duel/bot.mjs';
import { nameError, pinError, normName, DOGS, dogName, SLOTS } from '../duel/accounts.mjs';
import { topicsOf } from '../duel/pack.mjs';
import { freshSeed } from '../duel/rng.mjs';
import { lockerFor, fitLook } from '../duel/locker.mjs';
import { ITEMS, wearMsg, SLOT_NAME, VB } from '../pup/wardrobe.mjs';

const BASE = new URL('../', import.meta.url);
export const RIG = new URL('pup/rig/index.html', BASE).href;
export const ICON = dog => new URL(`pup/rig/icons/${DOGS.some(d => d.id === dog) ? dog : 'pip'}.png`, BASE).href;
const CSS = new URL('ui/duel.css', BASE).href;
const LETTERS = 'ABCDEF';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => Math.round(n).toLocaleString('en-AU');
const ago = iso => {
  const s = Math.max(0, (Date.now() - Date.parse(iso || 0)) / 1000);
  return s < 120 ? 'online' : s < 3600 ? `${Math.round(s / 60)} min ago` : s < 86400 ? `${Math.round(s / 3600)} h ago` : `${Math.round(s / 86400)} d ago`;
};
const EXPR = { idle: 'happy', think: 'lockedin', wait: 'curious', right: 'excited', wrong: 'sad', win: 'overjoyed', loss: 'puppy', draw: 'bashful', emote: 'goofy' };

function loadCss() {
  if (document.querySelector(`link[data-pup-duel]`)) return Promise.resolve();
  return new Promise(res => {
    const l = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: CSS });
    l.dataset.pupDuel = '';
    l.onload = l.onerror = () => res();
    document.head.append(l);
  });
}

/* a dog in an iframe of the rig, dressed; `.expr(id)` changes its face */
function dogFrame(look, { mirror = false, label = '' } = {}) {
  const box = document.createElement('div');
  box.className = 'pd-dog' + (mirror ? ' pd-mirror' : '');
  const f = document.createElement('iframe');
  f.src = `${RIG}?embed=1&dog=${encodeURIComponent(look?.dog || 'pip')}&expr=happy`;
  f.title = label; f.setAttribute('aria-hidden', 'true'); f.tabIndex = -1; f.loading = 'lazy';
  box.append(f);
  let ready = false, wantExpr = null;
  const send = m => { try { f.contentWindow?.postMessage(m, location.origin); } catch { /* not ready */ } };
  f.addEventListener('load', () => { ready = true; send(wearMsg(look?.wear || {}, false)); if (wantExpr) send({ dob: 'expr', id: wantExpr }); });
  return {
    el: box,
    expr(id) { if (wantExpr === id) return; wantExpr = id; if (ready) send({ dob: 'expr', id }); },
    tap() { if (ready) send({ dob: 'tap' }); }
  };
}

export function mountDuel(root, { transport = null, pack = { questions: [] }, look: hostLook = null, storage = globalThis.localStorage, storeKey = 'pup-duel', practice = true, title = 'Duel', keys = 'document', onClose = () => {}, onResult = () => {} } = {}) {
  const storeAt = `${storeKey}:${transport?.name || 'none'}`;
  const remembered = () => { try { return JSON.parse(storage.getItem(storeAt)) || null; } catch { return null; } };
  const remember = me => { try { if (me) storage.setItem(storeAt, JSON.stringify(me)); else storage.removeItem(storeAt); } catch { /* private mode */ } };
  const S = { screen: '', me: null, lobby: null, lv: null, session: null, world: null, worldMe: null, t: transport, err: '', busy: false, raf: 0, dogs: {}, live: null, match: null, sheet: null };
  root.classList.add('pd');
  root.innerHTML = '<div class="pd-shell"></div><div class="pd-live" aria-live="polite"></div>';
  const shell = root.querySelector('.pd-shell'), liveEl = root.querySelector('.pd-live');
  const say = text => { liveEl.textContent = ''; setTimeout(() => { liveEl.textContent = text; }, 30); };
  const topics = topicsOf(pack);

  /* ---- sign in ---- */
  function showAuth(step = 'name', draft = {}) {
    stopAll(); S.screen = 'auth';
    shell.innerHTML = `
      <header class="pd-top"><button class="pd-x" type="button" data-pd="close" aria-label="Close the duel"></button><h1 class="pd-h1">${esc(title)}</h1><span></span></header>
      <main class="pd-main pd-auth">
        <div class="pd-hero"><img src="${ICON(draft.dog || 'pip')}" alt=""><div><h2>Duel your mates</h2><p>Same questions, same clock. Right and fast wins.</p></div></div>
        ${step === 'name' ? `
        <form class="pd-card pd-form" data-pd="signin" novalidate>
          <label class="pd-field"><span>Your name</span><input name="name" autocomplete="username" autocapitalize="words" maxlength="20" required value="${esc(draft.name || '')}"></label>
          <label class="pd-field"><span>4-digit PIN</span><input name="pin" type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="current-password" maxlength="4" required value="${esc(draft.pin || '')}"></label>
          <p class="pd-err" role="alert">${esc(S.err)}</p>
          <button class="pd-btn pd-pri" type="submit" data-act="login">Sign in</button>
          <button class="pd-btn" type="button" data-pd="new">I'm new here</button>
          <p class="pd-fine">No email, no password: a name your mates know you by and a PIN you will remember.${transport ? '' : ' Duels with mates need the shared backend; practice works anywhere.'}</p>
        </form>` : `
        <form class="pd-card pd-form" data-pd="create">
          <h2 class="pd-h2">Pick your dog</h2>
          <div class="pd-dogs" role="radiogroup" aria-label="Your dog">${DOGS.map(d => `<button type="button" role="radio" class="pd-dogpick" data-dog="${d.id}" aria-checked="${d.id === (draft.dog || 'pip')}"><img src="${ICON(d.id)}" alt=""><b>${esc(d.name)}</b><small>${esc(d.hint)}</small></button>`).join('')}</div>
          <p class="pd-err" role="alert">${esc(S.err)}</p>
          <button class="pd-btn pd-pri" type="submit">Create ${esc(normName(draft.name))}</button>
          <button class="pd-btn" type="button" data-pd="back">Back</button>
        </form>`}
        ${practice ? `<button class="pd-row pd-practice" type="button" data-pd="practice"><img src="${ICON(BOT.look.dog)}" alt=""><span><b>Practice with ${esc(BOT.name)}</b><small>A bot, on this device</small></span><i aria-hidden="true">›</i></button>` : ''}
      </main>`;
    const form = shell.querySelector('form');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (S.busy) return;
      if (step === 'name') {
        const name = form.name.value, pin = form.pin.value;
        S.err = nameError(name) || pinError(pin) || (transport ? '' : 'Duels with mates need the shared backend (see the README); try practice instead.');
        if (S.err) return showAuth('name', { name, pin });
        await busy(async () => { const me = await transport.login(name, pin); signedIn(me); }, () => showAuth('name', { name, pin }));
      } else {
        const dog = form.querySelector('[aria-checked="true"]')?.dataset.dog || 'pip';
        await busy(async () => { const me = await transport.register(draft.name, draft.pin, { dog, wear: {} }); signedIn(me); }, () => showAuth('create', { ...draft, dog }));
      }
    });
    shell.querySelector('[data-pd="new"]')?.addEventListener('click', () => {
      const name = form.name.value, pin = form.pin.value, bad = nameError(name) || pinError(pin);
      S.err = bad;
      showAuth(bad ? 'name' : 'create', { name, pin, dog: 'pip' });
    });
    shell.querySelector('[data-pd="back"]')?.addEventListener('click', () => { S.err = ''; showAuth('name', draft); });
    shell.querySelectorAll('.pd-dogpick').forEach(b => b.addEventListener('click', () => {
      shell.querySelectorAll('.pd-dogpick').forEach(x => x.setAttribute('aria-checked', String(x === b)));
      shell.querySelector('.pd-hero img').src = ICON(b.dataset.dog);
    }));
    wireCommon();
    S.err = '';
    ([...shell.querySelectorAll('input')].find(i => !i.value) || shell.querySelector('input, .pd-dogpick'))?.focus({ preventScroll: true });
  }
  async function busy(fn, onErr) {
    S.busy = true; root.dataset.busy = '';
    try { await fn(); } catch (e) { S.err = e.message || 'Something went wrong'; onErr?.(); } finally { S.busy = false; delete root.dataset.busy; }
  }
  function signedIn(me) { S.me = me; S.t = transport; S.world = null; remember(me); S.err = ''; showLobby(); }

  /* ---- the lobby ---- */
  function myLook() {
    const base = S.lv?.self?.look || S.me?.look || { dog: 'pip', wear: {} };
    if (hostLook) { const h = hostLook(); if (h) return h; }
    return fitLook({ dog: base.dog || 'pip', wear: base.wear || {} }, lockerFor(ITEMS, S.lv?.self?.wins || 0).open);
  }
  function showLobby() {
    stopAll(); S.screen = 'lobby';
    shell.innerHTML = `
      <header class="pd-top"><button class="pd-x" type="button" data-pd="close" aria-label="Close the duel"></button><h1 class="pd-h1">${esc(title)}</h1><button class="pd-link" type="button" data-pd="signout">Sign out</button></header>
      <main class="pd-main pd-lobby">
        <section class="pd-card pd-me"><div class="pd-me-dog"></div><div class="pd-me-txt"><h2 class="pd-name"></h2><p class="pd-rec"></p><button class="pd-btn pd-sm" type="button" data-pd="dress">Dress up</button></div></section>
        <section class="pd-sec" data-sec="invites" hidden><h2 class="pd-h2">Challenges for you</h2><div class="pd-list"></div></section>
        <section class="pd-sec" data-sec="mine" hidden><h2 class="pd-h2">Your duels</h2><div class="pd-list"></div></section>
        <section class="pd-sec" data-sec="mates"><h2 class="pd-h2">Challenge a mate</h2><div class="pd-list"></div><p class="pd-empty" hidden>Nobody else yet. Send a mate this page: they pick a name and a PIN, and appear here.</p></section>
        ${practice ? `<button class="pd-row pd-practice" type="button" data-pd="practice"><img src="${ICON(BOT.look.dog)}" alt=""><span><b>Practice with ${esc(BOT.name)}</b><small>A bot; your record is safe</small></span><i aria-hidden="true">›</i></button>` : ''}
        <section class="pd-sec" data-sec="past" hidden><h2 class="pd-h2">Recent</h2><div class="pd-list"></div></section>
        <p class="pd-err" role="alert"></p>
      </main>`;
    wireCommon();
    shell.querySelector('[data-pd="signout"]').addEventListener('click', () => { remember(null); S.me = null; showAuth(); });
    shell.querySelector('[data-pd="dress"]').addEventListener('click', openDress);
    if (!S.t) return;
    const me = S.me;
    S.lobby = createLobby({ transport: S.t, me, onChange: lv => { S.lv = lv; paintLobby(); } });
    S.lobby.start();
    paintLobby();
  }
  function paintLobby() {
    if (S.screen !== 'lobby') return;
    const lv = S.lv || { mates: [], invites: [], waiting: [], live: [], past: [], self: null, loaded: false };
    const self = lv.self || S.me, look = myLook();
    shell.querySelector('.pd-name').textContent = self?.name || '';
    shell.querySelector('.pd-rec').textContent = self ? `${self.wins || 0} won · ${self.losses || 0} lost${self.draws ? ` · ${self.draws} drawn` : ''}` : '';
    const holder = shell.querySelector('.pd-me-dog');
    if (holder.dataset.look !== JSON.stringify(look)) { holder.dataset.look = JSON.stringify(look); holder.replaceChildren(dogFrame(look, { label: dogName(look.dog) }).el); }
    const fill = (sec, items, row) => {
      const s = shell.querySelector(`[data-sec="${sec}"]`), list = s.querySelector('.pd-list');
      s.hidden = sec !== 'mates' && !items.length;
      list.replaceChildren(...items.map(row));
    };
    fill('invites', lv.invites, d => card(d, `${d.them?.name || 'A mate'} challenged you`, setupLine(d.setup), [['Accept', 'pri', () => openDuel(d, { accept: true })], ['Decline', '', () => declineDuel(d)]]));
    fill('mine', [...lv.live, ...lv.waiting], d => d.status === 'live'
      ? card(d, `Live against ${d.them?.name || 'a mate'}`, setupLine(d.setup), [['Play', 'pri', () => openDuel(d)]])
      : card(d, `Waiting for ${d.them?.name || 'your mate'}`, `${setupLine(d.setup)} · they have been told`, [['Open', '', () => openDuel(d)]]));
    fill('mates', lv.mates, p => {
      const b = document.createElement('div'); b.className = 'pd-row pd-mate';
      b.innerHTML = `<img src="${ICON(p.look?.dog)}" alt=""><span><b></b><small></small></span><button class="pd-btn pd-sm pd-pri" type="button">Duel</button>`;
      b.querySelector('b').textContent = p.name;
      b.querySelector('small').textContent = `${p.online ? 'Online' : ago(p.seen_at)} · ${p.wins || 0}–${p.losses || 0}`;
      b.querySelector('small').classList.toggle('pd-on', !!p.online);
      b.querySelector('button').setAttribute('aria-label', `Challenge ${p.name}`);
      b.querySelector('button').addEventListener('click', () => openSetup(p));
      return b;
    });
    shell.querySelector('[data-sec="mates"] .pd-empty').hidden = !lv.loaded || lv.mates.length > 0;
    fill('past', lv.past, d => {
      const res = d.result || {}, mine = res.score?.[S.me.id], theirs = res.score?.[d.them?.id];
      const line = d.status === 'done' ? (res.winner === null ? 'Draw' : res.winner === S.me.id ? 'Won' : 'Lost') + (mine !== undefined ? ` ${fmt(mine)}–${fmt(theirs ?? 0)}` : '') : d.status === 'declined' ? 'Declined' : 'Cancelled';
      const b = document.createElement('div'); b.className = 'pd-row pd-past';
      b.innerHTML = `<img src="${ICON(d.them?.look?.dog)}" alt=""><span><b></b><small></small></span>`;
      b.querySelector('b').textContent = `${line} · ${d.them?.name || 'a mate'}`;
      b.querySelector('small').textContent = setupLine(d.setup);
      return b;
    });
    shell.querySelector('.pd-lobby > .pd-err').textContent = lv.error ? `Can't reach the server (${lv.error}). Retrying.` : '';
  }
  const setupLine = s => `${s?.rounds || '?'} questions · ${s?.secs || '?'} s${s?.topic ? ` · ${s.topic}` : ''}`;
  function card(d, head, sub, acts) {
    const c = document.createElement('div'); c.className = 'pd-row pd-duelrow';
    c.innerHTML = `<img src="${ICON(d.them?.look?.dog)}" alt=""><span><b></b><small></small></span><span class="pd-acts"></span>`;
    c.querySelector('b').textContent = head; c.querySelector('small').textContent = sub;
    for (const [label, kind, fn] of acts) {
      const b = document.createElement('button'); b.type = 'button'; b.className = `pd-btn pd-sm${kind ? ' pd-' + kind : ''}`; b.textContent = label;
      b.addEventListener('click', fn); c.querySelector('.pd-acts').append(b);
    }
    return c;
  }
  async function declineDuel(d) {
    const s = createSession({ transport: S.t, me: S.me, duel: d });
    s.start(); s.decline(); setTimeout(() => s.stop(), 4000);
    S.lobby?.nudge(d.a, { type: 'declined', duel: d.id });
    setTimeout(() => S.lobby?.refresh(), 600);
  }

  /* ---- sheets: the challenge setup, the dress-up locker, leaving ---- */
  function sheet(html, wire) {
    closeSheet();
    const el = document.createElement('div');
    el.className = 'pd-sheet-wrap';
    el.innerHTML = `<div class="pd-scrim" data-pd="shut"></div><div class="pd-sheet" role="dialog" aria-modal="true">${html}</div>`;
    root.append(el); S.sheet = el;
    el.querySelectorAll('[data-pd="shut"]').forEach(b => b.addEventListener('click', closeSheet));
    wire(el.querySelector('.pd-sheet'));
    el.querySelector('.pd-sheet button, .pd-sheet select')?.focus({ preventScroll: true });
  }
  function closeSheet() { S.sheet?.remove(); S.sheet = null; }
  function openSetup(mate, last = null) {
    const opt = last || { rounds: RULES.rounds, secs: RULES.secs, topic: '' };
    const seg = (name, vals, cur, fmtv) => `<div class="pd-seg" role="radiogroup" aria-label="${name}">${vals.map(v => `<button type="button" role="radio" data-${name}="${v}" aria-checked="${v === cur}">${fmtv(v)}</button>`).join('')}</div>`;
    sheet(`
      <h2 class="pd-h2">Challenge ${esc(mate.name)}</h2>
      <p class="pd-sub">Questions</p>${seg('rounds', RULES.roundChoices, opt.rounds, v => v)}
      <p class="pd-sub">Seconds each</p>${seg('secs', RULES.secsChoices, opt.secs, v => `${v} s`)}
      ${topics.length > 1 ? `<label class="pd-field"><span>Topic</span><select name="topic"><option value="">Everything (${pack.questions.length})</option>${topics.map(t => `<option value="${esc(t.topic)}"${t.topic === opt.topic ? ' selected' : ''}>${esc(t.topic)} (${t.count})</option>`).join('')}</select></label>` : ''}
      <p class="pd-err" role="alert"></p>
      <button class="pd-btn pd-pri" type="button" data-pd="send">Send the challenge</button>
      <button class="pd-btn" type="button" data-pd="shut">Not now</button>`, el => {
      el.querySelectorAll('.pd-seg').forEach(g => g.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; g.querySelectorAll('button').forEach(x => x.setAttribute('aria-checked', String(x === b))); }));
      el.querySelector('[data-pd="send"]').addEventListener('click', async () => {
        const rounds = +el.querySelector('[data-rounds][aria-checked="true"]').dataset.rounds, secs = +el.querySelector('[data-secs][aria-checked="true"]').dataset.secs;
        const topic = el.querySelector('select')?.value || '';
        const setup = makeSetup(pack, { rounds, secs, topic, seed: freshSeed(), title: pack.title });
        if (!setup.questions.length) { el.querySelector('.pd-err').textContent = 'No questions to play.'; return; }
        await busy(async () => {
          const d = await challengeMate(mate.id, setup);
          closeSheet(); openDuel({ ...d, them: mate });
        }, () => { el.querySelector('.pd-err').textContent = S.err; });
      });
    });
  }
  function openDress() {
    const self = S.lv?.self || S.me, locker = lockerFor(ITEMS, self?.wins || 0), look = myLook();
    if (hostLook) { sheet(`<h2 class="pd-h2">Your dog</h2><p class="pd-sub">Your dog wears what it wears in ${esc(title)}'s shop.</p><button class="pd-btn" type="button" data-pd="shut">OK</button>`, () => {}); return; }
    const cur = { dog: look.dog, wear: { ...look.wear } };
    const piece = it => `<button type="button" class="pd-piece" data-id="${it.id}" data-slot="${it.slot}" data-r="${it.rarity}" aria-pressed="${cur.wear[it.slot] === it.id}" ${locker.open.has(it.id) ? '' : 'disabled'} title="${esc(it.name)}"><svg viewBox="${it.tile || it.vb || VB[it.slot]}" aria-hidden="true">${it.svg}</svg><span>${esc(it.name)}</span></button>`;
    sheet(`
      <h2 class="pd-h2">Dress up</h2>
      <div class="pd-dogs pd-dogs-sm" role="radiogroup" aria-label="Your dog">${DOGS.map(d => `<button type="button" role="radio" class="pd-dogpick" data-dog="${d.id}" aria-checked="${d.id === cur.dog}"><img src="${ICON(d.id)}" alt=""><b>${esc(d.name)}</b></button>`).join('')}</div>
      <p class="pd-sub">${locker.open.size} of ${locker.total} pieces open · every win opens two more</p>
      ${SLOTS.map(s => `<p class="pd-sub">${esc(SLOT_NAME[s])}</p><div class="pd-pieces">${unlockedFirst(s, locker).map(piece).join('')}</div>`).join('')}
      <button class="pd-btn pd-pri" type="button" data-pd="save">Save</button>
      <button class="pd-btn" type="button" data-pd="shut">Cancel</button>`, el => {
      el.querySelectorAll('.pd-dogpick').forEach(b => b.addEventListener('click', () => { cur.dog = b.dataset.dog; el.querySelectorAll('.pd-dogpick').forEach(x => x.setAttribute('aria-checked', String(x === b))); }));
      el.querySelectorAll('.pd-piece').forEach(b => b.addEventListener('click', () => {
        const on = cur.wear[b.dataset.slot] === b.dataset.id;
        if (on) delete cur.wear[b.dataset.slot]; else cur.wear[b.dataset.slot] = b.dataset.id;
        el.querySelectorAll(`.pd-piece[data-slot="${b.dataset.slot}"]`).forEach(x => x.setAttribute('aria-pressed', String(cur.wear[x.dataset.slot] === x.dataset.id)));
      }));
      el.querySelector('[data-pd="save"]').addEventListener('click', async () => {
        await busy(async () => { const p = await (S.lobby ? S.lobby.look(cur) : S.t.touch(S.me, cur)); S.me = { ...S.me, look: p.look }; remember(S.me); closeSheet(); paintLobby(); }, () => {});
      });
    });
  }
  const unlockedFirst = (slot, locker) => ITEMS.filter(i => i.slot === slot && !i.exclusive).sort((a, b) => Number(locker.open.has(b.id)) - Number(locker.open.has(a.id)) || a.price - b.price);

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
    const myL = myLook();
    shell.innerHTML = `
      <header class="pd-top pd-mtop"><button class="pd-x" type="button" data-pd="leave" aria-label="Leave the duel"></button><div class="pd-dots" aria-hidden="true"></div><span class="pd-roundno"></span></header>
      <main class="pd-main pd-match">
        <section class="pd-versus">
          <div class="pd-side pd-mine"><div class="pd-dogslot"></div><b class="pd-pname">You</b><span class="pd-score">0</span><i class="pd-status"></i></div>
          <div class="pd-vs" aria-hidden="true">VS</div>
          <div class="pd-side pd-theirs"><div class="pd-dogslot"></div><b class="pd-pname"></b><span class="pd-score">0</span><i class="pd-status"></i><span class="pd-say" hidden></span></div>
        </section>
        <div class="pd-timer" aria-hidden="true"><i></i></div>
        <article class="pd-card pd-q" aria-live="off">
          <p class="pd-qtag"></p><p class="pd-stem"></p>
          <div class="pd-opts"></div>
          <div class="pd-why" hidden></div>
        </article>
        <div class="pd-hold" hidden><div class="pd-hold-in"><p class="pd-big"></p><p class="pd-hold-sub"></p><div class="pd-hold-acts"></div></div></div>
        <footer class="pd-emotes">${Object.entries(EMOTES).filter(([k]) => k !== 'again').map(([k, v]) => `<button type="button" class="pd-emote" data-e="${k}">${esc(v)}</button>`).join('')}</footer>
        <p class="pd-net" hidden></p>
      </main>`;
    wireCommon();
    const theirName = them.name || 'Your mate';
    shell.querySelector('.pd-theirs .pd-pname').textContent = theirName;
    const myDog = dogFrame(myL, { label: 'Your dog' }), theirDog = dogFrame(them.look || { dog: 'rosie' }, { mirror: true, label: `${theirName}'s dog` });
    shell.querySelector('.pd-mine .pd-dogslot').append(myDog.el);
    shell.querySelector('.pd-theirs .pd-dogslot').append(theirDog.el);
    S.dogs = { me: myDog, them: theirDog };
    S.match = { d, me, them, t, practice: isPractice, last: {}, round: -1, revealed: -1, emoteN: 0, reported: false };
    shell.querySelector('[data-pd="leave"]').addEventListener('click', confirmLeave);
    shell.querySelectorAll('.pd-emote').forEach(b => b.addEventListener('click', () => { if (S.session?.emote(b.dataset.e)) { b.classList.add('pd-sent'); setTimeout(() => b.classList.remove('pd-sent'), 600); S.dogs.me.expr(EXPR.emote); } }));
    S.session = createSession({ transport: t, me, duel: d, onChange: v => { S.view = v; paintMatch(); } });
    S.session.start();
    if (accept) S.session.accept();
    tick();
  }
  function pick(i) {
    if (!S.session?.answer(i)) return;
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
    shell.querySelector('.pd-roundno').textContent = st.phase === 'live' || s.name === 'reveal' ? `${Math.min(st.rounds.length, (s.round ?? st.round) + 1)}/${st.rounds.length}` : '';
    /* scores move on the reveal, never before: a jump while they are still thinking would tell them you were right */
    const shown = p => st.rounds.reduce((t, R) => t + (R.closed ? R.answers[p]?.pts || 0 : 0), 0);
    shell.querySelector('.pd-mine .pd-score').textContent = fmt(shown(me));
    shell.querySelector('.pd-theirs .pd-score').textContent = fmt(shown(opp));
    /* their status: never what they picked until the round closes */
    const theirStatus = s.name === 'question' || s.name === 'locked' ? (v.theirs ? 'Answered' : 'Thinking…') : s.name === 'reveal' ? (st.rounds[s.round]?.answers[opp]?.ok ? 'Right' : 'Wrong') : '';
    const myStatus = s.name === 'locked' ? 'Locked in' : s.name === 'reveal' ? (st.rounds[s.round]?.answers[me]?.ok ? 'Right' : 'Wrong') : '';
    shell.querySelector('.pd-theirs .pd-status').textContent = theirStatus;
    shell.querySelector('.pd-mine .pd-status').textContent = myStatus;
    shell.querySelector('.pd-theirs').classList.toggle('pd-done', !!v.theirs && (s.name === 'question' || s.name === 'locked'));
    if (v.theirs && M.last.theirs !== `${s.round}`) { M.last.theirs = `${s.round}`; if (s.name === 'question') say(`${M.them.name || 'Your mate'} answered`); }
    /* an emote from them shows over their dog */
    const em = st.emotes.filter(e => e.by === opp);
    if (em.length > M.emoteN) {
      M.emoteN = em.length;
      const b = shell.querySelector('.pd-say');
      b.textContent = EMOTES[em.at(-1).e]; b.hidden = false; S.dogs.them.expr(EXPR.emote); S.dogs.them.tap();
      clearTimeout(M.sayT); M.sayT = setTimeout(() => { b.hidden = true; }, 2600);
    }
    /* the question card */
    const card = shell.querySelector('.pd-q'), hold = shell.querySelector('.pd-hold');
    const showQ = q && (s.name === 'question' || s.name === 'locked' || s.name === 'reveal');
    card.hidden = !showQ;
    if (showQ) {
      const key = `${s.round}`;
      if (M.round !== s.round) {
        M.round = s.round;
        shell.querySelector('.pd-qtag').textContent = [q.origin === 'ai' ? 'AI-written' : '', q.topic || ''].filter(Boolean).join(' · ');
        shell.querySelector('.pd-stem').textContent = q.stem;
        if (s.name === 'question') say(`Question ${s.round + 1} of ${st.rounds.length}. ${secs} seconds.`);
        const opts = shell.querySelector('.pd-opts');
        opts.replaceChildren(...q.options.map((o, i) => {
          const b = document.createElement('button'); b.type = 'button'; b.className = 'pd-opt'; b.dataset.i = i;
          b.innerHTML = '<kbd></kbd><span></span><em class="pd-who" hidden></em>';
          b.querySelector('kbd').textContent = LETTERS[i]; b.querySelector('span').textContent = o;
          b.addEventListener('click', () => pick(i));
          return b;
        }));
        shell.querySelector('.pd-why').hidden = true;
        S.dogs.me.expr(EXPR.think); S.dogs.them.expr(EXPR.think);
        card.dataset.round = key;
      }
      const picked = v.picked ?? v.mine?.choice;
      const R = st.rounds[s.round], reveal = s.name === 'reveal' && R?.closed;
      shell.querySelectorAll('.pd-opt').forEach((b, i) => {
        b.disabled = s.name !== 'question' || picked !== undefined || s.left <= 0;
        b.classList.toggle('pd-picked', picked === i);
        b.classList.toggle('pd-right', !!reveal && i === q.answer);
        b.classList.toggle('pd-wrong', !!reveal && picked === i && i !== q.answer);
        const who = b.querySelector('.pd-who'), mineHere = reveal && R.answers[me]?.choice === i, theirsHere = reveal && R.answers[opp]?.choice === i;
        who.hidden = !(mineHere || theirsHere);
        who.textContent = mineHere && theirsHere ? 'You both' : mineHere ? 'You' : theirsHere ? (M.them.name || 'Them') : '';
        b.setAttribute('aria-pressed', String(picked === i));
      });
      const why = shell.querySelector('.pd-why');
      if (reveal && M.revealed !== s.round) {
        M.revealed = s.round;
        const a = R.answers[me], b = R.answers[opp];
        const note = a?.choice !== null && a?.choice !== undefined && !a.ok ? q.notes?.[a.choice] : null;
        why.innerHTML = `<p class="pd-pts"></p>${note ? '<p class="pd-note"></p>' : ''}${q.why ? '<p class="pd-whytext"></p>' : ''}`;
        why.querySelector('.pd-pts').textContent = a?.ok ? `Right! +${fmt(a.pts)}` : a?.how === 'answer' && a.choice === null ? 'Out of time' : 'Not this time';
        why.querySelector('.pd-pts').classList.toggle('pd-good', !!a?.ok);
        if (note) why.querySelector('.pd-note').textContent = `Why not ${LETTERS[a.choice]}: ${note}`;
        if (q.why) why.querySelector('.pd-whytext').textContent = q.why;
        why.hidden = false;
        S.dogs.me.expr(a?.ok ? EXPR.right : EXPR.wrong); S.dogs.them.expr(b?.ok ? EXPR.right : EXPR.wrong);
        if (a?.ok) S.dogs.me.tap();
        say(`${a?.ok ? 'Right' : 'Wrong'}. ${M.them.name || 'Your mate'} was ${b?.ok ? 'right' : 'wrong'}. ${fmt(st.score[me])} to ${fmt(st.score[opp])}.`);
      } else if (!reveal) why.hidden = true;
    }
    shell.querySelector('.pd-match').toggleAttribute('data-live', st.phase === 'live' || st.phase === 'done');
    /* the holds: waiting for an accept, the countdown, the end. An ending shows only once the log agrees (v.firm):
       this phone's own reply can run ahead of a move it has not polled yet */
    const big = shell.querySelector('.pd-big'), sub = shell.querySelector('.pd-hold-sub'), acts = shell.querySelector('.pd-hold-acts');
    const fp = v.firm.phase;
    let holdOn = true;
    if (st.phase === 'invited') {
      if (me === st.b) { big.textContent = `${M.them.name || 'A mate'} challenges you`; sub.textContent = setupLine(st.setup); setActs([['Accept', 'pri', () => S.session.accept()], ['Decline', '', () => { S.session.decline(); setTimeout(showLobbyOrAuth, 800); }]]); }
      else { big.textContent = `Waiting for ${M.them.name || 'your mate'}`; sub.textContent = `${setupLine(st.setup)}. The duel starts when they accept.`; setActs([['Cancel', '', () => { S.session.leave(); setTimeout(showLobbyOrAuth, 800); }]]); }
    } else if (s.name === 'ready') { sub.textContent = 'Get ready'; setActs([]); }
    else if (s.name === 'wait') { big.textContent = '…'; sub.textContent = 'Starting'; setActs([]); }
    else if (fp === 'declined' || fp === 'cancelled') { big.textContent = fp === 'declined' ? 'Not this time' : 'Cancelled'; sub.textContent = fp === 'declined' ? `${M.them.name || 'Your mate'} declined.` : 'The challenge was called off.'; setActs([['Back', 'pri', showLobbyOrAuth]]); }
    else if (fp === 'done' && s.name !== 'reveal') { holdOn = false; showResults(); return; }
    else if (st.phase !== 'live' && s.name !== 'reveal') { big.textContent = '…'; sub.textContent = 'Checking the result'; setActs([]); }
    else holdOn = false;
    hold.hidden = !holdOn;
    function setActs(list) {
      const sig = list.map(x => x[0]).join('|');
      if (acts.dataset.sig === sig) return;
      acts.dataset.sig = sig;
      acts.replaceChildren(...list.map(([label, kind, fn]) => { const b = document.createElement('button'); b.type = 'button'; b.className = `pd-btn${kind ? ' pd-' + kind : ''}`; b.textContent = label; b.addEventListener('click', fn); return b; }));
    }
    /* the network, only when it matters */
    const net = shell.querySelector('.pd-net'), sending = v.sending.find(x => x.tries > 0);
    const away = st.phase === 'live' && v.mine && !v.theirs && s.name === 'locked' && s.left <= 0;
    net.hidden = !(sending || away);
    net.textContent = sending ? 'Reconnecting… your answer is safe and will send' : away ? `${M.them.name || 'Your mate'} seems away. Moving on in a few seconds.` : '';
  }
  function showLobbyOrAuth() { if (S.world) { S.world.stop(); S.world = null; S.t = transport; } if (S.me) showLobby(); else showAuth(); }
  function confirmLeave() {
    const st = S.view?.state;
    if (!st || st.phase !== 'live') { S.session?.leave?.(); showLobbyOrAuth(); return; }
    sheet(`<h2 class="pd-h2">Leave the duel?</h2><p class="pd-sub">${esc(S.match.them.name || 'Your mate')} wins if you go.</p>
      <button class="pd-btn pd-danger" type="button" data-pd="go">Leave</button><button class="pd-btn" type="button" data-pd="shut">Keep playing</button>`, el => {
      el.querySelector('[data-pd="go"]').addEventListener('click', () => { S.session.leave(); closeSheet(); });   // the leave row ends the game and paints the result
    });
  }

  /* ---- the result ---- */
  function showResults() {
    const v = S.view, M = S.match;
    if (!v || !M || S.screen === 'results') return;
    S.screen = 'results';
    cancelAnimationFrame(S.raf);
    const st = v.firm, me = v.me, opp = v.opp, out = outcome(st, me) || 'loss';
    const head = out === 'win' ? 'You win!' : out === 'draw' ? 'A draw' : `${M.them.name || 'Your mate'} wins`;
    const why = st.reason === 'leave' ? (st.winner === me ? `${M.them.name || 'Your mate'} left the duel.` : 'You left the duel.') : st.reason === 'forfeit' ? (st.winner === me ? `${M.them.name || 'Your mate'} went quiet for three rounds.` : 'You were away for three rounds.') : '';
    const main = shell.querySelector('.pd-main');
    main.classList.add('pd-over');
    shell.querySelector('.pd-q').hidden = true; shell.querySelector('.pd-hold').hidden = true; shell.querySelector('.pd-timer').hidden = true; shell.querySelector('.pd-net').hidden = true;
    shell.querySelector('.pd-roundno').textContent = '';
    const res = document.createElement('section');
    res.className = 'pd-card pd-result';
    res.dataset.out = out;
    res.innerHTML = `<h2 class="pd-big" tabindex="-1"></h2><p class="pd-sub pd-reason"></p>
      <div class="pd-tally"><span><b></b><small>You · <i></i> right</small></span><span><b></b><small><em></em> · <i></i> right</small></span></div>
      <div class="pd-strip" role="img"></div>
      <div class="pd-acts"><button class="pd-btn pd-pri" type="button" data-pd="again">Rematch</button><button class="pd-btn" type="button" data-pd="lobby">${M.practice ? 'Done' : 'Back to the lobby'}</button></div>`;
    res.querySelector('.pd-big').textContent = head;
    res.querySelector('.pd-reason').textContent = why || `${st.rounds.length} questions · ${st.setup.secs} s each`;
    const [mine, theirs] = res.querySelectorAll('.pd-tally > span');
    mine.querySelector('b').textContent = fmt(st.score[me]); mine.querySelector('i').textContent = st.right[me];
    theirs.querySelector('b').textContent = fmt(st.score[opp]); theirs.querySelector('em').textContent = M.them.name || 'Them'; theirs.querySelector('i').textContent = st.right[opp];
    /* round by round: a row of dots each, green where right */
    const strip = res.querySelector('.pd-strip'), line = (label, p) => {
      const row = document.createElement('div'); row.className = 'pd-strow';
      row.innerHTML = '<b></b><span></span>';
      row.querySelector('b').textContent = label;
      row.querySelector('span').append(...st.rounds.map(R => Object.assign(document.createElement('i'), { className: R.answers[p]?.ok ? 'pd-ok' : 'pd-no' })));
      return row;
    };
    strip.replaceChildren(line('You', me), line(M.them.name || 'Them', opp));
    strip.setAttribute('aria-label', `Right answers by round: you ${st.rounds.map(R => (R.answers[me]?.ok ? 'right' : 'wrong')).join(', ')}; ${M.them.name || 'them'} ${st.rounds.map(R => (R.answers[opp]?.ok ? 'right' : 'wrong')).join(', ')}`);
    main.insertBefore(res, shell.querySelector('.pd-emotes'));
    shell.querySelector('.pd-dots').replaceChildren();
    S.dogs.me.expr(out === 'win' ? EXPR.win : out === 'draw' ? EXPR.draw : EXPR.loss);
    S.dogs.them.expr(out === 'loss' ? EXPR.win : out === 'draw' ? EXPR.draw : EXPR.loss);
    if (out === 'win') S.dogs.me.tap();
    say(`${head}. ${fmt(st.score[me])} to ${fmt(st.score[opp])}.`);
    res.querySelector('[data-pd="lobby"]').addEventListener('click', showLobbyOrAuth);
    res.querySelector('[data-pd="again"]').addEventListener('click', () => rematch(st));
    res.querySelector('.pd-big').focus({ preventScroll: true });
    /* answering on a small phone leaves the view scrolled down to the options: bring the two dogs back into view, the
       winner's celebration is the point of this screen (whatever scrolls: the page here, a sheet in a host) */
    shell.scrollIntoView?.({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    if (!M.reported) { M.reported = true; try { onResult({ outcome: out, score: st.score[me], theirs: st.score[opp], right: st.right[me], rounds: st.rounds.length, practice: M.practice, reason: st.reason }); } catch { /* the host's */ } }
  }
  async function rematch(st) {
    const M = S.match, opt = { rounds: st.rounds.length, secs: st.setup.secs, topic: st.setup.topic || '' };
    if (M.practice) { await startPractice(); return; }
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
    shell.querySelectorAll('[data-pd="practice"]').forEach(b => b.addEventListener('click', startPractice));
  }
  function stopAll(keepWorld = false) {
    cancelAnimationFrame(S.raf);
    S.session?.stop(); S.session = null;
    S.lobby?.stop(); S.lobby = null;
    if (!keepWorld && S.world) { S.world.stop(); S.world = null; S.t = transport; }
    closeSheet();
    S.view = null; S._stage = null;
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
      S.me = was;
      showLobby();
      try { const p = await transport.touch(was); S.me = { ...was, ...p }; remember(S.me); } catch (e) { if (e.server) { remember(null); S.me = null; S.err = 'Please sign in again.'; showAuth(); } }
    } else showAuth();
  });
  return { destroy, key, get state() { return S; } };
}
