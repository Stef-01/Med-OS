/* library/stats.mjs - what your answers say (founder 2026-10-26: "a study summary feature to know your gaps, also a
   Spotify Wrapped style gen z pop out at the end of every month"). Pure: the Study tab, the Wrapped pop-out and the
   tests.

   Every answer in Study is recorded twice, small:
     on its card    r, w: right and wrong answers to that question; last: 1 when the last was right, 0 wrong
                    (library/sched.mjs keeps the rest of the card; plan.mjs reads last for Incorrect)
     in its day     days['2026-10-26'] = { n, r, s: { specialty: [n, r] }, y: { year: [n, r] }, k: { kind: [n, r] },
                    h: { hour: n } }  (the month's Wrapped is read from these; the Study record syncs them on your
                    account only: study-kit/sync.mjs SPEC.lib, mine) */
import { YEARS, DIFFICULTY } from '../mcq/year.mjs';
import { KINDS } from './item.mjs';

export const dayOf = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const monthOf = t => dayOf(t).slice(0, 7);
const bump = (o, k, ok) => { const v = (o[k] ||= [0, 0]); v[0]++; if (ok) v[1]++; };

/* one answer into the study record (mutates and returns it): its card's tally and its day */
export function record(mem, { key, item }, ok, t) {
  const c = mem.card[key] || {}; mem.card[key] = { ...c, r: (c.r | 0) + (ok ? 1 : 0), w: (c.w | 0) + (ok ? 0 : 1), last: ok ? 1 : 0 };
  const days = (mem.days ||= {}), d = (days[dayOf(t)] ||= { n: 0, r: 0, s: {}, y: {}, k: {}, h: {} });
  d.n++; if (ok) d.r++;
  if (item.topic) bump(d.s, item.topic, ok);
  if (item.year) bump(d.y, item.year, ok);
  if (item.cat) bump(d.k, item.cat, ok);
  const h = new Date(t).getHours(); d.h[h] = (d.h[h] | 0) + 1;
  return mem;
}

/* ---------- your gaps ---------- */
export const MIN_SEEN = 3;   /* a group needs this many answers before its accuracy means anything */
const pct = (r, n) => (n ? Math.round((100 * r) / n) : 0);
/* entries: [{ key, item }] (every question you can study); cards: { key: card with r, w }. Groups by specialty, by
   specialty and kind, by year and by difficulty: { n (answers), r, acc, items, seen (questions answered) } */
export function summary(entries, cards) {
  const g = { spec: {}, sk: {}, year: {}, diff: {} }, tot = { n: 0, r: 0, items: 0, seen: 0 };
  const add = (bag, id, label, c) => { const x = (bag[id] ||= { id, label, n: 0, r: 0, items: 0, seen: 0 }); x.items++; if (c) { x.n += c.n; x.r += c.r; if (c.n) x.seen++; } };
  for (const { key, item } of entries || []) {
    const cd = cards?.[key], c = cd ? { n: (cd.r | 0) + (cd.w | 0), r: cd.r | 0 } : null;
    tot.items++; if (c?.n) { tot.seen++; tot.n += c.n; tot.r += c.r; }
    if (item.topic) add(g.spec, item.topic, item.topic, c);
    if (item.topic && item.cat) add(g.sk, `${item.topic}|${item.cat}`, `${item.topic} › ${KINDS[item.cat]?.label || item.cat}`, c);
    if (item.year) add(g.year, String(item.year), YEARS[item.year]?.label || `Year ${item.year}`, c);
    if (item.difficulty) add(g.diff, String(item.difficulty), DIFFICULTY[item.difficulty]?.label || '', c);
  }
  const fin = bag => Object.values(bag).map(x => ({ ...x, acc: pct(x.r, x.n) }));
  const spec = fin(g.spec), sk = fin(g.sk);
  return {
    total: { ...tot, acc: pct(tot.r, tot.n) },
    /* the weakest first: enough answers to judge, the lowest accuracy, then the most answered */
    /* by specialty and kind; when no pair has enough answers yet, by specialty */
    gaps: (sk.some(x => x.n >= MIN_SEEN && x.acc < 70) ? sk : spec).filter(x => x.n >= MIN_SEEN && x.acc < 70).sort((a, b) => a.acc - b.acc || b.n - a.n).slice(0, 5),
    strong: sk.filter(x => x.n >= MIN_SEEN && x.acc >= 80).sort((a, b) => b.acc - a.acc || b.n - a.n).slice(0, 3),
    /* specialties with questions you have not touched, the biggest first */
    untouched: spec.filter(x => !x.seen).sort((a, b) => b.items - a.items),
    spec: spec.sort((a, b) => b.items - a.items),
    years: fin(g.year).sort((a, b) => a.id - b.id),
    diffs: fin(g.diff).sort((a, b) => a.id - b.id)
  };
}

