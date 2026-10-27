#!/usr/bin/env node
/* fetch-sources.mjs - the open sources the registry says to import (data/sources/registry.json, verdict "import"):
   download each, keep the raw file outside the repo ($MCQ_BENCH_DIR/sources/<id>/, else ../research/sources/<id>/;
   downloaded files are data and never run), adapt it (lib/sources.mjs) and write data/benchmarks/<id>.jsonl, which the
   pool reads as candidates. Then: node scripts/mcq-judge.mjs --tag src:<id> --sample 60, node scripts/mcq-pool.mjs.
     node scripts/fetch-sources.mjs [--only headqa] [--offline]   (--offline adapts the raw file already downloaded) */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registryProblems, adapt } from './lib/sources.mjs';
import { cli } from './lib/disk.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { argv, opt } = cli();
const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'sources', 'registry.json'), 'utf8'));
const bad = registryProblems(reg);
if (bad.length) { console.error(`the registry needs fixing:\n- ${bad.join('\n- ')}`); process.exit(1); }
const RAW = path.join(process.env.MCQ_BENCH_DIR || path.join(ROOT, '..', 'research'), 'sources');
for (const s of reg.sources.filter(x => x.verdict === 'import' && (!opt('--only') || x.id === opt('--only')))) {
  const dir = path.join(RAW, s.id), file = path.join(dir, path.basename(new URL(s.url).pathname));
  fs.mkdirSync(dir, { recursive: true });
  if (!argv.includes('--offline')) {
    const r = await fetch(s.url);
    if (!r.ok) { console.error(`${s.id}: ${r.status} ${s.url}`); process.exitCode = 1; continue; }
    fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  }
  const raw = s.format === 'json' ? JSON.parse(fs.readFileSync(file, 'utf8')) : fs.readFileSync(file, 'utf8');
  const { rows, dropped } = adapt(s, raw, new Date(fs.statSync(file).mtimeMs).toISOString().slice(0, 10));
  fs.writeFileSync(path.join(ROOT, 'data', 'benchmarks', `${s.id}.jsonl`), rows.map(r => JSON.stringify(r)).join('\n') + '\n');
  console.log(`${s.id}: ${rows.length} rows -> data/benchmarks/${s.id}.jsonl (${dropped.length} left out${dropped.length ? `, e.g. ${dropped.slice(0, 2).join('; ')}` : ''})`);
}
