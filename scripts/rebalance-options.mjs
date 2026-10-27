#!/usr/bin/env node
/* rebalance-options.mjs - takes the longest-option cue out of the written questions that still carry it (lib/mcq-rebalance.mjs
   says why and how): Claude rewrites the wrong options only, a rewrite must pass the writer's checks, and an independent
   examiner, answering blind, must still pick the key; otherwise the question is left as it was. Each kept rewrite is
   marked rebalanced: <date>.

     node scripts/rebalance-options.mjs --set hy         data/mcq/high-yield.json
     node scripts/rebalance-options.mjs --set station    public/duel/mcq/*.json (the station questions)
     options: --limit n · --batch 8 · --jobs 3 · --model sonnet · --dry-run (the first batch's rewrites, printed)
   then: npm run duel-pack */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REBALANCE_SYSTEM, REBALANCE_SCHEMA, examSchema, needsRebalance, brief, rebalanced } from './lib/mcq-rebalance.mjs';
import { EXAM_SYSTEM, HY_FILE } from './generate-hy.mjs';
import { claudeAsk } from './lib/ask.mjs';
import { cli } from './lib/disk.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { argv, opt } = cli();
const SET = opt('--set'), today = new Date().toISOString().slice(0, 10);
if (!['hy', 'station'].includes(SET)) { console.error('usage: node scripts/rebalance-options.mjs --set hy|station [--limit n] [--batch 8] [--jobs 3] [--dry-run]'); process.exit(2); }

/* the files and their questions: [{ file, json, list }] where list is the array that holds the questions */
const MCQ_DIR = path.join(ROOT, 'public', 'duel', 'mcq');
const files = SET === 'hy'
  ? [{ file: HY_FILE, json: JSON.parse(fs.readFileSync(HY_FILE, 'utf8')) }].map(f => ({ ...f, list: f.json.items }))
  : fs.readdirSync(MCQ_DIR).filter(f => f.endsWith('.json')).sort().map(f => { const file = path.join(MCQ_DIR, f), json = JSON.parse(fs.readFileSync(file, 'utf8')); return { file, json, list: json.questions }; });
const owner = new Map(files.flatMap(f => f.list.map(q => [q.id, f])));
let todo = files.flatMap(f => f.list.filter(needsRebalance));
if (opt('--limit')) todo = todo.slice(0, +opt('--limit'));
const size = Math.max(1, +opt('--batch', 8)), batches = [];
for (let i = 0; i < todo.length; i += size) batches.push(todo.slice(i, i + size));
const { ask, name } = await claudeAsk(), model = opt('--model', 'sonnet');
const unwrap = r => (r && r.value !== undefined && !Array.isArray(r) ? r.value : r);
console.log(`${todo.length} ${SET} questions with the key the longest option, in ${batches.length} batches · Claude via ${name}`);
const dirty = new Set(), save = () => { for (const f of dirty) fs.writeFileSync(f.file, `${JSON.stringify(f.json, null, 1)}\n`); dirty.clear(); };
let kept = 0, refused = 0, examiner = 0;
const worker = async () => {
  for (let b; (b = batches.shift());) {
    try {
      const w = unwrap(await ask({ system: REBALANCE_SYSTEM, content: JSON.stringify(b.map(brief)), schema: REBALANCE_SCHEMA, effort: 'medium', model, label: 'rebalance' }));
      const made = [];
      for (const x of w?.items || []) {
        const q = b.find(y => y.id === x.id); if (!q) continue;
        const r = rebalanced(q, x.options, x.keyShortened === true);
        if (r.q) made.push(r.q); else { refused++; console.log(`refused ${q.id}: ${r.why.join('; ')}`); }
      }
      if (argv.includes('--dry-run')) { for (const q of made) console.log(JSON.stringify({ id: q.id, before: b.find(y => y.id === q.id).options, after: q.options })); process.exit(0); }
      if (!made.length) continue;
      const n = Math.max(...made.map(q => q.options.length));
      const e = unwrap(await ask({ system: EXAM_SYSTEM.replace('(0 to 3)', `(0 to ${n - 1})`), content: JSON.stringify(made.map(q => ({ id: q.id, stem: q.stem, options: q.options }))), schema: examSchema(n), effort: 'medium', model, label: 'rebalance-exam' }));
      const by = new Map((e?.answers || []).map(a => [a.id, a.answer]));
      for (const q of made) {
        if (by.get(q.id) !== q.answer) { examiner++; console.log(`examiner ${q.id}: key ${q.answer}, examiner ${by.get(q.id)}; left as it was`); continue; }
        const f = owner.get(q.id), i = f.list.findIndex(y => y.id === q.id);
        f.list[i] = { ...f.list[i], options: q.options, rebalanced: today }; dirty.add(f); kept++;
      }
      save(); console.log(`batch: ${made.length} rewritten · ${kept} kept so far`);
    } catch (e) { console.error(`batch failed: ${String(e.message).slice(0, 200)}`); }
  }
};
await Promise.all(Array.from({ length: Math.max(1, +opt('--jobs', 3)) }, worker));
save();
console.log(`kept ${kept} · refused by the checks ${refused} · refused by the examiner ${examiner}`);
