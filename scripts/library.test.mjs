/* the library (docs/library.md): the ChatGPT prompt, reading and checking an upload, the Study scheduler, and library
   questions in the duel's pack */
import test from 'node:test';
import assert from 'node:assert/strict';
import { chatPrompt } from '../public/js/library/prompt.mjs';
import { readUpload, check, checkUpload, specialtyOf, kindOf, stripFence, layers, deckName, KIND_IDS, SPECIALTIES, LIMITS } from '../public/js/library/item.mjs';
import { grade, queue, counts, preview, newCard, soon, recall, NEW_A_DAY, DAY } from '../public/js/library/sched.mjs';
import { duelQuestion, mixPack } from '../public/js/library/mix.mjs';
import { normPack, normQuestion, topicTree } from '../public/js/vendor/pup-duel/duel/pack.mjs';
import { RANGES, GROUPS, inText, find } from '../public/js/library/ranges.mjs';

const NOW = Date.parse('2026-10-26T09:00:00Z');
const Q = (o = {}) => ({
  stem: 'A 67-year-old man has 2 hours of central crushing chest pain radiating to the left arm. He is sweaty and pale. His ECG shows ST elevation in leads II, III and aVF.',
  ask: 'Which coronary artery is most likely occluded?',
  options: ['Right coronary artery', 'Left anterior descending artery', 'Left circumflex artery', 'Left main coronary artery'],
  answer: 'A', explanation: 'Inferior ST elevation (II, III, aVF) is usually the right coronary artery, which supplies the inferior wall in most people.',
  why: ['Correct.', 'Anterior leads V1 to V4.', 'Lateral leads I, aVL, V5, V6.', 'Widespread changes and shock.'], specialty: 'Cardiology', kind: 'anatomy', tags: ['stemi'], ...o });

test('the prompt names every specialty and kind exactly, the JSON shape, and asks for short stems', () => {
  const p = chatPrompt('my notes on croup');
  for (const s of SPECIALTIES) assert.ok(p.includes(s), s);
  for (const k of KIND_IDS) assert.ok(p.includes(`"${k}"`), k);
  for (const f of ['"stem"', '"ask"', '"options"', '"answer"', '"explanation"', '"why"', '"specialty"', '"kind"']) assert.ok(p.includes(f), f);
  assert.match(p, /Output ONLY a JSON array/); assert.match(p, /timer/); assert.ok(p.trim().endsWith('my notes on croup'));
  const ex = JSON.parse(p.slice(p.indexOf('[', p.indexOf('Example of one element')), p.indexOf('My material:')).trim());
  const r = checkUpload(JSON.stringify(ex), { by: 'Sam', now: NOW });
  assert.equal(r.ready.length, 1, `the prompt's own example uploads: ${JSON.stringify(r.rows[0].problems)}`);
});

test('specialties and kinds as students write them', () => {
  assert.equal(specialtyOf('Paeds'), 'Paediatrics'); assert.equal(specialtyOf('cardiology'), 'Cardiology'); assert.equal(specialtyOf('O&G'), 'Obstetrics');
  assert.equal(specialtyOf('Obstetrics & Gynaecology'), 'Obstetrics'); assert.equal(specialtyOf('ENT'), 'Otorhinolaryngology'); assert.equal(specialtyOf('Astrology'), '');
  assert.equal(kindOf('OSCE skills'), 'skills'); assert.equal(kindOf('Physiology and pathophysiology'), 'physio'); assert.equal(kindOf('pathophysiology'), 'physio');
  assert.equal(kindOf('Anatomy'), 'anatomy'); assert.equal(kindOf('management'), 'clinical'); assert.equal(kindOf('trivia'), '');
});

test('an upload: fenced JSON, a letter key, specialty and kind; repeats and broken questions are listed, not saved', () => {
  assert.equal(stripFence('Here you go:\n```json\n[{"a":1}]\n```\nHope it helps'), '[{"a":1}]');
  assert.equal(stripFence('Sure! [{"a":1}]'), '[{"a":1}]');
  const text = 'Sure, here they are:\n```json\n' + JSON.stringify([Q(), Q({ specialty: 'Astrology' }), Q({ kind: '' }), Q({ options: ['a', 'b'] }), Q()]) + '\n```';
  const d = readUpload(text);
  assert.equal(d.length, 5); assert.equal(d[0].answer, 0); assert.equal(d[0].topic, 'Cardiology'); assert.equal(d[0].kind, 'anatomy');
  const r = checkUpload(text, { by: 'Sam', now: NOW });
  assert.equal(r.ready.length, 1, JSON.stringify(r.rows[0].problems));
  const it = r.ready[0];
  assert.equal(it.topic, 'Cardiology'); assert.equal(it.cat, 'anatomy'); assert.equal(it.provenance.kind, 'user'); assert.equal(it.provenance.source.licence, 'own'); assert.equal(it.provenance.submittedBy, 'Sam');
  assert.match(r.rows[1].problems[0].reason, /Astrology/); assert.match(r.rows[2].problems[0].reason, /type/i);
  assert.ok(r.rows[3].problems.some(p => /options/.test(p.reason))); assert.match(r.rows[4].problems[0].reason, /already/);
  assert.equal(checkUpload(JSON.stringify([Q()]), { by: 'Sam', now: NOW, have: [it] }).ready.length, 0, 'already in the library');
  assert.ok(r.rows.every(x => x.problems.every(p => ['block', 'major', 'minor'].includes(p.severity))));
});

