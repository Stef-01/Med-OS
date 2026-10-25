/* server-core.mjs: supabase/migrations/0001_pup_duel.sql written again in JavaScript, over a plain object, so the
   local and memory transports (and scripts/fake-supabase.mjs) behave like the real backend: the same rules, the same
   error messages, the same rows. test/sql-parity.test.mjs pins the two; test/sql.test.mjs runs the same scenario
   against a real Postgres when one is at hand.

   db { players: {id: player}, duels: {id: duel}, events: [row], n } is JSON all the way down, so a transport can keep
   it in localStorage. */

import { normName, nameKey } from './accounts.mjs';
import { KINDS, idFor, jsonbBytes, reduce, summary } from './core.mjs';
import { ITEMS } from '../pup/wardrobe.mjs';
import { START, STALE, eloDelta, pickOpponent, windowFor } from './ranked.mjs';
import { legacyWallet, duelPay, practicePay, buyError, fitWear, logged, starterOwned, OUTFITS, BUY_ERR } from './shop.mjs';

export const ERR = {
  name: 'Pick a name of 2 to 20 letters or numbers', pin: 'The PIN is 4 digits', look: 'That look is too big',
  taken: 'That name is taken', login: 'Wrong name or PIN', token: 'Sign in again', self: 'Pick a mate, not yourself',
  nobody: 'No such player', noQs: 'A duel needs questions', nQs: 'A duel has 1 to 15 questions',
  rounds: 'Rounds must match the questions', secs: 'A question lasts 5 to 120 seconds', big: 'That duel is too big',
  q: 'A question needs 2 to 6 options and its answer', notYours: 'Not your duel', kind: 'Unknown move',
  id: 'Bad move id', moveBig: 'That move is too big', tries: 'Too many wrong PINs: try again in 10 minutes',
  outfits: 'At most 3 outfits', ...Object.fromEntries(Object.entries(BUY_ERR).map(([k, v]) => [`buy_${k}`, v]))
};
export const LIMITS = { look: 2048, setup: 65536, body: 4096, id: 200, page: 200, finished: 20, minQ: 1, maxQ: 15, minSecs: 5, maxSecs: 120, fails: 5, failMinutes: 10 };
const SQL_NAME = /^[A-Za-z0-9 ._-]{2,20}$/;

export class DuelError extends Error {}
const fail = m => { throw new DuelError(m); };
const bytes = jsonbBytes;
const uuid = () => globalThis.crypto.randomUUID();
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');

/* bcrypt in Postgres; salted SHA-256 here (local play only: the hash never leaves the device) */
export const sha256 = async text => hex(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));

export const emptyDb = () => ({ players: {}, duels: {}, events: [], n: 0, fails: [] });

/* the duel as the log says it stands: the same fold the phones run (core.reduce), as pup_outcome() in Postgres.
   The server keeps the status and the record from this, never from what a phone claims */
export function outcomeOf(duel, events) {
  const st = reduce(duel, events.filter(e => e.duel === duel.id));
  return { phase: st.phase, ...summary(st) };
}

/* the wallet as pup_wallet() returns it; made on first use (0002_pup_shop.sql pup_wallet_init) */
const walletRow = w => ({ bones: w.bones, owned: [...w.owned], outfits: w.outfits.map(x => x), ledger: w.ledger.map(x => ({ ...x })), practice: { ...w.practice } });
const ensureWallet = p => (p.wallet ||= legacyWallet(ITEMS, p));
const dayOf = iso => iso.slice(0, 10);
const profile = p => ({ id: p.id, name: p.name, look: p.look, wins: p.wins, losses: p.losses, draws: p.draws, seen_at: p.seen_at });
const duelRow = d => ({ id: d.id, a: d.a, b: d.b, status: d.status, setup: d.setup, result: d.result, created_at: d.created_at, updated_at: d.updated_at });

