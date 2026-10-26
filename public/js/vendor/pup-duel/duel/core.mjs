/* core.mjs: the duel's laws, pure. Both phones fold the same event log with reduce() and get the same game.
   docs/architecture.md is the design; test/core.test.mjs pins every rule here.

   duel   { id, a, b, setup }            a challenged b; setup is makeSetup()'s output
   row    { n, id, duel, by, kind, body, at }   n is the server's order; id is deterministic (evId), so a retry or a
                                                 second copy of a row is the same row */

import { rng, shuffle } from './rng.mjs';
import { ProcessGameConfig, CreateGameReducer, InitializeGame, INVALID_MOVE, ActivePlayers, makeMove, setLogger } from '../engine/index.mjs';

export const RULES = {
  rounds: 7, secs: 20, readyMs: 3000, revealMs: 3500, graceMs: 8000, forfeitAfter: 3,
  maxQuestions: 15, minSecs: 5, maxSecs: 120, maxSetupBytes: 65536,
  roundChoices: [5, 7, 10], secsChoices: [15, 20, 30]
};
export const KINDS = ['accept', 'decline', 'answer', 'timeout', 'emote', 'leave', 'final', 'rematch'];
export const EMOTES = { gg: 'GG', woof: 'Woof!', wow: 'Nice one', close: 'So close', again: 'Rematch?' };
export const PHASES = ['invited', 'live', 'done', 'declined', 'cancelled'];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/* reading time (founder 2026-10-25: "the questions are way too much text for the time"): the seconds a player picks are
   for thinking; each question adds the time to read it, at 4 words a second (240 a minute, a quick clinical reader),
   past the first 12 words. A one-line question keeps the pick; a 120-word vignette with five options gets about 30
   seconds more. The question carries its own secs in the setup, so both phones and Postgres time it the same */
export const READ = { wps: 4, free: 12 };
export const words = s => (String(s || '').match(/\S+/g) || []).length;
export const readSecs = q => Math.max(0, Math.ceil((words(q?.stem) + (q?.options || []).reduce((n, o) => n + words(o), 0) - READ.free) / READ.wps));
/* a round's seconds: its question's own, else the setup's (a duel from before reading time) */
export function secsOf(setup, r) {
  const q = setup?.questions?.[r], s = q?.secs;
  return Number.isInteger(s) && s >= RULES.minSecs && s <= RULES.maxSecs ? s : setup?.secs || RULES.secs;
}

/* the bytes Postgres counts for a jsonb value (octet_length(v::text)): JSON with a space after every ':' and ',',
   so a size limit means the same thing in the browser, in server-core.mjs and in the migration */
export function jsonbBytes(v) {
  let seps = 0;
  const walk = x => {
    if (Array.isArray(x)) { seps += Math.max(0, x.length - 1); x.forEach(walk); }
    else if (x && typeof x === 'object') { const k = Object.keys(x).filter(key => x[key] !== undefined); seps += k.length + Math.max(0, k.length - 1); k.forEach(key => walk(x[key])); }
  };
  walk(v ?? {});
  return new TextEncoder().encode(JSON.stringify(v ?? {})).length + seps;
}

/* ---- setting a duel up ---- */

/* the challenger's phone deals the questions (seeded, so a test can pin a deal) and shuffles each one's options;
   the questions travel inside the duel, so both phones play the same ones whatever pack each has cached */
