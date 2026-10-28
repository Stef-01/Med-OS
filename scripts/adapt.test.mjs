/* lib/mcq-adapt.mjs: HEAD-QA's wording adapted, the question and its key as published */
import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptationOf, storedAdaptation, adaptRecord, ADAPTED_CREDIT } from './lib/mcq-adapt.mjs';
import { poolQuestion } from './lib/duel-pack.mjs';

const q = { id: 'headqa-2013-1', stem: 'A calcium figure of 11 mg / dL is found in a 30-year-old patient during a routine business examination. The story is anodyne. Which test is most useful?', options: ['25-OH D.', 'PTHrP.', 'Calcium / creatinine ratio in urine.', 'Tubular reabsorption of phosphates.'], answer: 2, explanation: '', why: [null, null, null, null], topic: 'Endocrinology', tags: ['src:headqa'], provenance: { kind: 'open-exam', source: { name: 'HEAD-QA (MIR 2013)' } } };
const w = { stem: 'A 30-year-old has a serum calcium of 2.75 mmol/L at a routine work medical; the history is otherwise unremarkable. Which test is most useful?', options: ['25-hydroxyvitamin D', 'PTHrP', 'Urinary calcium to creatinine ratio', 'Tubular reabsorption of phosphate'] };

test('an adaptation is kept when the shape holds, and refused when it changes it', () => {
  assert.deepEqual(adaptationOf(q, w).why, []);
  assert.match(adaptationOf(q, { ...w, options: w.options.slice(0, 3) }).why.join(), /number of options/);
  assert.match(adaptationOf(q, { ...w, stem: 'A 30-year-old has a raised calcium.' }).why.join(), /end with the question/);
  assert.match(adaptationOf(q, { ...w, options: [w.options[0], w.options[0], w.options[2], w.options[3]] }).why.join(), /two options the same/);
});

test('in the pack: the adapted wording, the same key, and the credit says so; a changed question drops it', () => {
  const store = { [q.id]: adaptRecord(q, adaptationOf(q, w).a) };
  const p = poolQuestion(q, new Map(), {}, {}, store).q;
  assert.equal(p.stem, w.stem); assert.deepEqual(p.options, w.options); assert.equal(p.answer, 2);
  assert.ok(p.credit.includes(ADAPTED_CREDIT) && p.credit.startsWith('HEAD-QA'));
  assert.equal(storedAdaptation(store, { ...q, answer: 1 }), null);
  assert.equal(poolQuestion(q).q.stem, q.stem, 'nothing stored, published wording');
});
