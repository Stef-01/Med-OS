#!/usr/bin/env node
/* generate-hy.mjs - high-yield questions (founder 2026-10-26: "much more research online to find more high yield Qs").
   The topics are data/mcq/high-yield-topics.json: 15 specialties x 15 topics, weighted from the AMC MCQ specification
   (V8, 2025: adult medicine 30 %, adult surgery 20 %, women's, child, mental and population health 12.5 % each), the
   USMLE Step 2 CK weights, the UK licensing exam's conditions, AIHW burden of disease 2024 and Australian specifics
   (research 2026-10-26). For each topic Claude writes two questions so 0 to 1 can climb it: a foundation question
   (Year 1 or 2: the anatomy, physiology, pathophysiology or pharmacology behind it) and a clinical one (Year 3 or 4:
   the diagnosis, the test, the management), each with its kind, year and difficulty. Every question passes the duel
   writer's gate (lib/mcq.mjs) and then an independent examiner who answers it blind: a question is kept only when the
   examiner's answer is the key. Kept in data/mcq/high-yield.json; build-duel-pack.mjs puts them in the bank.

     node scripts/generate-hy.mjs                every topic not written yet
     options: --only cardiology,renal · --limit 6 (topics) · --batch 3 (topics a call) · --jobs 3 · --model sonnet
              --dry-run (the first batch, printed, nothing written)
   then: node scripts/tag-years.mjs is not needed (the writer tags the year and difficulty), npm run duel-pack */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATS, LIMITS, writerChecks } from './lib/mcq.mjs';
import { YEARS, DIFFICULTY, isYear, isDiff } from '../public/js/mcq/year.mjs';
import { SPECIALTIES } from '../public/js/study-kit/vocab.mjs';
import { fnv } from '../public/js/mcq/schema.mjs';
import { cli } from './lib/disk.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const HY_FILE = path.join(ROOT, 'data', 'mcq', 'high-yield.json');
const TOPICS_FILE = path.join(ROOT, 'data', 'mcq', 'high-yield-topics.json');
export { SPECIALTIES };
export const readHy = (file = HY_FILE) => { try { const j = JSON.parse(fs.readFileSync(file, 'utf8')); return Array.isArray(j.items) ? j.items : []; } catch { return []; } };

const str = { type: 'string' }, int = (a, b) => ({ type: 'integer', minimum: a, maximum: b });
const obj = props => ({ type: 'object', additionalProperties: false, required: Object.keys(props), properties: props });
export const SCHEMA = obj({ questions: { type: 'array', items: obj({
  topic: int(0, 20), level: { type: 'string', enum: ['foundation', 'clinical'] }, specialty: { type: 'string', enum: SPECIALTIES },
  cat: { type: 'string', enum: CATS.map(c => c.id) }, year: int(1, 4), difficulty: int(1, 3),
  stem: str, options: { type: 'array', minItems: 4, maxItems: 4, items: str }, answer: int(0, 3), why: str, notes: { type: 'array', minItems: 4, maxItems: 4, items: str }
}) } });
export const SYSTEM = `You write single-best-answer questions for Australian medical students, for a study app whose "0 to 1" mode climbs from first principles (Year 1) to final year (Year 4). You are given a few high-yield topics, each numbered. For each topic write exactly two questions:
- level "foundation": Year 1 or 2. The first principle under the topic: the anatomy, physiology, pathophysiology, microbiology or the mechanism of a drug the clinical decision rests on. A short stem (a vignette is optional). kind physio or anatomy (or clinical for a pharmacology mechanism).
- level "clinical": Year 3 or 4. A short clinical vignette (age, sex, setting, the findings that matter) asking the diagnosis, the test and how to read it (Year 3), or the management, the dose, the next step, escalation (Year 4). kind clinical or skills.
Kinds: ${CATS.map(c => `${c.id} (${c.label})`).join(', ')}.
Years: ${Object.entries(YEARS).map(([n, y]) => `${n} ${y.name}`).join('; ')}.
Difficulty for a student of that year: ${Object.entries(DIFFICULTY).map(([n, d]) => `${n} ${d.label}: ${d.brief}`).join('; ')}. Mix them.
specialty: the one specialty from the list the question belongs to.

Rules for every question:
- One option is clearly the best answer on current Australian practice (eTG, the Australian Medicines Handbook, RACGP, ANZCOR, the relevant college or state guideline, the national screening programs); a senior clinician would agree without argument. Check the answer twice.
- The stem gives what is needed to answer and ends with a direct question ending in "?". At most ${LIMITS.stem} characters, plain text. Never name the answer in the stem. No "EXCEPT", "NOT", "all of the above" or "none of the above".
- Exactly 4 options, each at most ${LIMITS.option} characters, the same kind of thing, similar in length and specificity. Every wrong option is plausible to a student who half knows the topic.
- answer is the index (0 to 3) of the right option; vary its position.
- why: one or two sentences (at most ${LIMITS.why} characters): why the answer is right, with the fact to keep.
- notes: one per option in order: "" for the right one; for each wrong one a sentence (at most ${LIMITS.note} characters) saying why it is wrong.
- Australian generic drug names, SI units, Australian spelling. Short stems: the questions are played against a timer.`;

