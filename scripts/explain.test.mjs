/* lib/mcq-explain.mjs: explanations for pooled questions published without one, kept only when checked, tied to the
   question as it is, and marked AI-written in the pack */
import test from 'node:test';
import assert from 'node:assert/strict';
import { needsExplanation, explanationOf, passesCheck, storedFor, record, explainBrief, WHY_MAX } from './lib/mcq-explain.mjs';
import { poolQuestion } from './lib/duel-pack.mjs';

const q = { id: 'medqa-1', stem: 'A 35-year-old man has itchy, watery eyes and sneezing each spring. Examination shows bilateral conjunctival injection with watery discharge.', ask: 'What is the most appropriate treatment?',
  options: ['Erythromycin ointment', 'Ketotifen eye drops', 'Warm compresses', 'Fluorometholone eye drops'], answer: 1, explanation: '', why: [null, null, null, null], topic: 'Ophthalmology', tags: ['src:medqa'],
  provenance: { kind: 'usmle-resource', source: { name: 'MedQA' } } };
const why = 'Seasonal itch, watery discharge and sneezing are allergic conjunctivitis; a topical antihistamine and mast cell stabiliser such as ketotifen is first line.';
const notes = ['Erythromycin treats bacterial conjunctivitis, which gives a purulent discharge.', '', 'Warm compresses suit blepharitis or a chalazion.', 'A topical steroid is kept for severe disease under an ophthalmologist.'];

test('a question needs one when it came without an explanation worth the name', () => {
  assert.ok(needsExplanation(q));
  assert.ok(needsExplanation({ ...q, explanation: 'See text.' }));
  assert.ok(!needsExplanation({ ...q, explanation: why }));
});

test('a written explanation: kept with a note per wrong option, refused for what a student would trip on', () => {
  const ok = explanationOf(q, { why, notes });
  assert.deepEqual(ok.e, { why, notes: [notes[0], null, notes[2], notes[3]] });
  assert.deepEqual(explanationOf(q, { why, notes: notes.filter(Boolean) }).e.notes, [notes[0], null, notes[2], notes[3]], 'notes for the wrong options only are put back around the key');
  assert.match(explanationOf(q, { why: 'Allergic.', notes }).why.join(), /too short/);
  assert.match(explanationOf(q, { why: 'x'.repeat(WHY_MAX + 1), notes }).why.join(), /over/);
  assert.match(explanationOf(q, { why, notes: [notes[0], '', '', notes[3]] }).why.join(), /no note for option 3/);
  assert.match(explanationOf(q, { why, notes: notes.slice(0, 2) }).why.join(), /one note per option/);
  assert.match(explanationOf(q, { why: `${why} Option A is wrong.`, notes }).why.join(), /by letter/, 'the options are shuffled when shown');
  assert.deepEqual(explanationOf(q, { why: `${why} Vitamin A deficiency is not the cause.`, notes }).why, [], 'a capital A in a word is not an option letter');
  assert.deepEqual(explanationOf(q, { why: `${why} It is not haemophilia A.`, notes: [notes[0], '', 'Group A streptococcus causes it: not here.', notes[3]] }).why, [], 'nor a disease named with a letter');
  assert.match(explanationOf(q, { why: `${why} So (B) is right.`, notes }).why.join(), /by letter/);
});

test('only a reviewed, accurate and consistent explanation is kept; a changed question drops it', () => {
  assert.ok(passesCheck({ accurate: true, consistent: true }));
  assert.ok(!passesCheck({ accurate: true, consistent: false }) && !passesCheck({ accurate: false, consistent: true }) && !passesCheck(null));
  const store = { [q.id]: record(q, explanationOf(q, { why, notes }).e, { model: 'opus', at: '2026-10-27' }) };
  assert.equal(storedFor(store, q).by, 'ai');
  assert.equal(storedFor(store, { ...q, answer: 3 }), null, 'a different key is a different question');
  assert.equal(storedFor(store, { ...q, explanation: 'anything' })?.by, 'ai', 'the hash is the question, not its explanation');
  assert.deepEqual(Object.keys(explainBrief(q)), ['id', 'question', 'options', 'key', 'key_text']);
});

test('in the pack: the stored explanation fills a question that has none, marked AI-written; a published one wins', () => {
  const store = { [q.id]: record(q, explanationOf(q, { why, notes }).e) };
  const p = poolQuestion(q, new Map(), {}, store).q;
  assert.equal(p.why, why); assert.equal(p.whyBy, 'ai');
  assert.deepEqual(p.notes, [notes[0], null, notes[2], notes[3]]);
  const own = poolQuestion({ ...q, explanation: 'The published explanation, which says why ketotifen is right here.' }, new Map(), {}, store).q;
  assert.equal(own.whyBy, undefined); assert.match(own.why, /published/);
  assert.equal(poolQuestion(q).q.why, undefined, 'nothing stored, nothing shown');
});
