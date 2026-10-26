#!/usr/bin/env node
/* import-medexpqa.mjs - real exam questions with doctors' explanations (research 2026-10-26: "the best human-written
   explanations of any open set; clean licence chain"). MedExpQA (HiTZ, huggingface.co/datasets/HiTZ/MedExpQA, CC BY
   4.0; the raw Antidote CasiMedicos corpus is CC0): 622 cases from the Spanish MIR residency exam, each explained by
   doctors of the CasiMedicos community, option by option. data/medexpqa/medexpqa-en.jsonl holds the English fields.

   Claude adapts each case for Australian students (CC BY allows adaptation with credit and a note of the changes):
   Australian generic drug names and practice, the stem tightened for the timer, four options (the weakest distractor
   dropped when there are five), the doctors' explanation as the why and the notes, and its specialty, kind, year and
   difficulty. A case that turns on Spanish law, the Spanish health system or a fact Australian practice contradicts is
   left out. Every adapted question passes the duel writer's gate and then a blind examiner (as generate-hy.mjs). Kept in
   data/mcq/medexpqa.json; build-duel-pack.mjs puts them in the bank with their credit.

     node scripts/import-medexpqa.mjs      options: --limit 12 · --batch 6 · --jobs 3 · --model sonnet · --dry-run */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATS, LIMITS, gate } from './lib/mcq.mjs';
import { YEARS, DIFFICULTY, isYear, isDiff } from '../public/js/mcq/year.mjs';
import { SPECIALTIES, EXAM_SYSTEM, EXAM_SCHEMA } from './generate-hy.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const MXQ_FILE = path.join(ROOT, 'data', 'mcq', 'medexpqa.json');
export const CREDIT = 'Adapted from MedExpQA / Antidote CasiMedicos (HiTZ), CC BY 4.0: Spanish MIR exam question and doctors’ explanation, adapted for Australian practice';
export const readMxq = (file = MXQ_FILE) => { try { const j = JSON.parse(fs.readFileSync(file, 'utf8')); return Array.isArray(j.items) ? j.items : []; } catch { return []; } };
const SRC = path.join(ROOT, 'data', 'medexpqa', 'medexpqa-en.jsonl');   /* not data/benchmarks: the pool reads every file there */

const str = { type: 'string' }, int = (a, b) => ({ type: 'integer', minimum: a, maximum: b });
const obj = props => ({ type: 'object', additionalProperties: false, required: Object.keys(props), properties: props });
const SCHEMA = obj({ items: { type: 'array', items: obj({
  id: str, keep: { type: 'boolean' }, reason: str, specialty: { type: 'string', enum: SPECIALTIES }, cat: { type: 'string', enum: CATS.map(c => c.id) },
  year: int(1, 4), difficulty: int(1, 3), stem: str, options: { type: 'array', minItems: 4, maxItems: 4, items: str }, answer: int(0, 3), why: str, notes: { type: 'array', minItems: 4, maxItems: 4, items: str }
}) } });
const SYSTEM = `You adapt real exam questions (the Spanish MIR residency exam, with explanations written by Spanish doctors) into single-best-answer questions for Australian medical students. For each case given:
- keep: false (with a short reason) when the question turns on Spanish law, the Spanish health system, a Spanish code of ethics, Spanish epidemiology, or a fact current Australian practice contradicts. Otherwise keep: true.
- Rewrite the stem for Australian practice: Australian generic drug names (e.g. benzodiazepines spelt -azepam, acenocoumarol becomes warfarin when the point allows), SI units, Australian spelling. Keep the clinical problem and the right answer the same. Tighten it to at most ${LIMITS.stem} characters, ending in a direct question with "?". Never name the answer in the stem.
- Exactly 4 options, each at most ${LIMITS.option} characters: when the original has five, drop the weakest distractor. answer is the index (0 to 3) of the right option after your edits.
- why: one or two sentences (at most ${LIMITS.why} characters) from the doctors' explanation: why the answer is right, with the fact to keep. notes: one per option in order, "" for the right one, a sentence (at most ${LIMITS.note} characters) for each wrong one, from the doctors' explanation where it says, else your own.
- specialty: one of the given list. cat (kind): ${CATS.map(c => `${c.id} (${c.label})`).join(', ')}.
- year (1 to 4): ${Object.entries(YEARS).map(([n, y]) => `${n} ${y.name}`).join('; ')}; the earliest year a student could answer it. difficulty (1 to 3, for a student of that year): ${Object.entries(DIFFICULTY).map(([n, d]) => `${n} ${d.label}`).join(', ')}.
Answer for every id given. For a case you do not keep, still fill the other fields with placeholders.`;

