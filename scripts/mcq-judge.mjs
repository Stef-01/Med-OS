#!/usr/bin/env node
/* mcq-judge.mjs - the model-judged evaluation (lib/mcq-judge.mjs) of the pool's candidates, or of a benchmark file.

     node scripts/mcq-judge.mjs                         every candidate without a current verdict -> data/mcq/verdicts.json
     node scripts/mcq-judge.mjs --kind user,ai          only these kinds (user, ai, amsa, usmle-resource)
     node scripts/mcq-judge.mjs --sample 200 --tag src:medqa   a seeded sample of the candidates with this tag
     node scripts/mcq-judge.mjs --ids osce-amsa-187,u-abc
     node scripts/mcq-judge.mjs --bench <normalised.jsonl> --out <file> [--meta step2&3] [--origin human|ai] [--sample n]
                                                        a benchmark set; --out must be outside the repo unless every row is MIT
   options: --jobs 4 (calls in parallel) · --limit n · --dry-run (say what would be judged)

   Claude is reached as the station generator reaches it: lib/claude.mjs (the SDK) when ANTHROPIC_API_KEY is set, else the
   Claude Code CLI on the signed-in subscription (lib/claude-cli.mjs). Each verdict records which judge ran
   ("<model> via the API" or "<model> via the Claude Code CLI"); a verdict is never written without a call that returned.
   The file is rewritten after every question, so a stopped run resumes where it stopped. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { allCandidates, readJsonl, benchOnlyItem, benchmarkItem } from './lib/mcq-sources.mjs';
import { judgeItem, verdictFor } from './lib/mcq-judge.mjs';
import { fnv } from '../public/js/mcq/schema.mjs';
import { claudeAsk } from './lib/ask.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const VERDICTS = path.join(ROOT, 'data', 'mcq', 'verdicts.json');
export const readVerdicts = f => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {});
export const writeVerdicts = (f, v) => { fs.mkdirSync(path.dirname(f), { recursive: true }); const t = `${f}.${process.pid}.tmp`; fs.writeFileSync(t, `${JSON.stringify(Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))), null, 1)}\n`); fs.renameSync(t, f); };
/* one verdict into the file, merged with what is on disk under a lock, so two runs at once never drop each other's */
export function addVerdict(f, id, v) {
  const lock = `${f}.lock`;
  for (let i = 0; ; i++) {
    try { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.closeSync(fs.openSync(lock, 'wx')); break; }
    catch (e) { if (e.code !== 'EEXIST' || i > 400) throw e; if (i > 200 && Date.now() - fs.statSync(lock).mtimeMs > 30000) fs.rmSync(lock, { force: true }); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25); }
  }
  try { const all = readVerdicts(f); all[id] = v; writeVerdicts(f, all); } finally { fs.rmSync(lock, { force: true }); }
}
/* a seeded sample: the n items whose id hashes lowest (stable across runs and machines) */
export const sample = (items, n) => [...items].sort((a, b) => fnv(`s:${a.id}`).localeCompare(fnv(`s:${b.id}`))).slice(0, n);


if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; }, flag = k => argv.includes(k);
  const list = v => (v ? v.split(',').map(s => s.trim()).filter(Boolean) : []);
  let items, out;
  if (opt('--bench')) {
    let rows = readJsonl(path.resolve(opt('--bench')));
    if (opt('--meta')) rows = rows.filter(r => r.meta_info === opt('--meta'));
    if (opt('--origin')) rows = rows.filter(r => String(r.origin || '').startsWith(opt('--origin')));
    out = opt('--out') && path.resolve(opt('--out'));
    if (!out) { console.error('--bench needs --out <file>'); process.exit(2); }
    const allMit = rows.every(r => /^MIT\b/.test(r.source?.licence || ''));
    if (!allMit && (out + path.sep).startsWith(ROOT + path.sep)) { console.error('refused: this set is not all MIT (the official samples are benchmark only), so its verdicts stay outside the repo'); process.exit(2); }
    items = rows.map(r => (allMit ? benchmarkItem(r) : benchOnlyItem(r))).filter(Boolean);
  } else {
    out = VERDICTS;
    items = allCandidates(ROOT).items;
    if (opt('--kind')) items = items.filter(q => list(opt('--kind')).includes(q.provenance?.kind));
    if (opt('--tag')) items = items.filter(q => (q.tags || []).includes(opt('--tag')));
    if (opt('--ids')) items = items.filter(q => list(opt('--ids')).includes(q.id));
  }
  if (opt('--sample')) items = sample(items, Number(opt('--sample')));
  const verdicts = readVerdicts(out);
  let todo = items.filter(q => q && Array.isArray(q.options) && !verdictFor(verdicts, q));
  if (opt('--limit')) todo = todo.slice(0, Number(opt('--limit')));
  console.log(`${items.length} questions · ${items.length - todo.length} already judged · ${todo.length} to judge -> ${path.relative(ROOT, out) || out}`);
  if (flag('--dry-run') || !todo.length) process.exit(0);
  const { ask, via } = await claudeAsk();
  const jobs = Math.max(1, Number(opt('--jobs')) || 4);
  let done = 0, failed = 0; const t0 = Date.now();
  const worker = async () => {
    for (let q; (q = todo.shift());) {
      try {
        let model = '';
        const v = await judgeItem(q, { ask: async a => { const r = await ask(a); model = r.model || model; return r; } });
        v.judge = via(model);
        verdicts[q.id] = v; addVerdict(out, q.id, v);
        done++;
        console.log(`${done} ${q.id} · solved ${v.solves.filter(s => s.answer === q.answer).length}/2 · ${v.rubric.verdict} · ${Math.round((Date.now() - t0) / 1000)} s`);
      } catch (e) { failed++; console.error(`fail ${q.id}: ${String(e.message).slice(0, 200)}`); }
    }
  };
  await Promise.all(Array.from({ length: jobs }, worker));
  console.log(`judged ${done}, failed ${failed}, in ${Math.round((Date.now() - t0) / 1000)} s`);
  process.exit(failed ? 1 : 0);
}
