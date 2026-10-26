#!/usr/bin/env node
/* generate-duel-mcq.mjs - writes the duel's category questions (lib/mcq.mjs): for every station in public/osce/, one question
   each in OSCE skills, Clinical, Physiology and pathophysiology, and Anatomy, to public/duel/mcq/<station>.json. Then run
   npm run duel-pack to put them in the duel.

     node scripts/generate-duel-mcq.mjs                  every station without a file yet (resumes where it stopped)
     node scripts/generate-duel-mcq.mjs --only ai-12e898ea,amsa-381    those stations, rewritten
     node scripts/generate-duel-mcq.mjs --limit 5        the first five still to do
     node scripts/generate-duel-mcq.mjs --redo amsa-268:skills   that question written again, the station's others kept
     MCQ_CONCURRENCY=4 node scripts/generate-duel-mcq.mjs

   Claude: the SDK when ANTHROPIC_API_KEY is set (lib/claude.mjs), else the signed-in Claude Code CLI (lib/claude-cli.mjs).
   A question that fails a gate is not written; a station short of a category is asked once more and the best of the
   two answers is kept. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MCQ_SYSTEM, MCQ_SCHEMA, CATS, stationBrief, normalizeMcq, mcqFile } from './lib/mcq.mjs';
import { stationsOnDisk } from './build-duel-pack.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const MCQ_DIR = path.join(ROOT, 'public', 'duel', 'mcq');
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const fill = process.argv.includes('--fill');
/* --redo amsa-268:skills,amsa-219:clinical  drops those questions (a review found them wanting) and writes them again, keeping
   the station's others */
const redo = (arg('--redo') || '').split(',').filter(Boolean).map(x => x.split(':'));   /* stations short of a kind: keep what they have, ask for the rest */

async function asker() {
  if (process.env.ANTHROPIC_API_KEY) { const { claudeJson } = await import('./lib/claude.mjs'); return claudeJson; }
  const { claudeCliJson } = await import('./lib/claude-cli.mjs'); return claudeCliJson;
}

export async function writeStationMcq(st, ask, at = new Date().toISOString(), have = []) {
  const content = `The station:\n${stationBrief(st)}`;
  let best = { kept: CATS.map(c => have.find(q => q.cat === c.id)).filter(Boolean), failed: [] };   /* a station's questions already written are kept (--fill) */
  for (let tryN = 0; tryN < 2 && best.kept.length < CATS.length; tryN++) {
    const raw = await ask({ system: MCQ_SYSTEM, content, schema: MCQ_SCHEMA, effort: 'high', label: `mcq ${st.id}` });
    const draft = raw && !raw.questions && raw.value ? raw.value : raw;   /* the CLI wraps the structured output as { value } */
    const r = normalizeMcq(st, draft);
    /* keep, per category, a question that passed, from either answer */
    const by = new Map(best.kept.map(q => [q.cat, q]));
    for (const q of r.kept) if (!by.has(q.cat)) by.set(q.cat, q);
    best = { kept: CATS.map(c => by.get(c.id)).filter(Boolean), failed: [...best.failed, ...r.failed] };
  }
  return { file: mcqFile(st, best.kept, at), failed: best.failed };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  fs.mkdirSync(MCQ_DIR, { recursive: true });
  const only = arg('--only')?.split(','), limit = Number(arg('--limit')) || Infinity, conc = Number(process.env.MCQ_CONCURRENCY) || 3;
  const todo = stationsOnDisk().sort((a, b) => (a.id < b.id ? -1 : 1))
    .filter(st => {
      const f = path.join(MCQ_DIR, `${st.id}.json`);
      if (redo.length) return redo.some(([id]) => id === st.id);
      if (only) return only.includes(st.id);
      if (fill) return fs.existsSync(f) && JSON.parse(fs.readFileSync(f, 'utf8')).questions.length < CATS.length;   /* only stations short of a kind */
      return !fs.existsSync(f);
    }).slice(0, limit);
  console.log(`mcq: ${todo.length} station${todo.length === 1 ? '' : 's'} to write, ${conc} at a time`);
  const ask = await asker();
  let done = 0, short = 0;
  const work = async () => {
    for (let st; (st = todo.shift());) {
      try {
        const f = path.join(MCQ_DIR, `${st.id}.json`), drop = new Set(redo.filter(([id]) => id === st.id).map(([, c]) => c));
        const have = (fill || drop.size) && fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')).questions.filter(q => !drop.has(q.cat)) : [];
        const { file, failed } = await writeStationMcq(st, ask, undefined, have);
        if (file.questions.length) fs.writeFileSync(path.join(MCQ_DIR, `${st.id}.json`), JSON.stringify(file, null, 1) + '\n');
        if (file.questions.length < CATS.length) short++;
        done++;
        console.log(`mcq ${done}: ${st.id} ${file.questions.map(q => q.cat).join(', ')}${failed.length ? `  (left out: ${failed.join(' | ')})` : ''}`);
      } catch (e) { console.error(`mcq: ${st.id} failed: ${e.message}`); }
    }
  };
  await Promise.all(Array.from({ length: conc }, work));
  console.log(`mcq: ${done} written${short ? `, ${short} short of a category` : ''}. Now: npm run duel-pack`);
}
