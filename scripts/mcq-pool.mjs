#!/usr/bin/env node
/* mcq-pool.mjs - the standard MCQ pool: every candidate (lib/mcq-sources.mjs) through the selector (lib/mcq-select.mjs)
   with the verdicts in data/mcq/verdicts.json and the bars in data/mcq/calibration.json. Writes

     public/mcq/pool.json        the admitted questions, each with its provenance and its eval
     public/mcq/status.json      each submitted question's status (pool, rejected with reasons, pending): the app's
                                 Submit a question list reads it, so a submitter sees what happened once this is deployed
     data/mcq/selection.json     every candidate's decision and reasons, and the pool's composition

     node scripts/mcq-pool.mjs              write them, and print the composition and the rejections by reason
     node scripts/mcq-pool.mjs --check      exit 1 when the files are not what the candidates make now (npm test)
     node scripts/mcq-pool.mjs --why <id>   one candidate's decision
   Then npm run duel-pack, which builds the duel's questions from the pool. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { allCandidates, readJson } from './lib/mcq-sources.mjs';
import { select, statusOf, DEFAULT_BARS, QUOTA } from './lib/mcq-select.mjs';
import { KINDS } from '../public/js/mcq/schema.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const FILES = { pool: path.join(ROOT, 'public', 'mcq', 'pool.json'), status: path.join(ROOT, 'public', 'mcq', 'status.json'), selection: path.join(ROOT, 'data', 'mcq', 'selection.json') };
const text = v => `${JSON.stringify(v, null, 1)}\n`;

export function build(root = ROOT) {
  const { items, dropped } = allCandidates(root);
  const verdicts = readJson(path.join(root, 'data', 'mcq', 'verdicts.json'), {});
  const cal = readJson(path.join(root, 'data', 'mcq', 'calibration.json'), {});
  const bars = cal.bars || DEFAULT_BARS;
  const { pool, decisions, stats } = select(items, { verdicts, bars, quota: QUOTA });
  return {
    files: {
      pool: { schemaVersion: 1, version: `pool-${pool.length}`, title: 'Standard MCQ pool',
        note: `Built by scripts/mcq-pool.mjs: candidates from the stations, generate-mcq.mjs, the open USMLE-style banks and open exam sets in data/benchmarks and student submissions, admitted on the flaw checks, the model review and the bars calibrated on the benchmarks (docs/mcq.md). provenance.kind says where each came from: ${Object.keys(KINDS).join(', ')}.`,
        bars, counts: stats.pool, questions: pool },
      status: { schemaVersion: 1, note: 'Each submitted question\'s status at the last pool build (scripts/mcq-pool.mjs).', submissions: statusOf(decisions) },
      selection: { stats: { ...stats, droppedBeforeSelection: dropped }, decisions }
    },
    stats, decisions
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2), { files, stats, decisions } = build();
  if (argv.includes('--why')) { const id = argv[argv.indexOf('--why') + 1]; console.log(JSON.stringify(decisions.find(d => d.id === id) || `no candidate ${id}`, null, 1)); process.exit(0); }
  if (argv.includes('--check')) {
    const stale = Object.keys(FILES).filter(k => !fs.existsSync(FILES[k]) || fs.readFileSync(FILES[k], 'utf8') !== text(files[k]));
    if (stale.length) { console.error(`MCQ pool is stale (${stale.map(k => path.relative(ROOT, FILES[k])).join(', ')}): run node scripts/mcq-pool.mjs`); process.exit(1); }
    console.log(`MCQ pool: current (${files.pool.questions.length} questions)`); process.exit(0);
  }
  for (const k of Object.keys(FILES)) { fs.mkdirSync(path.dirname(FILES[k]), { recursive: true }); fs.writeFileSync(FILES[k], text(files[k])); }
  console.log(`pool: ${files.pool.questions.length} questions · ${JSON.stringify(stats.pool)}`);
  console.log(`candidates: ${JSON.stringify(stats.candidates)} · decisions: ${JSON.stringify(stats.status)}`);
  const why = {};
  for (const d of decisions.filter(x => x.status === 'rejected')) { const r = d.reasons[0].replace(/\d+/g, 'n').replace(/"[^"]*"/g, '"…"').slice(0, 90); why[r] = (why[r] || 0) + 1; }
  console.log('rejections by first reason:'); for (const [r, n] of Object.entries(why).sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(`  ${n} × ${r}`);
}
