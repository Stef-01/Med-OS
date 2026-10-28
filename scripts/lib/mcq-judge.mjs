/* lib/mcq-judge.mjs - the model-judged half of a question's evaluation (the deterministic half is
   public/js/mcq/flaws.mjs). Three calls per question, all through `ask` (lib/claude.mjs claudeJson with an API key,
   else lib/claude-cli.mjs claudeCliJson on the signed-in Claude Code CLI), so the flow is tested with a stub:

     solve 1, solve 2   an examinee answers it WITHOUT the key, the explanation or the source; the second run sees the
                        options in reverse order, so a position habit cannot agree with the key by chance twice
     rubric             a reviewer reads the whole item, key included, and scores it the NBME way: is the key right,
                        is it the single best answer, are the distractors plausible and homogeneous, is it Step 2 CK
                        material (applying knowledge to a patient), is it accurate and safe, how good is the explanation

   The judge never sees where a question came from (user, AI, AMSA, a bank): the same prompt for every kind.
   judgeScore turns a verdict into 0..100 and judgeGates into hard reasons to refuse; the selector (lib/mcq-select.mjs)
   combines it with the flaw score against the bar calibrated on the benchmarks. */
import { fullStem, LETTERS, contentHash } from '../../public/js/mcq/schema.mjs';
import { SPECIALTIES } from '../../public/js/study-kit/vocab.mjs';

export const JUDGE_VERSION = 'judge-1';
export { SPECIALTIES };
const str = { type: 'string' }, int = (min, max) => ({ type: 'integer', minimum: min, maximum: max });
const obj = (props, req = Object.keys(props)) => ({ type: 'object', additionalProperties: false, required: req, properties: props });

export const SOLVE_SYSTEM = `You are sitting a USMLE Step 2 Clinical Knowledge examination. Read the question and choose the single best answer, as a well-prepared final-year medical student would, applying current evidence-based practice. Answer with the option's letter. Give your confidence (0 to 1) and one sentence of reasoning.`;
/* a preclinical question (tag level:preclinical) is sat and reviewed as a Year 1 or 2 exam, so recall is judged as recall */
export const SOLVE_PRECLINICAL = `You are sitting a first- or second-year medical school examination in the basic sciences (anatomy, physiology, biochemistry, genetics, pharmacology, pathology). Read the question and choose the single best answer, as a well-prepared student would. Answer with the option's letter. Give your confidence (0 to 1) and one sentence of reasoning.`;
export const solveSchema = n => obj({ answer: { type: 'string', enum: [...LETTERS.slice(0, n)] }, confidence: { type: 'number' }, reason: str });

export const RUBRIC_SYSTEM = `You review single-best-answer questions for a medical-school question pool, to the standard of the NBME item-writing guide (Constructing Written Test Questions for the Basic and Clinical Sciences) and of USMLE Step 2 Clinical Knowledge. You are given one question with its key. Judge only the question in front of you: its source is not given and does not matter.

Score each part strictly:
- key_correct: is the keyed answer correct by current evidence and guidelines? "unsure" only if it truly depends on a guideline that differs by country.
- other_defensible: letters of any OTHER option an expert could defend as equally correct. Empty when the key is clearly best.
- single_best (1-5): 5 one option is clearly best and the others clearly worse; 3 the key is best but a distractor is arguable; 1 two or more options are right, or none is.
- distractors (1-5): are the wrong options plausible to a weak student, homogeneous (same kind of thing as the key), and free of cues? 1 = absurd or heterogeneous.
- relevance (1-5): is it Step 2 CK material, applying clinical knowledge to a patient (diagnosis, next step, management, prognosis, prevention, ethics in practice)? 1 = trivia or recall without a patient.
- accuracy (1-5): is everything stated in the stem, options and explanation medically accurate and current?
- explanation (0-5): 0 when there is none; else how well it teaches why the key is right and each distractor wrong.
- safety: ok false if a student who learned this question would be led to harm a patient (a dangerous dose, a missed emergency, outdated dangerous practice), with the issues.
- flaws: item-writing flaws you see (e.g. "longest option is the key", "negative stem", "clang", "heterogeneous options", "two keys", "vignette gives the answer away"); empty if none.
- topic: the one specialty it belongs to, from the list.
- verdict: accept (use as it is), revise (good idea, fixable flaw), reject (wrong, unsafe, or not worth fixing).
- reasons: at most three short reasons for the verdict.
- suggestion: one or two sentences on how to fix it, or "" when nothing needs fixing.`;
export const RUBRIC_PRECLINICAL = RUBRIC_SYSTEM
  .replace('and of USMLE Step 2 Clinical Knowledge', 'for the first two (preclinical) years of a medical degree')
  .replace(/- relevance \(1-5\):[^\n]*/, '- relevance (1-5): is it core Year 1 or 2 knowledge a doctor builds on (anatomy, physiology, biochemistry, genetics, pharmacology mechanism, pathology, or the science behind a clinical sign)? A recall question without a patient is fine here. 1 = trivia no doctor needs, or a fact out of date.');
export const RUBRIC_SCHEMA = obj({
  key_correct: { type: 'string', enum: ['yes', 'no', 'unsure'] }, other_defensible: { type: 'array', items: str },
  single_best: int(1, 5), distractors: int(1, 5), relevance: int(1, 5), accuracy: int(1, 5), explanation: int(0, 5),
  safety: obj({ ok: { type: 'boolean' }, issues: { type: 'array', items: str } }),
  flaws: { type: 'array', items: str }, topic: { type: 'string', enum: [...SPECIALTIES] },
  verdict: { type: 'string', enum: ['accept', 'revise', 'reject'] }, reasons: { type: 'array', items: str }, suggestion: str
});

