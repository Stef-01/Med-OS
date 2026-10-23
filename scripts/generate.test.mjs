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

/* a well-formed acute paediatric station in the 5 / 10 / 5 format, as the model would return it */
const ROW = { rr: null, spo2: null, o2: null, dev: null, sbp: null, dbp: null, hr: null, rhythm: null, temp: null, avpu: null, pain: null, distress: null, crt: null, bgl: null, lactate: null, concern: null, init: '', note: '' };
const leaf = (id, x, crit = false) => ({ id, t: 'checkbox', x, crit, d: '', kids: [] });
const H = (id, x) => ({ id, t: 'heading', x, crit: false, d: '', kids: [] });
const DRAFT = {
  title: 'Wheezy toddler in the emergency department', desc: 'Acute asthma in a 4-year-old.', focus: 'Acute asthma: severity and stepwise treatment',
  specialty: ['Paediatrics', 'Emergency Medicine'], type: ['Emergency', 'History', 'Examination', 'Management'], complexity: 'Moderate',
  context: ['Emergency department'], presentation: ['Wheeze'], diagnosis: ['Acute asthma'],
  stem: '<p>You are the junior doctor in a paediatric ED. Mia, 4, is wheezy and her father is with her.</p>',
  tasks: ['<p>Take a focused history from her father and examine Mia (10 minutes).</p>', '<p>The examiner will give you her observations. Interpret them, then outline your management approach and safety netting (5 minutes).</p>'],
  patient: `<p>${'Mia has been wheezy since last night after a cold. '.repeat(40)}</p>`,
  demo: { age: 4, unit: 'years', sex: 'F', weight: 16, setting: 'ed', pregnant: false, postpartum: false },
  part2: { lead: 'Here are her observations on arrival and after treatment, and her blood gas.', handover: [
    { label: 'Observations', kind: 'obs', result: '<p>On room air throughout.</p>', model: '<p>On arrival RR 44 and HR 146 (blue zone) and SpO2 93% (yellow zone): a clinical review; better after salbutamol.</p>',
      obs: { rows: [{ ...ROW, t: '10:05', rr: 44, spo2: 93, dev: 'RA', hr: 146, temp: 37.6, avpu: 'A', distress: 'mild', crt: 2, init: 'KL' },
        { ...ROW, t: '10:50', rr: 32, spo2: 96, dev: 'RA', hr: 138, temp: 37.4, avpu: 'A', distress: 'mild', crt: 2, init: 'KL', note: '3 doses of salbutamol given' }] } },
    { label: 'Venous gas', kind: 'gas', result: '<table><tr><th>Test</th><th>Result</th><th>Reference</th></tr><tr><td>pH</td><td>7.38</td><td>7.32 to 7.42</td></tr><tr><td>pCO2</td><td>38 mmHg</td><td>38 to 50</td></tr></table>',
      model: '<p>No respiratory acidosis: a normal pCO2 in a child breathing fast is reassuring now, but a rising pCO2 would be a late sign of tiring.</p>', obs: { rows: [] } }],
    ask: ['How severe is her asthma?', 'What is your management?', 'What would you tell her father before she goes home?'] },
  check: [H(1, 'Professionalism'), leaf(2, 'Introduces self'), leaf(3, 'Plain language'),
    H(4, 'History'), ...Array.from({ length: 5 }, (_, i) => leaf(5 + i, `History item ${i + 1}`)), leaf(50, 'Asks about triggers'), leaf(51, 'Asks about previous admissions and ICU'), leaf(52, 'Asks about preventer use and technique'), leaf(53, 'Asks about smoke exposure at home'),
    H(10, 'Examination'), ...Array.from({ length: 4 }, (_, i) => leaf(11 + i, `Examines item ${i + 1}`, i === 0)),
    H(15, 'Interpretation'), leaf(16, 'Classifies moderate asthma', true), leaf(17, 'Recognises the response to treatment'),
    H(18, 'Management'),
    { id: 19, t: 'checkbox', x: 'Gives salbutamol by spacer:', crit: true, d: '', kids: [{ id: 1, x: '6 puffs (age under 6)', crit: false, d: '' }, { id: 2, x: 'Reassesses at 20 minutes', crit: false, d: '' }] },
    leaf(20, 'Management item 1', true), leaf(21, 'Asks for a senior clinical review'), leaf(22, 'Management item 3'),
    H(23, 'Safety netting'), leaf(24, 'Red flags: hard breathing, can\'t talk, blue lips: call 000', true), leaf(25, 'GP review in 1 to 2 days with a written asthma action plan')],
  guide: '', explain: '<p>Asthma severity guides treatment.</p>', points: ['<p>One</p>', '<p>Two</p>', '<p>Three</p>', '<p>Four</p>'],
  refs: ['RCH Clinical Practice Guideline: Asthma acute', 'National Asthma Council Australia: Australian Asthma Handbook'],
  imaging: [],
};

