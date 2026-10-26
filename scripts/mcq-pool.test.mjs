/* the pool's pipeline without a network or a model: the judge with a stub (lib/mcq-judge.mjs), selection, quotas,
   dedupe and provenance preservation (lib/mcq-select.mjs), the intake of submissions (lib/mcq-intake.mjs), generation
   with a stub (lib/mcq-generate.mjs), the candidates' writers (lib/mcq-sources.mjs), and the pool on disk */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { good, GOOD } from './mcq.test.mjs';
import { judgeItem, judgeScore, judgeGates, verdictFor, solveText, rubricText, cleanRubric, SPECIALTIES } from './lib/mcq-judge.mjs';
import { assess, select, statusOf, quality, poolItem } from './lib/mcq-select.mjs';
import { mergeSubmissions, submissionsFrom, remoteSubmissions } from './lib/mcq-intake.mjs';
import { writeMcq, toItem, exemplarsFor, stationBrief, blocking, keyLongest, RAPID_SYSTEM, WRITER_SYSTEM } from './lib/mcq-generate.mjs';
import { quotaOf } from './lib/mcq-select.mjs';
import { checkLength } from '../public/js/mcq/flaws.mjs';
import { fits } from '../public/js/vendor/pup-duel/duel/core.mjs';
import { spreadKey, stationItem, benchmarkItem, stationItems } from './lib/mcq-sources.mjs';
import { cleanItem, contentHash, LETTERS } from '../public/js/mcq/schema.mjs';
import { flawReport } from '../public/js/mcq/flaws.mjs';
import { build } from './mcq-pool.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BARS = { base: 70, ai: 80 };
const rubric = (o = {}) => ({ key_correct: 'yes', other_defensible: [], single_best: 5, distractors: 4, relevance: 5, accuracy: 5, explanation: 4, safety: { ok: true, issues: [] }, flaws: [], topic: 'Cardiology', verdict: 'accept', reasons: ['fine'], suggestion: '', ...o });
const verdict = (q, o = {}, solves = [q.answer, q.answer]) => ({ hash: contentHash(q), judge: 'stub', at: '2026-10-25T00:00:00Z', solves: solves.map(answer => ({ answer, confidence: 0.9, reason: '' })), rubric: cleanRubric(rubric(o)) });

/* a stub examinee and reviewer: the examinee answers with the letter of a given option text in the order it is shown */
function stubAsk(pickText, review = rubric()) {
  const calls = [];
  return { calls, ask: async ({ content, schema, label }) => {
    calls.push({ label, content });
    if (/solve/.test(label)) { const lines = content.split('\n').filter(l => /^[A-E]\. /.test(l)); const i = lines.findIndex(l => l.slice(3) === pickText); return { value: { answer: LETTERS[i], confidence: 0.8, reason: 'r' }, model: 'stub-model' }; }
    return { value: review, model: 'stub-model' };
  } };
}

test('judgeItem: two solves without the key (the second in reverse order, mapped back), then the rubric with it', async () => {
  const q = cleanItem(good()), { ask, calls } = stubAsk(GOOD.options[0]);
  const v = await judgeItem(q, { ask, now: () => 'T' });
  assert.deepEqual(v.solves.map(s => s.answer), [0, 0], 'the reversed run maps its letter back to the same option');
  assert.equal(v.hash, contentHash(q)); assert.equal(v.at, 'T'); assert.equal(v.judge, 'stub-model');
  assert.equal(calls.length, 3);
  for (const c of calls.slice(0, 2)) assert.ok(!/Key:|Explanation|test bank|usmle/i.test(c.content), 'the examinee never sees the key, the explanation or the source');
  assert.ok(calls[1].content.indexOf(GOOD.options[4]) < calls[1].content.indexOf(GOOD.options[0]), 'the second run shows the options reversed');
  assert.match(calls[2].content, /Key: A/); assert.ok(!/test bank|MIT/.test(calls[2].content), 'the reviewer is not told the source');
  assert.match(solveText(q, [0, 1, 2, 3, 4]), /A\. Primary/); assert.match(rubricText(q), /Why each option is wrong/);
});

