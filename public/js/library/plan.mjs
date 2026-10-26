/* library/plan.mjs - the day's study and the sessions you can build (founder 2026-10-26: "a much more robust personal
   study ecosystem ... how other platforms have it and how you can optimally customise"). What it borrows:
     Duolingo     a daily goal you can change, a streak that counts the days you studied (and forgives today until
                  it is over), the goal ring
     Anki         due cards first, then new ones up to the day's allowance (sched.mjs); a heatmap of the last weeks
     UWorld/AMBOSS  a session builder: which questions (all, unused, incorrect, flagged), how many, tutor (the answer
                  after each) or timed (a clock on each, like the exam), in what order (due first, shuffled, 0 to 1)
   Pure: the Study tab and the tests. A card here is sched.mjs's card plus stats.mjs's tally (r, w), last (1 right,
   0 wrong: the last answer), f (flagged) and note. */
import { queue, isNew } from './sched.mjs';
import { ladder } from '../mcq/year.mjs';
import { dayOf } from './stats.mjs';

export const GOALS = Object.freeze([10, 20, 40, 60]);
export const SIZES = Object.freeze([10, 20, 40, 0]);   /* 0: all of them */
export const WHICH = Object.freeze({ all: 'All', unused: 'Unused', incorrect: 'Incorrect', flagged: 'Flagged' });
export const ORDERS = Object.freeze({ due: 'Due first', shuffle: 'Shuffled', ladder: '0 to 1' });
export const MODES = Object.freeze({ tutor: 'Tutor', timed: 'Timed' });
export const DEFAULT_PREF = Object.freeze({ goal: 20, size: 20, which: 'all', order: 'due', mode: 'tutor' });
export const pref = p => ({
  goal: GOALS.includes(p?.goal) ? p.goal : DEFAULT_PREF.goal,
  size: SIZES.includes(p?.size) ? p.size : DEFAULT_PREF.size,
  which: Object.hasOwn(WHICH, p?.which) ? p.which : DEFAULT_PREF.which,
  order: Object.hasOwn(ORDERS, p?.order) ? p.order : DEFAULT_PREF.order,
  mode: Object.hasOwn(MODES, p?.mode) ? p.mode : DEFAULT_PREF.mode
});

/* ---------- the day ---------- */
const DAY = 864e5;
const back = (d, n) => dayOf(Date.parse(`${d}T12:00:00`) - n * DAY);
/* today's answers against the goal: { n, goal, frac (0..1), done } */
export function today(days, t, goal = DEFAULT_PREF.goal) {
  const n = days?.[dayOf(t)]?.n | 0;
  return { n, goal, frac: Math.min(1, n / goal), done: n >= goal };
}
/* the streak: consecutive days with an answer, ending today, or yesterday while today is still young (not broken
   until the day is over); live: today already counts */
export function streak(days, t) {
  const d0 = dayOf(t), has = d => (days?.[d]?.n | 0) > 0;
  let start = has(d0) ? d0 : back(d0, 1), n = 0;
  while (has(back(start, n))) n++;
  return { days: n, live: has(d0) };
}
/* the last `weeks` weeks as columns of 7 days (Monday first), each { d, n, level 0..4 }; the newest column ends today */
export function heat(days, t, weeks = 15) {
  const d0 = new Date(t), dow = (d0.getDay() + 6) % 7, out = [];
  const end = Date.parse(`${dayOf(t)}T12:00:00`), first = end - (dow + (weeks - 1) * 7) * DAY;
  const max = Math.max(1, ...Object.values(days || {}).map(x => x.n | 0));
  for (let w = 0; w < weeks; w++) {
    const col = [];
    for (let i = 0; i < 7; i++) {
      const at = first + (w * 7 + i) * DAY;
      if (at > end) { col.push(null); continue; }
      const d = dayOf(at), n = days?.[d]?.n | 0;
      col.push({ d, n, level: !n ? 0 : Math.min(4, 1 + Math.floor((3 * n) / max)) });
    }
    out.push(col);
  }
  return out;
}

/* ---------- a session ---------- */
/* entries: [{ key, item }]; which: all | unused (never answered) | incorrect (the last answer was wrong) | flagged */
export function which(entries, cards, w = 'all') {
  const c = e => cards?.[e.key];
  switch (w) {
    case 'unused': return entries.filter(e => !((c(e)?.r | 0) + (c(e)?.w | 0)));
    case 'incorrect': return entries.filter(e => c(e)?.last === 0);
    case 'flagged': return entries.filter(e => !!c(e)?.f);
    default: return entries;
  }
}
/* the session: the questions (filtered by which), in the order asked, at most size (0: all; due first keeps the
   day's allowance of new cards). rnd for a fair shuffle */
export function session(entries, cards, { which: w = 'all', order = 'due', size = 20 } = {}, t = Date.now(), startedToday = 0, rnd = Math.random) {
  const pool = which(entries, cards, w), cap = l => (size ? l.slice(0, size) : l);
  if (order === 'ladder') {
    const open = pool.filter(e => { const c = cards?.[e.key]; return isNew(c) || c.due <= t; });
    return cap(ladder(open.length ? open : pool, e => e.item.year, size ? Math.max(1, Math.ceil(size / 4)) : 0, e => e.item.difficulty));
  }
  if (order === 'shuffle' || w !== 'all') {   /* a filtered set is studied now, whatever its due dates */
    const l = [...pool];
    for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; }
    return cap(order === 'due' ? l.sort((a, b) => (cards?.[a.key]?.due || 0) - (cards?.[b.key]?.due || 0)) : l);
  }
  const by = new Map(pool.map(e => [e.key, e]));
  return cap(queue(pool.map(e => ({ id: e.key })), cards, t, startedToday).map(x => by.get(x.id)));
}
/* timed mode: the seconds a question gets, like the exam (90 s a question) plus its reading (1 s per 4 words past 60) */
export function timedSecs(item) {
  const words = `${item?.stem || ''} ${item?.ask || ''} ${(item?.options || []).join(' ')}`.split(/\s+/).filter(Boolean).length;
  return Math.min(240, 90 + Math.max(0, Math.ceil((words - 60) / 4)));
}
/* the counts the home shows for a set of entries: { due, fresh, flagged, incorrect, unused } */
export function tally(entries, cards, t) {
  let due = 0, fresh = 0, flagged = 0, incorrect = 0, unused = 0;
  for (const e of entries) {
    const c = cards?.[e.key];
    if (isNew(c)) fresh++; else if (c.due <= t) due++;
    if (c?.f) flagged++;
    if (c?.last === 0) incorrect++;
    if (!((c?.r | 0) + (c?.w | 0))) unused++;
  }
  return { due, fresh, flagged, incorrect, unused };
}
