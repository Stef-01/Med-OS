#!/usr/bin/env node
/* explain-mcq.mjs - explanations for pooled questions published without one (lib/mcq-explain.mjs says why). Claude
   writes each with the key given; a second call reviews it (accurate, consistent with the key); only one that passes
   both and the checks is kept, in data/mcq/explanations.json. build-duel-pack.mjs puts them in the pack, marked
   AI-written. The questions themselves are never changed.
     node scripts/explain-mcq.mjs [--kind usmle-resource,open-exam] [--limit 20] [--batch 8] [--jobs 3] [--model opus] [--dry-run] */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cli, list, readJson } from './lib/disk.mjs';
import { needsExplanation, storedFor, explainBrief, checkBrief, explanationOf, passesCheck, record, EXPLAIN_SYSTEM, EXPLAIN_SCHEMA, CHECK_SYSTEM, CHECK_SCHEMA } from './lib/mcq-explain.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const EXPLAIN_FILE = path.join(ROOT, 'data', 'mcq', 'explanations.json');
export const readExplanations = (f = EXPLAIN_FILE) => readJson(f, { items: {} }).items || {};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { opt, flag } = cli();
  const kinds = list(opt('--kind', 'usmle-resource,open-exam'));
  const pool = readJson(path.join(ROOT, 'public', 'mcq', 'pool.json'), { questions: [] }).questions;
  const file = readJson(EXPLAIN_FILE, { items: {}, refused: {} }), store = file.items || {}, refused = file.refused || {};
  let todo = pool.filter(q => kinds.includes(q.provenance?.kind) && needsExplanation(q) && !storedFor(store, q));
  if (opt('--limit')) todo = todo.slice(0, +opt('--limit'));
  const size = Math.max(1, +opt('--batch', 8)), batches = [];
  for (let i = 0; i < todo.length; i += size) batches.push(todo.slice(i, i + size));
  const model = opt('--model', 'opus'), cliJson = (await import('./lib/claude-cli.mjs')).claudeCliJson,
    ask = async a => { const r = await cliJson(a); return r && r.value && !r.items ? r.value : r; }, day = new Date().toISOString().slice(0, 10);
  console.log(`${todo.length} questions without an explanation (${kinds.join(', ')}) in ${batches.length} batches · Claude ${model}`);
  const save = () => {
    const sorted = o => Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1)));
    fs.writeFileSync(EXPLAIN_FILE, `${JSON.stringify({ note: 'AI-written explanations for pooled questions published without one (scripts/explain-mcq.mjs, lib/mcq-explain.mjs). Each was reviewed by a second call and kept only when accurate and consistent with the key; hash ties it to the question as it is. refused: the last refusal per question.', items: sorted(store), refused: sorted(refused) }, null, 1)}\n`);
  };
  let kept = 0, lost = 0;
  const worker = async () => {
    for (let b; (b = batches.shift());) {
      try {
        const w = await ask({ system: EXPLAIN_SYSTEM, content: JSON.stringify(b.map(explainBrief)), schema: EXPLAIN_SCHEMA, effort: 'medium', model, label: 'explain' });
        const made = [];
        for (const q of b) {
          const r = explanationOf(q, (w?.items || []).find(x => x.id === q.id));
          if (r.e) made.push({ q, e: r.e }); else { lost++; refused[q.id] = { why: r.why.join('; '), at: day }; console.log(`${q.id}: ${r.why.join('; ')}`); }
        }
        if (flag('--dry-run')) { console.log(JSON.stringify(made.map(m => ({ id: m.q.id, ...m.e })), null, 1)); process.exit(0); }
        if (made.length) {
          const c = await ask({ system: CHECK_SYSTEM, content: JSON.stringify(made.map(m => checkBrief(m.q, m.e))), schema: CHECK_SCHEMA, effort: 'medium', model, label: 'explain-check' });
          for (const m of made) {
            const v = (c?.items || []).find(x => x.id === m.q.id);
            if (passesCheck(v)) { store[m.q.id] = record(m.q, m.e, { model, at: day }); delete refused[m.q.id]; kept++; }
            else { lost++; refused[m.q.id] = { why: `review: ${v ? v.problem || 'not accurate or not consistent' : 'no verdict'}`, at: day }; console.log(`${m.q.id}: review: ${v?.problem || 'no verdict'}`); }
          }
        }
        save(); console.log(`batch: kept ${kept}, refused ${lost} so far`);
      } catch (err) { console.error(`batch failed: ${String(err.message).slice(0, 200)}`); }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, +opt('--jobs', 3)) }, worker));
  console.log(`kept ${kept} · refused ${lost} · stored ${Object.keys(store).length} -> data/mcq/explanations.json`);
}
