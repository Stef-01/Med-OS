#!/usr/bin/env node
/* tag-years.mjs - the year (1 to 4) and difficulty (1 to 3, public/js/mcq/year.mjs) of every question in the duel's pack,
   by Claude, kept in data/mcq/years.json ({ years: { id: year }, difficulty: { id: 1..3 } }) for build-duel-pack.mjs,
   which falls back to guessYear() and guessDiff() for a question not tagged yet. Only questions missing either are
   sent (a year already given is kept), so a run after new questions are written tags just those:

     node scripts/tag-years.mjs                every untagged question in public/duel/pack.json
     node scripts/tag-years.mjs --redo        tag them all again
     node scripts/tag-years.mjs --kinds       sort the pooled questions into clinical, physio or anatomy (the pack files
                                              them clinical until then); --kinds --redo sorts them all again
     node scripts/tag-years.mjs --retest 80   tag a seeded sample again from scratch and compare (data/mcq/tag-retest.json,
                                              lib/mcq-tag-retest.mjs; years.json is not touched); mcq-evals.mjs reports it
     options: --passes 3 (a year and difficulty is the median of this many passes, each in its own batch order; kinds take
              one) · --batch 40 · --jobs 3 · --model sonnet · --dry-run (print the first batch's answer, write nothing)
   then: npm run duel-pack

   The Claude Code CLI on the signed-in subscription (lib/claude-cli.mjs), else the API (lib/claude.mjs) with a key. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { YEARS, isYear, DIFFICULTY, isDiff } from '../public/js/mcq/year.mjs';
import { fnv } from '../public/js/mcq/schema.mjs';
import { claudeAsk } from './lib/ask.mjs';
import { cli } from './lib/disk.mjs';
import { tagSample, tagRetestStats, medianTag } from './lib/mcq-tag-retest.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const YEARS_FILE = path.join(ROOT, 'data', 'mcq', 'years.json');
export const TAG_RETEST_FILE = path.join(ROOT, 'data', 'mcq', 'tag-retest.json');
const readFile = (file, k) => { try { const j = JSON.parse(fs.readFileSync(file, 'utf8')); return j && typeof j[k] === 'object' ? j[k] : {}; } catch { return {}; } };
export const readYears = (file = YEARS_FILE) => readFile(file, 'years');
export const readDifficulty = (file = YEARS_FILE) => readFile(file, 'difficulty');
export const readKinds = (file = YEARS_FILE) => readFile(file, 'kinds');

/* difficulty decided by what it takes, with a tie-break: a retest of 80 (2026-10-27) agreed on the year 96% of the time
   (kappa 0.93) but on difficulty 69% (kappa 0.51), every disagreement one step, most between Easy and Medium. The rule raised two fresh runs' agreement from 85% to 89% (kappa 0.77 to 0.82), and
   every question was tagged again with it, so the stored tags come from one pass */
export const DIFF_RULE = `Decide difficulty by what answering takes, for a student of that year:
1 Easy: one well-known fact or a classic pattern the stem spells out; no option is close.
2 Medium: one inference (put two findings together, or apply a rule to this patient), or a less common fact, or one close distractor.
3 Hard: two or more inferences in a row, the exception or second-line choice, or two options that both look right until one specific detail.
When torn between two levels, choose the lower one unless the higher level's condition is clearly met.
Judge each question on its own, against that standard: never rank the questions in this list against each other (a list of hard questions can all be Hard, a list of easy ones all Easy).`;
export const SYSTEM = `You place medical school multiple-choice questions on the year of a four-year medical degree they are pitched at, so a student can learn from first principles upwards ("0 to 1": Year 1, then 2, then 3, then final year).

${Object.entries(YEARS).map(([n, y]) => `Year ${n} (${y.name}): ${y.brief}.`).join('\n')}

Judge what the question asks the student to know or do, not the setting of the vignette: a question set on a ward that asks which nerve supplies a muscle is Year 1; one that asks the mechanism of a drug or why a sign occurs is Year 2; one that asks the most likely diagnosis or the best test is Year 3; one that asks the next step in management, a dose, or what to do first in an unwell patient is Year 4. Give the earliest year a well-taught student could answer it.

Then its difficulty for a student of that year:
${Object.entries(DIFFICULTY).map(([n, d]) => `${n} ${d.label}: ${d.brief}.`).join('\n')}
${DIFF_RULE}
Answer for every id given, with one integer year and one integer difficulty each.`;
export const SCHEMA = { type: 'object', additionalProperties: false, required: ['years'], properties: { years: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'year', 'difficulty'], properties: { id: { type: 'string' }, year: { type: 'integer', minimum: 1, maximum: 4 }, difficulty: { type: 'integer', minimum: 1, maximum: 3 } } } } } };
export const brief = q => ({ id: q.id, kind: q.cat || '', stem: String(q.stem).slice(0, 700), options: q.options });

