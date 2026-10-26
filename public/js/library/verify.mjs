/* library/verify.mjs - checking the medicine of an upload (research 2026-10-26: in a 2025 study 49 % of ChatGPT-written
   medical MCQs had item-writing flaws and 22 % factual errors; the flaw checks in item.mjs catch the first, this the
   second). Claude answers each question blind and says whether the keyed answer is the one best answer on current
   Australian practice; a question it disagrees with is held back with its reason, and the student can keep it anyway.
   Pure: the prompt, the schema and what to do with the answer. The call is the marker's (osce/marker.mjs: the student's
   own Anthropic key from Settings, from this browser). */

export const VERIFY_SYSTEM = `You are a senior clinician checking multiple-choice questions written by ChatGPT for Australian medical students. For each question: choose the one best answer yourself on current Australian practice (eTG, the Australian Medicines Handbook, RACGP, the colleges, state guidelines), then compare it with the given key. ok is true only when the key is the single best answer and no other option is equally defensible, and the stem and options contain no factual error. When ok is false, issue says in one plain sentence what is wrong (the key is wrong and why, two options are defensible, a fact is wrong, the question is ambiguous). Answer for every id.`;
export const VERIFY_SCHEMA = { type: 'object', additionalProperties: false, required: ['checks'], properties: { checks: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'choice', 'ok', 'issue'], properties: { id: { type: 'string' }, choice: { type: 'integer', minimum: 0, maximum: 5 }, ok: { type: 'boolean' }, issue: { type: 'string' } } } } } };
const LET = 'ABCDE';
/* what Claude reads: each question with its key, ids as given */
export const verifyPrompt = items => JSON.stringify(items.map(q => ({ id: q.id, stem: `${q.stem}${q.ask ? ` ${q.ask}` : ''}`, options: q.options.map((o, i) => `${LET[i]}. ${o}`), key: LET[q.answer], explanation: q.explanation || '' })));
/* the checks onto the items: { pass: [item], held: [{ item, issue }] }; an item Claude did not answer for passes (the
   flaw checks already did) and is counted unchecked */
export function applyChecks(items, checks) {
  const by = new Map((checks || []).filter(c => c && typeof c.id === 'string').map(c => [c.id, c]));
  const pass = [], held = []; let unchecked = 0;
  for (const it of items) {
    const c = by.get(it.id);
    if (!c) { unchecked++; pass.push(it); continue; }
    if (c.ok && c.choice === it.answer) pass.push({ ...it, checked: 1 });
    else held.push({ item: it, issue: String(c.issue || (c.choice !== it.answer ? `Claude chose ${LET[c.choice] || '?'}, the key says ${LET[it.answer]}` : 'not the single best answer')).slice(0, 300) });
  }
  return { pass, held, unchecked };
}
