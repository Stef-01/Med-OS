/* server-core.mjs: supabase/migrations/0001_pup_duel.sql written again in JavaScript, over a plain object, so the
   local and memory transports (and scripts/fake-supabase.mjs) behave like the real backend: the same rules, the same
   error messages, the same rows. test/sql-parity.test.mjs pins the two; test/sql.test.mjs runs the same scenario
   against a real Postgres when one is at hand.

   db { players: {id: player}, duels: {id: duel}, events: [row], n } is JSON all the way down, so a transport can keep
   it in localStorage. */

import { normName, nameKey } from './accounts.mjs';
import { KINDS } from './core.mjs';

export const ERR = {
  name: 'Pick a name of 2 to 20 letters or numbers', pin: 'The PIN is 4 digits', look: 'That look is too big',
  taken: 'That name is taken', login: 'Wrong name or PIN', token: 'Sign in again', self: 'Pick a mate, not yourself',
  nobody: 'No such player', noQs: 'A duel needs questions', nQs: 'A duel has 1 to 15 questions',
  rounds: 'Rounds must match the questions', secs: 'A question lasts 5 to 120 seconds', big: 'That duel is too big',
  q: 'A question needs 2 to 6 options and its answer', notYours: 'Not your duel', kind: 'Unknown move',
  id: 'Bad move id', moveBig: 'That move is too big'
};
export const LIMITS = { look: 2048, setup: 65536, body: 4096, id: 200, page: 200, finished: 20, minQ: 1, maxQ: 15, minSecs: 5, maxSecs: 120 };
const SQL_NAME = /^[A-Za-z0-9 ._-]{2,20}$/;

export class DuelError extends Error {}
const fail = m => { throw new DuelError(m); };
const bytes = v => new TextEncoder().encode(JSON.stringify(v ?? {})).length;
const uuid = () => globalThis.crypto.randomUUID();
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');

/* bcrypt in Postgres; salted SHA-256 here (local play only: the hash never leaves the device) */
export const sha256 = async text => hex(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));

export const emptyDb = () => ({ players: {}, duels: {}, events: [], n: 0 });

const profile = p => ({ id: p.id, name: p.name, look: p.look, wins: p.wins, losses: p.losses, draws: p.draws, seen_at: p.seen_at });
const duelRow = d => ({ id: d.id, a: d.a, b: d.b, status: d.status, setup: d.setup, result: d.result, created_at: d.created_at, updated_at: d.updated_at });

/* the server: every method is the SQL function of the same name (pup_<name>) */
export function createServer({ db = emptyDb(), now = () => new Date().toISOString(), sleep = () => Promise.resolve(), digest = sha256 } = {}) {
  const hashPin = async (pin, salt = hex(globalThis.crypto.getRandomValues(new Uint8Array(8)).buffer)) => `${salt}$${await digest(`${salt}:${pin}`)}`;
  const pinOk = async (pin, stored) => (await hashPin(pin, stored.split('$')[0])) === stored;
  const me = token => Object.values(db.players).find(p => p.token === token) || fail(ERR.token);
  const seen = p => { p.seen_at = now(); };
  return {
    db,
    async register(name, pin, look = {}) {
      const n = normName(name);
      if (!SQL_NAME.test(n) || !/[A-Za-z0-9]/.test(n)) fail(ERR.name);
      if (!/^[0-9]{4}$/.test(pin ?? '')) fail(ERR.pin);
      if (bytes(look) > LIMITS.look) fail(ERR.look);
      if (Object.values(db.players).some(p => p.name_key === nameKey(n))) fail(ERR.taken);
      const t = now(), p = { id: uuid(), name: n, name_key: nameKey(n), pin_hash: await hashPin(pin), token: uuid(), look: look || {}, wins: 0, losses: 0, draws: 0, created_at: t, seen_at: t };
      db.players[p.id] = p;
      return { ...profile(p), token: p.token };
    },
    async login(name, pin) {
      const p = Object.values(db.players).find(x => x.name_key === nameKey(name));
      if (!p || !(await pinOk(String(pin ?? ''), p.pin_hash))) { await sleep(400); fail(ERR.login); }
      seen(p);
      return { ...profile(p), token: p.token };
    },
    async touch(token, look = null) {
      const p = me(token);
      if (look !== null && bytes(look) > LIMITS.look) fail(ERR.look);
      seen(p); if (look !== null) p.look = look;
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
      const t = now(), d = { id: uuid(), a: p.id, b: opponent, status: 'invited', setup, result: null, created_at: t, updated_at: t };
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
      if (typeof id !== 'string' || !id || id.length > LIMITS.id || !id.startsWith(`${duel}/`)) fail(ERR.id);
      if (bytes(body) > LIMITS.body) fail(ERR.moveBig);
      const old = db.events.find(e => e.id === id);
      if (old) return { ...old };
      const t = now(), e = { n: ++db.n, id, duel, by: p.id, kind, body: body || {}, at: t };
      db.events.push(e);
      if (kind === 'accept' && d.status === 'invited' && p.id === d.b) d.status = 'live';
      else if (kind === 'decline' && d.status === 'invited' && p.id === d.b) d.status = 'declined';
      else if (kind === 'leave' && d.status === 'invited') d.status = p.id === d.a ? 'cancelled' : 'declined';
      else if (kind === 'final' && d.status === 'live') {
        d.status = 'done'; d.result = body || {};
        const w = body?.winner || null;
        if (w === null) { db.players[d.a].draws++; db.players[d.b].draws++; }
        else if (w === d.a || w === d.b) { db.players[w].wins++; db.players[w === d.a ? d.b : d.a].losses++; }
      }
      d.updated_at = t; seen(p);
      return { ...e };
    },
    async log(token, duel, after = 0) {
      const p = me(token), d = db.duels[duel];
      if (!d || (p.id !== d.a && p.id !== d.b)) fail(ERR.notYours);
      return { duel: duelRow(d), rows: db.events.filter(e => e.duel === duel && e.n > (after || 0)).slice(0, LIMITS.page).map(e => ({ ...e })) };
    }
  };
}