test('an upload as CSV with specialty and kind columns', () => {
  const q = Q(), csv = `stem,ask,a,b,c,d,answer,explanation,specialty,kind\n"${q.stem}","${q.ask}",${q.options.join(',')},A,"${q.explanation}",Cardio,Anatomy`;
  const r = checkUpload(csv, { by: 'Sam', now: NOW });
  assert.equal(r.ready.length, 1, JSON.stringify(r.rows[0]?.problems)); assert.equal(r.ready[0].topic, 'Cardiology'); assert.equal(r.ready[0].cat, 'anatomy');
});

test('plain text only, and the limits', () => {
  assert.ok(check(readUpload(JSON.stringify([Q({ stem: `${Q().stem} <img src=x onerror=alert(1)>` })]))[0], { by: 'S', now: NOW }).problems.some(p => /HTML/.test(p.reason)));
  assert.equal(checkUpload(JSON.stringify(Array.from({ length: LIMITS.upload + 3 }, () => Q())), { by: 'S', now: NOW }).more, true);
  assert.equal(deckName('  Paeds   wk 3  '), 'Paeds wk 3'); assert.equal(deckName('x'.repeat(99)).length, LIMITS.deckName);
});

test('the drill-down over a library: specialty, then every kind with its count', () => {
  const { ready } = checkUpload(JSON.stringify([Q(), Q({ stem: `${Q().stem} He is 70.`, kind: 'clinical' }), Q({ stem: `${Q().stem} Now 2.`, specialty: 'Paeds' })]), { by: 'S', now: NOW });
  const L = layers(ready);
  assert.deepEqual(L.map(t => [t.topic, t.count]), [['Cardiology', 2], ['Paediatrics', 1]]);
  assert.deepEqual(L[0].cats.map(c => c.count), [0, 1, 0, 1]);
});

test('FSRS-6: one 10-minute learning step, then days; Hard < Good < Easy; a lapse relearns; an SM-2 card converts', () => {
  let c = grade(null, 'good', NOW); assert.equal(c.st, 2, 'Good on a new card graduates'); assert.ok(c.due - NOW >= DAY);
  const a1 = grade(null, 'again', NOW); assert.equal(a1.due - NOW, 10 * 6e4, 'Again: 10 minutes'); assert.equal(a1.st, 1);
  assert.equal(grade(null, 'hard', NOW).due - NOW, 15 * 6e4, 'Hard on the first step: 1.5 times it');
  assert.equal(grade(a1, 'good', NOW + 10 * 6e4).st, 2, 'then Good graduates');
  const later = c.due, hard = grade(c, 'hard', later), good = grade(c, 'good', later), easy = grade(c, 'easy', later);
  assert.ok(hard.due < good.due && good.due < easy.due, 'Hard < Good < Easy');
  assert.ok(good.s > c.s, 'a recall makes it more stable');
  const lapse = grade(good, 'again', good.due); assert.equal(lapse.st, 3); assert.equal(lapse.lapses, 1); assert.equal(lapse.due - good.due, 10 * 6e4); assert.ok(lapse.s < good.s);
  const old = grade({ due: NOW, ivl: 30, ease: 2.5, reps: 5, lapses: 0 }, 'good', NOW);
  assert.equal(old.st, 2); assert.ok(old.due - NOW > 20 * DAY, `an SM-2 card at 30 days keeps its place (${Math.round((old.due - NOW) / DAY)} days)`); assert.equal(old.ivl, undefined);
  assert.equal(preview(null, 'again', NOW), '10 min'); assert.match(preview(null, 'good', NOW), /day/); assert.match(preview(null, 'easy', NOW), /day/);
  const fz = new Set(Array.from({ length: 30 }, (_, i) => grade(good, 'good', good.due, () => i / 30).due)); assert.ok(fz.size > 1, 'fuzzed with rnd');
  assert.ok(Math.abs(recall(10, 10) - 0.9) < 1e-9, 'R(S, S) = 90 %');
  assert.equal(soon(grade(null, 'again', NOW), NOW), true); assert.equal(soon(c, NOW), false);
});

