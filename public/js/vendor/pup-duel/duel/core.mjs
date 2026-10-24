/* core.mjs: the duel's laws, pure. Both phones fold the same event log with reduce() and get the same game.
   docs/architecture.md is the design; test/core.test.mjs pins every rule here.

   duel   { id, a, b, setup }            a challenged b; setup is makeSetup()'s output
   row    { n, id, duel, by, kind, body, at }   n is the server's order; id is deterministic (evId), so a retry or a
                                                 second copy of a row is the same row */

import { rng, shuffle } from './rng.mjs';

export const RULES = {
  rounds: 7, secs: 20, readyMs: 3000, revealMs: 3500, graceMs: 8000, forfeitAfter: 3,
  maxQuestions: 15, minSecs: 5, maxSecs: 120, maxSetupBytes: 65536,
  roundChoices: [5, 7, 10], secsChoices: [15, 20, 30]
};
export const KINDS = ['accept', 'decline', 'answer', 'timeout', 'emote', 'leave', 'final', 'rematch'];
export const EMOTES = { gg: 'GG', woof: 'Woof!', wow: 'Nice one', close: 'So close', again: 'Rematch?' };
export const PHASES = ['invited', 'live', 'done', 'declined', 'cancelled'];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/* ---- setting a duel up ---- */

/* the challenger's phone deals the questions (seeded, so a test can pin a deal) and shuffles each one's options;
   the questions travel inside the duel, so both phones play the same ones whatever pack each has cached */
export function makeSetup(pack, { rounds = RULES.rounds, secs = RULES.secs, topic = '', seed = 1, title = '' } = {}) {
  const r = rng(seed), pool = (pack?.questions || []).filter(q => !topic || q.topic === topic);
  const picked = shuffle(r, pool).slice(0, clamp(Math.floor(rounds) || RULES.rounds, 1, RULES.maxQuestions));
  const questions = picked.map(q => {
    const order = shuffle(r, q.options.map((_, i) => i));
    const out = { id: q.id, stem: q.stem, options: order.map(i => q.options[i]), answer: order.indexOf(q.answer) };
    if (q.why) out.why = q.why;
    if (q.notes) out.notes = order.map(i => q.notes[i] ?? null);
    if (q.topic) out.topic = q.topic;
    if (q.origin) out.origin = q.origin;
    return out;
  });
  return { v: 1, rounds: questions.length, secs: clamp(Math.round(secs) || RULES.secs, RULES.minSecs, RULES.maxSecs), title: String(title || pack?.title || '').slice(0, 80), topic: topic || '', seed: seed >>> 0, questions };
}

/* the same checks pup_challenge makes in Postgres; '' when the setup can be played */
export function setupError(s) {
  if (!s || typeof s !== 'object') return 'no setup';
  if (!Array.isArray(s.questions) || s.questions.length < 1 || s.questions.length > RULES.maxQuestions) return `1 to ${RULES.maxQuestions} questions`;
  if (s.rounds !== s.questions.length) return 'rounds must match the questions';
  if (!Number.isInteger(s.secs) || s.secs < RULES.minSecs || s.secs > RULES.maxSecs) return `${RULES.minSecs} to ${RULES.maxSecs} seconds a question`;
  for (const q of s.questions) {
    if (!q || typeof q.stem !== 'string' || !q.stem) return 'a question without a stem';
    if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 6) return '2 to 6 options a question';
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length) return 'an answer out of range';
  }
  if (new TextEncoder().encode(JSON.stringify(s)).length > RULES.maxSetupBytes) return 'the setup is too big';
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

/* Kahoot's points, halved for a slow answer: 500 to 1000 for a right one, +100 a right answer in a row before it
   (at most +300); 0 for wrong or none */
export function points(ok, ms, secs, run = 0) {
  if (!ok) return 0;
  const t = clamp(ms / (secs * 1000), 0, 1);
  return 500 + Math.round(500 * (1 - t)) + 100 * clamp(run, 0, 3);
}

export const other = (st, p) => (p === st.a ? st.b : st.a);

function fresh(duel) {
  const { id, a, b, setup } = duel, zero = () => ({ [a]: 0, [b]: 0 });
  return {
    id, a, b, setup, phase: 'invited', round: 0, last: 0,
    rounds: (setup?.questions || []).map(() => ({ answers: {}, closed: false, closedN: 0 })),
    score: zero(), right: zero(), time: zero(), run: zero(), idle: zero(),
    winner: null, reason: '', emotes: [], finals: [], rematch: null
  };
}

function finish(st, reason, winner) {
  st.phase = 'done'; st.reason = reason;
  if (winner !== undefined) { st.winner = winner; return; }
  const { a, b } = st, sa = st.score[a], sb = st.score[b];
  /* a tie on points goes to the faster on right answers; 0 to 0 is a draw */
  st.winner = sa !== sb ? (sa > sb ? a : b) : sa > 0 && st.time[a] !== st.time[b] ? (st.time[a] < st.time[b] ? a : b) : null;
}