export function mxqQuestion(q, src) {
  if (!q?.keep) return { q: null, why: `left out: ${q?.reason || 'not kept'}` };
  const issues = gate(q);
  if (!isYear(q.year)) issues.push('no year'); if (!isDiff(q.difficulty)) issues.push('no difficulty'); if (!SPECIALTIES.includes(q.specialty)) issues.push('no specialty');
  if (issues.length) return { q: null, why: issues.join('; ') };
  const s = x => String(x ?? '').replace(/\s+/g, ' ').trim();
  return { q: { id: src.id, specialty: q.specialty, cat: q.cat, year: q.year, difficulty: q.difficulty, stem: s(q.stem), options: q.options.map(s), answer: q.answer, why: s(q.why), notes: q.notes.map((n, i) => (i === q.answer ? null : s(n))), origin: src.type, exam: src.year ? `MIR ${src.year}` : 'MIR' }, why: '' };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
  const src = fs.readFileSync(SRC, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
  const store = readMxq(), seen = new Set([...store.map(x => x.id), ...readSkipped()]);
  let todo = src.filter(x => !seen.has(x.id)); if (opt('--limit')) todo = todo.slice(0, +opt('--limit'));
  const size = Math.max(1, +opt('--batch', 6)), batches = [];
  for (let i = 0; i < todo.length; i += size) batches.push(todo.slice(i, i + size));
  const ask = (await import('./lib/claude-cli.mjs')).claudeCliJson, model = opt('--model', 'sonnet');
  const unwrap = r => (r && r.value && !r.items && !r.answers ? r.value : r);
  const skipped = new Set(readSkipped());
  console.log(`${todo.length} cases in ${batches.length} batches · Claude ${model} via the CLI`);
  const save = () => {
    fs.mkdirSync(path.dirname(MXQ_FILE), { recursive: true }); store.sort((a, b) => (a.id < b.id ? -1 : 1));
    fs.writeFileSync(MXQ_FILE, `${JSON.stringify({ note: `${CREDIT}. Written by scripts/import-medexpqa.mjs; each kept only when a blind examiner chose the same key. skipped: cases left out (Spanish law or system, or failed checks).`, credit: CREDIT, url: 'https://huggingface.co/datasets/HiTZ/MedExpQA', licence: 'CC BY 4.0', items: store, skipped: [...skipped].sort() }, null, 1)}\n`);
  };
  let kept = 0, dropped = 0;
  const worker = async () => {
    for (let b; (b = batches.shift());) {
      try {
        const content = JSON.stringify(b.map(x => ({ id: x.id, specialty_hint: x.type, question: x.question, options: x.options, correct_option_1based: x.correct, doctors_explanation: x.answer, option_explanations: x.explanations })));
        const w = unwrap(await ask({ system: `${SYSTEM}\nSpecialties: ${SPECIALTIES.join(', ')}`, content, schema: SCHEMA, effort: 'medium', model, label: 'mxq' }));
        const made = [];
        for (const q of w?.items || []) { const s0 = b.find(x => x.id === q.id); if (!s0) continue; const r = mxqQuestion(q, s0); if (r.q) made.push(r.q); else { dropped++; skipped.add(s0.id); console.log(`${s0.id}: ${r.why}`); } }
        if (argv.includes('--dry-run')) { console.log(JSON.stringify(made, null, 1)); process.exit(0); }
        if (made.length) {
          const e = unwrap(await ask({ system: EXAM_SYSTEM, content: JSON.stringify(made.map(q => ({ id: q.id, stem: q.stem, options: q.options }))), schema: EXAM_SCHEMA, effort: 'medium', model, label: 'mxq-exam' }));
          const by = new Map((e?.answers || []).map(a => [a.id, a.answer]));
          for (const q of made) { if (by.get(q.id) === q.answer) { store.push(q); kept++; } else { dropped++; skipped.add(q.id); console.log(`examiner: ${q.id}: key ${q.answer}, examiner ${by.get(q.id)}`); } }
        }
        save(); console.log(`batch: kept ${kept} so far`);
      } catch (err) { console.error(`batch failed: ${String(err.message).slice(0, 200)}`); }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, +opt('--jobs', 3)) }, worker));
  console.log(`kept ${kept} · left out ${dropped} · total ${store.length}`);
}
function readSkipped() { try { return JSON.parse(fs.readFileSync(MXQ_FILE, 'utf8')).skipped || []; } catch { return []; } }
