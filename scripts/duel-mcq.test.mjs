/* the duel's category questions: the gates, the writer's flow with a stub for Claude, and the pack that merges them */
import test from 'node:test';
import assert from 'node:assert/strict';
import { CATS, CAT_IDS, gate, normalizeMcq, stationBrief, MCQ_SCHEMA, MCQ_SYSTEM, LIMITS } from './lib/mcq.mjs';
import { writeStationMcq } from './generate-duel-mcq.mjs';
import { buildPack } from './lib/duel-pack.mjs';
import { stationsOnDisk, poolOnDisk } from './build-duel-pack.mjs';
import { normPack, topicTree } from '../public/js/vendor/pup-duel/duel/pack.mjs';

const good = (cat, over = {}) => ({ cat, stem: 'A 4-year-old boy has a barking cough and stridor at rest. Which drug is given first?', options: ['Oral dexamethasone', 'Nebulised salbutamol', 'IV ceftriaxone', 'Oral amoxicillin'], answer: 0,
  why: 'Corticosteroids reduce airway oedema in croup within hours.', notes: ['', 'Salbutamol treats bronchospasm, not the subglottic oedema of croup.', 'There is no sign of bacterial tracheitis.', 'Croup is viral.'], ...over });

test('the four categories, in the order a player sees them', () => {
  assert.deepEqual(CATS.map(c => c.label), ['OSCE skills', 'Clinical', 'Physiology and pathophysiology', 'Anatomy']);
  assert.deepEqual(MCQ_SCHEMA.properties.questions.items.properties.cat.enum, CAT_IDS);
  for (const c of CATS) assert.ok(MCQ_SYSTEM.includes(c.label), c.label);
});

test('a question that can ship passes; every flaw is named', () => {
  assert.deepEqual(gate(good('clinical')), []);
  assert.match(gate(good('bogus')).join(), /unknown category/);
  assert.match(gate(good('clinical', { stem: 'No question mark here.' })).join(), /does not end with a question/);
  assert.match(gate(good('clinical', { stem: 'Which of these is NOT given?' })).join(), /negative/);
  assert.match(gate(good('clinical', { options: ['A', 'B', 'C'] })).join(), /3 options/);
  assert.match(gate(good('clinical', { options: ['Oral dexamethasone', 'oral dexamethasone', 'C', 'D'] })).join(), /two options the same/);
  assert.match(gate(good('clinical', { options: ['All of the above', 'B', 'C', 'D'] })).join(), /all\/none option/);
  assert.match(gate(good('clinical', { answer: 4 })).join(), /no valid answer/);
  assert.match(gate(good('clinical', { stem: 'Is oral dexamethasone given first?' })).join(), /stem names the answer/);
  assert.match(gate(good('clinical', { notes: ['', '', 'x', 'y'] })).join(), /note 1 missing/);
  assert.match(gate(good('clinical', { why: 'x'.repeat(LIMITS.why + 1) })).join(), /why length/);
});

test('the writer keeps one passing question a category, asks again once when one fails, and ids them by station', async () => {
  const st = { id: 'ai-x', title: 'Croup', specialty: ['Paediatrics'], demo: { age: 4, unit: 'years', sex: 'M', setting: 'ed' } };
  const calls = [];
  const ask = async ({ label }) => {
    calls.push(label);
    return calls.length === 1 ? { questions: [good('skills'), good('clinical'), good('physio', { answer: 9 }), good('anatomy')] } : { questions: [good('physio'), good('skills', { stem: 'bad' })] };
  };
  const { file, failed } = await writeStationMcq(st, ask, 't');
  assert.equal(calls.length, 2, 'asked once more for the missing category');
  assert.deepEqual(file.questions.map(q => q.cat), CAT_IDS);
  assert.deepEqual(file.questions.map(q => q.id), CAT_IDS.map(c => `osce-ai-x-${c}`));
  assert.equal(file.questions[0].notes[0], null, 'the right option has no note');
  assert.ok(failed.some(f => /physio/.test(f)) && failed.some(f => /skills/.test(f)));
  assert.equal(normalizeMcq(st, { questions: [good('skills'), good('skills')] }).kept.length, 1, 'one a category');
});

test('a station brief carries the case and never the marking sheet', () => {
  const st = stationsOnDisk().find(s => s.part2?.handover?.length);
  const b = stationBrief(st);
  assert.ok(b.includes(st.title) && /Result \(/.test(b) && /Differential/.test(b));
  assert.ok(!b.includes('"t":"checkbox"') && !/<[a-z]+>/.test(b));
});

test('the pack: each pooled question is Clinical, category questions join under the station\'s specialty, and a broken one is left out', () => {
  const stations = stationsOnDisk(), pool = poolOnDisk();
  const st = stations.find(s => s.specialty?.[0] === 'Paediatrics');
  const mcq = { [st.id]: { station: st.id, questions: [{ id: `osce-${st.id}-anatomy`, ...good('anatomy') }, { id: `osce-${st.id}-skills`, ...good('skills', { answer: 7 }) }] } };
  const { pack, dropped } = buildPack(pool, { mcq, stations });
  assert.deepEqual(pack.cats.map(c => c.id), CAT_IDS);
  assert.ok(pack.questions.filter(q => !q.station).every(q => q.cat === 'clinical'), 'the pool\'s questions are Clinical');
  const a = pack.questions.find(q => q.id === `osce-${st.id}-anatomy`);
  assert.equal(a.topic, 'Paediatrics'); assert.equal(a.cat, 'anatomy');
  assert.ok(!pack.questions.some(q => q.id === `osce-${st.id}-skills`) && dropped.some(d => d.startsWith(`osce-${st.id}-skills`)));
  /* the duel reads it as two layers */
  const paeds = topicTree(normPack(pack).pack).topics.find(t => t.topic === 'Paediatrics');
  assert.deepEqual(paeds.cats.map(c => c.label), CATS.map(c => c.label));
  assert.equal(paeds.cats.find(c => c.id === 'anatomy').count, 1);
});
