#!/usr/bin/env node
/* add-ddx.mjs - give a station its reasonable differentials (Stefan 2026-10-23: "make it clear what reasonable
   differentials could be in the script"). Writes only `ddx`: 3 to 6 diagnoses, exactly one most likely, the others a
   candidate may fairly offer and the must-not-miss ones, each with this patient's features for and against. The rest of
   the station is the context Claude reads, and the list must agree with the expected answer to the differentials
   question. The result must pass ddxProblems (lib/station-gates.mjs); one retry with the problems, else the station is
   left as it was and listed. Works on public/osce/*.json and on drafts (--file). The index is rebuilt at the end.

     node scripts/add-ddx.mjs                   every station without a ddx
     node scripts/add-ddx.mjs --only ai-1234    these ids (comma-separated), even if they have one
     node scripts/add-ddx.mjs --file drafts/amsa-196.json   a draft ({ station } or a station)
     node scripts/add-ddx.mjs --workers 2       two at a time
     node scripts/add-ddx.mjs --dry-run         print, write nothing

   Claude through lib/claude.mjs when ANTHROPIC_API_KEY is set, else the Claude Code CLI (lib/claude-cli.mjs). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DDX_RULES, DDX_SCHEMA } from './lib/generate.mjs';
import { ddxProblems } from './lib/station-gates.mjs';
import { writeIndex } from './build-index.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'), PUB = path.join(ROOT, 'public'), DIR = path.join(PUB, 'osce');
const argv = process.argv.slice(2);
const opt = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
const flag = k => argv.includes(k);

export const SCHEMA = { type: 'object', additionalProperties: false, required: ['ddx'], properties: { ddx: DDX_SCHEMA } };
export const SYSTEM = `You are a senior Australian OSCE examiner and practising clinician. For an existing station, list the reasonable differentials the examiner should credit. Change nothing else: the diagnosis, the results and the expected answers stay as they are, and your list must agree with them (the leading diagnosis is the station's diagnosis; every differential in the expected answer to the differentials question appears).
${DDX_RULES}
Australian spelling. Plain text only.`;
export const userPrompt = (st, problems = []) => {
  const { media, imaging, ...body } = st;
  return `${problems.length ? `Your last answer had these problems; fix every one:\n${problems.map(p => `- ${p}`).join('\n')}\n\n` : ''}The station (JSON):\n${JSON.stringify(body)}`;
};

/* one station's ddx, or the problems that stopped it */
export async function ddxFor(st, ask, log = () => {}) {
  let problems = [], value = null;
  for (let round = 0; round < 2; round++) {
    try { ({ value } = await ask({ system: SYSTEM, content: userPrompt(st, problems), schema: SCHEMA, effort: 'high', label: `ddx ${st.id}` })); }
    catch (e) { problems = [e.message]; continue; }
    problems = ddxProblems(value.ddx);
    if (!problems.length) return { ddx: value.ddx };
    log(`  ${st.id} round ${round + 1}: ${problems.join(' | ')}`);
  }
  return { problems };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const ask = process.env.ANTHROPIC_API_KEY ? (await import('./lib/claude.mjs')).claudeJson : (await import('./lib/claude-cli.mjs')).claudeCliJson;
  const file = opt('--file'), only = (opt('--only') || '').split(',').map(s => s.trim()).filter(Boolean);
  const targets = file
    ? [{ path: path.resolve(file), wrap: true }]
    : fs.readdirSync(DIR).filter(f => f.endsWith('.json') && f !== 'index.json').map(f => ({ path: path.join(DIR, f) }));
  const todo = targets.map(t => { const j = JSON.parse(fs.readFileSync(t.path, 'utf8')); return { ...t, j, st: j.station || j }; })
    .filter(t => file || (only.length ? only.includes(t.st.id) : !(t.st.ddx || []).length));
  const WORKERS = Math.max(1, Number(opt('--workers') || 1));
  console.log(`${todo.length} station(s) to give differentials · ${WORKERS} worker(s)`);
  const failed = [], done = [];
  async function one(t) {
    const r = await ddxFor(t.st, ask, console.log);
    if (r.problems) { failed.push(`${t.st.id} (${t.st.title}): ${r.problems.join('; ')}`); return; }
    if (flag('--dry-run')) { console.log(t.st.id, JSON.stringify(r.ddx, null, 1)); return; }
    const st = { ...t.st, ddx: r.ddx };
    fs.writeFileSync(t.path, `${JSON.stringify(t.j.station ? { ...t.j, station: st } : st, null, 1)}\n`);
    done.push(t.st.id);
    console.log(`  ${t.st.id} · ${t.st.title} · ${r.ddx.map(d => `${d.dx} (${d.tier})`).join('; ')}`);
  }
  const queue = [...todo];
  await Promise.all(Array.from({ length: WORKERS }, async () => { for (let t; (t = queue.shift());) await one(t); }));
  if (!flag('--dry-run') && !file) { const { rows } = writeIndex(PUB); console.log(`osce/index.json · ${rows} stations`); }
  console.log(`\n${done.length} given differentials, ${failed.length} left as they were`);
  for (const f of failed) console.log(`  - ${f}`);
}