export const EXAM_SYSTEM = 'You are an examiner checking single-best-answer questions written for Australian medical students. For each question, choose the one best answer on current Australian practice. Answer for every id with the index (0 to 3) of the option you choose; if two options are defensible or none is right, answer -1.';
export const EXAM_SCHEMA = obj({ answers: { type: 'array', items: obj({ id: str, answer: int(-1, 3) }) } });

/* one written question, checked, as a bank question; null with the reasons when it fails */
export function hyQuestion(q, spec, topic) {
  const issues = writerChecks(q);
  if (!isYear(q?.year)) issues.push('no year'); if (!isDiff(q?.difficulty)) issues.push('no difficulty');
  if (!SPECIALTIES.includes(q?.specialty)) issues.push('no specialty');
  if (issues.length) return { q: null, why: issues.join('; ') };
  const s = x => String(x ?? '').replace(/\s+/g, ' ').trim();
  return { q: { id: `hy-${fnv(`${spec}|${topic}|${q.level}|${s(q.stem)}`)}`, spec, topic, level: q.level, specialty: q.specialty, cat: q.cat, year: q.year, difficulty: q.difficulty,
    stem: s(q.stem), options: q.options.map(s), answer: q.answer, why: s(q.why), notes: q.notes.map((n, i) => (i === q.answer ? null : s(n))) }, why: '' };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { argv, opt } = cli();
  const topics = JSON.parse(fs.readFileSync(TOPICS_FILE, 'utf8')), only = opt('--only', '').split(',').filter(Boolean);
  const store = readHy(), done = new Set(store.map(x => `${x.spec}|${x.topic}`));
  let todo = Object.entries(topics).filter(([k]) => !only.length || only.includes(k)).flatMap(([spec, list]) => list.map(topic => ({ spec, topic }))).filter(x => !done.has(`${x.spec}|${x.topic}`));
  if (opt('--limit')) todo = todo.slice(0, +opt('--limit'));
  const size = Math.max(1, +opt('--batch', 3)), batches = [];
  for (let i = 0; i < todo.length; i += size) batches.push(todo.slice(i, i + size));
  const ask = (await import('./lib/claude-cli.mjs')).claudeCliJson, model = opt('--model', 'sonnet');
  const unwrap = r => (r && r.value && !r.questions && !r.answers ? r.value : r);
  console.log(`${todo.length} topics in ${batches.length} batches · Claude ${model} via the CLI`);
  const save = () => { fs.mkdirSync(path.dirname(HY_FILE), { recursive: true }); store.sort((a, b) => (a.id < b.id ? -1 : 1)); fs.writeFileSync(HY_FILE, `${JSON.stringify({ note: 'Written by scripts/generate-hy.mjs: two questions a high-yield topic (data/mcq/high-yield-topics.json), each kept only when an independent examiner answered it blind to the same key. Kind ai.', items: store }, null, 1)}\n`); };
  let kept = 0, dropped = 0;
  const worker = async () => {
    for (let b; (b = batches.shift());) {
      try {
        const content = b.map((x, i) => `Topic ${i}: [${x.spec.replace(/_/g, ' ')}] ${x.topic}`).join('\n');
        const w = unwrap(await ask({ system: SYSTEM, content, schema: SCHEMA, effort: 'medium', model, label: 'hy' }));
        const made = [];
        for (const q of w?.questions || []) { const t = b[q.topic]; if (!t) continue; const r = hyQuestion(q, t.spec, t.topic); if (r.q) made.push(r.q); else { dropped++; console.log(`gate: ${t.spec} ${q.level}: ${r.why}`); } }
        if (argv.includes('--dry-run')) { console.log(JSON.stringify(made, null, 1)); process.exit(0); }
        if (!made.length) continue;
        const e = unwrap(await ask({ system: EXAM_SYSTEM, content: JSON.stringify(made.map(q => ({ id: q.id, stem: q.stem, options: q.options }))), schema: EXAM_SCHEMA, effort: 'medium', model, label: 'hy-exam' }));
        const by = new Map((e?.answers || []).map(a => [a.id, a.answer]));
        for (const q of made) { if (by.get(q.id) === q.answer) { store.push(q); kept++; } else { dropped++; console.log(`examiner: ${q.spec} ${q.level} (${q.id}): key ${q.answer}, examiner ${by.get(q.id)}`); } }
        save(); console.log(`batch: ${made.length} written · kept ${kept} so far`);
      } catch (err) { console.error(`batch failed: ${String(err.message).slice(0, 200)}`); }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, +opt('--jobs', 3)) }, worker));
  console.log(`kept ${kept} · dropped ${dropped} · total ${store.length}`);
}
