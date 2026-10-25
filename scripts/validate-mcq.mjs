#!/usr/bin/env node
/* validate-mcq.mjs - the MCQ pool's data as it ships (npm test runs it; exit 1 on any error):
     public/mcq/pool.json     every question valid (schema.mjs), no blocking flaw, a provenance kind, a named source with a
                              licence the pool accepts and no commercial or official bank, an AI question that says how it
                              was made, a user question that says who sent it, an eval with the judge that reviewed it;
                              the counts match
     public/mcq/status.json   only submitted (user) questions
     data/benchmarks/*.jsonl  every row MIT-licensed, with its source
     data/mcq/*.json          generated questions are ai, submissions are user, each verdict names its judge
     no NBME text             when the official USMLE samples are on this machine ($MCQ_BENCH_DIR, else
                              ../research/mcq-src), no 12-word run of their text appears in any file under data/, docs/,
                              scripts/ or public/ (outside the vendored package and the media); skipped otherwise, and said
   node scripts/validate-mcq.mjs [repo root] */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanItem, itemProblems, licenceOk, KINDS, BANNED_SOURCE } from '../public/js/mcq/schema.mjs';
import { flawReport, words } from '../public/js/mcq/flaws.mjs';
import { readJsonl, readJson } from './lib/mcq-sources.mjs';

