/* the MCQ pool's pure laws: the question schema and its provenance (public/js/mcq/schema.mjs), every item-writing flaw
   check (public/js/mcq/flaws.mjs), the mutations that test the checks (lib/mcq-mutate.mjs) */
import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanItem, itemProblems, licenceOk, draftsFrom, parseCsv, userItem, contentHash, fullStem, duelOrigin, kindLabel, newUserId, displayOrder } from '../public/js/mcq/schema.mjs';
import * as F from '../public/js/mcq/flaws.mjs';
import { mutantsOf, MUTATIONS, wrongKey } from './lib/mcq-mutate.mjs';

export const GOOD = Object.freeze({
  id: 'medqa-test-0001',
  stem: 'A 64-year-old man comes to the emergency department because of crushing central chest pain for 2 hours. He has hypertension and smokes. His pulse is 96/min and blood pressure is 150/90 mm Hg. Examination shows diaphoresis. An ECG shows 3 mm ST elevation in leads II, III and aVF.',
  ask: 'Which of the following is the most appropriate next step in management?',
  options: ['Primary percutaneous coronary intervention', 'Exercise electrocardiographic stress testing', 'Outpatient transthoracic echocardiography', 'Oral proton pump inhibitor therapy trial', 'CT pulmonary angiography of the chest'],
  answer: 0, explanation: 'Inferior STEMI within 12 hours of onset needs reperfusion, and primary PCI is preferred where it is available in time.',
  why: [null, 'Stress testing is contraindicated in an acute infarct.', 'Delays reperfusion.', 'The pain is not reflux.', 'Nothing points to pulmonary embolism.'],
  topic: 'Cardiology', tags: ['src:test'],
  provenance: { kind: 'usmle-resource', source: { name: 'A test bank', url: 'https://example.org', licence: 'MIT' }, createdAt: '2026-10-25' }
});
export const good = (over = {}) => ({ ...structuredClone(GOOD), ...over });
const fails = (fn, q) => !fn(q).pass;

test('cleanItem keeps a valid question as given, provenance included', () => {
  const q = cleanItem(good());
  assert.equal(q.id, GOOD.id); assert.deepEqual(q.options, GOOD.options); assert.equal(q.answer, 0);
  assert.deepEqual(q.provenance, { kind: 'usmle-resource', source: { name: 'A test bank', url: 'https://example.org', licence: 'MIT' }, createdAt: '2026-10-25' });
  assert.equal(fullStem(q), `${GOOD.stem} ${GOOD.ask}`);
  assert.equal(duelOrigin(q), 'human'); assert.equal(kindLabel(q), 'USMLE resource');
  assert.equal(duelOrigin({ provenance: { kind: 'amsa' } }), 'ai'); assert.equal(duelOrigin({ provenance: { kind: 'ai' } }), 'ai'); assert.equal(duelOrigin({ provenance: { kind: 'user' } }), 'human');
});

test('itemProblems: the shape, a licence the pool accepts, no commercial or official bank, provenance that says who made it', () => {
  assert.deepEqual(itemProblems(good()), []);
  assert.match(itemProblems(good({ options: ['a', 'b', 'c'] })).join(), /options: 4 or 5/);
  assert.match(itemProblems(good({ answer: 7 })).join(), /answer/);
  assert.match(itemProblems(good({ stem: 'Short' })).join(), /stem/);
  assert.match(itemProblems(good({ stem: `${GOOD.stem} <b>bold</b>` })).join(), /plain text/);
  assert.match(itemProblems(good({ provenance: { ...GOOD.provenance, kind: 'scraped' } })).join(), /provenance.kind/);
  assert.match(itemProblems(good({ provenance: { ...GOOD.provenance, source: { name: 'UWorld Step 2', licence: 'own' } } })).join(), /commercial or official bank/);
  assert.match(itemProblems(good({ provenance: { ...GOOD.provenance, source: { name: 'x', licence: 'All rights reserved' } } })).join(), /licence/);
  assert.match(itemProblems(good({ provenance: { kind: 'ai', source: { name: 'x', licence: 'own' }, createdAt: '2026-10-25' } })).join(), /says how it was made/);
  assert.match(itemProblems(good({ provenance: { kind: 'user', source: { name: 'x', licence: 'own' }, createdAt: '2026-10-25' } })).join(), /who submitted/);
  assert.ok(licenceOk('MIT (Copyright (c) 2022 Di Jin)') && licenceOk('CC BY 4.0') && licenceOk('own') && !licenceOk('Copyright FSMB and NBME') && !licenceOk(''));
  assert.equal(cleanItem(good({ answer: -1 })), null);
});

