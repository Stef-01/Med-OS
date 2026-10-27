/* the duel: its question pack (scripts/lib/duel-pack.mjs from the standard MCQ pool, public/duel/pack.json) and the vendored Pup Duel package
   (public/js/vendor/pup-duel, never edited by hand: VERSION.json holds a hash of every file) */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { shortDx, patientLine, stationQuestion, buildPack, poolQuestion, DUEL } from './lib/duel-pack.mjs';
import { stationsOnDisk, poolOnDisk, packText, mcqOnDisk, packInputs } from './build-duel-pack.mjs';
import { stationItems } from './lib/mcq-sources.mjs';
import { normQuestion } from '../public/js/vendor/pup-duel/duel/pack.mjs';
import { taxonomyProblems } from '../public/js/mcq/taxonomy.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

test('shortDx keeps the name of the diagnosis and drops its qualifiers', () => {
  const cases = {
    'Acute ischaemic stroke in the right anterior cerebral artery territory, cardioembolic from atrial fibrillation': 'Acute ischaemic stroke in the right anterior cerebral artery territory',
    'Generalised (nodal) osteoarthritis of the hands, knees, hips and lumbar spine': 'Generalised osteoarthritis of the hands',
    'Early seropositive, erosive rheumatoid arthritis': 'Early seropositive erosive rheumatoid arthritis',
    'Duodenal ulcer associated with Helicobacter pylori, with long-term NSAID use contributing': 'Duodenal ulcer',
    'Cardiac (arrhythmic) syncope due to complete heart block': 'Cardiac syncope',
    'Chronic hepatitis B infection, HBeAg-negative phase with low viral load': 'Chronic hepatitis B infection',
    'Spontaneous bacterial peritonitis in decompensated alcohol-related cirrhosis': 'Spontaneous bacterial peritonitis',
    'Croup (laryngotracheobronchitis)': 'Croup',
    'iron deficiency anaemia from heavy menstrual bleeding.': 'Iron deficiency anaemia'
  };
  for (const [from, to] of Object.entries(cases)) assert.equal(shortDx(from), to, from);
});

test('patientLine says who and where, with the right article', () => {
  assert.equal(patientLine({ age: 65, unit: 'years', sex: 'M', setting: 'ed' }), 'A 65-year-old man in the emergency department');
  assert.equal(patientLine({ age: 5, unit: 'weeks', sex: 'M', setting: 'gp' }), 'A 5-week-old baby boy in general practice');
  assert.equal(patientLine({ age: 3, unit: 'days', sex: 'X', setting: 'birth suite' }), 'A 3-day-old baby in the birth suite');
  assert.equal(patientLine({ age: 8, unit: 'years', sex: 'F' }), 'An 8-year-old girl');
  assert.equal(patientLine({ age: 11, unit: 'years', sex: 'M', setting: 'clinic' }), 'An 11-year-old boy in clinic');
  assert.equal(patientLine({ age: 18, unit: 'years', sex: 'F', setting: 'ward' }), 'An 18-year-old woman on the ward');
  assert.equal(patientLine({ age: 16, unit: 'years', sex: 'F' }), 'A 16-year-old girl');
  assert.equal(patientLine({ age: 83, unit: 'years', sex: 'X' }), 'An 83-year-old person');
  assert.equal(patientLine({}), 'A patient');
});

const st = (id, extra = {}) => ({
  id, specialty: ['Cardiology'], demo: { age: 60, unit: 'years', sex: 'F', setting: 'ed' }, points: ['Think of it first'],
  ddx: [
    { dx: 'Reasonable one', tier: 'reasonable', for: '', against: 'Not this' },
    { dx: 'Big bad thing', tier: 'dangerous', for: '', against: 'No sign of it' },
    { dx: 'The answer, with detail', tier: 'likely', for: 'Crushing pain and a raised troponin', against: '' },
    { dx: 'Another reasonable', tier: 'reasonable', for: '', against: 'Nope' },
    { dx: 'A fourth', tier: 'reasonable', for: '', against: 'No' }
  ], ...extra
});

test('stationQuestion: the findings as the stem, the differential as the distractors, dangerous first, notes from "against"', () => {
  const { q } = stationQuestion(st('s1'));
  assert.equal(q.id, 'osce-s1');
  assert.equal(q.stem, 'A 60-year-old woman in the emergency department. Crushing pain and a raised troponin. What is the most likely diagnosis?');
  assert.deepEqual(q.options, ['The answer', 'Big bad thing', 'Reasonable one', 'Another reasonable']);
  assert.equal(q.answer, 0);
  assert.deepEqual(q.notes, [null, 'No sign of it.', 'Not this.', 'Nope.']);
  assert.equal(q.why, 'The answer fits: crushing pain and a raised troponin. Think of it first.', 'why the key fits, from the stem\'s findings, then the teaching point'); assert.equal(q.topic, 'Cardiology'); assert.equal(q.origin, 'ai'); assert.equal(q.station, 's1');
});

