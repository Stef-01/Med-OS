/* lib/mcq-spotcheck.mjs - pure: the human check on the pool. Every number the evals report so far is a model judging
   (the review, the bar it is held to, the review reviewed again); docs/mcq-evals.md has long named a physician's
   spot-check of the pooled questions as the honest next step. This is that check: a fixed, seeded sample of the pool,
   spread over the kinds, as a sheet a person marks (docs/mcq-spotcheck.md, written by scripts/mcq-spotcheck.mjs), the
   marks in data/mcq/spotcheck.json, and what they say: the share of pooled questions a person accepts, by kind, and
   what is wrong with the rest. Every sampled question passed the review and the bar, so this is the pool's precision. */
import { fnv, LETTERS } from '../../public/js/mcq/schema.mjs';

/* the calls a person can make on a question */
export const CALLS = Object.freeze({ ok: 'fine as it is', key: 'the key is wrong', sba: 'not a single best answer (another option is as good)', unsafe: 'unsafe or out of date for Australian practice', unclear: 'unclear or flawed wording', other: 'something else (say what in the note)' });

const kindOf = q => q?.provenance?.kind || 'unknown';
/* n questions, as evenly spread over the kinds as the pool allows, each kind's taken in a fixed hash order (so the same
   pool and n give the same sample on any machine, and adding questions moves it little) */
export function spotSample(questions, n = 40, salt = 'spot') {
  const by = new Map();
  for (const q of [...questions].sort((a, b) => (fnv(`${salt}:${a.id}`) < fnv(`${salt}:${b.id}`) ? -1 : 1))) (by.get(kindOf(q)) || by.set(kindOf(q), []).get(kindOf(q))).push(q);
  const kinds = [...by.keys()].sort(), out = [];
  for (let round = 0; out.length < n && kinds.some(k => by.get(k).length > round); round++)
    for (const k of kinds) { const q = by.get(k)[round]; if (q && out.length < n) out.push(q); }
  return out;
}

/* the sheet a person marks */
export function spotSheet(questions, { date = '' } = {}) {
  const L = ['# MCQ spot-check', '', `Written by \`node scripts/mcq-spotcheck.mjs\`${date ? ` on ${date}` : ''}: ${questions.length} questions from the standard pool, spread over its kinds. Every one passed the model review and the bar; this is the check a person makes.`, '',
    'For each question, record a call in `data/mcq/spotcheck.json` under `marks`, keyed by its id: `{ "call": "ok", "note": "", "by": "your name" }`. The calls:', '',
    ...Object.entries(CALLS).map(([k, v]) => `- \`${k}\`: ${v}`), '', 'Then `node scripts/mcq-evals.mjs` reports what the marks say (docs/mcq-evals.md, section 6).', ''];
  questions.forEach((q, i) => {
    L.push(`## ${i + 1}. ${q.id} (${kindOf(q)}${q.topic ? `, ${q.topic}` : ''})`, '', q.ask ? `${q.stem} **${q.ask}**` : q.stem, '');
    q.options.forEach((o, j) => L.push(`- ${LETTERS[j]}. ${o}${j === q.answer ? '  **(key)**' : ''}`));
    if (q.explanation) L.push('', `*Explanation:* ${q.explanation}`);
    L.push('', `*Source:* ${q.provenance?.source?.name || kindOf(q)}`, '');
  });
  return L.join('\n');
}

/* what the marks say: { marked, ok, okShare, byKind: { kind: { marked, ok, okShare } }, problems: { call: n }, unmarked } */
export function spotResults(questions, marks = {}) {
  const pct = (a, b) => (b ? Math.round((1000 * a) / b) / 10 : null);
  const rows = questions.map(q => ({ q, m: marks[q.id] })).filter(r => r.m && Object.hasOwn(CALLS, r.m.call));
  const byKind = {}, problems = {};
  for (const { q, m } of rows) {
    const k = (byKind[kindOf(q)] ||= { marked: 0, ok: 0 });
    k.marked++; if (m.call === 'ok') k.ok++; else problems[m.call] = (problems[m.call] || 0) + 1;
  }
  for (const k of Object.values(byKind)) k.okShare = pct(k.ok, k.marked);
  const ok = rows.filter(r => r.m.call === 'ok').length;
  return { sample: questions.length, marked: rows.length, ok, okShare: pct(ok, rows.length), byKind, problems, unmarked: questions.length - rows.length };
}
