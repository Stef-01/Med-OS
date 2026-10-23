/* the station gates and the generator's flow, with Claude stubbed: a draft that passes ships with exam findings; one
   that fails is revised once on its problems; one that still fails is kept back */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { shapeProblems, qualityProblems, reviewNotes, bankStats } from './lib/station-gates.mjs';
import { writeStation, exemplars, normalize, stationId, STATION_SCHEMA, REVIEW_SCHEMA, EXAM_SCHEMA, writerPrompt } from './lib/generate.mjs';

const PUB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const bank = fs.readdirSync(path.join(PUB, 'osce')).filter(f => f !== 'index.json').map(f => JSON.parse(fs.readFileSync(path.join(PUB, 'osce', f), 'utf8')));
const stats = bankStats(bank);

/* a well-formed acute paediatric station, as the model would return it */
const leaf = (id, x, crit = false) => ({ id, t: 'checkbox', x, crit, d: '', kids: [] });
const DRAFT = {
  title: 'Wheezy toddler in the emergency department', desc: 'Acute asthma in a 4-year-old.', focus: 'Acute asthma: severity and stepwise treatment',
  specialty: ['Paediatrics', 'Emergency Medicine'], type: ['Emergency', 'Management', 'Counselling'], complexity: 'Moderate',
  context: ['Emergency department'], presentation: ['Wheeze'], diagnosis: ['Acute asthma'],
  stem: '<p>You are the junior doctor in a paediatric ED. Mia, 4, is wheezy. This station is 8 minutes.</p>',
  tasks: ['<p>Assess Mia (3 minutes).</p>', '<p>Manage her (3 minutes).</p>', '<p>Explain the plan to her father (2 minutes).</p>'],
  patient: `<p>${'Mia has been wheezy since last night after a cold. '.repeat(40)}</p>`,
  check: [{ id: 1, t: 'heading', x: 'Professionalism', crit: false, d: '', kids: [] }, leaf(2, 'Introduces self'),
    { id: 3, t: 'heading', x: 'Assessment', crit: false, d: '', kids: [] }, ...Array.from({ length: 6 }, (_, i) => leaf(4 + i, `Assesses item ${i + 1}`, i < 2)),
    { id: 10, t: 'heading', x: 'Management', crit: false, d: '', kids: [] },
    { id: 11, t: 'checkbox', x: 'Gives salbutamol by spacer:', crit: true, d: '', kids: [{ id: 1, x: '6 puffs (age under 6)', crit: false, d: '' }, { id: 2, x: 'Reassesses at 20 minutes', crit: false, d: '' }] },
    ...Array.from({ length: 4 }, (_, i) => leaf(12 + i, `Management item ${i + 1}`, i === 0)),
    { id: 16, t: 'heading', x: 'Communication', crit: false, d: '', kids: [] }, ...Array.from({ length: 4 }, (_, i) => leaf(17 + i, `Explains item ${i + 1}`))],
  guide: '', explain: '<p>Asthma severity guides treatment.</p>', points: ['<p>One</p>', '<p>Two</p>', '<p>Three</p>', '<p>Four</p>'],
  refs: ['RCH Clinical Practice Guideline: Asthma acute', 'National Asthma Council Australia: Australian Asthma Handbook'],
  imaging: [],
};

test('every shipped station passes the shape gate', () => {
  for (const s of bank) assert.deepEqual(shapeProblems(s), [], s.id);
});

test('the bank sets the checklist range for each kind', () => {
  assert.ok(stats.acute.min >= 12 && stats.acute.max > stats.acute.min);
  assert.ok(stats.clinic.min >= 12 && stats.clinic.max > stats.clinic.min);
});

test('the quality gates pass a sound draft and name each thing wrong with a broken one', () => {
  const ok = { id: 'ai-test', ...normalize(DRAFT) };
  assert.deepEqual(shapeProblems(ok), []);
  assert.deepEqual(qualityProblems(ok, stats), []);
  const bad = normalize({ ...DRAFT, tasks: ['<p>Assess (5 minutes)</p>', '<p>Manage (5 minutes)</p>'], refs: ['Some textbook'], specialty: ['Paediatrics', 'Made Up Specialty'],
    check: DRAFT.check.filter(i => i.x !== 'Communication' && i.x !== 'Professionalism'), imaging: [{ id: 'X', modality: 'scan', place: 'stem', region: '', finding: '', caption: '', alt: '' }],
    stem: '<p onclick="x()">hi</p>' });
  const p = qualityProblems({ id: 'ai-test', ...bad }, stats).join('\n') + shapeProblems({ id: 'ai-test', ...bad }).join('\n');
  for (const want of [/task times add to 10/, /at least 2 references/, /RCH/, /Australian guideline/, /Made Up Specialty/, /Professionalism heading/, /Communication or Counselling heading/, /imaging X/, /stem: .*onclick/]) assert.match(p, want);
});

