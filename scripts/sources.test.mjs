/* sources.test.mjs - the open-sources registry and the adapters that turn a download into pool candidates */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registryProblems, adapt, VERDICTS } from './lib/sources.mjs';
import { benchmarkItem } from './lib/mcq-sources.mjs';
import { poolQuestion } from './lib/duel-pack.mjs';
import { licenceOk } from '../public/js/mcq/schema.mjs';
import { taxonomyProblems } from '../public/js/mcq/taxonomy.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const REG = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'sources', 'registry.json'), 'utf8'));

test('the registry: every source has a licence, says whether it covers the questions, and a verdict with its reason', () => {
  assert.deepEqual(registryProblems(REG), []);
  assert.ok(REG.sources.every(s => VERDICTS.includes(s.verdict)));
  for (const s of REG.sources.filter(x => x.verdict === 'import')) assert.ok(licenceOk(s.licence), `${s.id}: an import's licence is one the pool accepts`);
  assert.ok(REG.sources.some(s => s.id === 'quest-ai' && s.verdict === 'benchmark-only'), 'the official samples stay benchmark only');
  assert.match(registryProblems({ sources: [{ id: 'x-set', name: 'X', licence: 'MIT', verdict: 'import', why: 'w', coversContent: true }] }).join(' '), /adapter.*https url.*credit.*kind/);
  assert.match(registryProblems({ sources: [{ id: 'y-set', name: 'Y', licence: 'MIT', verdict: 'maybe', why: 'w' }] }).join(' '), /verdict maybe.*coversContent/);
});

test('HEAD-QA: the medicine paper of the kept years, no image questions, the key as an index, the credit on every row', () => {
  const src = REG.sources.find(s => s.id === 'headqa');
  const json = { exams: {
    Cuaderno_2014_1_M: { name: 'Cuaderno_2014_1_M', category: 'medicine', year: '2014', data: [
      { qid: '7', qtext: ' A 60-year-old man  has chest pain. What is next? ', ra: '3', image: '', answers: [{ aid: 2, atext: 'B' }, { aid: 1, atext: 'A' }, { aid: 3, atext: 'C' }, { aid: 4, atext: 'D' }] },
      { qid: '8', qtext: 'See the image.', ra: '1', image: 'img/2014_8.png', answers: [1, 2, 3, 4].map(aid => ({ aid, atext: `o${aid}` })) },
      { qid: '9', qtext: 'No key?', ra: '9', image: '', answers: [1, 2, 3, 4].map(aid => ({ aid, atext: `o${aid}` })) }] },
    Cuaderno_2017_1_M: { category: 'medicine', year: '2017', data: [{ qid: '1', qtext: 'q', ra: '1', image: '', answers: [1, 2, 3, 4].map(aid => ({ aid, atext: `o${aid}` })) }] },
    Cuaderno_2014_1_B: { category: 'biology', year: '2014', data: [{ qid: '1', qtext: 'q', ra: '1', image: '', answers: [1, 2, 3, 4].map(aid => ({ aid, atext: `o${aid}` })) }] } } };
  const { rows, dropped } = adapt(src, json, '2026-10-26');
  assert.deepEqual(rows.map(r => r.id), ['headqa-2014-7'], 'medicine, 2013 to 2016, with a key and no image');
  assert.equal(rows[0].stem, 'A 60-year-old man has chest pain. What is next?');
  assert.deepEqual(rows[0].options, ['A', 'B', 'C', 'D'], 'in the exam\'s own order'); assert.equal(rows[0].answer, 2);
  assert.equal(rows[0].source.name, src.credit); assert.equal(rows[0].source.licence, src.licence);
  assert.equal(dropped.length, 2); assert.match(dropped.join(' '), /needs its image.*no key/);
  /* as a candidate: kind open-exam, its tag, and in the duel its credit */
  const item = benchmarkItem({ ...rows[0], options: ['Aspirin and urgent angiography', 'Oral antacid', 'Reassurance only', 'Outpatient stress test'] });
  assert.equal(item.provenance.kind, 'open-exam'); assert.ok(item.tags.includes('src:headqa'));
  const q = poolQuestion({ ...item, topic: 'Cardiology' }).q;
  assert.deepEqual([q.source, q.origin], ['open-exam', 'human']); assert.equal(q.credit, src.credit);
  assert.deepEqual(taxonomyProblems({ ...q, cat: 'clinical', year: 3, difficulty: 2 }), [], 'fully categorised once it has its year and difficulty');
});

test('data/benchmarks/headqa.jsonl is what the adapter makes (nothing in it was rewritten)', () => {
  const f = path.join(ROOT, 'data', 'benchmarks', 'headqa.jsonl');
  const rows = fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
  assert.ok(rows.length > 700);
  assert.ok(rows.every(r => /^headqa-201[3-6]-\d+$/.test(r.id) && r.options.length >= 4 && Number.isInteger(r.answer) && r.source.licence === 'Reuse with attribution (Ministerio de Sanidad, Spain)'));
});

test('PrinciplismQA (piloted, now benchmark-only): model-written, so kind ai, imported, with its MIT notice as credit; the principle-list items left out', () => {
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'sources', 'registry.json'), 'utf8')), src = reg.sources.find(s => s.id === 'principlismqa');
  assert.equal(src.verdict, 'benchmark-only', 'piloted and failed (2026-10-27)'); assert.equal(src.kind, 'ai'); assert.ok(licenceOk(src.licence)); assert.match(src.credit, /Copyright \(c\) 2025 Freedom AI, MIT/);
  const raw = [
    { id: 1, question: 'A patient who lacks capacity refuses a blood test. What should the doctor do?', options: { A: 'Act in the patient\'s best interests after consulting family', B: 'Take the blood anyway', C: 'Discharge the patient', D: 'Call the police' }, correct_answer: 'A', explanation: 'Best interests.' },
    { id: 2, question: 'Which principle is most challenged?', options: { A: 'Autonomy', B: 'Beneficence', C: 'Justice', D: 'Non-maleficence' }, correct_answer: 'A', explanation: 'x' },
    { id: 3, question: 'Which principle is most relevant?', options: { A: 'Beneficence', B: 'Non-maleficence', C: 'Justice', D: 'Respect for persons' }, correct_answer: 'D', explanation: 'x' },
    { id: 4, question: 'No key here?', options: { A: 'a', B: 'b', C: 'c', D: 'd' }, correct_answer: 'E', explanation: 'x' }
  ];
  const { rows, dropped } = adapt(src, raw, '2026-10-27');
  assert.deepEqual(rows.map(r => r.id), ['principlismqa-1']);
  assert.equal(dropped.length, 3); assert.ok(dropped.some(d => /principles/.test(d)) && dropped.some(d => /no key/.test(d)));
  assert.equal(rows[0].topic, 'Bioethics'); assert.equal(rows[0].answer, 0);
  const q = benchmarkItem(rows[0]);
  assert.equal(q.provenance.kind, 'ai'); assert.equal(q.provenance.generator.how, 'imported'); assert.equal(q.topic, 'Bioethics');
  assert.ok(q.tags.includes('src:principlismqa'));
  const p = poolQuestion({ ...q, eval: {} }).q;
  assert.equal(p.origin, 'ai'); assert.equal(p.source, 'ai'); assert.match(p.credit, /PrinciplismQA/);
});
