/* lib/mcq-tag-retest.mjs - the tags, tagged twice: every question's year (1 to 4), difficulty (1 to 3) and, for a
   pooled one, kind (clinical, physio, anatomy) come from one model pass (scripts/tag-years.mjs), and the duel deals
   by them (the 0 to 1 ladder climbs by year, a drill filters by kind). tag-years.mjs --retest n tags a seeded sample
   again from scratch, without touching data/mcq/years.json, and keeps the pairs in data/mcq/tag-retest.json; this says
   how often the two agree, exactly and within one step, and Cohen's kappa (agreement beyond chance). Pure. */
import { fnv } from '../../public/js/mcq/schema.mjs';

const round1 = x => Math.round(x * 10) / 10;
const pct = (n, d) => (d ? round1((100 * n) / d) : null);

/* n questions spread over the sources, each source's in a fixed hash order (the same pack and n give the same sample) */
export function tagSample(questions, n = 80, salt = 'tags') {
  const by = new Map();
  for (const q of [...questions].sort((a, b) => (fnv(`${salt}:${a.id}`) < fnv(`${salt}:${b.id}`) ? -1 : 1))) (by.get(q.source || 'unknown') || by.set(q.source || 'unknown', []).get(q.source || 'unknown')).push(q);
  const keys = [...by.keys()].sort(), out = [];
  for (let r = 0; out.length < n && keys.some(k => by.get(k).length > r); r++) for (const k of keys) { const q = by.get(k)[r]; if (q && out.length < n) out.push(q); }
  return out;
}

/* Cohen's kappa for two raters over the same items */
export function kappa(pairs) {
  const n = pairs.length; if (!n) return null;
  const cats = [...new Set(pairs.flat())], po = pairs.filter(([a, b]) => a === b).length / n;
  const pe = cats.reduce((s, c) => s + (pairs.filter(([a]) => a === c).length / n) * (pairs.filter(([, b]) => b === c).length / n), 0);
  return pe === 1 ? 1 : Math.round(((po - pe) / (1 - pe)) * 100) / 100;
}

/* rows: [{ id, source, year: [first, again], difficulty: [first, again], kind?: [first, again] }] */
export function tagRetestStats(rows) {
  const one = key => {
    const ps = rows.map(r => r[key]).filter(p => Array.isArray(p) && p[0] != null && p[1] != null);
    const num = ps.every(([a, b]) => Number.isInteger(a) && Number.isInteger(b));
    return { n: ps.length, same: pct(ps.filter(([a, b]) => a === b).length, ps.length), ...(num ? { withinOne: pct(ps.filter(([a, b]) => Math.abs(a - b) <= 1).length, ps.length) } : {}), kappa: kappa(ps) };
  };
  const bySource = {};
  for (const s of [...new Set(rows.map(r => r.source))].sort()) {
    const rs = rows.filter(r => r.source === s), ys = rs.filter(r => r.year?.[0] === r.year?.[1]).length;
    bySource[s] = { n: rs.length, yearSame: pct(ys, rs.length) };
  }
  return { n: rows.length, year: one('year'), difficulty: one('difficulty'), kind: one('kind'), bySource };
}

/* the tag from several passes: the median (the lower middle for an even count), so one pass's step either way does not
   decide it. A trial of two medians of 3 on the retest sample agreed on difficulty 86% of the time (kappa 0.77)
   against 79% (0.65) for two single passes (2026-10-27) */
export function medianTag(xs) {
  const v = xs.filter(Number.isInteger).sort((a, b) => a - b);
  return v.length ? v[Math.floor((v.length - 1) / 2)] : null;
}