test('stationQuestion drops an option that repeats the answer, tops up from the specialty, and refuses a stem that names the answer', () => {
  const thin = st('s2', { ddx: [{ dx: 'Pneumonia', tier: 'likely', for: 'Fever and crackles', against: '' }, { dx: 'Pneumonia, atypical', tier: 'reasonable', against: 'x' }, { dx: 'Asthma', tier: 'reasonable', against: 'y' }] });
  const others = ['Myocarditis', 'Pericarditis', 'Endocarditis'].map((dx, i) => st(`o${i}`, { ddx: [{ dx, tier: 'likely', for: 'f', against: '' }] }));
  const { q } = stationQuestion(thin, [thin, ...others]);
  assert.deepEqual(q.options, ['Pneumonia', 'Asthma', 'Myocarditis', 'Pericarditis']);
  assert.deepEqual(q.notes, [null, 'y.', null, null]);
  assert.match(stationQuestion(thin, [thin]).why, /fewer than 3/);
  assert.match(stationQuestion(st('s3', { ddx: [{ dx: 'Gout', tier: 'likely', for: 'Classic gout of the big toe' }, ...st('x').ddx.filter(d => d.tier !== 'likely')] })).why, /name the answer/);
  assert.match(stationQuestion({ id: 's4', ddx: [] }).why, /no likely/);
});

test('the station writer: a fair question for nearly every station, every one playable by the duel', () => {
  const stations = stationsOnDisk(path.join(ROOT, 'public'));
  const { items, dropped } = stationItems(stations);
  assert.ok(items.length >= stations.length - 5, `${items.length} of ${stations.length} (${dropped.join('; ')})`);
  for (const q of items) {
    assert.ok(normQuestion(poolQuestion(q).q).q, q.id);
    assert.ok(q.options.every(o => o.length <= 70), q.id);
    assert.ok(!q.stem.toLowerCase().includes(q.options[q.answer].toLowerCase()), `${q.id}: the stem names the answer`);
  }
});

const pooled = (kind, over = {}) => ({ id: `q-${kind}`, stem: 'A 60-year-old man has chest pain.', ask: 'What is the most likely diagnosis?', options: ['A', 'B', 'C', 'D'], answer: 2, explanation: 'Because it is C. It is not the others.', why: ['not A', 'not B', null, 'not D'], topic: 'Cardiology', provenance: { kind }, ...over });
test('poolQuestion: the whole stem, provenance kept as origin (ai for ai and amsa) and source, too long for the duel is left out', () => {
  const q = poolQuestion(pooled('amsa')).q;
  assert.equal(q.stem, 'A 60-year-old man has chest pain. What is the most likely diagnosis?');
  assert.deepEqual([q.origin, q.source, q.answer, q.why], ['ai', 'amsa', 2, 'Because it is C. It is not the others.']);
  assert.deepEqual(q.notes, ['not A', 'not B', null, 'not D']);
  assert.deepEqual(['ai', 'amsa', 'user', 'usmle-resource'].map(k => poolQuestion(pooled(k)).q.origin), ['ai', 'ai', 'human', 'human']);
  assert.match(poolQuestion(pooled('user', { stem: 'x'.repeat(DUEL.stem) })).why, /characters/);
  assert.equal(poolQuestion(pooled('user', { explanation: `${'Long sentence here. '.repeat(80)}` })).q.why.length <= DUEL.why, true);
  const { pack } = buildPack({ questions: [pooled('ai'), pooled('user', { id: 'q-user2' })] });
  assert.equal(pack.origin, 'mixed'); assert.equal(pack.questions.length, 2);
});
test('poolQuestion: a lab value between a < and a > stays (the pool is plain text, not HTML)', () => {
  const stem = 'Serum: K <3.5 mmol/L, Na >145 mmol/L, cortisol <50 nmol/L with ACTH >20 pmol/L.';
  const q = poolQuestion(pooled('user', { stem, explanation: 'K <3.5 and Na >145 point to it.', why: ['a <b> c', 'x', null, 'y'] })).q;
  assert.ok(q.stem.startsWith(stem), q.stem);
  assert.equal(q.why, 'K <3.5 and Na >145 point to it.');
  assert.equal(q.notes[0], 'a <b> c', 'what looks like a tag in plain text is the text');
});

test('the pack from the pool: every pooled question that fits, each playable by the duel', () => {
  const pool = poolOnDisk(path.join(ROOT, 'public')), { pack, dropped } = buildPack(pool);
  assert.equal(pack.questions.length + dropped.length, pool.questions.length);
  assert.equal(new Set(pack.questions.map(q => q.id)).size, pack.questions.length);
  for (const q of pack.questions) {
    const { q: ok, why } = normQuestion(q);
    assert.ok(ok, why);
    assert.equal(ok.stem, q.stem, `${q.id}: the duel shows the whole stem`);
    const p = pool.questions.find(x => x.id === q.id);
    assert.equal(q.source, p.provenance.kind); assert.equal(q.origin, ['ai', 'amsa'].includes(p.provenance.kind) ? 'ai' : 'human');
  }
});

