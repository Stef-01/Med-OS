/* library/sched.mjs - when a question comes back in Study: FSRS-6 (founder 2026-10-26, research: "replace SM-2 with
   FSRS-6 at its published defaults"; in the open SRS benchmark of ~10,000 Anki users FSRS-6 predicts recall better than
   SM-2 for 99.6 % of them). A port of open-spaced-repetition/py-fsrs 6.3.2 fsrs/scheduler.py (MIT, Jarrett Ye and
   Joshua Hamilton); the formulas are the FSRS-6 section of awesome-fsrs's The Algorithm. Checked against ts-fsrs 5.4.2
   (the copy Optimus Learn ships) on 10,835 simulated reviews: the memory model matched on every one.

   Four buttons: Again, Hard, Good, Easy. A card is
     { st (1 learning, 2 review, 3 relearning), step, s (stability, days), d (difficulty 1..10), due, lr (last review),
       reps, lapses }  (times in ms; stats.mjs adds r, w, last; plan.mjs reads f and note)
   A question never studied has no card, or one with no st. A card from the SM-2 days ({ ivl, ease }) is converted on
   its next grade (FSRS's memory_state_from_sm2). Retention 90 %, one learning step and one relearning step of 10 minutes
   (the research's default: as few steps under a day as possible, so a right answer graduates and a miss comes back),
   at most 100 years; intervals of 3 days and more are fuzzed a little so a day's cards do not bunch. Pure (the fuzz
   takes rnd). */

export const W = Object.freeze([0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796,
  1.4835, 0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542]);
export const GRADES = Object.freeze(['again', 'hard', 'good', 'easy']);
export const RETENTION = 0.9, NEW_A_DAY = 20, DAY = 864e5;
const MIN = 6e4, LEARN = [10 * MIN], RELEARN = [10 * MIN], MAX_IVL = 36500, S_MIN = 0.001, S_MAX = 36500;
const DECAY = -W[20], FACTOR = Math.pow(0.9, 1 / DECAY) - 1;
const FUZZ = [[2.5, 7, 0.15], [7, 20, 0.1], [20, Infinity, 0.05]];

export const newCard = () => ({ due: 0, reps: 0, lapses: 0 });
/* a card as stored, or null; other fields on it (stats.mjs's r, w, last; plan.mjs's f, note) are kept */
const ok = c => (c && typeof c === 'object' && !Array.isArray(c) ? { ...newCard(), ...c, due: Number.isFinite(c.due) ? c.due : 0 } : null);
export const isNew = c => !c || !(c.st || c.reps || c.lapses || c.ivl);

const clampD = d => Math.min(Math.max(d, 1), 10);
const clampS = s => Math.min(Math.max(s, S_MIN), S_MAX);
/* the forgetting curve: the chance of recall t days after a review at stability s */
export const recall = (t, s) => Math.pow(1 + (FACTOR * t) / s, DECAY);
const initS = g => clampS(W[g - 1]);
const initD = g => W[4] - Math.exp(W[5] * (g - 1)) + 1;
const nextD = (D, g) => clampD(W[7] * initD(4) + (1 - W[7]) * (D + (-W[6] * (g - 3) * (10 - D)) / 9));
const recallS = (D, S, R, g) => S * (1 + Math.exp(W[8]) * (11 - D) * Math.pow(S, -W[9]) * (Math.exp((1 - R) * W[10]) - 1) * (g === 2 ? W[15] : 1) * (g === 4 ? W[16] : 1));
const forgetS = (D, S, R) => Math.min(W[11] * Math.pow(D, -W[12]) * (Math.pow(S + 1, W[13]) - 1) * Math.exp((1 - R) * W[14]), S / Math.exp(W[17] * W[18]));
const shortS = (S, g) => { let inc = Math.exp(W[17] * (g - 3 + W[18])) * Math.pow(S, -W[19]); if (g >= 2) inc = Math.max(inc, 1); return clampS(S * inc); };
const longS = (D, S, R, g) => clampS(g === 1 ? forgetS(D, S, R) : recallS(D, S, R, g));
const ivlDays = S => Math.min(Math.max(Math.round((S / FACTOR) * (Math.pow(RETENTION, 1 / DECAY) - 1)), 1), MAX_IVL);
function fuzzDays(d, rnd) {
  if (!rnd || d < 2.5) return d;
  let delta = 1;
  for (const [a, b, f] of FUZZ) delta += f * Math.max(Math.min(d, b) - a, 0);
  const hi = Math.min(Math.round(d + delta), MAX_IVL), lo = Math.min(Math.max(2, Math.round(d - delta)), hi);
  return Math.floor(rnd() * (hi - lo + 1)) + lo;
}
/* FSRS's SM-2 conversion (fsrs-rs memory_state_from_sm2): an old card keeps what it had earned */
export function fromSM2(ease, ivl) {
  const S = (Math.max(ivl, S_MIN) * FACTOR) / (Math.pow(RETENTION, 1 / DECAY) - 1);
  const D = 11 - (ease - 1) / (Math.exp(W[8]) * Math.pow(S, -W[9]) * Math.expm1((1 - RETENTION) * W[10]));
  return { s: clampS(S), d: clampD(D) };
}
function fsrsOf(c) {
  if (c.st) return c;
  if (c.ivl > 0 || c.reps > 0) {   /* an SM-2 card */
    const { s, d } = fromSM2(c.ease || 2.5, Math.max(1, c.ivl || 1));
    return { ...c, st: c.ivl > 0 ? 2 : 3, step: c.ivl > 0 ? null : 0, s, d, lr: c.due ? c.due - Math.max(1, c.ivl || 0) * DAY : null };
  }
  return { ...c, st: 1, step: 0, s: null, d: null, lr: null };
}
/* how likely you are to recall it now (0 for a new card) */
export function retrievability(card, t) {
  const c = ok(card); if (!c || !c.st || c.s == null || c.lr == null) return 0;
  return recall(Math.max(0, Math.floor((t - c.lr) / DAY)), c.s);
}