/* the gates and the flow are tested against a fixed bank (three acute and three clinic stations shaped like DRAFT), so a
   change in the shipped stations never moves these tests; the shipped bank has its own tests below and in bank.test.mjs */
const SYNTH = [0, 1, 2].flatMap(i => [{ id: `ai-acute${i}`, ...normalize(DRAFT) }, { id: `ai-clinic${i}`, ...normalize({ ...DRAFT, type: ['History', 'Examination', 'Management'] }) }]);
const stats = bankStats(SYNTH);

test('every shipped station passes the shape gate', () => {
  for (const s of bank) assert.deepEqual(shapeProblems(s), [], s.id);
});

test('the bank sets the checklist range for each kind', () => {
  for (const b of [bankStats(bank), stats]) for (const k of ['acute', 'clinic']) assert.ok(b[k].min >= 12 && b[k].max > b[k].min, k);
});

test('the quality gates pass a sound draft and name each thing wrong with a broken one', () => {
  const ok = { id: 'ai-test', ...normalize(DRAFT) };
  assert.deepEqual(shapeProblems(ok), []);
  assert.deepEqual(qualityProblems(ok, stats), []);
  const bad = normalize({ ...DRAFT, tasks: ['<p>Assess (5 minutes)</p>', '<p>Manage (5 minutes)</p>'], refs: ['Some textbook'], specialty: ['Paediatrics', 'Made Up Specialty'],
    check: DRAFT.check.filter(i => i.x !== 'Safety netting' && i.x !== 'Professionalism'), imaging: [{ id: 'X', modality: 'scan', place: 'stem', region: '', finding: '', caption: '', alt: '' }],
    stem: '<p onclick="x()">hi, you have 8 minutes</p>', part2: { lead: '', handover: [{ label: 'Obs', result: 'x' }], ask: [] } });
  const p = qualityProblems({ id: 'ai-test', ...bad }, stats).join('\n') + shapeProblems({ id: 'ai-test', ...bad }).join('\n');
  for (const want of [/task times add to 10/, /at least 2 references/, /RCH/, /Australian guideline/, /Made Up Specialty/, /Professionalism heading/, /Safety netting heading/, /imaging X/, /stem: .*onclick/,
    /leave times out of the stem/, /Part 2 hands over at least 2 results/, /at least 2 examiner questions/, /opening line/]) assert.match(p, want);
  const oneSafety = normalize({ ...DRAFT, check: DRAFT.check.filter(i => i.id !== 25) });
  assert.match(qualityProblems({ id: 'ai-test', ...oneSafety }, stats).join(), /1 safety-netting item/);
  const lastNotPart2 = normalize({ ...DRAFT, tasks: ['<p>Part 2 first (5 minutes)</p>', '<p>Then history (10 minutes)</p>'] });
  assert.match(qualityProblems({ id: 'ai-test', ...lastNotPart2 }, stats).join(), /the last task is Part 2/);
});