test('a paediatric fixed dose with no per-kg dose beside it goes to the examiner, not the hard gate', () => {
  const st = normalize({ ...DRAFT, check: [...DRAFT.check, leaf(30, 'Gives prednisolone 20 mg orally'), leaf(31, 'Gives ondansetron 0.15 mg/kg (2.4 mg)')] });
  assert.match(reviewNotes(st).join(), /20 mg/);
  assert.doesNotMatch(reviewNotes(st).join(), /2\.4 mg/);
});

test('normalize: the model\'s strict shape back to the bank\'s compact one', () => {
  const n = normalize(DRAFT);
  assert.deepEqual(n.check[0], { id: 1, t: 'heading', x: 'Professionalism' });
  assert.deepEqual(n.check[1], { id: 2, t: 'checkbox', x: 'Introduces self' });
  assert.deepEqual(n.check.find(i => i.id === 11).kids[0], { id: 1, t: 'checkbox', x: '6 puffs (age under 6)' });
  assert.equal(n.check.find(i => i.id === 11).crit, true);
});

test('the benchmark: same kind, shared specialty first, no ids, media or provenance fields', () => {
  const ex = exemplars(bank, { acute: true, specialty: ['Paediatrics'] });
  assert.equal(ex.length, 3);
  for (const s of ex) { for (const k of ['id', 'origin', 'basis', 'source', 'media']) assert.ok(!(k in s), k); assert.ok(s.type.some(t => t === 'Emergency' || t === 'Ward Call')); }
  assert.ok(ex[0].specialty.includes('Paediatrics'));
  assert.match(writerPrompt('asthma', { acute: true }, ex, stats), /Checklist size: \d+ to \d+/);
  assert.match(stationId('A title', '2026-01-01T00:00:00Z'), /^ai-[0-9a-f]{8}$/);
});

test('every schema is strict at every level (the API requires it)', () => {
  const walk = (s, where) => {
    if (s.type === 'object') { assert.equal(s.additionalProperties, false, where); assert.deepEqual([...s.required].sort(), Object.keys(s.properties).sort(), where); for (const [k, v] of Object.entries(s.properties)) walk(v, `${where}.${k}`); }
    if (s.items) walk(s.items, `${where}[]`);
  };
  walk(STATION_SCHEMA, 'station'); walk(REVIEW_SCHEMA, 'review'); walk(EXAM_SCHEMA, 'exam');
});

const EXAM = { vitals: 'HR 140', general: 'Wheezy', steps: [{ area: 'Chest', do: 'Auscultate', find: 'Wheeze' }], bedside: [], key: 'Moderate asthma' };
function stub(script) {
  const calls = [];
  return { calls, ask: async a => { calls.push(a.label); const v = script(a, calls); return { value: v, model: 'stub-model' }; } };
}

test('flow: a draft that passes the gates and the examiner ships with its exam findings', async () => {
  const { calls, ask } = stub(a => (a.label === 'draft' ? DRAFT : a.label.startsWith('review') ? { pass: true, issues: [] } : EXAM));
  const r = await writeStation('acute asthma', { acute: true, specialty: ['Paediatrics'] }, { bank, ask, now: '2026-10-23T00:00:00Z' });
  assert.equal(r.ok, true);
  assert.deepEqual(calls, ['draft', 'review 1', 'exam findings']);
  assert.match(r.station.id, /^ai-[0-9a-f]{8}$/);
  assert.equal(r.station.origin, 'ai');
  assert.deepEqual(r.exam, EXAM);
});

test('flow: gate problems and examiner blockers go back for one revision', async () => {
  const broken = { ...DRAFT, refs: ['A textbook'] };
  const { calls, ask } = stub((a, c) => {
    if (a.label === 'draft') return broken;
    if (a.label === 'review 1') return { pass: false, issues: [{ where: 'check 11', problem: 'wrong puffs', fix: 'use 6 puffs', severity: 'blocker' }] };
    if (a.label === 'revise') { assert.match(a.content, /at least 2 references/); assert.match(a.content, /\[blocker\] check 11: wrong puffs/); return DRAFT; }
    if (a.label === 'review 2') return { pass: true, issues: [{ where: 'stem', problem: 'comma', fix: 'add one', severity: 'minor' }] };
    return EXAM;
  });
  const r = await writeStation('acute asthma', { acute: true }, { bank, ask });
  assert.equal(r.ok, true);
  assert.deepEqual(calls, ['draft', 'review 1', 'revise', 'review 2', 'exam findings']);
  assert.equal(r.rounds.length, 2);
});

test('flow: a station that still fails after its revision is kept back', async () => {
  const { calls, ask } = stub(a => (a.label === 'draft' || a.label === 'revise' ? DRAFT : a.label.startsWith('review') ? { pass: false, issues: [{ where: 'x', problem: 'unsafe dose', fix: 'fix it', severity: 'blocker' }] } : EXAM));
  const r = await writeStation('acute asthma', { acute: true }, { bank, ask });
  assert.equal(r.ok, false);
  assert.equal(r.exam, null);
  assert.deepEqual(calls, ['draft', 'review 1', 'revise', 'review 2']);
});