const lettered = (opts, order) => order.map((i, n) => `${LETTERS[n]}. ${opts[i]}`).join('\n');
export function solveText(q, order) { return `${fullStem(q)}\n\n${lettered(q.options, order)}`; }
export function rubricText(q) {
  const why = (q.why || []).map((w, i) => (w ? `${LETTERS[i]}: ${w}` : '')).filter(Boolean);
  return `Specialties to choose the topic from: ${SPECIALTIES.join(', ')}

<question>
${fullStem(q)}

${lettered(q.options, q.options.map((_, i) => i))}

Key: ${LETTERS[q.answer]}
Explanation: ${String(q.explanation || '').trim() || '(none given)'}${why.length ? `\nWhy each option is wrong:\n${why.join('\n')}` : ''}
</question>`;
}

/* one question through the three calls -> the verdict record kept in data/mcq/verdicts.json */
export async function judgeItem(q, { ask, judge, now = () => new Date().toISOString() }) {
  const n = q.options.length, fwd = q.options.map((_, i) => i), rev = [...fwd].reverse();
  const solves = [];
  for (const [run, order] of [[1, fwd], [2, rev]]) {
    const pre = Array.isArray(q.tags) && q.tags.includes('level:preclinical');
    const { value } = await ask({ system: pre ? SOLVE_PRECLINICAL : SOLVE_SYSTEM, content: solveText(q, order), schema: solveSchema(n), effort: 'medium', label: `${q.id} solve ${run}` });
    const pos = LETTERS.indexOf(String(value.answer || '').toUpperCase());
    solves.push({ answer: pos >= 0 && pos < n ? order[pos] : -1, confidence: Math.max(0, Math.min(1, Number(value.confidence) || 0)), reason: String(value.reason || '').slice(0, 300) });
  }
  const { value: rubric, model } = await ask({ system: Array.isArray(q.tags) && q.tags.includes('level:preclinical') ? RUBRIC_PRECLINICAL : RUBRIC_SYSTEM, content: rubricText(q), schema: RUBRIC_SCHEMA, effort: 'high', label: `${q.id} rubric` });
  return { hash: contentHash(q), judge: judge || model || 'unknown', judgeVersion: JUDGE_VERSION, at: now(), solves, rubric: cleanRubric(rubric) };
}
const clip = (a, k, n) => (Array.isArray(a) ? a : []).map(x => String(x).slice(0, n)).filter(Boolean).slice(0, k);
export function cleanRubric(r) {
  const i = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v) || lo)));
  return {
    key_correct: ['yes', 'no', 'unsure'].includes(r?.key_correct) ? r.key_correct : 'unsure', other_defensible: clip(r?.other_defensible, 4, 2),
    single_best: i(r?.single_best, 1, 5), distractors: i(r?.distractors, 1, 5), relevance: i(r?.relevance, 1, 5), accuracy: i(r?.accuracy, 1, 5), explanation: i(r?.explanation, 0, 5),
    safety: { ok: r?.safety?.ok !== false, issues: clip(r?.safety?.issues, 3, 200) }, flaws: clip(r?.flaws, 6, 120),
    topic: SPECIALTIES.includes(r?.topic) ? r.topic : '', verdict: ['accept', 'revise', 'reject'].includes(r?.verdict) ? r.verdict : 'revise',
    reasons: clip(r?.reasons, 3, 240), suggestion: String(r?.suggestion || '').slice(0, 500)
  };
}

/* how many of the two independent solves reached the key */
export const solved = (v, q) => (v?.solves || []).filter(s => s.answer === q.answer).length;
/* 0..100: the solver's agreement 30, single best 20, distractors 15, relevance 15, accuracy 20 (explanation is reported, not scored:
   the open banks carry none, and the duel shows the per-option reasons instead) */
export function judgeScore(v, q) {
  const r = v.rubric, f = x => (x - 1) / 4;
  return Math.round(30 * (solved(v, q) / 2) + 20 * f(r.single_best) + 15 * f(r.distractors) + 15 * f(r.relevance) + 20 * f(r.accuracy));
}
/* the hard reasons a judged question cannot enter the pool, whatever its score */
export function judgeGates(v, q, { strict = false } = {}) {
  const r = v.rubric, out = [], s = solved(v, q);
  if (r.key_correct === 'no') out.push('the reviewer judged the key wrong');
  if (!r.safety.ok) out.push(`unsafe: ${r.safety.issues[0] || 'the reviewer flagged a safety problem'}`);
  if (s === 0) out.push('an independent solver reached another answer both times');
  if (strict && s < 2) out.push('an AI-written question must be solved to its key both times');
  if (r.single_best <= 2) out.push(`not a single best answer${r.other_defensible.length ? ` (${r.other_defensible.join(', ')} also defensible)` : ''}`);
  if (r.verdict === 'reject') out.push(`the reviewer rejected it: ${r.reasons[0] || 'no reason given'}`);
  return out;
}
/* a verdict is current only for the exact text it judged */
export const verdictFor = (verdicts, q) => { const v = verdicts?.[q.id]; return v && v.hash === contentHash(q) ? v : null; };