export function makeSetup(pack, { rounds = RULES.rounds, secs = RULES.secs, topic = '', cat = '', seed = 1, title = '', read = true } = {}) {
  const base = clamp(Math.round(secs) || RULES.secs, RULES.minSecs, RULES.maxSecs);
  const r = rng(seed), pool = (pack?.questions || []).filter(q => (!topic || q.topic === topic || (q.topics || []).includes(topic)) && (!cat || q.cat === cat));
  const picked = shuffle(r, pool).slice(0, clamp(Math.floor(rounds) || RULES.rounds, 1, RULES.maxQuestions));
  const questions = picked.map(q => {
    const order = shuffle(r, q.options.map((_, i) => i));
    const out = { id: q.id, stem: q.stem, options: order.map(i => q.options[i]), answer: order.indexOf(q.answer) };
    if (read) out.secs = clamp(base + readSecs(q), RULES.minSecs, RULES.maxSecs);   /* read: false keeps one time for every question */
    if (q.why) out.why = q.why;
    if (q.notes) out.notes = order.map(i => q.notes[i] ?? null);
    if (q.topic) out.topic = q.topic;
    if (q.cat) { out.cat = q.cat; const l = (pack?.cats || []).find(c => c.id === q.cat)?.label; if (l) out.catLabel = String(l).slice(0, 60); }
    if (q.origin) out.origin = q.origin;
    if (q.source) out.source = q.source;
    return out;
  });
  return { v: 1, rounds: questions.length, secs: base, title: String(title || pack?.title || '').slice(0, 80), topic: topic || '', ...(cat ? { cat: String(cat).slice(0, 30), catLabel: String((pack?.cats || []).find(c => c.id === cat)?.label || cat).slice(0, 60) } : {}), seed: seed >>> 0, questions };
}

/* the same checks pup_challenge makes in Postgres; '' when the setup can be played */
export function setupError(s) {
  if (!s || typeof s !== 'object') return 'no setup';
  if (!Array.isArray(s.questions) || s.questions.length < 1 || s.questions.length > RULES.maxQuestions) return `1 to ${RULES.maxQuestions} questions`;
  if (s.rounds !== s.questions.length) return 'rounds must match the questions';
  if (!Number.isInteger(s.secs) || s.secs < RULES.minSecs || s.secs > RULES.maxSecs) return `${RULES.minSecs} to ${RULES.maxSecs} seconds a question`;
  if (s.questions.some(q => q?.secs !== undefined && (!Number.isInteger(q.secs) || q.secs < RULES.minSecs || q.secs > RULES.maxSecs))) return `${RULES.minSecs} to ${RULES.maxSecs} seconds a question`;
  for (const q of s.questions) {
    if (!q || typeof q.stem !== 'string' || !q.stem) return 'a question without a stem';
    if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 6) return '2 to 6 options a question';
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length) return 'an answer out of range';
  }
  if (jsonbBytes(s) > RULES.maxSetupBytes) return 'the setup is too big';
  return '';
}

/* ---- events ---- */

/* deterministic ids: the second copy of an answer, or a retry of one that did land, is the same row; and "one answer
   per player per round" is a unique key in the log */
export function evId(duel, kind, { round, who, nonce } = {}) {
  switch (kind) {
    case 'answer': return `${duel}/a/${round}/${who}`;
    case 'timeout': return `${duel}/t/${round}/${who}`;   // who: the player who is out of time
    case 'accept': case 'decline': return `${duel}/${kind}`;
    case 'leave': case 'final': case 'rematch': return `${duel}/${kind}/${who}`;
    case 'emote': return `${duel}/e/${who}/${nonce}`;
    default: throw new Error(`unknown kind ${kind}`);
  }
}

/* the id a move must have, given who makes it: the server refuses any other, so nobody can take a move's id before
   its owner does (an emote's id has a free tail: { prefix }) */
export function idFor(duel, kind, body, by) {
  const b = body || {};
  switch (kind) {
    case 'answer': return { id: `${duel}/a/${b.round ?? ''}/${by}` };
    case 'timeout': return { id: `${duel}/t/${b.round ?? ''}/${b.for ?? ''}` };
    case 'accept': case 'decline': return { id: `${duel}/${kind}` };
    case 'leave': case 'final': case 'rematch': return { id: `${duel}/${kind}/${by}` };
    case 'emote': return { prefix: `${duel}/e/${by}/` };
    default: return { id: null };
  }
}

/* Kahoot's points, halved for a slow answer: 500 to 1000 for a right one, +100 a right answer in a row before it
   (at most +300); 0 for wrong or none. Integer arithmetic (half rounds up), so Postgres gets the same number */
export function points(ok, ms, secs, run = 0) {
  if (!ok) return 0;
  const T = secs * 1000, m = clamp(Math.round(ms), 0, T);
  return 500 + Math.floor((1000 * (T - m) + T) / (2 * T)) + 100 * clamp(run, 0, 3);
}

