/* mcq-audit.mjs - pure: the standard pool and the duel pack as a whole, where one question's checks cannot see. Every
   question in the pool already passed the flaw checks, the model review and the bar; this asks what the set looks like
   (scripts/mcq-audit.mjs writes it to data/mcq/audit.json and docs/mcq-audit.md).

   formats     how many questions fit each answer-time format (the duel's Rapid 15 s, Standard 30 s, Long case 90 s: a
               question fits when reading it takes at most two thirds of the time), per kind and per topic, and the
               topics too thin to deal a 10-question duel in a format
   cues        how often the key is the longest option (chance is 1 in the number of options), where the key sits, and
               how often each flaw check still fires on a pooled question (a minor flaw passes the bar)
   duplicates  pairs of different questions whose stems share most of their word runs (two items on one patient)
   review      what the model review recommended for the pooled questions (accept, revise), its solve agreement and
               its rubric scores, per kind

   auditPool(pool, { pack, verdicts, fits, readSecs, formats }) -> report; fits/readSecs/formats come from the vendored
   duel package (duel/core.mjs), so the audit and the duel time questions the same way. */

import { flawReport, words } from '../../public/js/mcq/flaws.mjs';

export const THIN = 10;                 /* a topic with fewer fitting questions than the duel's longest pick is thin */
export const DUP_AT = 0.5;              /* stems sharing half their word triples are near-duplicates */
const round1 = x => Math.round(x * 10) / 10;
const pct = (n, d) => (d ? round1((100 * n) / d) : null);
const median = xs => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
const p90 = xs => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(0.9 * (s.length - 1))] : null; };
const kindOf = q => q?.provenance?.kind || q?.source || 'unknown';
const count = (xs, f) => xs.reduce((m, x) => { const k = f(x); m[k] = (m[k] || 0) + 1; return m; }, {});

/* the word triples of a stem, for near-duplicate stems */
export function shingles(s) {
  const w = words(s), out = new Set();
  for (let i = 0; i + 2 < w.length; i++) out.add(`${w[i]} ${w[i + 1]} ${w[i + 2]}`);
  return out;
}
export function overlap(a, b) {
  if (!a.size || !b.size) return 0;
  let n = 0; for (const x of a) if (b.has(x)) n++;
  return n / Math.min(a.size, b.size);
}

/* the key is the longest option by characters, with no tie */
export const keyLongest = q => { const L = q.options.map(o => String(o).length), k = L[q.answer]; return L.filter(l => l >= k).length === 1; };

export function formatsOf(list, { fits, readSecs, formats, topicOf = q => q.topic || 'No topic' }) {
  const out = {};
  for (const f of formats) {
    const fit = list.filter(q => fits(q, f.secs));
    const byTopic = count(fit, topicOf), all = count(list, topicOf);
    const thin = Object.keys(all).filter(t => (byTopic[t] || 0) < THIN).sort();
    out[f.secs] = { name: f.name, fit: fit.length, of: list.length, share: pct(fit.length, list.length), byKind: count(fit, kindOf), byTopic, topics: Object.keys(all).length, thin };
  }
  const read = list.map(q => readSecs(q));
  return { formats: out, readSecs: { median: median(read), p90: p90(read), max: read.length ? Math.max(...read) : null } };
}

export function auditPool(pool, { pack = null, verdicts = {}, fits, readSecs, formats }) {
  const qs = pool?.questions || [], kinds = [...new Set(qs.map(kindOf))].sort();
  const per = k => qs.filter(q => kindOf(q) === k);
  /* cues */
  const cues = {};
  for (const k of kinds) {
    const l = per(k), n = l.length, chance = n ? round1(100 * l.reduce((s, q) => s + 1 / q.options.length, 0) / n) : null;
    const fired = {};
    for (const q of l) for (const r of flawReport(q).failed) fired[r.check] = (fired[r.check] || 0) + 1;
    cues[k] = { n, keyLongest: pct(l.filter(keyLongest).length, n), chance, keyAt: count(l, q => 'ABCDEFGH'[q.answer]), options: count(l, q => q.options.length), checks: Object.fromEntries(Object.entries(fired).sort((a, b) => b[1] - a[1]).map(([id, c]) => [id, { n: c, share: pct(c, n) }])) };
  }
  /* near-duplicate stems across different questions */
  const sh = qs.map(q => shingles(q.stem)), duplicates = [];
  for (let i = 0; i < qs.length; i++) for (let j = i + 1; j < qs.length; j++) {
    const o = overlap(sh[i], sh[j]);
    if (o >= DUP_AT) duplicates.push({ a: qs[i].id, b: qs[j].id, overlap: round1(o * 100) });
  }
  duplicates.sort((x, y) => y.overlap - x.overlap || (x.a < y.a ? -1 : 1));
  /* what the model review said of the pooled questions */
  const review = {};
  for (const k of kinds) {
    const vs = per(k).map(q => verdicts[q.id]).filter(Boolean), n = vs.length;
    const agreed = vs.filter(v => (v.solves || []).length && v.solves.every(s => s.answer === v.solves[0].answer)).length;
    const r = f => median(vs.map(v => v.rubric?.[f]).filter(Number.isFinite));
    review[k] = { judged: n, verdict: count(vs, v => v.rubric?.verdict || 'none'), solvesAgree: pct(agreed, n), median: { single_best: r('single_best'), distractors: r('distractors'), relevance: r('relevance'), accuracy: r('accuracy'), explanation: r('explanation') } };
  }
  const out = { pool: { n: qs.length, byKind: count(qs, kindOf), ...formatsOf(qs, { fits, readSecs, formats }) }, cues, duplicates, review };
  if (pack) { const pq = pack.questions || []; out.pack = { n: pq.length, bySource: count(pq, q => q.source || q.origin || 'unknown'), ...formatsOf(pq, { fits, readSecs, formats }) }; }
  return out;
}

