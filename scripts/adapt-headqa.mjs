#!/usr/bin/env node
/* adapt-headqa.mjs - clearer English for the pooled HEAD-QA questions (lib/mcq-adapt.mjs says why). Claude rewrites
   the wording; a blind examiner (generate-hy.mjs EXAM_SYSTEM) must still choose the key; only then is it kept, in
   data/mcq/adapted.json. build-duel-pack.mjs shows it in the pack. The pool question is never changed.
     node scripts/adapt-headqa.mjs [--limit 20] [--batch 8] [--jobs 3] [--model opus] [--dry-run] */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cli, readJson } from './lib/disk.mjs';
import { ADAPT_SYSTEM, ADAPT_SCHEMA, adaptBrief, adaptationOf, storedAdaptation, adaptRecord } from './lib/mcq-adapt.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ADAPT_FILE = path.join(ROOT, 'data', 'mcq', 'adapted.json');
export const readAdapted = (f = ADAPT_FILE) => readJson(f, { items: {} }).items || {};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { opt, flag } = cli();
  const { EXAM_SYSTEM } = await import('./generate-hy.mjs');
  const pool = readJson(path.join(ROOT, 'public', 'mcq', 'pool.json'), { questions: [] }).questions;
  const file = readJson(ADAPT_FILE, { items: {}, refused: {} }), store = file.items || {}, refused = file.refused || {};
  let todo = pool.filter(q => q.tags?.includes('src:headqa') && !storedAdaptation(store, q));
  if (opt('--limit')) todo = todo.slice(0, +opt('--limit'));
  const size = Math.max(1, +opt('--batch', 8)), batches = [];
  for (let i = 0; i < todo.length; i += size) batches.push(todo.slice(i, i + size));
  const model = opt('--model', 'opus'), cliJson = (await import('./lib/claude-cli.mjs')).claudeCliJson, day = new Date().toISOString().slice(0, 10);
  const ask = async a => { const r = await cliJson(a); return r && r.value && !r.items && !r.answers ? r.value : r; };
  const n = Math.max(...pool.map(q => q.options.length));
  const examSchema = { type: 'object', additionalProperties: false, required: ['answers'], properties: { answers: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'answer'], properties: { id: { type: 'string' }, answer: { type: 'integer', minimum: -1, maximum: n - 1 } } } } } };
  console.log(`${todo.length} HEAD-QA questions to adapt in ${batches.length} batches · Claude ${model}`);
  const save = () => {
    const sorted = o => Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1)));
    fs.writeFileSync(ADAPT_FILE, `${JSON.stringify({ note: 'HEAD-QA wording adapted by AI (scripts/adapt-headqa.mjs, lib/mcq-adapt.mjs): kept only when a blind examiner chose the published key. hash ties it to the pooled question; refused: the last refusal per question.', items: sorted(store), refused: sorted(refused) }, null, 1)}\n`);
  };
  let kept = 0, lost = 0;
  const worker = async () => {
    for (let b; (b = batches.shift());) {
      try {
        const w = await ask({ system: ADAPT_SYSTEM, content: JSON.stringify(b.map(adaptBrief)), schema: ADAPT_SCHEMA, effort: 'medium', model, label: 'adapt' });
        const made = [];
        for (const q of b) { const r = adaptationOf(q, (w?.items || []).find(x => x.id === q.id)); if (r.a) made.push({ q, a: r.a }); else { lost++; refused[q.id] = { why: r.why.join('; '), at: day }; } }
        if (flag('--dry-run')) { console.log(JSON.stringify(made.map(m => ({ id: m.q.id, ...m.a })), null, 1)); process.exit(0); }
        if (made.length) {
          const e = await ask({ system: EXAM_SYSTEM.replace('index (0 to 3)', `index (0 to ${n - 1})`), content: JSON.stringify(made.map(m => ({ id: m.q.id, stem: m.a.stem, options: m.a.options }))), schema: examSchema, effort: 'medium', model, label: 'adapt-exam' });
          const by = new Map((e?.answers || []).map(x => [x.id, x.answer]));
          for (const m of made) {
            if (by.get(m.q.id) === m.q.answer) { store[m.q.id] = adaptRecord(m.q, m.a, { model, at: day }); delete refused[m.q.id]; kept++; }
            else { lost++; refused[m.q.id] = { why: `examiner chose ${by.get(m.q.id)}, the key is ${m.q.answer}`, at: day }; }
          }
        }
        save(); console.log(`batch: kept ${kept}, refused ${lost} so far`);
      } catch (err) { console.error(`batch failed: ${String(err.message).slice(0, 200)}`); }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, +opt('--jobs', 3)) }, worker));
  console.log(`kept ${kept} · refused ${lost} · stored ${Object.keys(store).length} -> data/mcq/adapted.json`);
}