test('a study session: overdue first, then new up to the day\'s allowance; counts', () => {
  const items = Array.from({ length: 30 }, (_, i) => ({ id: `q${i}` }));
  const cards = { q0: { ...newCard(), st: 2, due: NOW - 5 * DAY, reps: 2 }, q1: { ...newCard(), st: 2, due: NOW - DAY, reps: 2 }, q2: { ...newCard(), st: 2, due: NOW + DAY, reps: 2 } };
  const q = queue(items, cards, NOW);
  assert.deepEqual(q.slice(0, 2).map(x => x.id), ['q0', 'q1']); assert.equal(q.length, 2 + NEW_A_DAY); assert.ok(!q.some(x => x.id === 'q2'));
  assert.equal(queue(items, cards, NOW, NEW_A_DAY).length, 2);
  assert.deepEqual(counts(items, cards, NOW), { due: 2, new: 27, learnt: 1 });
});

test('library questions in the duel: playable, tagged with whose, in their own deck; the pack lists the decks it has', () => {
  const { ready } = checkUpload(JSON.stringify([Q()]), { by: 'S', now: NOW });
  const q = duelQuestion(ready[0], 'mine');
  assert.equal(normQuestion(q).why, '');
  assert.equal(q.topic, 'Cardiology'); assert.equal(q.cat, 'anatomy'); assert.equal(q.source, 'mine'); assert.equal(q.deck, 'mine'); assert.match(q.stem, /occluded\?$/);
  const bank = { title: 'Bank', origin: 'mixed', cats: [{ id: 'anatomy', label: 'Anatomy' }], questions: [{ id: 'b1', stem: 'A bank question?', options: ['a', 'b'], answer: 0, topic: 'Cardiology', cat: 'anatomy' }] };
  const p = mixPack(bank, ready, [ready[0], { ...ready[0], id: 'u-other' }]);
  assert.deepEqual(p.decks.map(d => d.id), ['bank', 'mine', 'friends']);
  assert.deepEqual(p.questions.map(x => x.deck), ['bank', 'mine', 'friends'], "a friend's copy of your own question comes once");
  assert.equal(normPack(p).pack.questions.length, 3);
  assert.equal(topicTree(normPack(p).pack).topics[0].count, 3);
  assert.deepEqual(mixPack(bank, [], []).decks.map(d => d.id), ['bank']);
});