test('Part 2 results: the patient picks the chart, every result names its kind and carries a model interpretation, observations are rows', () => {
  const ok = { id: 'ai-test', ...normalize(DRAFT) };
  assert.deepEqual(ok.part2.handover[0].obs.rows[0], { t: '10:05', rr: 44, spo2: 93, dev: 'RA', hr: 146, temp: 37.6, avpu: 'A', distress: 'mild', crt: 2, init: 'KL' }, 'nulls and blanks dropped');
  assert.equal(ok.part2.handover[1].obs, undefined, 'no rows on a non-observation result');
  const bare = { ...ok, demo: undefined, part2: { ...ok.part2, handover: ok.part2.handover.map(({ kind, model, ...h }) => h) } };
  const q = qualityProblems(bare, stats).join('\n');
  assert.match(q, /demo: the patient/);
  assert.match(q, /names its kind/);
  assert.match(q, /model interpretation/);
  const noRows = { ...ok, part2: { ...ok.part2, handover: [{ ...ok.part2.handover[0], obs: undefined }, ok.part2.handover[1]] } };
  assert.match(qualityProblems(noRows, stats).join(), /give the observations as rows/);
  assert.doesNotMatch(qualityProblems({ ...noRows, demo: { ...ok.demo, setting: 'gp' } }, stats).join(), /give the observations as rows/, 'a GP room has no chart');
  assert.match(shapeProblems({ ...ok, part2: { ...ok.part2, handover: [{ ...ok.part2.handover[0], obs: { rows: [{ t: '9am', rr: 20 }] } }] } }).join(), /without a valid time/);
  assert.match(shapeProblems({ ...ok, part2: { ...ok.part2, handover: [{ ...ok.part2.handover[0], obs: { rows: [{ t: '10:00', rr: 20, dev: 'TENT' }] } }] } }).join(), /"dev" "TENT" is not a value/);
});

test('observations on the chart: a value on a zone line and an unanswered red zone go to the examiner', () => {
  const ok = { id: 'ai-test', ...normalize(DRAFT) };
  const red = { ...ok, check: ok.check.filter(i => !/senior|escalat/i.test(i.x)), part2: { ...ok.part2, handover: [{ ...ok.part2.handover[0], obs: { rows: [{ t: '10:05', rr: 50, spo2: 88, hr: 152 }] } }] } };
  const notes = reviewNotes(red).join('\n');
  assert.match(notes, /rr 50 sits on the line/);
  assert.match(notes, /red zone .* no checklist item asks the candidate to escalate/);
  assert.doesNotMatch(reviewNotes(ok).join(), /sits on the line|escalate/);
});

test('a paediatric fixed dose with no per-kg dose beside it goes to the examiner, not the hard gate', () => {
  const st = normalize({ ...DRAFT, check: [...DRAFT.check, leaf(40, 'Gives prednisolone 20 mg orally'), leaf(41, 'Gives ondansetron 0.15 mg/kg (2.4 mg)')] });
  assert.match(reviewNotes(st).join(), /20 mg/);
  assert.doesNotMatch(reviewNotes(st).join(), /2\.4 mg/);
});

test('normalize: the model\'s strict shape back to the bank\'s compact one', () => {
  const n = normalize(DRAFT);
  assert.deepEqual(n.check[0], { id: 1, t: 'heading', x: 'Professionalism' });
  assert.deepEqual(n.check[1], { id: 2, t: 'checkbox', x: 'Introduces self' });
  assert.deepEqual(n.check.find(i => i.id === 19).kids[0], { id: 1, t: 'checkbox', x: '6 puffs (age under 6)' });
  assert.equal(n.check.find(i => i.id === 19).crit, true);
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
  const r = await writeStation('acute asthma', { acute: true, specialty: ['Paediatrics'] }, { bank: SYNTH, ask, now: '2026-10-23T00:00:00Z' });
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
    if (a.label === 'review 1') return { pass: false, issues: [{ where: 'check 19', problem: 'wrong puffs', fix: 'use 6 puffs', severity: 'blocker' }] };
    if (a.label === 'revise') { assert.match(a.content, /at least 2 references/); assert.match(a.content, /\[blocker\] check 19: wrong puffs/); return DRAFT; }
    if (a.label === 'review 2') return { pass: true, issues: [{ where: 'stem', problem: 'comma', fix: 'add one', severity: 'minor' }] };
    return EXAM;
  });
  const r = await writeStation('acute asthma', { acute: true }, { bank: SYNTH, ask });
  assert.equal(r.ok, true);
  assert.deepEqual(calls, ['draft', 'review 1', 'revise', 'review 2', 'exam findings']);
  assert.equal(r.rounds.length, 2);
});

