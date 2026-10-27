/* lib/mcq-explain.mjs - pure: explanations for the pooled questions that came without one. The USMLE resource set
   (MedQA) and the HEAD-QA papers publish the key only, so 259 questions in the duel pack (2026-10-27 audit: all 144
   usmle-resource, 115 of open-exam) showed no "why" in Study or after a duel. scripts/explain-mcq.mjs asks Claude for
   one with the key given, a second review checks it, and only a checked one is kept (data/mcq/explanations.json).

   The question is never touched: its stem, options, key and provenance stay as published (docs/mcq.md, rule 9). The
   explanation is a separate record, tied to the question's content hash (a changed question drops it) and marked
   AI-written: the pack carries whyBy "ai" and Study and the duel say so under it. */
import { contentHash, fullStem } from '../../public/js/mcq/schema.mjs';
import { LIMITS } from './mcq.mjs';

/* a question needs one when it has no explanation worth the name (the flaw checks' own bar: 40 characters) */
export const MIN_WHY = 40;
export const needsExplanation = q => String(q?.explanation || '').trim().length < MIN_WHY;
/* a little longer than a written question's (LIMITS.why): a published question's case is longer, and Study folds
   anything past 220 characters behind Read all */
export const WHY_MAX = 400;

export const EXPLAIN_SYSTEM = `You write the explanation a student reads after answering a single-best-answer question. The key is given and has been checked; explain it, do not second-guess it.

For each question:
- why: why the key is the best answer, in one to three sentences, at most ${WHY_MAX - 60} characters. Name the finding or fact in the stem that decides it and the principle to remember. If current Australian practice differs from what the question expects (a US drug name or guideline), add one short clause saying so.
- notes: exactly one per option, in the order given, so as many notes as options: "" at the key's place; for each wrong option, one sentence (at most ${LIMITS.note} characters) on why it is not the best answer here, tied to the stem (what it would fit, or what in the stem rules it out).
Plain text, no markdown, no option letters (the options are shuffled when shown). Answer for every id given.`;

export const CHECK_SYSTEM = `You review explanations written for single-best-answer questions before students see them. Each item gives the question, its key and the explanation (why, and a note per wrong option). For each, say:
- accurate: false if any statement is wrong on current medical knowledge, or would mislead an Australian student;
- consistent: false if the explanation argues for an option other than the key, contradicts the stem, or a note calls a wrong option right;
- problem: what is wrong, in a sentence ("" when both are true).
Judge only the explanation; the key is correct.`;

const str = { type: 'string' };
const obj = props => ({ type: 'object', additionalProperties: false, required: Object.keys(props), properties: props });
export const EXPLAIN_SCHEMA = obj({ items: { type: 'array', items: obj({ id: str, why: str, notes: { type: 'array', items: str } }) } });
export const CHECK_SCHEMA = obj({ items: { type: 'array', items: obj({ id: str, accurate: { type: 'boolean' }, consistent: { type: 'boolean' }, problem: str }) } });

/* what the writer sees: the question as published and its key */
export const explainBrief = q => ({ id: q.id, question: fullStem(q), options: q.options, key: q.answer, key_text: q.options[q.answer] });
export const checkBrief = (q, e) => ({ ...explainBrief(q), why: e.why, notes: e.notes });

const tidy = s => String(s ?? '').replace(/\s+/g, ' ').trim();
/* one written explanation as a record, or the reasons it is refused. Notes for the wrong options only (one fewer than
   the options, the writer's habit in the first run: 34 of 44 refusals) are put back in place around the key */
export function explanationOf(q, w) {
  const why = tidy(w?.why), out = [];
  let notes = Array.isArray(w?.notes) ? w.notes.map(tidy) : [];
  if (notes.length === q.options.length - 1) notes = [...notes.slice(0, q.answer), '', ...notes.slice(q.answer)];
  if (why.length < MIN_WHY) out.push('the explanation is too short');
  if (why.length > WHY_MAX) out.push(`the explanation is over ${WHY_MAX} characters`);
  if (notes.length !== q.options.length) out.push('not one note per option');
  else notes.forEach((n, i) => { if (i !== q.answer && !n) out.push(`no note for option ${i + 1}`); if (n.length > LIMITS.note) out.push(`note ${i + 1} is over ${LIMITS.note} characters`); });
  if (/(^|\s)\(?[A-E]\)(\s|$)|\b[Oo]ptions? [A-E]\b|\b[Aa]nswer [A-E]\b/.test(`${why} ${notes.join(' ')}`)) out.push('it names an option by letter (the options are shuffled when shown)');
  if (/[*_`#]{2,}|^\s*[-*]\s/m.test(why)) out.push('markdown');
  return out.length ? { e: null, why: out } : { e: { why, notes: notes.map((n, i) => (i === q.answer ? null : n)) }, why: [] };
}

/* the review's call on it */
export const passesCheck = c => !!c && c.accurate === true && c.consistent === true;

/* a stored record for this question, if it still matches it */
export const storedFor = (store, q) => { const r = store?.[q.id]; return r && r.hash === contentHash(q) ? r : null; };
export const record = (q, e, { model = '', at = '' } = {}) => ({ hash: contentHash(q), why: e.why, notes: e.notes, by: 'ai', model, at });

/* what the evals report (section 7): of the pooled questions that need one, how many have a reviewed explanation, by
   kind, and why the rest were refused (the format checks, or the review) */
export function explainStats(questions, store = {}, refused = {}) {
  const need = questions.filter(needsExplanation), byKind = {};
  let kept = 0, review = 0, format = 0;
  for (const q of need) {
    const k = (byKind[q.provenance?.kind || 'unknown'] ||= { need: 0, kept: 0 });
    k.need++;
    if (storedFor(store, q)) { k.kept++; kept++; continue; }
    const why = refused[q.id]?.why || '';
    if (why.startsWith('review')) review++; else if (why) format++;
  }
  const reasons = Object.values(refused).map(r => r.why).filter(w => w.startsWith('review')).map(w => w.replace(/^review:\s*/, ''));
  return { need: need.length, kept, share: need.length ? Math.round((1000 * kept) / need.length) / 10 : null, refusedByReview: review, refusedByFormat: format, missing: need.length - kept, byKind, reviewReasons: reasons };
}
