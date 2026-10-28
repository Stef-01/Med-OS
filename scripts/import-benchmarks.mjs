#!/usr/bin/env node
/* import-benchmarks.mjs - the open, MIT-licensed USMLE-style items the pool may use, copied from the normalised
   downloads into data/benchmarks/ (one JSON line per item, its source and licence on every line):

     data/benchmarks/medqa-us-step2-3.jsonl            MedQA US 4-option test split, the "step2&3" items (Step 2 CK style)
     data/benchmarks/mmlu-professional-medicine.jsonl  MMLU professional_medicine (clinical vignettes)

   node scripts/import-benchmarks.mjs [--from <dir>]   (default: $MCQ_BENCH_DIR, else ../research/mcq-src)

   Only rows whose licence starts with MIT are copied. The official USMLE sample items (QUEST-AI's human half, copyright
   FSMB/NBME) are never copied: the evals read them where they were downloaded and keep only aggregate numbers. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJsonl } from './lib/mcq-sources.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const benchDir = argv => { const i = argv.indexOf('--from'); return path.resolve(i >= 0 ? argv[i + 1] : process.env.MCQ_BENCH_DIR || path.join(ROOT, '..', 'research', 'mcq-src')); };
export const SETS = [
  { out: 'medqa-us-step2-3.jsonl', from: 'medqa-us-test/normalised.jsonl', keep: r => r.meta_info === 'step2&3' },
  { out: 'mmlu-professional-medicine.jsonl', from: 'mmlu-med/normalised.jsonl', keep: r => r.topic === 'professional_medicine' },
  { out: 'mmlu-basic-sciences.jsonl', from: 'mmlu-med/normalised.jsonl', keep: r => ['anatomy', 'medical_genetics', 'clinical_knowledge', 'college_medicine'].includes(r.topic) }   /* level:preclinical (lib/mcq-sources.mjs), with its own review and quota */
];
const FIELDS = ['id', 'stem', 'options', 'answer', 'explanation', 'topic', 'meta_info', 'exam', 'source'];

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = benchDir(process.argv.slice(2)), outDir = path.join(ROOT, 'data', 'benchmarks');
  fs.mkdirSync(outDir, { recursive: true });
  for (const s of SETS) {
    const rows = readJsonl(path.join(dir, s.from)).filter(s.keep).filter(r => /^MIT\b/.test(r.source?.licence || ''));
    if (!rows.length) { console.error(`${s.from}: nothing found under ${dir}`); process.exit(1); }
    fs.writeFileSync(path.join(outDir, s.out), rows.map(r => JSON.stringify(Object.fromEntries(FIELDS.filter(k => r[k] !== undefined).map(k => [k, r[k]])))).join('\n') + '\n');
    console.log(`${s.out}: ${rows.length} items`);
  }
}