/* the server: every method is the SQL function of the same name (pup_<name>) */
export function createServer({ db = emptyDb(), now = () => new Date().toISOString(), digest = sha256 } = {}) {
  db.fails ||= [];
  const hashPin = async (pin, salt = hex(globalThis.crypto.getRandomValues(new Uint8Array(8)).buffer)) => `${salt}$${await digest(`${salt}:${pin}`)}`;
  const pinOk = async (pin, stored) => (await hashPin(pin, stored.split('$')[0])) === stored;
  const me = token => Object.values(db.players).find(p => p.token === token) || fail(ERR.token);
  const seen = p => { p.seen_at = now(); };
  let ranking = false;   // set while the queue makes its duel, as the SQL's pup.ranked setting
  /* a ranked duel's end moves both ratings, zero-sum (0003_pup_ranked.sql pup_rate) */
  const rate = (d, o) => {
    const A = db.players[d.a], B = db.players[d.b], ra = A.rating ?? START, rb = B.rating ?? START;
    const x = eloDelta(ra, rb, o.winner == null ? 0.5 : o.winner === d.a ? 1 : 0);
    A.rating = ra + x; B.rating = rb - x; A.ranked = (A.ranked || 0) + 1; B.ranked = (B.ranked || 0) + 1;
  };
  const board = p => ({ id: p.id, name: p.name, look: p.look, rating: p.rating ?? START, ranked: p.ranked || 0, wins: p.wins, losses: p.losses, draws: p.draws, seen_at: p.seen_at });
  const api = {
    db,
    async register(name, pin, look = {}) {
      const n = normName(name);
      if (!SQL_NAME.test(n) || !/[A-Za-z0-9]/.test(n)) fail(ERR.name);
      if (!/^[0-9]{4}$/.test(pin ?? '')) fail(ERR.pin);
      if (bytes(look) > LIMITS.look) fail(ERR.look);
      look = fitWear(look || {}, starterOwned(ITEMS));
      if (Object.values(db.players).some(p => p.name_key === nameKey(n))) fail(ERR.taken);
      const t = now(), p = { id: uuid(), name: n, name_key: nameKey(n), pin_hash: await hashPin(pin), token: uuid(), look: look || {}, wins: 0, losses: 0, draws: 0, created_at: t, seen_at: t };
      db.players[p.id] = p;
      return { ...profile(p), token: p.token };
    },
    /* five wrong PINs for a name in 10 minutes and that name waits (a 4-digit PIN is guessed in minutes otherwise) */
    async login(name, pin) {
      const key = nameKey(name), since = Date.parse(now()) - LIMITS.failMinutes * 60000;
      db.fails = db.fails.filter(f => Date.parse(f.at) > since);
      if (db.fails.filter(f => f.name_key === key).length >= LIMITS.fails) fail(ERR.tries);
      const p = Object.values(db.players).find(x => x.name_key === key);
      if (!p || !(await pinOk(String(pin ?? ''), p.pin_hash))) { db.fails.push({ name_key: key, at: now() }); fail(ERR.login); }
      seen(p);
      return { ...profile(p), token: p.token };
    },
    async touch(token, look = null) {
      const p = me(token);
      if (look !== null && bytes(look) > LIMITS.look) fail(ERR.look);
      seen(p); if (look !== null) p.look = fitWear(look, ensureWallet(p).owned);   // a look wears only what its player owns
      return profile(p);
    },
    async roster(token) {
      seen(me(token));
      return Object.values(db.players).map(profile).sort((x, y) => (x.seen_at < y.seen_at ? 1 : x.seen_at > y.seen_at ? -1 : 0));
    },
    async challenge(token, opponent, setup) {
      const p = me(token);
      if (opponent === p.id) fail(ERR.self);
      if (!db.players[opponent]) fail(ERR.nobody);
      if (!Array.isArray(setup?.questions)) fail(ERR.noQs);
      const nq = setup.questions.length;
      if (nq < LIMITS.minQ || nq > LIMITS.maxQ) fail(ERR.nQs);
      if (setup.rounds !== nq) fail(ERR.rounds);
      if (!Number.isInteger(setup.secs) || setup.secs < LIMITS.minSecs || setup.secs > LIMITS.maxSecs) fail(ERR.secs);
      if (bytes(setup) > LIMITS.setup) fail(ERR.big);
      for (const q of setup.questions) if (!Array.isArray(q?.options) || q.options.length < 2 || q.options.length > 6 || !Number.isInteger(q.answer) || q.answer < 0 || q.answer > q.options.length - 1) fail(ERR.q);
      const { ranked: _, ...plain } = setup;   // only the queue makes a ranked duel (0003_pup_ranked.sql pup_unrank)
      const t = now(), d = { id: uuid(), a: p.id, b: opponent, status: 'invited', setup: ranking ? { ...plain, ranked: true } : plain, result: null, created_at: t, updated_at: t };
      db.duels[d.id] = d; seen(p);
      return duelRow(d);
    },
    async inbox(token) {
      const p = me(token); seen(p);
      const mine = Object.values(db.duels).filter(d => d.a === p.id || d.b === p.id), desc = (x, y) => (x.updated_at < y.updated_at ? 1 : x.updated_at > y.updated_at ? -1 : 0);
      const open = mine.filter(d => d.status === 'invited' || d.status === 'live');
      const past = mine.filter(d => d.status !== 'invited' && d.status !== 'live').sort(desc).slice(0, LIMITS.finished);
      return [...open, ...past].sort(desc).map(duelRow);
    },
    async post(token, duel, id, kind, body = {}) {
      const p = me(token), d = db.duels[duel];
      if (!d || (p.id !== d.a && p.id !== d.b)) fail(ERR.notYours);
      if (!KINDS.includes(kind)) fail(ERR.kind);
      /* a move's id is the one its kind, round and maker give it (core.idFor): nobody can take another's id first */
      const want = idFor(duel, kind, body, p.id);
      if (typeof id !== 'string' || !id || id.length > LIMITS.id || (want.id ? id !== want.id : !id.startsWith(want.prefix))) fail(ERR.id);
      if (bytes(body) > LIMITS.body) fail(ERR.moveBig);
      const old = db.events.find(e => e.id === id);
      if (old) return { ...old };
      const t = now(), e = { n: ++db.n, id, duel, by: p.id, kind, body: body || {}, at: t };
      db.events.push(e);
      /* the status and the record follow the log, once, whatever any phone says */
      const o = outcomeOf(d, db.events);
      if (o.phase !== d.status && !(d.status === 'done' || d.status === 'declined' || d.status === 'cancelled')) {
        d.status = o.phase;
        if (o.phase === 'done') {
          d.result = o;
          if (d.setup?.ranked) rate(d, o);
          for (const id of [d.a, d.b]) { const pl = db.players[id], w = ensureWallet(pl), pay = duelPay(o, id); w.bones += pay.d; w.ledger = logged(w.ledger, pay.d, pay.why, t); }
          if (o.winner === null) { db.players[d.a].draws++; db.players[d.b].draws++; }
          else { db.players[o.winner].wins++; db.players[o.winner === d.a ? d.b : d.a].losses++; }
        }
      }
      d.updated_at = t; seen(p);
      return { ...e };
    },
    /* ---- the shop (0002_pup_shop.sql) ---- */
    async wallet(token) { const p = me(token); seen(p); return walletRow(ensureWallet(p)); },
    async buy(token, ids, total) {
      const p = me(token), w = ensureWallet(p), err = buyError(ITEMS, w, ids, total);
      if (err) fail(err);
      w.bones -= total; w.owned.push(...new Set(ids)); w.ledger = logged(w.ledger, -total, 'buy', now());
      return walletRow(w);
    },
    async practice(token, right) {
      const p = me(token), w = ensureWallet(p), t = now(), r = practicePay(w.practice, right, dayOf(t));
      w.practice = r.practice; if (r.d) { w.bones += r.d; w.ledger = logged(w.ledger, r.d, 'practice', t); }
      return { ...walletRow(w), paid: r.d };
    },
    async outfits(token, list) {
      const p = me(token), w = ensureWallet(p);
      if (!Array.isArray(list) || list.length > OUTFITS) fail(ERR.outfits);
      if (list.some(x => x !== null && bytes(x) > LIMITS.look)) fail(ERR.look);
      w.outfits = list.map(x => (x ? fitWear(x, w.owned) : null));
      return walletRow(w);
    },
    /* ---- ranked (0003_pup_ranked.sql) ---- */
    async queue(token, setup) {
      const p = me(token), t = now(), ms = Date.parse(t);
      seen(p);
      db.queue = (db.queue || []).filter(q => q.duel || ms - Date.parse(q.polled_at) <= STALE);
      let mine = db.queue.find(q => q.player === p.id);
      if (mine?.duel) { db.queue = db.queue.filter(q => q !== mine); return { duel: duelRow(db.duels[mine.duel]) }; }
      if (!mine) { mine = { player: p.id, rating: p.rating ?? START, joined_at: t, polled_at: t, duel: null }; db.queue.push(mine); }
      else { mine.polled_at = t; mine.rating = p.rating ?? START; }
      const opp = pickOpponent(mine, db.queue, ms);
      if (!opp) { const w = windowFor(ms - Date.parse(mine.joined_at)); return { queued: true, since: mine.joined_at, window: Number.isFinite(w) ? w : null }; }
      let d;
      ranking = true;
      try { d = await api.challenge(token, opp.player, setup); } finally { ranking = false; }
      await api.post(db.players[opp.player].token, d.id, `${d.id}/accept`, 'accept', {});
      opp.duel = d.id; db.queue = db.queue.filter(q => q !== mine);
      return { duel: duelRow(db.duels[d.id]) };
    },
    async unqueue(token) { const p = me(token); db.queue = (db.queue || []).filter(q => q.player !== p.id); return { queued: false }; },
    /* everyone on the ladder, with their wins in the last 7 days */
    async leaderboard(token) {
      seen(me(token));
      const since = Date.parse(now()) - 7 * 864e5, done = Object.values(db.duels).filter(d => d.status === 'done' && Date.parse(d.updated_at) > since);
      return Object.values(db.players).map(p => ({ ...board(p), week: done.filter(d => d.result?.winner === p.id).length }));
    },
    async log(token, duel, after = 0) {
      const p = me(token), d = db.duels[duel];
      if (!d || (p.id !== d.a && p.id !== d.b)) fail(ERR.notYours);
      return { duel: duelRow(d), rows: db.events.filter(e => e.duel === duel && e.n > (after || 0)).slice(0, LIMITS.page).map(e => ({ ...e })) };
    }
  };
  return api;
}