/* ---------- the month, wrapped ---------- */
const sum = (days, f) => Object.values(days).reduce((n, d) => n + f(d), 0);
const merge = (days, k) => { const out = {}; for (const d of Object.values(days)) for (const [id, [n, r]] of Object.entries(d[k] || {})) { const v = (out[id] ||= [0, 0]); v[0] += n; v[1] += r; } return out; };
/* the month's story, or null when there is too little in it (fewer than MIN_WRAP answers): YYYY-MM */
export const MIN_WRAP = 10;
export function wrapped(mem, month) {
  const days = Object.fromEntries(Object.entries(mem?.days || {}).filter(([d]) => d.startsWith(`${month}-`)));
  const n = sum(days, d => d.n | 0); if (n < MIN_WRAP) return null;
  const r = sum(days, d => d.r | 0), active = Object.keys(days).filter(d => days[d].n).sort();
  let best = 0, run = 0, prev = null;
  for (const d of active) { const t = Date.parse(`${d}T12:00:00Z`); run = prev != null && t - prev === 864e5 ? run + 1 : 1; best = Math.max(best, run); prev = t; }
  const specs = Object.entries(merge(days, 's')).map(([id, [cn, cr]]) => ({ id, n: cn, acc: pct(cr, cn) }));
  const top = [...specs].sort((a, b) => b.n - a.n)[0] || null;
  const glow = specs.filter(x => x.n >= MIN_SEEN).sort((a, b) => b.acc - a.acc || b.n - a.n)[0] || null;
  const nemesis = specs.filter(x => x.n >= MIN_SEEN && x !== glow).sort((a, b) => a.acc - b.acc || b.n - a.n)[0] || null;
  const hours = Array.from({ length: 24 }, (_, h) => sum(days, d => d.h?.[h] | 0)), peak = hours.indexOf(Math.max(...hours));
  const years = merge(days, 'y'), maxYear = Math.max(0, ...Object.keys(years).map(Number));
  const busiest = active.reduce((a, d) => (!a || days[d].n > days[a].n ? d : a), '');
  return { month, n, r, acc: pct(r, n), days: active.length, streak: best, top, glow, nemesis, peak, vibe: vibeOf(peak), maxYear, busiest, busiestN: busiest ? days[busiest].n : 0, specs: specs.length };
}
/* the hour you study most, as a persona */
export function vibeOf(h) {
  if (h >= 22 || h < 4) return { id: 'owl', name: 'Night Owl', line: 'Studying while the group chat sleeps. Unhinged, respectfully.' };
  if (h < 8) return { id: 'lark', name: 'Early Bird', line: 'Up before the sun and the registrar. Built different.' };
  if (h < 12) return { id: 'morning', name: 'Morning Grinder', line: 'Coffee in one hand, differentials in the other.' };
  if (h < 17) return { id: 'day', name: 'Daylight Scholar', line: 'Library-at-noon energy. Very normal, very effective.' };
  return { id: 'evening', name: 'Golden Hour Studier', line: 'Dinner, then a quick 40 questions. As one does.' };
}
/* the month to show on opening the app: the latest finished month with a story you have not seen yet */
export function dueWrap(mem, t) {
  const seen = new Set(mem?.wrap?.seen || []), cur = monthOf(t);
  const months = [...new Set(Object.keys(mem?.days || {}).map(d => d.slice(0, 7)))].filter(m => m < cur && !seen.has(m)).sort();
  for (let i = months.length - 1; i >= 0; i--) if (wrapped(mem, months[i])) return months[i];
  return '';
}
export const monthName = m => new Date(`${m}-15T12:00:00Z`).toLocaleString('en-AU', { month: 'long', timeZone: 'UTC' });