import { readFileSync } from 'node:fs';
test('0008_library.sql: every table closed to the public key, every function checks the token', () => {
  const S = readFileSync(new URL('../supabase/migrations/0008_library.sql', import.meta.url), 'utf8');
  for (const t of ['lib_decks', 'lib_items', 'lib_friends', 'lib_shares']) assert.ok(S.includes(`alter table public.${t} enable row level security`), t);
  assert.doesNotMatch(S, /create policy/i, 'no policy: the tables are reached only through the functions');
  const fns = [...S.matchAll(/create or replace function public\.(\w+)\(p_token uuid/g)].map(m => m[1]);
  assert.deepEqual(fns.sort(), ['friend_list', 'friend_request', 'friend_respond', 'friend_week', 'lib_delete', 'lib_library', 'lib_rename', 'lib_share', 'lib_upload']);
  for (const f of fns) { const body = S.slice(S.indexOf(`function public.${f}(`)); assert.match(body.slice(0, body.indexOf('end $$')), /public\.pup_me\(p_token\)/, f); assert.ok(S.includes(`grant execute on function public.${f}(`), f); }
  assert.match(S, /revoke all on function public\.lib_are_friends/);
  assert.match(S, /> 500 then raise/); assert.match(S, />= 50 then raise/); assert.match(S, /tot > 2000/); assert.match(S, /16384/);
});

import { yearOf, guessYear, ladder, YEARS } from '../public/js/mcq/year.mjs';
import { cleanItem } from '../public/js/mcq/schema.mjs';
test('year: read as students write it, guessed when missing, kept by the schema, climbed by 0 to 1', () => {
  for (const [v, y] of [[2, 2], ['Year 3', 3], ['y1', 1], ['MS4', 4], ['second year', 2], ['final year', 4], ['4th', 4], ['5', 0], ['', 0], ['year five', 0]]) assert.equal(yearOf(v), y, String(v));
  assert.equal(guessYear({ cat: 'anatomy', stem: 'Which nerve supplies deltoid?' }), 1);
  assert.equal(guessYear({ cat: 'anatomy', stem: 'A 30-year-old man cannot abduct his arm.' }), 2);
  assert.equal(guessYear({ cat: 'clinical', stem: 'A 70-year-old woman has chest pain.', ask: 'What is the most appropriate next step in management?' }), 4);
  assert.equal(guessYear({ cat: 'clinical', stem: 'A 70-year-old woman has chest pain.', ask: 'What is the most likely diagnosis?' }), 3);
  const r = checkUpload(JSON.stringify([Q({ year: 'Year 1' }), Q({ stem: `${Q().stem} Again.`, year: '' })]), { by: 'S', now: NOW });
  assert.deepEqual(r.ready.map(x => x.year), [1, 2], 'given, else guessed (an anatomy vignette is Year 2)');
  assert.ok(r.rows[1].problems.some(p => p.check === 'year' && p.severity === 'minor' && /guessed/.test(p.reason)), 'a guessed year is a tip, never a block');
  assert.equal(cleanItem({ ...r.ready[0] }).year, 1);
  assert.equal(chatPrompt().includes('"year"') && Object.values(YEARS).every(y => chatPrompt().includes(y.name)), true, 'the prompt asks for the year');
  assert.deepEqual(ladder([{ year: 3 }, { year: 1 }, {}, { year: 2 }, { year: 1 }]).map(x => x.year ?? 0), [1, 1, 2, 3, 0]);
  assert.deepEqual(ladder([{ year: 2 }, { year: 2 }, { year: 4 }], x => x.year, 1).map(x => x.year), [2, 4]);
});

import { verifyPrompt, applyChecks, VERIFY_SCHEMA } from '../public/js/library/verify.mjs';
test('check the medicine: Claude answers blind; a disagreement is held back with its reason; unanswered ones pass', () => {
  const { ready } = checkUpload(JSON.stringify([Q(), Q({ stem: `${Q().stem} Second.` }), Q({ stem: `${Q().stem} Third.` })]), { by: 'S', now: NOW });
  const p = JSON.parse(verifyPrompt(ready)); assert.equal(p.length, 3); assert.equal(p[0].key, 'A'); assert.match(p[0].options[0], /^A\. /);
  const r = applyChecks(ready, [{ id: ready[0].id, choice: 0, ok: true, issue: '' }, { id: ready[1].id, choice: 1, ok: false, issue: 'LAD gives anterior changes; this is inferior.' }]);
  assert.equal(r.pass.length, 2); assert.equal(r.pass[0].checked, 1); assert.equal(r.unchecked, 1);
  assert.equal(r.held.length, 1); assert.match(r.held[0].issue, /anterior/);
  assert.equal(applyChecks(ready, [{ id: ready[0].id, choice: 2, ok: true, issue: '' }]).held.length, 1, 'ok but a different choice is held');
  assert.deepEqual(VERIFY_SCHEMA.properties.checks.items.required, ['id', 'choice', 'ok', 'issue']);
});

test('normal ranges: every test whole; the tests a stem names found as whole words, in its order; find by name or by what stems call it', () => {
  assert.ok(RANGES.length >= 60 && GROUPS.length >= 8);
  for (const x of RANGES) assert.ok(x.g && x.t && x.r && typeof x.u === 'string' && x.k.length && x.k.every(k => k === k.toLowerCase()), x.t);
  assert.equal(new Set(RANGES.map(x => x.t)).size, RANGES.length, 'one row a test');
  const t = s => inText(s).map(x => x.t);
  assert.deepEqual(t('Her potassium is 6.8 mmol/L, creatinine 410 µmol/L and pH 7.21.'), ['Potassium', 'Creatinine', 'pH (arterial)']);
  assert.deepEqual(t('Haemoglobin 82 g/L, MCV 68 fL, ferritin 6 µg/L'), ['Haemoglobin', 'MCV', 'Ferritin']);
  assert.deepEqual(t('An alternative plan for her asthma 2 days ago; phosphate is 0.4 mmol/L'), ['Phosphate'], 'ALT, AST and pH only as whole words');
  assert.deepEqual(t('She takes sodium valproate and was given calcium gluconate; her sodium is 128 mmol/L'), ['Sodium'], 'a result has a number after it: a drug is not a result');
  assert.deepEqual(t('HbA1c 8.1%'), ['HbA1c'], 'Hb is not in HbA1c');
  assert.deepEqual(t('A 30-year-old woman with a sore knee'), []);
  assert.deepEqual(find('trop').map(x => x.t), ['hs-Troponin'], 'a word that starts so, not a word with it inside');
  assert.ok(find('white cell').some(x => x.t === 'White cell count') && find('pot').some(x => x.t === 'Potassium'));
  assert.ok(find('troponin').some(x => x.t === 'hs-Troponin') && find('wcc').some(x => x.t === 'White cell count') && find('').length === RANGES.length);
});
