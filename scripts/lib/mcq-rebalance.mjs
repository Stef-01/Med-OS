/* lib/mcq-rebalance.mjs - pure: one cue taken out of written questions. In the high-yield set (scripts/generate-hy.mjs)
   and the station questions (scripts/generate-duel-mcq.mjs), written before the writers refused it, the key was the
   single longest option in 60% and 51% (docs/mcq-audit.md, 2026-10-27): a student can pick it on length alone, and the
   duel's option shuffle cannot hide length. scripts/rebalance-options.mjs asks Claude to rewrite the wrong options only,
   then keeps a rewrite only if it passes these checks and an independent examiner, answering blind, still picks the key. */
import { keyIsLongest } from '../../public/js/mcq/flaws.mjs';
import { writerChecks, LIMITS } from './mcq.mjs';

export const REBALANCE_SYSTEM = `You fix one cue in single-best-answer questions written for Australian medical students: the correct option is the single longest, so a test-wise student can pick it without knowing the medicine.

For each question, rewrite the WRONG options, never the correct one, so that at least one of them is as long as the correct option or longer. Add the specific, plausible detail a real distractor carries (a dose, a timeframe, a route, a qualifier, a second step), in the same style and grammar as the correct option, so it reads as a confident, complete answer. The added detail must never hint that the option is wrong: do not name the other disease it belongs to, what it is really used for, or why it does not fit ("Asbestos fibres, causing mesothelioma" gives itself away; "Asbestos fibres inhaled over years of exposure" does not). Each rewritten option keeps the idea it had (do not swap in a different distractor), stays clearly wrong for this question, and stays within ${LIMITS.option} characters. If the correct option is too long for any wrong option to match within that, you may instead shorten the correct option, keeping its exact meaning; say so by setting keyShortened.

Return every question's options in the same order, with the correct option copied word for word unless you shortened it.`;
const str = { type: 'string' };
export const REBALANCE_SCHEMA = { type: 'object', additionalProperties: false, required: ['items'], properties: { items: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'options', 'keyShortened'], properties: { id: str, options: { type: 'array', items: str }, keyShortened: { type: 'boolean' } } } } } };
/* the examiner, as generate-hy.mjs asks it, for any number of options */
export const examSchema = n => ({ type: 'object', additionalProperties: false, required: ['answers'], properties: { answers: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'answer'], properties: { id: str, answer: { type: 'integer', minimum: -1, maximum: n - 1 } } } } } });

const trim = s => String(s ?? '').replace(/\s+/g, ' ').trim();
export const needsRebalance = q => Array.isArray(q?.options) && keyIsLongest({ options: q.options.map(trim), answer: q.answer });
export const brief = q => ({ id: q.id, stem: q.stem, options: q.options, correct: q.answer });

/* a rewrite as the question, or the reasons it is refused: the same number of options, the key word for word, the cue
   gone, and the writer's own checks still passing (writerChecks refuses a longest key too). A shortened key (keyShortened)
   must be shorter; whether it still means the same is the examiner's to confirm, answering blind */
export function rebalanced(q, options, keyShortened = false) {
  const why = [];
  if (!Array.isArray(options) || options.length !== q.options.length) return { q: null, why: ['a different number of options'] };
  const opts = options.map(trim);
  if (!keyShortened && opts[q.answer] !== trim(q.options[q.answer])) why.push('the correct option was changed');
  if (keyShortened && opts[q.answer].length >= trim(q.options[q.answer]).length) why.push('the correct option was changed but not shortened');
  if (opts.some(o => !o)) why.push('an empty option');
  if (new Set(opts.map(o => o.toLowerCase())).size !== opts.length) why.push('two options the same');
  const next = { ...q, options: opts };
  why.push(...writerChecks(next));
  return why.length ? { q: null, why } : { q: next, why: [] };
}
