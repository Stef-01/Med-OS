/* lib/mcq-retest.mjs - the model review, reviewed twice: how much of a question's fate is the reviewer's noise.
   A judged question is reviewed again from scratch (scripts/mcq-evals.mjs --retest n); the two verdicts are compared
   on what the selector reads: the review's verdict word, its key verdict, the two blind solves, the quality score, and,
   the number that matters, whether the question would pass the selector's steps 1 to 5 (lib/mcq-select.mjs assess)
   under one verdict and not the other. A flip rate well above zero says the bar decides close calls by chance.
   Pure: the caller makes the model calls. */
import { assess, DEFAULT_BARS } from './mcq-select.mjs';
import { contentHash } from '../../public/js/mcq/schema.mjs';

/* where the second verdict is kept beside the first, in data/mcq/eval-verdicts.json */
export const retestKey = q => `retest:${q.id}`;
export const retestFor = (store, q) => { const v = store?.[retestKey(q)]; return v && v.hash === contentHash(q) ? v : null; };

const round1 = x => Math.round(x * 10) / 10;
const rate = (n, d) => (d ? round1((100 * n) / d) : null);
const pctl = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))] : null; };

/* [{ q, a, b }] (a: the verdict the pool uses, b: the retest) -> agreement, the quality drift, and the flips */
export function retestStats(pairs, { bars = DEFAULT_BARS } = {}) {
  const rows = pairs.map(({ q, a: withSecond, b }) => {
    const { second, ...a } = withSecond;   /* one review against one review: a close call's second does not count here */
    const x = assess(q, { verdicts: { [q.id]: a }, bars }), y = assess(q, { verdicts: { [q.id]: b }, bars });
    const solvedA = a.solves.filter(s => s.answer === q.answer).length, solvedB = b.solves.filter(s => s.answer === q.answer).length;
    return { id: q.id, kind: x.kind, verdict: a.rubric.verdict === b.rubric.verdict, key: a.rubric.key_correct === b.rubric.key_correct, solves: solvedA === solvedB,
      drift: x.quality != null && y.quality != null ? Math.abs(x.quality - y.quality) : null, pass: [x.status === 'pass', y.status === 'pass'],
      quality: [x.quality, y.quality] };
  });
  const sum = list => {
    const n = list.length, drift = list.map(r => r.drift).filter(Number.isFinite), flips = list.filter(r => r.pass[0] !== r.pass[1]);
    return { n, verdictAgree: rate(list.filter(r => r.verdict).length, n), keyAgree: rate(list.filter(r => r.key).length, n), solvesAgree: rate(list.filter(r => r.solves).length, n),
      drift: { mean: drift.length ? round1(drift.reduce((s, d) => s + d, 0) / drift.length) : null, p90: pctl(drift, 0.9), max: drift.length ? Math.max(...drift) : null },
      passFirst: list.filter(r => r.pass[0]).length, passSecond: list.filter(r => r.pass[1]).length, flips: flips.length, flipRate: rate(flips.length, n) };
  };
  const kinds = [...new Set(rows.map(r => r.kind))].sort();
  const flipped = rows.filter(r => r.pass[0] !== r.pass[1]).map(r => ({ id: r.id, kind: r.kind, quality: r.quality, passed: r.pass[0] ? 'first' : 'second' }));
  return { ...sum(rows), byKind: Object.fromEntries(kinds.map(k => [k, sum(rows.filter(r => r.kind === k))])), flipped };
}