export const other = (st, p) => (p === st.a ? st.b : st.a);

/* ---- the game, on the engine ----
   The duel is a boardgame.io Game (src/engine/, the engine of boardgame.io ported from its source; its LICENSE is
   MIT), and the engine folds the log: phases invited, live, done, declined and cancelled, each a set of moves; both
   players act at once in every phase (ActivePlayers.ALL: nobody waits for a turn); a row is a move by the player who
   posted it, '0' the challenger (a) and '1' the mate (b); a move the rules refuse is INVALID_MOVE, which leaves the
   game as it was (a row out of turn, a second answer, an accept from the challenger). G is the game the screens and
   the server read, keyed by the players' own ids; a phase ends when its moves move G.phase on (its endIf), and
   `done` is a phase rather than the engine's gameover, so emotes, finals and a rematch still land after the last
   round. The engine is the authority for the order of things inside a phone; the server's log (pup_post, pup_log in
   Postgres) is the authority for which rows exist and in what order. */

const zero = (a, b) => ({ [a]: 0, [b]: 0 });

function finish(G, reason, winner, a, b) {
  G.phase = 'done'; G.reason = reason;
  if (winner !== undefined) { G.winner = winner; return; }
  const sa = G.score[a], sb = G.score[b];
  /* a tie on points goes to the faster on right answers; 0 to 0 is a draw */
  G.winner = sa !== sb ? (sa > sb ? a : b) : sa > 0 && G.time[a] !== G.time[b] ? (G.time[a] < G.time[b] ? a : b) : null;
}

/* the Game for one duel: its questions and players close over the moves, so G carries only what changes */
export function duelGame(duel, rules = RULES) {
  const { a, b } = duel, qs = duel.setup?.questions || [], secsAt = r => secsOf(duel.setup, r);
  const who = playerID => (playerID === '0' ? a : b), opp = p => (p === a ? b : a);
  function record(G, p, entry, n) {
    const R = G.rounds[G.round];
    R.answers[p] = { ...entry, n };
    if (R.answers[opp(p)]) {
      R.closed = true; R.closedN = n; G.round++;
      if (G.round >= G.rounds.length) finish(G, 'end', undefined, a, b);
    }
  }
  const moves = {
    accept({ G, playerID }, { n }) { if (who(playerID) !== b) return INVALID_MOVE; G.phase = 'live'; G.liveN = n; },
    decline({ G, playerID }) { if (who(playerID) !== b) return INVALID_MOVE; G.phase = 'declined'; },
    leave({ G, playerID }) {
      if (G.phase === 'invited') G.phase = who(playerID) === a ? 'cancelled' : 'declined';
      else finish(G, 'leave', opp(who(playerID)), a, b);
    },
    answer({ G, playerID }, body) {
      const p = who(playerID), R = G.rounds[G.round], q = qs[G.round];
      if (body.round !== G.round || !R || !q || R.answers[p]) return INVALID_MOVE;
      const choice = Number.isInteger(body.choice) && body.choice >= 0 && body.choice < q.options.length ? body.choice : null;
      const secs = secsAt(G.round), ms = typeof body.ms === 'number' && !Number.isNaN(body.ms) ? clamp(Math.round(body.ms), 0, secs * 1000) : 0, ok = choice === q.answer;
      const pts = points(ok, ms, secs, G.run[p]);
      G.score[p] += pts; G.run[p] = ok ? G.run[p] + 1 : 0; G.idle[p] = 0;
      if (ok) { G.right[p]++; G.time[p] += ms; }
      record(G, p, { choice, ms, ok, pts, how: 'answer' }, body.n);
    },
    timeout({ G, playerID }, body) {
      const by = who(playerID), late = body.for, R = G.rounds[G.round];
      if (body.round !== G.round || (late !== a && late !== b) || late === by || !R || R.answers[late]) return INVALID_MOVE;
      G.run[late] = 0; G.idle[late]++;
      record(G, late, { choice: null, ms: secsAt(G.round) * 1000, ok: false, pts: 0, how: 'timeout' }, body.n);
      if (G.phase === 'live' && G.idle[late] >= rules.forfeitAfter) finish(G, 'forfeit', by, a, b);
    },
    emote({ G, playerID }, { e, n }) { if (!EMOTES[e]) return INVALID_MOVE; G.emotes.push({ by: who(playerID), e, n }); if (G.emotes.length > 12) G.emotes.shift(); },
    final({ G, playerID }, { n }) { G.finals.push({ by: who(playerID), n }); },
    rematch({ G, playerID }, { duel: next }) { if (typeof next !== 'string') return INVALID_MOVE; G.rematch = { by: who(playerID), duel: next }; }
  };
  const pick = (...names) => Object.fromEntries(names.map(k => [k, moves[k]]));
  const phase = (name, names, start = false) => ({ start, moves: pick(...names), turn: { activePlayers: ActivePlayers.ALL }, endIf: ({ G }) => G.phase !== name, next: ({ G }) => G.phase });
  return {
    name: 'pup-duel', disableLog: true, seed: duel.setup?.seed ?? 1,
    setup: () => ({
      phase: 'invited', round: 0, liveN: 0,
      rounds: qs.map(() => ({ answers: {}, closed: false, closedN: 0 })),
      score: zero(a, b), right: zero(a, b), time: zero(a, b), run: zero(a, b), idle: zero(a, b),
      winner: null, reason: '', emotes: [], finals: [], rematch: null
    }),
    phases: {
      invited: phase('invited', ['accept', 'decline', 'leave', 'emote', 'final'], true),
      live: phase('live', ['leave', 'answer', 'timeout', 'emote', 'final']),
      done: phase('done', ['emote', 'final', 'rematch']),
      declined: phase('declined', ['emote', 'final']),
      cancelled: phase('cancelled', ['emote', 'final'])
    }
  };
}