const here = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export function validateMcq(root = here, { benchDir = process.env.MCQ_BENCH_DIR || path.join(root, '..', 'research', 'mcq-src') } = {}) {
  const errors = [], notes = [];
  const poolFile = path.join(root, 'public', 'mcq', 'pool.json');
  if (!fs.existsSync(poolFile)) return { errors: ['public/mcq/pool.json is missing: node scripts/mcq-pool.mjs'], notes };
  const pool = JSON.parse(fs.readFileSync(poolFile, 'utf8')), qs = Array.isArray(pool.questions) ? pool.questions : [];
  if (pool.schemaVersion !== 1 || !Array.isArray(pool.questions)) errors.push('pool.json: schemaVersion 1 and a questions list');
  const ids = new Set(), counts = {};
  for (const q of qs) {
    const at = `pool.json ${q?.id}`;
    if (ids.has(q?.id)) errors.push(`${at}: repeated id`); ids.add(q?.id);
    for (const p of itemProblems(q)) errors.push(`${at}: ${p}`);
    const c = cleanItem(q);
    if (c) { const { eval: _e, ...a } = q, { eval: _f, ...b } = c; if (JSON.stringify(a) !== JSON.stringify(b)) errors.push(`${at}: not in the schema's clean form (an unknown field, or untrimmed text)`); }
    if (c && flawReport(c).blocked) errors.push(`${at}: a blocking flaw`);
    const pv = q?.provenance || {}; counts[pv.kind] = (counts[pv.kind] || 0) + 1;
    if (!licenceOk(pv.source?.licence)) errors.push(`${at}: licence ${pv.source?.licence || 'none'}`);
    if (BANNED_SOURCE.test(`${pv.source?.name} ${pv.source?.url} ${q?.explanation || ''}`)) errors.push(`${at}: names a commercial or official bank`);
    if (!q?.eval || q.eval.verdict !== 'pool' || !String(q.eval.judge || '').trim() || !(q.eval.quality >= q.eval.bar)) errors.push(`${at}: no eval that admits it (verdict, judge, quality at or above its bar)`);
  }
  if (JSON.stringify(Object.fromEntries(Object.entries(counts).sort())) !== JSON.stringify(Object.fromEntries(Object.entries(pool.counts || {}).sort()))) errors.push(`pool.json: counts ${JSON.stringify(pool.counts)} but the questions are ${JSON.stringify(counts)}`);
  for (const k of Object.keys(counts)) if (!Object.hasOwn(KINDS, k)) errors.push(`pool.json: unknown kind ${k}`);
  const subs = readJson(path.join(root, 'data', 'mcq', 'submissions.json'), { items: [] }).items || [];
  for (const q of subs) if (q?.provenance?.kind !== 'user') errors.push(`submissions.json ${q?.id}: not a user question`);
  const status = readJson(path.join(root, 'public', 'mcq', 'status.json'), { submissions: {} }).submissions || {}, subIds = new Set(subs.map(q => q.id));
  for (const id of Object.keys(status)) if (!subIds.has(id)) errors.push(`status.json: ${id} is not a submission`);
  for (const q of readJson(path.join(root, 'data', 'mcq', 'generated.json'), { items: [] }).items || []) if (q?.provenance?.kind !== 'ai' || !q.provenance.generator?.how) errors.push(`generated.json ${q?.id}: not an ai question with its generator`);
  for (const [id, v] of Object.entries(readJson(path.join(root, 'data', 'mcq', 'verdicts.json'), {}))) if (!String(v?.judge || '').trim() || (v.solves || []).length !== 2 || !v.rubric) errors.push(`verdicts.json ${id}: a verdict names its judge and has two solves and a rubric`);
  const bdir = path.join(root, 'data', 'benchmarks');
  for (const f of fs.existsSync(bdir) ? fs.readdirSync(bdir).filter(x => x.endsWith('.jsonl')) : []) for (const r of readJsonl(path.join(bdir, f))) {
    if (!/^MIT\b/.test(r.source?.licence || '') || !r.source?.name || !r.source?.url) { errors.push(`benchmarks/${f} ${r.id}: every row is MIT, with its source`); break; }
  }
  /* no NBME text in the repo */
  const official = path.join(benchDir, 'quest-ai', 'normalised.jsonl');
  if (!fs.existsSync(official)) notes.push(`NBME text check skipped: the official samples are not at ${official}`);
  else {
    const N = 12, grams = new Set();
    for (const r of readJsonl(official).filter(x => String(x.origin || '').startsWith('human'))) { const w = words(`${r.stem} ${(r.options || []).join(' ')}`); for (let i = 0; i + N <= w.length; i++) grams.add(w.slice(i, i + N).join(' ')); }
    /* a run the open banks also use is the exam's stock phrasing ("which of the following is the most appropriate next step in management"), not NBME's text */
    for (const f of fs.existsSync(bdir) ? fs.readdirSync(bdir).filter(x => x.endsWith('.jsonl')) : []) for (const r of readJsonl(path.join(bdir, f))) { const w = words(r.stem); for (let i = 0; i + N <= w.length; i++) grams.delete(w.slice(i, i + N).join(' ')); }
    const skip = /(^|\/)(node_modules|\.git|vendor|media|fonts|drafts|requests)(\/|$)/, exts = /\.(json|jsonl|md|mjs|js|html|css|sql|txt|csv)$/;
    const walk = (d, out = []) => { for (const n of fs.readdirSync(d)) { const p = path.join(d, n), rel = path.relative(root, p); if (skip.test(rel)) continue; const st = fs.statSync(p); if (st.isDirectory()) walk(p, out); else if (exts.test(n) && st.size < 20e6) out.push(p); } return out; };
    let files = 0;
    for (const top of ['data', 'docs', 'scripts', 'public']) for (const f of fs.existsSync(path.join(root, top)) ? walk(path.join(root, top)) : []) {
      files++;
      const w = words(fs.readFileSync(f, 'utf8'));
      for (let i = 0; i + N <= w.length; i++) if (grams.has(w.slice(i, i + N).join(' '))) { errors.push(`${path.relative(root, f)}: contains text of an official USMLE sample item ("${w.slice(i, i + N).join(' ')}")`); break; }
    }
    notes.push(`NBME text check: ${grams.size} 12-word runs of the official samples, none in ${files} files`);
  }
  return { errors, notes, count: qs.length, counts };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { errors, notes, count, counts } = validateMcq(process.argv[2] ? path.resolve(process.argv[2]) : here);
  for (const n of notes) console.log(`note  ${n}`);
  for (const e of errors) console.error(`error ${e}`);
  console.log(`MCQ pool: ${count} questions ${JSON.stringify(counts || {})} · ${errors.length} error${errors.length === 1 ? '' : 's'}`);
  process.exit(errors.length ? 1 : 0);
}