/* the card after a grade at t; rnd fuzzes the interval (leave it out for none) */
export function grade(card, g, t, rnd = null) {
  const base = ok(card) || newCard(), gi = GRADES.indexOf(g) + 1;
  if (!gi) return base;
  const c = fsrsOf(base), days = c.lr == null ? null : Math.floor((t - c.lr) / DAY), R = retrievability(c, t);
  let ivl;
  const toReview = () => { c.st = 2; c.step = null; ivl = fuzzDays(ivlDays(c.s), rnd) * DAY; };
  if (c.st === 2) {
    const S = c.s, D = c.d, same = days !== null && days < 1, nextS = x => (same ? shortS(S, x) : longS(D, S, R, x));
    c.s = nextS(gi); c.d = nextD(D, gi);
    if (gi === 1) { c.st = 3; c.step = 0; ivl = RELEARN[0]; c.lapses = (c.lapses | 0) + 1; }
    else {   /* Hard < Good < Easy, as Anki and ts-fsrs keep them */
      let h = ivlDays(nextS(2)), gd = ivlDays(nextS(3)), e = ivlDays(nextS(4));
      h = Math.min(h, gd); gd = Math.max(gd, h + 1); e = Math.max(e, gd + 1);
      ivl = fuzzDays(Math.min([0, 0, h, gd, e][gi], MAX_IVL), rnd) * DAY;
    }
  } else {
    const steps = c.st === 1 ? LEARN : RELEARN;
    if (c.s == null || c.d == null) { c.s = initS(gi); c.d = clampD(initD(gi)); }
    else if (days !== null && days < 1) { c.s = shortS(c.s, gi); c.d = nextD(c.d, gi); }
    else { c.s = longS(c.d, c.s, R, gi); c.d = nextD(c.d, gi); }
    if (c.step == null) c.step = 0;
    if (c.step >= steps.length && gi >= 2) toReview();
    else if (gi === 1) { c.step = 0; ivl = steps[0]; }
    else if (gi === 2) ivl = c.step === 0 ? (steps.length === 1 ? steps[0] * 1.5 : (steps[0] + steps[1]) / 2) : steps[c.step];
    else if (gi === 3) { if (c.step + 1 >= steps.length) toReview(); else { c.step += 1; ivl = steps[c.step]; } }
    else toReview();
  }
  delete c.ivl; delete c.ease;
  return { ...c, due: t + ivl, lr: t, reps: (c.reps | 0) + 1 };
}
/* is the card back within the session (a learning step of minutes), so Study shows it again before the end */
export const soon = (card, t) => !!card && card.due - t < 30 * MIN;

/* what one grade would give, for the buttons: "1 min", "10 min", "3 days", "2 mo" */
export const preview = (card, g, t) => span(grade(card, g, t).due - t);
export function span(ms) {
  const m = Math.round(ms / MIN);
  if (m < 60) return `${Math.max(1, m)} min`;
  const d = Math.round(ms / DAY);
  if (d < 1) return `${Math.round(m / 60)} h`;
  if (d < 31) return `${d} day${d === 1 ? '' : 's'}`;
  if (d < 365) return `${Math.round(d / 30)} mo`;
  return `${(d / 365).toFixed(1)} yr`;
}

/* a study session over `items` (already narrowed to the pick): the due ones, the most overdue first, then new ones up
   to the day's allowance (NEW_A_DAY less the new ones started today). cards: { id: card } */
export function queue(items, cards, now, startedToday = 0) {
  const due = [], fresh = [];
  for (const it of items || []) { const c = ok(cards?.[it.id]); if (isNew(c)) fresh.push(it); else if (c.due <= now) due.push([c.due, it]); }
  due.sort((a, b) => a[0] - b[0]);
  return [...due.map(x => x[1]), ...fresh.slice(0, Math.max(0, NEW_A_DAY - startedToday))];
}
/* the counts a deck or pick shows: { due, new, learnt } */
export function counts(items, cards, now) {
  let due = 0, fresh = 0, learnt = 0;
  for (const it of items || []) { const c = ok(cards?.[it.id]); if (isNew(c)) fresh++; else if (c.due <= now) due++; else learnt++; }
  return { due, new: fresh, learnt };
}