test('judgeScore and judgeGates: wrong key, unsafe, two keys, never solved; AI questions must be solved twice', () => {
  const q = cleanItem(good());
  assert.equal(judgeScore(verdict(q), q), Math.round(30 + 20 + 15 * 0.75 + 15 + 20));
  assert.deepEqual(judgeGates(verdict(q), q), []);
  assert.match(judgeGates(verdict(q, { key_correct: 'no' }), q)[0], /key wrong/);
  assert.match(judgeGates(verdict(q, { safety: { ok: false, issues: ['dose'] } }), q)[0], /unsafe: dose/);
  assert.match(judgeGates(verdict(q, { single_best: 2, other_defensible: ['C'] }), q).join(), /not a single best answer \(C also/);
  assert.match(judgeGates(verdict(q, {}, [1, 2]), q)[0], /another answer both times/);
  assert.deepEqual(judgeGates(verdict(q, {}, [0, 2]), q), []);
  assert.match(judgeGates(verdict(q, {}, [0, 2]), q, { strict: true })[0], /both times/);
  assert.equal(verdictFor({ [q.id]: verdict(q) }, q).judge, 'stub');
  assert.equal(verdictFor({ [q.id]: verdict(q) }, { ...q, answer: 1 }), null, 'a verdict is for the exact text it judged');
  assert.equal(cleanRubric({ topic: 'Astrology', single_best: 9 }).topic, ''); assert.equal(cleanRubric({ single_best: 9 }).single_best, 5);
  assert.ok(SPECIALTIES.includes('Cardiology'));
});

const item = (id, kind, over = {}) => {
  const prov = { user: { kind: 'user', source: { name: 'Written by the submitter', url: '', licence: 'own' }, submittedBy: 'Sam', createdAt: '2026-10-25' },
    ai: { kind: 'ai', source: { name: 'AI', url: '', licence: 'own' }, createdAt: '2026-10-25', generator: { how: 'stub', version: 't', basis: ['amsa-187'] } },
    amsa: { kind: 'amsa', source: { name: 'AMSA', url: '', licence: 'own' }, createdAt: '2026-10-25', generator: { how: 'duel-pack', version: 't', basis: ['amsa-187'] } },
    'usmle-resource': GOOD.provenance }[kind];
  return cleanItem(good({ id, provenance: prov, ...over }));
};
/* a distinct question per n (its own words and options), so dedupe leaves them alone */
const distinct = (id, kind, n, over = {}) => item(id, kind, {
  stem: `A ${30 + n}-year-old woman comes to the emergency department with pain. ${Array.from({ length: 24 }, (_, i) => `w${n}q${i}`).join(' ')}. Her pulse is ${80 + n}/min and blood pressure is 120/80 mm Hg. Examination shows tenderness.`,
  options: ['alpha', 'bravo', 'charlie', 'delta', 'echo'].map(w => `${w} plan ${n} z${n}`), ...over });

test('assess: schema, flaws, a verdict, the gates and the bar, in that order, each with its reason', () => {
  const q = item('q-ok', 'usmle-resource'), v = { [q.id]: verdict(q) };
  assert.equal(assess(q, { verdicts: v, bars: BARS }).status, 'pass');
  assert.deepEqual(assess(q, { verdicts: {}, bars: BARS }).status, 'pending');
  const bad = { ...good({ id: 'q-bad' }), options: ['a', 'b'] };
  const a = assess(bad, { verdicts: {}, bars: BARS }); assert.equal(a.status, 'rejected'); assert.match(a.reasons.join(), /options/);
  const dup = good({ id: 'q-dup' }); dup.options[1] = dup.options[0];
  assert.match(assess(dup, { bars: BARS }).reasons[0], /are the same/);
  assert.match(assess(q, { verdicts: { [q.id]: verdict(q, { key_correct: 'no' }) }, bars: BARS }).reasons[0], /key wrong/);
  const low = assess(q, { verdicts: { [q.id]: verdict(q, { single_best: 3, distractors: 1, relevance: 1, accuracy: 3 }, [0, 1]) }, bars: BARS });
  assert.equal(low.status, 'rejected'); assert.match(low.reasons[0], /below the base bar of 70/);
  assert.equal(quality(100, 50), 70);
});

test('AI-written questions need the higher bar and two solves; a user\'s question the base bar', () => {
  const mid = { single_best: 4, distractors: 3, relevance: 4, accuracy: 4 };   /* judge 30+15+7.5+11.25+15 = 79 -> quality 87 */
  const ai = item('ai-1', 'ai'), user = item('u-aaaaaa1', 'user');
  const harsh = { base: 70, ai: 90 };
  assert.equal(assess(user, { verdicts: { [user.id]: verdict(user, mid) }, bars: harsh }).status, 'pass');
  assert.match(assess(ai, { verdicts: { [ai.id]: verdict(ai, mid) }, bars: harsh }).reasons[0], /AI-written bar of 90/);
  assert.match(assess(ai, { verdicts: { [ai.id]: verdict(ai, {}, [0, 3]) }, bars: BARS }).reasons[0], /both times/);
});

test('select: user questions always kept, dedupe keeps the user\'s, quotas and topics make reserves, provenance untouched, every decision explained', () => {
  const users = [0, 1, 2].map(n => distinct(`u-user00${n}`, 'user', n));
  const bank = [3, 4, 5, 6, 7].map(n => distinct(`bank-${n}`, 'usmle-resource', n));
  const copy = item('bank-copy', 'usmle-resource', { stem: users[0].stem });   /* the same case as a user's question */
  const ais = [8, 9].map(n => distinct(`ai-${n}`, 'ai', n));
  const all = [...users, ...bank, copy, ...ais];
  const before = JSON.stringify(all.map(q => q.provenance));
  const verdicts = Object.fromEntries(all.map(q => [q.id, verdict(q)]));
  const { pool, decisions, stats } = select(all, { verdicts, bars: BARS, quota: { 'usmle-resource': 3, ai: 5, amsa: 5 }, topicShare: 0.15 });
  const ids = pool.map(q => q.id);
  for (const u of users) assert.ok(ids.includes(u.id), `${u.id} kept`);
  assert.match(decisions.find(d => d.id === 'bank-copy').reasons[0], /near-duplicate of u-user000.*source ranks first/);
  assert.equal(pool.filter(q => q.provenance.kind === 'usmle-resource').length, 3);
  assert.equal(decisions.filter(d => d.status === 'reserve').length, 2);
  assert.match(decisions.find(d => d.status === 'reserve').reasons[0], /quota of 3 is full/);
  assert.equal(JSON.stringify(all.map(q => q.provenance)), before, 'select changes nothing it was given');
  for (const q of pool) assert.deepEqual(q.provenance, all.find(x => x.id === q.id).provenance, 'the pool keeps provenance as it came');
  for (const d of decisions) if (d.status !== 'pool') assert.ok(d.reasons.length, `${d.id} has a reason`);
  assert.deepEqual(stats.pool, { user: 3, 'usmle-resource': 3, ai: 2 });
  assert.equal(pool[0].eval.verdict, 'pool'); assert.ok(pool[0].eval.evalVersion);
  const st = statusOf(decisions); assert.deepEqual(Object.keys(st).sort(), users.map(u => u.id)); assert.equal(st['u-user000'].status, 'pool');
});

test('topic balance: no topic past its share of the non-user pool', () => {
  const many = Array.from({ length: 10 }, (_, n) => distinct(`b-${n}`, 'usmle-resource', n));
  const { pool, decisions } = select(many, { verdicts: Object.fromEntries(many.map(q => [q.id, verdict(q)])), bars: BARS, quota: { 'usmle-resource': 100 }, topicShare: 0.1 });
  assert.equal(pool.length, 6, 'the floor of 6 per topic');
  assert.match(decisions.find(d => d.status === 'reserve').reasons[0], /Cardiology already holds 6/);
});

test('poolItem fills an empty topic from the review and says so', () => {
  const q = item('t-1', 'usmle-resource', { topic: '' }), a = assess(q, { verdicts: { [q.id]: verdict(q, { topic: 'Neurology' }) }, bars: BARS });
  const p = poolItem(a); assert.equal(p.topic, 'Neurology'); assert.equal(p.eval.topicFrom, 'review'); assert.deepEqual(p.provenance, q.provenance);
});

test('intake: user questions only, the first copy of an id kept, an export or a list read', async () => {
  const u = item('u-abcdef1', 'user'), other = { ...u, stem: `${u.stem} Changed.` };
  const r = mergeSubmissions([u], [other, item('u-abcdef2', 'user'), { ...item('u-abcdef3', 'user'), provenance: { ...u.provenance, kind: 'ai' } }, { id: 'medqa-1', provenance: { kind: 'user' } }]);
  assert.deepEqual(r.items.map(q => q.id), ['u-abcdef1', 'u-abcdef2']);
  assert.equal(r.items[0].stem, u.stem); assert.match(r.conflicts[0], /first one is kept/);
  assert.equal(r.refused.length, 2); assert.match(r.refused.join(), /must be a user question \(kind "ai"\)/);
  assert.equal(submissionsFrom(JSON.stringify({ mcqSubmissions: 1, items: [u] })).length, 1);
  assert.equal(submissionsFrom('[{"item":{"id":"u-x"}}]')[0].id, 'u-x');
  const seen = [];
  const fake = async (url, init) => { seen.push({ url, init }); return { ok: true, json: async () => [{ id: u.id, item: u }] }; };
  assert.deepEqual((await remoteSubmissions({ url: 'https://p.example', key: 'k' }, fake)).map(q => q.id), [u.id]);
  assert.match(seen[0].url, /^https:\/\/p\.example\/rest\/v1\/mcq_submissions\?select=/); assert.equal(seen[0].init.method, undefined, 'a read, never a write');
});

const station = { id: 'amsa-900', title: 'Chest pain in a 50-year-old man', desc: 'Inferior STEMI.', specialty: ['Cardiology'], diagnosis: ['Inferior STEMI'], presentation: ['Chest pain'],
  demo: { age: 50, unit: 'years', sex: 'M', setting: 'ed' }, points: ['Reperfuse fast'], explain: '<p>Primary PCI.</p>', refs: ['ANZCOR'], generatedAt: '2026-10-23T11:01:47Z',
  source: { label: 'AMSA MedEd OSCEs', url: 'https://amsameded.org.au/x', title: 'Chest Pain History 1' },
  ddx: [{ dx: 'Inferior STEMI', tier: 'likely', for: 'Crushing pain with ST elevation in II, III and aVF', against: '' }, { dx: 'Aortic dissection', tier: 'dangerous', against: 'Equal pulses' }, { dx: 'Pericarditis', tier: 'reasonable', against: 'Not positional' }, { dx: 'Pulmonary embolism', tier: 'dangerous', against: 'No risk factors' }] };

test('generation with a stub: drafted from the station and exemplars, revised once on a major flaw, tagged ai with its basis', async () => {
  const bench = [cleanItem(good({ id: 'medqa-ex1' })), cleanItem(good({ id: 'medqa-ex2', stem: 'A 30-year-old woman comes to clinic with a rash for 3 days. Her temperature is 37.1°C. Examination shows a target lesion on the palm.' }))];
  const draft = { stem: GOOD.stem, ask: 'Which of the following is NOT the most appropriate next step?', options: GOOD.options, answer: 'A', explanation: GOOD.explanation, why: ['right', 'w1', 'w2', 'w3', 'w4'], topic: 'Cardiology' };
  const asks = [];
  const ask = async a => { asks.push(a); return { value: a.label.endsWith('revise') ? { ...draft, ask: GOOD.ask } : draft, model: 'stub-model' }; };
  const r = await writeMcq(station, 'management', { bench, ask, how: 'stub', now: '2026-10-25T12:00:00Z' });
  assert.equal(r.ok, true); assert.equal(r.rounds, 2);
  assert.match(asks[1].content, /Negative lead-in/);
  assert.match(asks[0].content, /<station>[\s\S]*Inferior STEMI[\s\S]*<example_1>/); assert.match(asks[0].content, /next step in management/);
  const q = r.item;
  assert.equal(q.provenance.kind, 'ai'); assert.deepEqual(q.provenance.generator.basis, ['amsa-900', 'osce-amsa-900']);
  assert.deepEqual(q.provenance.generator.exemplars.sort(), ['medqa-ex1', 'medqa-ex2']); assert.equal(q.provenance.generator.how, 'stub');
  assert.equal(q.options[q.answer], GOOD.options[0], 'the key survives the spread'); assert.equal(q.why[q.answer], null);
  assert.match(q.id, /^ai-mcq-[0-9a-f]{8}$/);
  const never = await writeMcq(station, 'management', { bench, ask: async () => ({ value: draft, model: 'm' }), how: 'stub' });
  assert.equal(never.ok, false, 'still flawed after one revision: not kept'); assert.match(never.problems[0], /Negative/);
  assert.equal(toItem({ ...draft, answer: 'Z' }, { st: station, focus: 'management', ex: [], how: 'stub', now: 'x' }), null);
  assert.ok(exemplarsFor(station, bench).length <= 3); assert.ok(!stationBrief(station).includes('<p>'));
});

test('the Rapid form: a short case that fits the duel\'s 15 s, written to its own brief, tagged, revised when it runs long or the key is longest', async () => {
  const bench = [cleanItem(good({ id: 'medqa-ex1' }))];
  const short = { stem: 'A 67-year-old man has crushing central chest pain for 40 minutes. His ECG shows ST elevation in leads II, III and aVF.', ask: 'Most appropriate next step?',
    options: ['Primary PCI', 'Oral aspirin alone', 'CT pulmonary angiogram', 'Serial troponins', 'Outpatient stress test'], answer: 'A', explanation: 'Inferior STEMI within 12 hours: primary PCI.', why: ['right', 'w1', 'w2', 'w3', 'w4'], topic: 'Cardiology' };
  const long = { ...short, stem: `${short.stem} ${'He has a long and detailed history that a fifteen second round cannot hold. '.repeat(3)}` };
  const asks = [];
  const ask = async a => { asks.push(a); return { value: a.label.endsWith('revise') ? short : long, model: 'stub-model' }; };
  const r = await writeMcq(station, 'management', { bench, ask, how: 'stub', now: '2026-10-26T12:00:00Z', form: 'rapid' });
  assert.equal(asks[0].system, RAPID_SYSTEM); assert.match(asks[0].content, /short \(15-second\) question/);
  assert.match(asks[1].content, /to read at 4 words a second/, 'the long draft is sent back with its reading time');
  assert.equal(r.ok, true); assert.equal(r.rounds, 2);
  assert.ok(r.item.tags.includes('form:rapid'));
  assert.ok(fits({ stem: `${r.item.stem} ${r.item.ask}`, options: r.item.options }, 15), 'what is kept fits 15 s as the duel reads it');
  assert.equal(checkLength(r.item).pass, true, 'a rapid case is not a too-short vignette');
  assert.equal(checkLength({ ...r.item, tags: [] }).pass, false, 'the same stem as a Step 2 vignette is too short');
  const v = toItem(short, { st: station, focus: 'management', ex: [], how: 'stub', now: '2026-10-26T12:00:00Z' });
  assert.notEqual(v.id, r.item.id, 'a rapid question and a vignette of the same station, focus and time are different questions');
  assert.ok(!v.tags.some(t => t.startsWith('form:')));
  assert.equal(blocking(v, 'vignette').some(p => /to read/.test(p.reason)), false, 'a vignette has no time to fit');
  assert.notEqual(WRITER_SYSTEM, RAPID_SYSTEM);
});
test('the key as the single longest option is sent back for revision; a tie is not a cue', () => {
  const q = cleanItem(good({ id: 'medqa-kl' }));
  const longKey = { ...q, options: q.options.map((o, i) => (i === q.answer ? `${o} with a much longer and more careful qualifier` : o)) };
  assert.equal(keyLongest(longKey), true);
  assert.ok(blocking(longKey).some(p => /longest option/.test(p.reason)));
  const tie = { ...q, options: q.options.map(() => 'same length') .map((o, i) => `${o}${i}`) };
  assert.equal(keyLongest(tie), false, 'every option as long: no cue');
});
test('the Rapid quota: AI-written Rapid questions count against their own cap, not the vignettes\'', () => {
  const rapid = { kind: 'ai', q: { tags: ['generated', 'form:rapid'] } }, vig = { kind: 'ai', q: { tags: ['generated'] } };
  assert.equal(quotaOf(rapid), 'ai-rapid'); assert.equal(quotaOf(vig), 'ai'); assert.equal(quotaOf({ kind: 'user', q: { tags: ['form:rapid'] } }), 'user');
  const ais = [0, 1, 2, 3].map(n => distinct(`ai-v${n}`, 'ai', n + 20)), rapids = [0, 1, 2].map(n => ({ ...distinct(`ai-r${n}`, 'ai', n + 30), tags: ['generated', 'form:rapid'] }));
  const all = [...ais, ...rapids], verdicts = Object.fromEntries(all.map(q => [q.id, verdict(q)]));
  const { pool, decisions } = select(all, { verdicts, bars: BARS, quota: { ai: 2, 'ai-rapid': 2 }, topicShare: 1 });
  assert.equal(pool.filter(q => q.tags.includes('form:rapid')).length, 2); assert.equal(pool.filter(q => !q.tags.includes('form:rapid')).length, 2);
  assert.ok(decisions.some(d => /AI-written Rapid quota of 2 is full/.test(d.reasons[0] || '')));
});
test('the station writer: kind amsa or ai by the station, the key spread with its notes, the station as basis', () => {
  const { item: a } = stationItem(station, [station]);
  assert.equal(a.provenance.kind, 'amsa'); assert.equal(a.provenance.source.url, 'https://amsameded.org.au/x'); assert.deepEqual(a.provenance.generator.basis, ['amsa-900']);
  assert.equal(a.ask, 'What is the most likely diagnosis?'); assert.equal(a.options[a.answer], 'Inferior STEMI'); assert.equal(a.why[a.answer], null);
  assert.equal(a.why[a.options.indexOf('Aortic dissection')], 'Equal pulses.');
  const { item: b } = stationItem({ ...station, id: 'ai-12345678', source: 'ai' }, []);
  assert.equal(b.provenance.kind, 'ai');
  const q = { id: 'x1', options: ['k', 'a', 'b', 'c'], why: [null, 'wa', 'wb', 'wc'], answer: 0 }, s = spreadKey(q);
  assert.equal(s.options[s.answer], 'k'); assert.equal(s.why[s.options.indexOf('b')], 'wb');
  const positions = stationItems(Array.from({ length: 40 }, (_, i) => ({ ...station, id: `amsa-${900 + i}` }))).items.map(x => x.answer);
  assert.ok(new Set(positions).size >= 3, 'the keys are spread over the positions');
  const bm = benchmarkItem({ id: 'medqa-us4-test-9999', stem: GOOD.stem, options: GOOD.options.slice(0, 4), answer: 2, meta_info: 'step2&3', source: { name: 'MedQA', url: 'u', licence: 'MIT', retrieved: '2026-10-25' } });
  assert.equal(bm.provenance.kind, 'usmle-resource'); assert.deepEqual(bm.tags, ['src:medqa', 'exam:step2&3']); assert.equal(bm.provenance.source.licence, 'MIT');
});

test('the pool on disk is what the candidates make now (node scripts/mcq-pool.mjs after any change)', () => {
  const { files } = build(ROOT);
  for (const [k, f] of [['pool', 'public/mcq/pool.json'], ['status', 'public/mcq/status.json'], ['selection', 'data/mcq/selection.json']])
    assert.equal(fs.readFileSync(path.join(ROOT, f), 'utf8'), `${JSON.stringify(files[k], null, 1)}\n`, `${f} is stale`);
  for (const q of files.pool.questions) {
    assert.ok(cleanItem(q), `${q.id} is a valid question`);
    assert.ok(!flawReport(q).blocked, `${q.id} has no blocking flaw`);
    assert.equal(q.eval.verdict, 'pool');
  }
});
