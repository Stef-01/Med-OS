#!/usr/bin/env node
/* generate-mcq.mjs - new Step 2 CK-style questions written from the stations (lib/mcq-generate.mjs says how), kept in
   data/mcq/generated.json for the judge and the selector. Nothing written here reaches the pool by itself:
   node scripts/mcq-judge.mjs --kind ai, then node scripts/mcq-pool.mjs.

     node scripts/generate-mcq.mjs --stations amsa-187,ai-12e898ea [--focus management]
     node scripts/generate-mcq.mjs --sample 40            40 stations (seeded), the focus rotating over the four
     node scripts/generate-mcq.mjs --sample 80 --form rapid    short questions for the duel's Rapid 15 s format
   options: --jobs 3 · --dry-run (print, write nothing)

   Claude: lib/claude.mjs (the SDK) when ANTHROPIC_API_KEY is set, else the Claude Code CLI (lib/claude-cli.mjs); the
   item records which (generator.how "api" or "cli"). A question that still has a major flaw after its one revision goes
   to drafts/mcq/ with its problems. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeMcq, FOCUS, FORMS } from './lib/mcq-generate.mjs';
import { readJsonl, benchmarkItem, readJson } from './lib/mcq-sources.mjs';
import { stationsOnDisk } from './build-duel-pack.mjs';
import { fnv } from '../public/js/mcq/schema.mjs';
import { claudeAsk } from './lib/ask.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const GENERATED = path.join(ROOT, 'data', 'mcq', 'generated.json');
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
const list = v => (v ? v.split(',').map(s => s.trim()).filter(Boolean) : []);

const stations = stationsOnDisk(path.join(ROOT, 'public')).sort((a, b) => a.id.localeCompare(b.id));
const bench = readJsonl(path.join(ROOT, 'data', 'benchmarks', 'medqa-us-step2-3.jsonl')).map(benchmarkItem).filter(Boolean);
const store = readJson(GENERATED, { note: 'Written by scripts/generate-mcq.mjs. Kind ai; each passes the judge and the selector before it reaches the pool.', items: [] });
const FORM = opt('--form') || 'vignette';
if (!FORMS[FORM]) { console.error(`--form is one of ${Object.keys(FORMS).join(', ')}`); process.exit(2); }
const formOf = q => (q.tags.find(t => t.startsWith('form:')) || 'form:vignette').slice(5);
const have = new Set(store.items.map(q => `${q.provenance.generator.basis[0]}|${(q.tags.find(t => t.startsWith('focus:')) || '').slice(6)}|${formOf(q)}`));
const focuses = Object.keys(FOCUS);
let jobs = [];
if (opt('--stations')) jobs = list(opt('--stations')).map((id, i) => ({ st: stations.find(s => s.id === id), focus: opt('--focus') || focuses[i % focuses.length] }));
else if (opt('--sample')) jobs = [...stations].sort((a, b) => fnv(`g:${a.id}`).localeCompare(fnv(`g:${b.id}`))).slice(0, Number(opt('--sample'))).map((st, i) => ({ st, focus: opt('--focus') || focuses[i % focuses.length] }));
else { console.error('usage: node scripts/generate-mcq.mjs --stations <id,id> | --sample <n> [--focus management|investigation|interpretation|complication] [--form vignette|rapid] [--jobs 3] [--dry-run]'); process.exit(2); }
if (jobs.some(j => !j.st)) { console.error('no such station'); process.exit(2); }
jobs = jobs.filter(j => !have.has(`${j.st.id}|${j.focus}|${FORM}`));
const { ask, how, name } = await claudeAsk();
console.log(`${jobs.length} ${FORM} questions to write · Claude via ${name}`);
let kept = 0, failed = 0;
const save = () => { if (argv.includes('--dry-run')) return; fs.mkdirSync(path.dirname(GENERATED), { recursive: true }); store.items.sort((a, b) => a.id.localeCompare(b.id)); fs.writeFileSync(GENERATED, `${JSON.stringify(store, null, 1)}\n`); };
const worker = async () => {
  for (let j; (j = jobs.shift());) {
    try {
      const r = await writeMcq(j.st, j.focus, { bench, ask, how, log: m => console.log(m), form: FORM });
      if (r.ok) { store.items.push(r.item); save(); kept++; console.log(`kept ${r.item.id} · ${j.st.id} · ${j.focus}${r.rounds > 1 ? ' (revised)' : ''}`); }
      else {
        failed++; console.log(`not kept · ${j.st.id} · ${j.focus}: ${r.problems.join('; ')}`);
        if (!argv.includes('--dry-run')) { const d = path.join(ROOT, 'drafts', 'mcq'); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, `${j.st.id}-${j.focus}${FORM === 'vignette' ? '' : `-${FORM}`}.json`), `${JSON.stringify({ problems: r.problems, draft: r.draft }, null, 1)}\n`); }
      }
    } catch (e) { failed++; console.error(`fail ${j.st.id} ${j.focus}: ${String(e.message).slice(0, 200)}`); }
  }
};
await Promise.all(Array.from({ length: Math.max(1, Number(opt('--jobs')) || 3) }, worker));
console.log(`kept ${kept} · not kept ${failed}`);