/* the report as Markdown: short; the numbers live in audit.json */
export function auditMarkdown(a, { date = '' } = {}) {
  const L = [];
  const fmtRow = (label, f) => `| ${label} | ${Object.values(f.formats).map(x => `${x.fit} of ${x.of} (${x.share}%)`).join(' | ')} | ${f.readSecs.median} / ${f.readSecs.p90} s |`;
  const names = Object.values(a.pool.formats).map(x => `${x.name} ${Object.keys(a.pool.formats).find(k => a.pool.formats[k] === x)} s`);
  L.push('# MCQ audit', '', `Written by \`node scripts/mcq-audit.mjs\`${date ? ` on ${date}` : ''} from the standard pool (\`public/mcq/pool.json\`) and the duel pack (\`public/duel/pack.json\`). Every pooled question has passed the flaw checks, the model review and the bar; this looks at the set as a whole. The numbers are in \`data/mcq/audit.json\`.`, '');
  L.push('## Answer-time formats', '', 'A question fits a format when reading it (4 words a second past the first 12, options included) takes at most two thirds of the time, leaving a third to think. The duel deals fitting questions first and gives the rest time to read.', '');
  L.push(`| | ${names.join(' | ')} | reading, median / 90th |`, `|---|${names.map(() => '---').join('|')}|---|`, fmtRow('pool', a.pool));
  if (a.pack) L.push(fmtRow('duel pack', a.pack));
  L.push('');
  for (const [secs, f] of Object.entries((a.pack || a.pool).formats)) {
    const kinds = Object.entries(f.byKind).map(([k, n]) => `${k} ${n}`).join(', ') || 'none';
    L.push(`- **${f.name} (${secs} s)**: ${kinds}. ${f.thin.length ? `Thin (under ${THIN} fitting) in ${f.thin.length} of ${f.topics} topics: ${f.thin.slice(0, 12).join(', ')}${f.thin.length > 12 ? ', …' : ''}.` : 'Every topic can deal 10.'}`);
  }
  L.push('', '## Cues and residual flaws in the pool', '', '| kind | n | key is the longest option | chance | key position | checks still firing (share of the kind) |', '|---|---|---|---|---|---|');
  for (const [k, c] of Object.entries(a.cues)) L.push(`| ${k} | ${c.n} | ${c.keyLongest}% | ${c.chance}% | ${Object.entries(c.keyAt).sort().map(([p, n]) => `${p} ${n}`).join(', ')} | ${Object.entries(c.checks).slice(0, 4).map(([id, x]) => `${id} ${x.share}%`).join(', ') || 'none'} |`);
  L.push('', '## Near-duplicate stems', '', a.duplicates.length ? `${a.duplicates.length} pair${a.duplicates.length === 1 ? '' : 's'} share at least ${DUP_AT * 100}% of their word triples:` : `No two pooled questions share ${DUP_AT * 100}% of their word triples.`);
  for (const d of a.duplicates.slice(0, 15)) L.push(`- ${d.a} and ${d.b}: ${d.overlap}%`);
  L.push('', '## The model review of the pooled questions', '', '| kind | judged | verdicts | both solves agree | single best | distractors | relevance | accuracy | explanation |', '|---|---|---|---|---|---|---|---|---|');
  for (const [k, r] of Object.entries(a.review)) L.push(`| ${k} | ${r.judged} | ${Object.entries(r.verdict).map(([v, n]) => `${v} ${n}`).join(', ')} | ${r.solvesAgree}% | ${r.median.single_best} | ${r.median.distractors} | ${r.median.relevance} | ${r.median.accuracy} | ${r.median.explanation} |`);
  L.push('', 'Rubric scores are medians on the review\'s 1 to 5 scale.', '');
  return L.join('\n');
}