function record(st, who, entry, n) {
  const R = st.rounds[st.round];
  R.answers[who] = { ...entry, n };
  const opp = other(st, who);
  if (R.answers[opp]) {
    R.closed = true; R.closedN = n; st.round++;
    if (st.round >= st.rounds.length) finish(st, 'end');
  }
}

/* the whole game from the log: rows in any order, any number of copies */
export function reduce(duel, rows) {
  const st = fresh(duel), secs = duel.setup?.secs || RULES.secs, players = [st.a, st.b], seen = new Set();
  const sorted = (rows || []).filter(r => r && r.duel === duel.id).slice().sort((x, y) => x.n - y.n);
  for (const row of sorted) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    st.last = Math.max(st.last, row.n);
    const by = row.by, body = row.body || {};
    if (!players.includes(by)) continue;
    switch (row.kind) {
      case 'accept': if (st.phase === 'invited' && by === st.b) st.phase = 'live'; break;
      case 'decline': if (st.phase === 'invited' && by === st.b) st.phase = 'declined'; break;
      case 'leave':
        if (st.phase === 'invited') st.phase = by === st.a ? 'cancelled' : 'declined';
        else if (st.phase === 'live') finish(st, 'leave', other(st, by));
        break;
      case 'answer': {
        if (st.phase !== 'live' || body.round !== st.round) break;
        const R = st.rounds[st.round], q = st.setup.questions[st.round];
        if (R.answers[by]) break;
        const choice = Number.isInteger(body.choice) && body.choice >= 0 && body.choice < q.options.length ? body.choice : null;
        const ms = clamp(Math.round(Number(body.ms) || 0), 0, secs * 1000), ok = choice === q.answer;
        const pts = points(ok, ms, secs, st.run[by]);
        st.score[by] += pts; st.run[by] = ok ? st.run[by] + 1 : 0; st.idle[by] = 0;
        if (ok) { st.right[by]++; st.time[by] += ms; }
        record(st, by, { choice, ms, ok, pts, how: 'answer' }, row.n);
        break;
      }
      case 'timeout': {
        const who = body.for;
        if (st.phase !== 'live' || body.round !== st.round || !players.includes(who) || who === by) break;
        const R = st.rounds[st.round];
        if (R.answers[who]) break;
        st.run[who] = 0; st.idle[who]++;
        record(st, who, { choice: null, ms: secs * 1000, ok: false, pts: 0, how: 'timeout' }, row.n);
        if (st.phase === 'live' && st.idle[who] >= RULES.forfeitAfter) finish(st, 'forfeit', by);
        break;
      }
      case 'emote': if (EMOTES[body.e]) { st.emotes.push({ by, e: body.e, n: row.n }); if (st.emotes.length > 12) st.emotes.shift(); } break;
      case 'final': st.finals.push({ by, n: row.n }); break;
      case 'rematch': if (st.phase === 'done' && typeof body.duel === 'string') st.rematch = { by, duel: body.duel }; break;
    }
  }
  return st;
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
   opens the next after the reveal */
export function stepClock(clock, st, now, rules = RULES) {
  const c = { liveAt: clock.liveAt, openAt: { ...clock.openAt }, closedAt: { ...clock.closedAt } };
  if (c.liveAt === null && (st.phase === 'live' || (st.phase === 'done' && st.rounds.some(r => r.closed)))) { c.liveAt = now; c.openAt[0] = now + rules.readyMs; }
  st.rounds.forEach((R, i) => {
    if (R.closed && c.closedAt[i] === undefined) { c.closedAt[i] = now; if (i + 1 < st.rounds.length) c.openAt[i + 1] = Math.max(now + rules.revealMs, c.openAt[i] ?? 0); }
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
  const mine = st.rounds[r].answers[me], left = st.setup.secs * 1000 - (now - open);
  return mine ? { name: 'locked', round: r, left: Math.max(0, left) } : { name: 'question', round: r, left: Math.max(0, left) };
}

/* what this phone must post now: its own blank answer when its time is up; a timeout for the other player when
   they are silent past their time and the grace */
export function due(st, clock, now, me, rules = RULES) {
  if (st.phase !== 'live') return [];
  const r = st.round, open = clock.openAt[r];
  if (open === undefined) return [];
  const R = st.rounds[r], end = open + st.setup.secs * 1000, opp = other(st, me), out = [];
  if (!R.answers[me] && now >= end) out.push({ kind: 'answer', round: r, choice: null, ms: st.setup.secs * 1000 });
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
  const end = open + st.setup.secs * 1000, edges = [open, end, end + rules.graceMs].filter(t => t > now);
  return edges.length ? Math.min(...edges) : null;
}