test('public/duel/pack.json is current (node scripts/mcq-pool.mjs, then npm run duel-pack)', () => {
  const pub = path.join(ROOT, 'public'), { pack } = buildPack(poolOnDisk(pub), packInputs(pub));
  assert.equal(fs.readFileSync(path.join(ROOT, 'public/duel/pack.json'), 'utf8'), packText(pack));
});

test('the vendored Pup Duel is exactly what its VERSION.json says, and the migration is the package\'s', () => {
  const dir = path.join(ROOT, 'public/js/vendor/pup-duel'), v = JSON.parse(fs.readFileSync(path.join(dir, 'VERSION.json'), 'utf8'));
  const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 16);
  const walk = (d, out = []) => { for (const n of fs.readdirSync(d)) { const p = path.join(d, n); if (fs.statSync(p).isDirectory()) walk(p, out); else out.push(path.relative(dir, p).split(path.sep).join('/')); } return out; };
  const files = walk(dir).filter(f => f !== 'VERSION.json').sort();
  assert.deepEqual(files, Object.keys(v.files).sort(), 'the same files');
  for (const f of files) assert.equal(sha(path.join(dir, f)), v.files[f], `${f} was edited: change the package and vendor again`);
  assert.equal(sha(path.join(ROOT, 'supabase/migrations/0002_pup_duel.sql')), v.migration.sha, '0002_pup_duel.sql is the package\'s migration');
  /* the shop's migration (the package's 0002_pup_shop.sql) is 0003 here */
  const shop = (v.migrations || []).find(m => m.file.endsWith('_pup_shop.sql'));
  assert.ok(shop, 'the package pins its shop migration');
  assert.equal(sha(path.join(ROOT, 'supabase/migrations/0003_pup_shop.sql')), shop.sha, '0003_pup_shop.sql is the package\'s shop migration');
  /* ranked play's (the package's 0003_pup_ranked.sql) is 0004 here */
  const ranked = (v.migrations || []).find(m => m.file.endsWith('_pup_ranked.sql'));
  assert.ok(ranked, 'the package pins its ranked migration');
  assert.equal(sha(path.join(ROOT, 'supabase/migrations/0004_pup_ranked.sql')), ranked.sha, '0004_pup_ranked.sql is the package\'s ranked migration');
  /* the leaderboard's periods (the package's 0004_pup_ladder.sql) are 0005 here */
  const ladder = (v.migrations || []).find(m => m.file.endsWith('_pup_ladder.sql'));
  assert.ok(ladder, 'the package pins its ladder migration');
  assert.equal(sha(path.join(ROOT, 'supabase/migrations/0005_pup_ladder.sql')), ladder.sha, '0005_pup_ladder.sql is the package\'s ladder migration');
});

test('the package\'s four migrations, in order, are Med-OS\'s 0002 to 0005, and the duel plays on Med-OS\'s own project', () => {
  const v = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/js/vendor/pup-duel/VERSION.json'), 'utf8'));
  const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 16);
  const here = ['0002_pup_duel.sql', '0003_pup_shop.sql', '0004_pup_ranked.sql', '0005_pup_ladder.sql'];
  assert.deepEqual(v.migrations.map(m => m.file), ['0001_pup_duel.sql', '0002_pup_shop.sql', '0003_pup_ranked.sql', '0004_pup_ladder.sql'].map(f => `supabase/migrations/${f}`));
  here.forEach((f, i) => assert.equal(sha(path.join(ROOT, 'supabase/migrations', f)), v.migrations[i].sha, `${f} is the package's ${v.migrations[i].file}: vendor again and copy it`));
  const cfg = {}; new Function('window', fs.readFileSync(path.join(ROOT, 'public/config.js'), 'utf8'))(cfg);
  assert.match(cfg.OSCE_CONFIG.supabaseUrl, /^https:\/\/pquajwxvlpvaygrkzfkl\.supabase\.co$/, 'Med-OS\'s own project, never Optimus\'s');
  assert.ok(!('duelSupabaseUrl' in cfg.OSCE_CONFIG) && !('duelSupabaseAnonKey' in cfg.OSCE_CONFIG), 'no second project for the duel');
});

test('every question in the duel pack is fully categorised: source, origin, credit, specialty, kind, year, difficulty', () => {
  const pack = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'duel', 'pack.json'), 'utf8'));
  const bad = pack.questions.map(q => [q.id, taxonomyProblems(q)]).filter(([, p]) => p.length);
  assert.deepEqual(bad.slice(0, 5), [], `${bad.length} of ${pack.questions.length} questions are not fully categorised`);
});

test('a pooled question\'s kind comes from the tagger (tag-years.mjs --kinds), clinical until it has looked', () => {
  const q = pooled('usmle-resource', { id: 'q-k1' });
  assert.equal(poolQuestion(q).q.cat, 'clinical');
  assert.equal(poolQuestion(q, new Map(), { 'q-k1': 'physio' }).q.cat, 'physio');
  assert.equal(poolQuestion(q, new Map(), { 'q-k1': 'skills' }).q.cat, 'clinical', 'a bank question is never an OSCE skill');
  assert.equal(buildPack({ questions: [q] }, { kinds: { 'q-k1': 'anatomy' } }).pack.questions[0].cat, 'anatomy');
});