/* --kinds: the duel's second layer (the pack's cats) for a pooled question, which the pack otherwise files as clinical */
export const KIND_SYSTEM = `You sort medical school multiple-choice questions by what they test, so a student can drill one kind at a time.

clinical: diagnosing, investigating or managing a patient, prognosis, ethics and law in practice, public health and the health system.
physio: physiology, pathophysiology, pharmacology mechanisms, biochemistry or genetics: how the body works and why a disease or drug behaves as it does.
anatomy: structure: anatomy, embryology, histology, the nerve, vessel or muscle involved.

Judge what the question asks, not its setting: a vignette that asks which nerve is injured is anatomy; one that asks the mechanism of a drug is physio; one that asks the next step is clinical. Answer for every id given.`;
export const KIND_SCHEMA = { type: 'object', additionalProperties: false, required: ['kinds'], properties: { kinds: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'kind'], properties: { id: { type: 'string' }, kind: { type: 'string', enum: ['clinical', 'physio', 'anatomy'] } } } } } };

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { argv, opt } = cli();
  const pack = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'duel', 'pack.json'), 'utf8'));
  const redo = argv.includes('--redo'), KINDS = argv.includes('--kinds'), years = redo && !KINDS ? {} : readYears(), diff = redo && !KINDS ? {} : readDifficulty(), kinds = redo && KINDS ? {} : readKinds();
  /* --kinds: the pooled questions (the ones the pack files as clinical by default) the tagger has not sorted */
  const pooled = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'mcq', 'pool.json'), 'utf8')).questions.map(q => q.id));
  if (opt('--retest')) {   /* the same prompts, fresh calls, on a fixed sample; nothing tagged is changed */
    const sample = tagSample(pack.questions, +opt('--retest') || 80), { ask } = await claudeAsk(), model = opt('--model', 'sonnet');
    const again = { years: {}, difficulty: {}, kinds: {} }, P = Math.max(1, +opt('--passes', 3)), vy = {}, vd = {};
    for (let p = 0; p < P; p++) {   /* as the tagger does: each pass in its own order, the median kept */
      const order = [...sample].sort((a, b) => (fnv(`retest${p}:${a.id}`) < fnv(`retest${p}:${b.id}`) ? -1 : 1));
      for (let i = 0; i < order.length; i += 40) {
        const r = await ask({ system: SYSTEM, content: JSON.stringify(order.slice(i, i + 40).map(brief)), schema: SCHEMA, effort: 'low', model, label: 'years-retest' });
        for (const x of (r?.years ? r : r?.value)?.years || []) { (vy[x.id] ||= []).push(x.year); (vd[x.id] ||= []).push(x.difficulty); }
      }
    }
    for (const q of sample) { again.years[q.id] = medianTag(vy[q.id] || []); again.difficulty[q.id] = medianTag(vd[q.id] || []); }
    const pk = sample.filter(q => pooled.has(q.id));
    for (let i = 0; i < pk.length; i += 40) { const k = await ask({ system: KIND_SYSTEM, content: JSON.stringify(pk.slice(i, i + 40).map(brief)), schema: KIND_SCHEMA, effort: 'low', model, label: 'kinds-retest' }); for (const x of (k?.kinds ? k : k?.value)?.kinds || []) again.kinds[x.id] = x.kind; }
    const rows = sample.map(q => ({ id: q.id, source: q.source || 'unknown', year: [years[q.id] ?? null, again.years[q.id] ?? null], difficulty: [diff[q.id] ?? null, again.difficulty[q.id] ?? null], ...(pooled.has(q.id) ? { kind: [kinds[q.id] ?? null, again.kinds[q.id] ?? null] } : {}) }));
    fs.writeFileSync(TAG_RETEST_FILE, `${JSON.stringify({ note: 'Written by scripts/tag-years.mjs --retest: a seeded sample of the pack tagged again from scratch; [first, again] per tag. lib/mcq-tag-retest.mjs reads it.', at: new Date().toISOString().slice(0, 10), model, passes: P, rows }, null, 1)}\n`);
    const st = tagRetestStats(rows);
    console.log(`retest of ${st.n}: year same ${st.year.same}% (within one ${st.year.withinOne}%, kappa ${st.year.kappa}) · difficulty same ${st.difficulty.same}% (kappa ${st.difficulty.kappa}) · kind same ${st.kind.same}% of ${st.kind.n} (kappa ${st.kind.kappa}) -> data/mcq/tag-retest.json`);
    process.exit(0);
  }
  /* each pass in its own fixed hash order, so a question meets different neighbours each time: the model judges
     difficulty partly against the batch it sees (one pass agrees with a differently batched one about 70 to 79% of the
     time), and the median of the passes is the tag (medianTag) */
  const P = KINDS ? 1 : Math.max(1, +opt('--passes', 3));
  const mixed = (qs, p) => [...qs].sort((a, b) => (fnv(`tag${p}:${a.id}`) < fnv(`tag${p}:${b.id}`) ? -1 : 1));
  const todo = KINDS ? pack.questions.filter(q => pooled.has(q.id) && !kinds[q.id]) : pack.questions.filter(q => !isYear(years[q.id]) || !isDiff(diff[q.id]));
  const size = Math.max(5, +opt('--batch', 40)), batches = [], vy = {}, vd = {};
  for (let p = 0; p < P; p++) { const o = mixed(todo, p); for (let i = 0; i < o.length; i += size) batches.push(o.slice(i, i + size)); }
  const { ask, name } = await claudeAsk();
  console.log(`${todo.length} questions to tag${P > 1 ? ` in ${P} passes` : ''}, ${batches.length} batches · Claude via ${name}`);
  const save = () => { fs.mkdirSync(path.dirname(YEARS_FILE), { recursive: true }); fs.writeFileSync(YEARS_FILE, `${JSON.stringify({ note: 'Written by scripts/tag-years.mjs: the year (1 to 4, public/js/mcq/year.mjs) of each duel question, by Claude.', years: Object.fromEntries(Object.entries(years).sort(([a], [b]) => (a < b ? -1 : 1))), difficulty: Object.fromEntries(Object.entries(diff).sort(([a], [b]) => (a < b ? -1 : 1))), kinds: Object.fromEntries(Object.entries(kinds).sort(([a], [b]) => (a < b ? -1 : 1))) }, null, 1)}\n`); };
  let done = 0, failed = 0;
  const worker = async () => {
    for (let b; (b = batches.shift());) {
      const ids = new Set(b.map(q => q.id));
      try {
        const raw = await ask({ system: KINDS ? KIND_SYSTEM : SYSTEM, content: JSON.stringify(b.map(brief)), schema: KINDS ? KIND_SCHEMA : SCHEMA, effort: 'low', model: opt('--model', 'sonnet'), label: KINDS ? 'kinds' : 'years' });
        const field = KINDS ? 'kinds' : 'years', out = (raw?.[field] ? raw : raw?.value)?.[field] || [];
        if (argv.includes('--dry-run')) { console.log(JSON.stringify(out, null, 1)); process.exit(0); }
        if (KINDS) { let n = 0; for (const x of out) if (ids.has(x.id) && KIND_SCHEMA.properties.kinds.items.properties.kind.enum.includes(x.kind)) { kinds[x.id] = x.kind; n++; } done += n; save(); console.log(`batch: ${n} of ${b.length} sorted (${done} so far)`); continue; }
        let n = 0; for (const x of out) if (ids.has(x.id) && isYear(x.year)) { (vy[x.id] ||= []).push(x.year); if (isDiff(x.difficulty)) (vd[x.id] ||= []).push(x.difficulty); n++; }
        done += n; console.log(`batch: ${n} of ${b.length} tagged (${done} of ${todo.length * P} so far)`);
      } catch (e) { failed += b.length; console.error(`batch failed: ${String(e.message).slice(0, 200)}`); }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, +opt('--jobs', 3)) }, worker));
  if (!KINDS) { for (const q of todo) { const y = medianTag(vy[q.id] || []), d = medianTag(vd[q.id] || []); if (!isYear(years[q.id]) && isYear(y)) years[q.id] = y; if (isDiff(d)) diff[q.id] = d; } save(); }
  const count = o => Object.values(o).reduce((m, y) => ((m[y] = (m[y] || 0) + 1), m), {});
  console.log(`tagged ${done} · failed ${failed} · by year ${JSON.stringify(count(years))} · by difficulty ${JSON.stringify(count(diff))}${KINDS ? ` · by kind ${JSON.stringify(count(kinds))}` : ''}`);
}
