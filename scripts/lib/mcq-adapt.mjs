/* lib/mcq-adapt.mjs - pure: clearer English for HEAD-QA's questions. The pool keeps open-exam questions as published,
   and HEAD-QA's English is the dataset's machine translation of the Spanish MIR ("The story is anodyne", "a routine
   business examination", mg/dL). scripts/adapt-headqa.mjs asks Claude to rewrite the wording only, for Australian
   practice and SI units, with the same options in the same order and the same key; a blind examiner must still choose
   that key. The pool question is never changed: the adaptation is its own record (data/mcq/adapted.json) tied to the
   question's content hash, and the duel pack shows it with "wording adapted by AI" in the credit line (founder's
   default, 2026-10-28). */
import { contentHash, fullStem } from '../../public/js/mcq/schema.mjs';
import { LIMITS } from './mcq.mjs';

export const ADAPT_SYSTEM = `You edit exam questions that were machine-translated from Spanish into English, for Australian medical students. For each question:
- Rewrite the stem as clear, natural clinical English: fix the translation ("the story is anodyne" means the history is unremarkable; "analytical" means blood tests; "VN" means the normal range), use Australian spelling and drug names, and give laboratory values in SI units with their normal ranges where the original gives them.
- Rewrite each option the same way, keeping every option's meaning, and keep them in the same order: the correct option stays the correct one.
- Change nothing medical: the facts, the numbers (converted, not rounded away), the question asked and the answer stay the same. Do not add hints, and never name the answer in the stem.
- The stem stays under ${LIMITS.stem * 2} characters, each option under ${LIMITS.option} characters, and the stem ends with the question.
Answer for every id given.`;
const str = { type: 'string' };
const obj = props => ({ type: 'object', additionalProperties: false, required: Object.keys(props), properties: props });
export const ADAPT_SCHEMA = obj({ items: { type: 'array', items: obj({ id: str, stem: str, options: { type: 'array', items: str } }) } });
export const adaptBrief = q => ({ id: q.id, stem: fullStem(q), options: q.options, correct: q.answer });

const tidy = s => String(s ?? '').replace(/\s+/g, ' ').trim();
/* a rewrite as a record, or the reasons it is refused */
export function adaptationOf(q, w) {
  const stem = tidy(w?.stem), options = Array.isArray(w?.options) ? w.options.map(tidy) : [], why = [];
  if (stem.length < 20) why.push('the stem is too short');
  if (stem.length > LIMITS.stem * 2) why.push('the stem is too long');
  if (!/\?\s*$/.test(stem)) why.push('the stem does not end with the question');
  if (options.length !== q.options.length) why.push('a different number of options');
  if (options.some(o => !o || o.length > LIMITS.option)) why.push('an empty or over-long option');
  if (new Set(options.map(o => o.toLowerCase())).size !== options.length) why.push('two options the same');
  if (options[q.answer] && stem.toLowerCase().includes(options[q.answer].toLowerCase()) && options[q.answer].length > 12) why.push('the stem names the answer');
  return why.length ? { a: null, why } : { a: { stem, options }, why: [] };
}
export const storedAdaptation = (store, q) => { const r = store?.[q.id]; return r && r.hash === contentHash(q) ? r : null; };
export const adaptRecord = (q, a, { model = '', at = '' } = {}) => ({ hash: contentHash(q), stem: a.stem, options: a.options, by: 'ai', model, at });
export const ADAPTED_CREDIT = 'wording adapted by AI for Australian practice; the question and its answer are as published';