test('flow: a station that still fails after its revision is kept back', async () => {
  const { calls, ask } = stub(a => (a.label === 'draft' || a.label === 'revise' ? DRAFT : a.label.startsWith('review') ? { pass: false, issues: [{ where: 'x', problem: 'unsafe dose', fix: 'fix it', severity: 'blocker' }] } : EXAM));
  const r = await writeStation('acute asthma', { acute: true }, { bank: SYNTH, ask });
  assert.equal(r.ok, false);
  assert.equal(r.exam, null);
  assert.deepEqual(calls, ['draft', 'review 1', 'revise', 'review 2']);
});

import { flagIssues } from './lib/station-gates.mjs';
test('lab flags: a value outside its printed range needs H or L, one inside needs none', () => {
  const t = '<table><tr><th>Test</th><th>Result</th><th>Reference</th></tr><tr><td>Hb</td><td>96 g/L L</td><td>115 to 160</td></tr><tr><td>WCC</td><td>15.8</td><td>4 to 11</td></tr><tr><td>Na</td><td>139 H</td><td>135 to 145</td></tr><tr><td>CRP</td><td>38 H</td><td>below 5</td></tr></table>';
  assert.deepEqual(flagIssues(t), ['WCC: 15.8 vs 4 to 11 → H, has no flag', 'Na: 139 H vs 135 to 145 → no flag, has H']);
  assert.deepEqual(flagIssues('<table><tr><td>a</td><td>b</td></tr></table>'), [], 'a table with no Result and Reference header is not checked');
  assert.deepEqual(flagIssues('<table><tr><th>Test</th><th>Result</th><th>Reference</th></tr><tr><td>HBV DNA</td><td>850 IU/mL</td><td>Not detected</td></tr><tr><td>HIV RNA</td><td>86,000 H</td><td>Not detected</td></tr></table>'), ['HBV DNA: 850 IU/mL vs Not detected → H, has no flag']);
});

import { gasIssues } from './lib/station-gates.mjs';
test('a blood gas must add up: bicarbonate from pH and pCO2, each column of a paired cord gas on its own', () => {
  const cord = '<table><tr><th>Cord gas</th><th>Artery</th><th>Vein</th><th>Reference</th></tr><tr><td>pH</td><td>7.18</td><td>7.25</td><td>7.20 to 7.35</td></tr><tr><td>pCO2 (mmHg)</td><td>54</td><td>46</td><td>40 to 60</td></tr><tr><td>Bicarbonate (mmol/L)</td><td>19</td><td>20</td><td>20 to 26</td></tr></table>';
  assert.deepEqual(gasIssues(cord), []);
  assert.match(gasIssues(cord.replace('<td>20</td><td>20 to 26', '<td>26</td><td>20 to 26')).join(), /Vein: pH 7.25, pCO2 46 gives HCO3 19.\d, the table has 26/);
  assert.match(gasIssues('<table><tr><th>Test</th><th>Result</th></tr><tr><td>pH</td><td>7.30</td></tr><tr><td>pCO2</td><td>5.0 kPa</td></tr><tr><td>HCO3</td><td>30</td></tr></table>').join(), /gives HCO3 18\.2, the table has 30/);
});