test('contentHash changes with the text a verdict was given for, not with its tags or eval', () => {
  const h = contentHash(good());
  assert.equal(contentHash(good({ tags: ['x'], eval: { a: 1 } })), h);
  assert.notEqual(contentHash(good({ answer: 1 })), h);
  assert.notEqual(contentHash(good({ ask: 'Which of the following is the most likely diagnosis?' })), h);
});

test('userItem: a student\'s own question is "own"; one from elsewhere names its source and licence; provenance is user', () => {
  const d = { stem: GOOD.stem, ask: GOOD.ask, options: [...GOOD.options.slice(0, 4), ''], answer: 0, explanation: GOOD.explanation, topic: 'Cardiology', author: 'Sam' };
  const own = cleanItem(userItem(d, { by: 'Sam', now: Date.parse('2026-10-25T10:00:00Z'), id: 'u-abc12345' }));
  assert.equal(own.options.length, 4, 'an empty fifth option is no option');
  assert.deepEqual(own.provenance, { kind: 'user', source: { name: 'Written by the submitter', url: '', licence: 'own' }, author: 'Sam', submittedBy: 'Sam', createdAt: '2026-10-25T10:00:00.000Z' });
  const open = userItem({ ...d, source: 'An open bank', url: 'https://x.org', licence: 'CC BY 4.0' }, { by: 'Alex', now: 1, id: 'u-abc12346' });
  assert.equal(open.provenance.source.licence, 'CC BY 4.0'); assert.equal(open.provenance.kind, 'user');
  const gap = userItem({ ...d, options: ['A', '', 'C', 'D'] }, { by: 'Sam', now: 1, id: 'u-abc12347' });
  assert.match(itemProblems(gap).join(), /empty option/, 'an empty option in the middle is reported, not dropped (the key would move)');
  assert.match(newUserId(1700000000000, () => 0.5), /^u-[a-z0-9]{6,24}$/);
});

test('draftsFrom reads JSON (one, a list, an export) and CSV with quotes, commas, new lines and a letter key', () => {
  assert.equal(draftsFrom(JSON.stringify(good()))[0].answer, 0);
  assert.equal(draftsFrom(JSON.stringify({ mcqSubmissions: 1, items: [good(), good()] })).length, 2);
  const lettered = draftsFrom(JSON.stringify({ question: 'A stem that is long enough?', A: 'a', B: 'b', C: 'c', D: 'd', key: 'C' }))[0];
  assert.deepEqual([lettered.options.length, lettered.answer], [4, 2]);
  const csv = 'stem,a,b,c,d,answer,explanation,source,licence\n"A 30-year-old woman, pregnant, says ""help"".\nWhat next?",One,Two,Three,Four,B,Because,An open bank,CC BY 4.0\n';
  const [d] = draftsFrom(csv);
  assert.equal(d.stem, 'A 30-year-old woman, pregnant, says "help".\nWhat next?'); assert.deepEqual(d.options, ['One', 'Two', 'Three', 'Four']); assert.equal(d.answer, 1); assert.equal(d.licence, 'CC BY 4.0');
  assert.deepEqual(parseCsv('a,b\n1,"2,3"\n'), [['a', 'b'], ['1', '2,3']]);
  assert.deepEqual(draftsFrom('not json, not csv'), []);
});