/* the engine says why it refused a move (a late answer, a second copy of a rematch): in a duel that is the rules
   working, not an error, so it goes to this short list (a debugger reads it) instead of the phone's console */
export const refusals = [];
setLogger({ info: () => {}, error: (...m) => { refusals.push(m.join(' ')); if (refusals.length > 50) refusals.shift(); } });

/* the engine for a duel, made once: its questions do not change once it is dealt. The start state is made afresh for
   every fold: the engine's reducer writes into the state it is given (its move counters), so a shared one would carry
   one fold's moves into the next */
const engines = new WeakMap();
function engineFor(duel) {
  const key = duel.setup || duel, hit = engines.get(key);
  if (hit && hit.a === duel.a && hit.b === duel.b) return hit;
  const game = ProcessGameConfig(duelGame(duel));
  const made = { a: duel.a, b: duel.b, game, reducer: CreateGameReducer({ game }) };
  engines.set(key, made);
  return made;
}

/* the whole game from the log: rows in any order, any number of copies. Each row is a move on the engine, in the
   server's order; a row from neither player is not a move at all */
export function reduce(duel, rows) {
  const { game, reducer } = engineFor(duel), seen = new Set();
  const sorted = (rows || []).filter(r => r && r.duel === duel.id).slice().sort((x, y) => x.n - y.n);
  let state = InitializeGame({ game, numPlayers: 2 }), last = 0;
  for (const row of sorted) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    last = Math.max(last, row.n);
    if ((row.by !== duel.a && row.by !== duel.b) || !KINDS.includes(row.kind)) continue;
    const body = row.body && typeof row.body === 'object' && !Array.isArray(row.body) ? row.body : {};
    state = reducer(state, makeMove(row.kind, [{ ...body, n: row.n }], row.by === duel.a ? '0' : '1'));
  }
  return { id: duel.id, a: duel.a, b: duel.b, setup: duel.setup, ...state.G, last, engine: { phase: state.ctx.phase, turn: state.ctx.turn } };
}

/* how the duel ended for me */
export function outcome(st, me) {
  if (st.phase !== 'done') return null;
  return st.winner === null ? 'draw' : st.winner === me ? 'win' : 'loss';
}
/* what a final event carries (the record kept in pup_duels.result) */
export const summary = st => ({ score: st.score, right: st.right, winner: st.winner, reason: st.reason, rounds: st.rounds.length });