test('the lead-in and the vignette: the ask, else the last sentence that asks (a lab table after it still counts)', () => {
  assert.equal(F.leadIn(good()), GOOD.ask);
  const q = good({ ask: undefined, stem: 'A 40-year-old man has pain. His pulse is 90/min. What is the number needed to treat? (Round to the nearest whole number.)' });
  delete q.ask;
  assert.equal(F.leadIn(q), 'What is the number needed to treat?');
  assert.match(F.vignette(q), /^A 40-year-old man has pain\. His pulse is 90\/min\. \(Round/);
});

test('each flaw check passes the good question', () => {
  const r = F.flawReport(good());
  assert.deepEqual(r.failed.map(f => f.check), []);
  assert.equal(r.score, 100); assert.equal(r.blocked, false);
  for (const c of r.results) assert.ok('check' in c && 'pass' in c && 'severity' in c && 'reason' in c);
});

const lead = ask => good({ ask });
test('lead-in, cover-the-options: a question that asks, focused, closed', () => {
  assert.ok(fails(F.checkLeadIn, good({ ask: 'The ECG is shown.' })));
  assert.equal(F.checkCover(lead('Which of the following statements is true?')).severity, 'major');
  assert.ok(fails(F.checkCover, lead('Which of the following is true about this condition?')));
  const colon = F.checkCover(lead('The most appropriate next step in management is:')); assert.equal(colon.pass, false); assert.equal(colon.severity, 'minor');
  assert.ok(!fails(F.checkCover, good()));
});
test('all/none of the above and option combinations', () => {
  for (const o of ['All of the above', 'None of the above', 'Both A and B', 'A and C']) { const q = good(); q.options[3] = o; assert.ok(fails(F.checkAllNone, q), o); }
  assert.ok(!fails(F.checkAllNone, good()));
});
test('negative stems: EXCEPT, NOT, least, false', () => {
  for (const a of ['Each of the following is a cause EXCEPT which?', 'Which of the following is NOT indicated?', 'Which is the least likely diagnosis?', 'Which of the following would not be appropriate?']) assert.ok(fails(F.checkNegative, lead(a)), a);
  assert.ok(!fails(F.checkNegative, good()));
  assert.ok(!fails(F.checkNegative, good({ stem: `${GOOD.stem} He does not smoke.` })), 'a negative in the vignette is not a negative stem');
});
test('longest option is the key (by a clear margin only)', () => {
  const q = good(); q.options[0] = 'Primary percutaneous coronary intervention of the right coronary artery within ninety minutes';
  assert.ok(fails(F.checkLongest, q));
  assert.ok(!fails(F.checkLongest, good()), 'the key is longest, but not by a mile');
});
test('grammatical cues: an article only the key fits', () => {
  const q = good({ ask: 'This patient most likely has an', options: ['Aortic dissection', 'Pericarditis', 'Pneumothorax', 'Myocarditis', 'Costochondritis'] });
  assert.equal(F.checkGrammar(q).pass, false);
  assert.ok(!fails(F.checkGrammar, good()));
});
test('convergence: the key is made of what the distractors share', () => {
  const q = good({ options: ['Aspirin, heparin and clopidogrel', 'Aspirin and warfarin', 'Heparin and alteplase', 'Clopidogrel and digoxin', 'Furosemide only'], answer: 0 });
  assert.equal(F.checkConvergence(q).pass, false);
  assert.ok(!fails(F.checkConvergence, good()));
});
test('absolute terms only in the distractors', () => {
  const q = good(); q.options[1] = 'Always start with exercise electrocardiographic stress testing';
  assert.ok(fails(F.checkAbsolutes, q));
  const k = structuredClone(q); k.options[0] = 'Always primary percutaneous coronary intervention';
  assert.ok(!fails(F.checkAbsolutes, k), 'the key has one too: no cue');
});
test('clang: the key named in the stem (major), one rare word repeated (minor)', () => {
  const named = good({ stem: `${GOOD.stem} The registrar suggests primary percutaneous coronary intervention.` });
  assert.equal(F.checkClang(named).severity, 'major'); assert.equal(F.checkClang(named).pass, false);
  const word = good({ stem: GOOD.stem.replace('He has hypertension', 'He had a percutaneous biopsy last year and has hypertension') });
  const r = F.checkClang(word); assert.equal(r.pass, false); assert.equal(r.severity, 'minor'); assert.match(r.reason, /percutaneous/);
  assert.ok(!fails(F.checkClang, good()));
});
test('duplicate options: the same (block), the same words reordered or with an article (major), not ones that differ in a number', () => {
  const same = good(); same.options[2] = same.options[1].toUpperCase();
  assert.equal(F.checkDuplicates(same).severity, 'block');
  const near = good(); near.options[2] = `The ${near.options[3].toLowerCase()}`;
  assert.deepEqual([F.checkDuplicates(near).pass, F.checkDuplicates(near).severity], [false, 'major']);
  const nums = good({ options: ['Repeat cultures in 24 hours', 'Repeat cultures in 48 hours', 'Do not repeat cultures', 'Start vancomycin', 'Remove the line'] });
  assert.ok(!fails(F.checkDuplicates, nums));
});
test('vignette completeness: age, sex, setting, presentation, findings', () => {
  assert.ok(!fails(F.checkVignette, good()));
  const thin = good({ stem: 'A 64-year-old man has an ECG with ST elevation in II, III and aVF.' });
  assert.equal(F.checkVignette(thin).pass, false);
  const none = good({ stem: 'Aspirin irreversibly inhibits cyclooxygenase in platelets for their lifespan.', ask: 'Which enzyme does aspirin inhibit?' });
  assert.match(F.checkVignette(none).reason, /Not a clinical vignette/);
});
test('stem length window', () => {
  assert.ok(fails(F.checkLength, good({ stem: 'A 64-year-old man has chest pain in the emergency department.' })));
  assert.ok(fails(F.checkLength, good({ stem: `${GOOD.stem} ${'More history follows here. '.repeat(120)}` })));
  assert.ok(!fails(F.checkLength, good()));
});
test('units on measurements', () => {
  assert.match(F.checkUnits(good({ stem: GOOD.stem.replace('150/90 mm Hg', '150/90') })).reason, /blood pressure 150/);
  assert.ok(fails(F.checkUnits, good({ stem: `${GOOD.stem} Serum potassium is 6.1.` })));
  assert.ok(!fails(F.checkUnits, good({ stem: `${GOOD.stem} Serum potassium is 6.1 mmol/L, temperature 38.2°C and haemoglobin 98 g/L. He is at the 50th percentile for weight. pH 7.31.` })));
});
test('flawReport: the cost of each failure, a block makes it ineligible', () => {
  const q = good({ ask: 'Each of the following is indicated EXCEPT which?' }); q.options[4] = 'None of the above';
  const r = F.flawReport(q);
  assert.deepEqual(r.failed.map(f => f.check).sort(), ['all-none', 'negative-stem']);
  assert.equal(r.score, 60);
  const dup = good(); dup.options[1] = dup.options[0];
  assert.equal(F.flawReport(dup).blocked, true);
  assert.equal(F.flawReport({ id: 'x' }).blocked, true, 'a non-question is blocked, not thrown');
});
test('near-duplicates across a pool: shingle Jaccard and containment', () => {
  const a = F.signature(good()), b = F.signature(good({ stem: `${GOOD.stem} He is anxious.` })), c = F.signature(good({ stem: 'A 5-year-old girl is brought to clinic with a limp for 3 days and a temperature of 38.5°C.', ask: 'What is the most likely diagnosis?', options: ['Septic arthritis', 'Transient synovitis', 'Perthes disease', 'Fracture', 'Leukaemia'] }));
  assert.equal(F.nearDuplicate(a, b).dup, true); assert.equal(F.nearDuplicate(a, c).dup, false);
  assert.ok(F.similarity(a, a) === 1 && F.containment(a, b) > 0.9);
});
test('answer-position balance', () => {
  const items = [0, 1, 2, 3, 0, 1, 2, 3].map(answer => ({ options: ['a', 'b', 'c', 'd'], answer }));
  assert.deepEqual(F.positionBalance(items)[4], { counts: [2, 2, 2, 2], n: 8, chi2: 0 });
  assert.ok(F.positionBalance(items.map(q => ({ ...q, answer: 0 })))[4].chi2 > 7.8);
});

test('every mutation injects its flaw and the check meant for it catches it; the original still passes', () => {
  const base = F.flawReport(good());
  const ms = mutantsOf(good());
  assert.deepEqual(ms.map(m => m.name).sort(), Object.keys(MUTATIONS).sort());
  for (const m of ms) {
    const r = F.flawReport(m.item);
    assert.ok(r.failed.some(f => m.expect.includes(f.check)), `${m.name}: ${r.failed.map(f => f.check).join(',')}`);
    assert.ok(r.score < base.score, `${m.name} lowers the score`);
    assert.deepEqual(m.item.provenance, GOOD.provenance, `${m.name} keeps the question's provenance`);
  }
  assert.equal(wrongKey(good()).answer, 1);
  assert.equal(F.flawReport(good()).score, 100, 'mutating copies: the original is untouched');
});

test('displayOrder: the key where the card id says, the rest in their order; the stored order untouched', () => {
  const q = { id: 'hy-1', options: ['key', 'b', 'c', 'd'], answer: 0 };
  for (const key of ['b:hy-1', 'b:hy-2', 'x', 'y', 'z']) {
    const o = displayOrder(q, key);
    assert.deepEqual([...o].sort(), [0, 1, 2, 3], 'every option once');
    assert.deepEqual(o.filter(i => i !== 0), [1, 2, 3], 'the distractors keep their order');
    assert.deepEqual(displayOrder(q, key), o, 'the same card shows the same order every time');
  }
  assert.deepEqual(q.options, ['key', 'b', 'c', 'd']);
  const at = {}; for (let i = 0; i < 400; i++) { const p = displayOrder(q, `k${i}`).indexOf(0); at[p] = (at[p] || 0) + 1; }
  assert.ok(Object.values(at).every(n => n > 60), `the key lands on every position (${JSON.stringify(at)})`);
  assert.deepEqual(displayOrder({ options: ['a', 'b'], answer: 9 }, 'k'), [0, 1], 'a bad key: as stored');
});