/* ---- the clock: each phone times itself; nothing compares clocks ----
   clock { liveAt, openAt: {round: ms}, closedAt: {round: ms} }, in this phone's own milliseconds */
export const newClock = () => ({ liveAt: null, openAt: {}, closedAt: {} });

/* note what this phone has just seen: the duel going live opens round 0 after a short countdown; a round closing
   opens the next after the reveal. Normally "when" is now, the moment this phone learned it. `past(n)`, given on a
   reload, says when row n happened on this phone's clock (from the server's timestamp), so a phone that comes back
   mid-round sees the time its opponent sees, not a fresh clock (never later than now, never more than 10 min back) */
export function stepClock(clock, st, now, rules = RULES, past = null) {
  const c = { liveAt: clock.liveAt, openAt: { ...clock.openAt }, closedAt: { ...clock.closedAt } };
  const when = n => { const t = past ? past(n) : undefined; return typeof t === 'number' && Number.isFinite(t) ? clamp(t, now - 600000, now) : now; };
  if (c.liveAt === null && (st.phase === 'live' || (st.phase === 'done' && st.rounds.some(r => r.closed)))) { const t = when(st.liveN); c.liveAt = t; c.openAt[0] = t + rules.readyMs; }
  st.rounds.forEach((R, i) => {
    if (R.closed && c.closedAt[i] === undefined) { const t = when(R.closedN); c.closedAt[i] = t; if (i + 1 < st.rounds.length) c.openAt[i + 1] = Math.max(t + rules.revealMs, c.openAt[i] ?? 0); }
  });
  return c;
}

/* where this phone is in the game, for the screen */
export function stage(st, clock, now, me) {
  if (st.phase !== 'live') {
    if (st.phase === 'done' && st.rounds.some(r => r.closed)) {
      const lastClosed = st.rounds.reduce((k, R, i) => (R.closed ? i : k), -1), t = clock.closedAt[lastClosed];
      if (st.reason === 'end' && t !== undefined && now < t + RULES.revealMs) return { name: 'reveal', round: lastClosed };
    }
    return { name: st.phase };
  }
  const r = st.round, open = clock.openAt[r];
  if (open === undefined) return { name: 'wait', round: r };
  if (now < open) return r === 0 ? { name: 'ready', round: 0, left: open - now } : { name: 'reveal', round: r - 1, left: open - now };
  const mine = st.rounds[r].answers[me], left = secsOf(st.setup, r) * 1000 - (now - open);
  return mine ? { name: 'locked', round: r, left: Math.max(0, left) } : { name: 'question', round: r, left: Math.max(0, left) };
}

/* what this phone must post now: its own blank answer when its time is up; a timeout for the other player when
   they are silent past their time and the grace */
export function due(st, clock, now, me, rules = RULES) {
  if (st.phase !== 'live') return [];
  const r = st.round, open = clock.openAt[r];
  if (open === undefined) return [];
  const R = st.rounds[r], T = secsOf(st.setup, r) * 1000, end = open + T, opp = other(st, me), out = [];
  if (!R.answers[me] && now >= end) out.push({ kind: 'answer', round: r, choice: null, ms: T });
  if (R.answers[me] && !R.answers[opp] && now >= end + rules.graceMs) out.push({ kind: 'timeout', round: r, for: opp });
  return out;
}

/* when due() or stage() will next change, so a session sleeps until then and not a moment longer */
export function nextEdge(st, clock, now, me, rules = RULES) {
  if (st.phase !== 'live') {
    const s = stage(st, clock, now, me);
    return s.name === 'reveal' ? clock.closedAt[s.round] + rules.revealMs : null;
  }
  const r = st.round, open = clock.openAt[r];
  if (open === undefined) return null;
  const end = open + secsOf(st.setup, r) * 1000, edges = [open, end, end + rules.graceMs].filter(t => t > now);
  return edges.length ? Math.min(...edges) : null;
}
