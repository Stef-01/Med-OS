#!/usr/bin/env node
/* publish-amsa-draft.mjs - an AMSA draft that failed the converter's review (drafts/amsa-<id>.json), once its blockers have
   been fixed by hand, through the same gates and a fresh examiner review, then published exactly as import-amsa.mjs
   publishes a station that passed: public/osce/amsa-<id>.json, its exam findings in exam.json, the ledger, the index.
   A draft with no reasonable differentials gets them first (add-ddx.mjs).

     node scripts/publish-amsa-draft.mjs 196            review; publish only if the gates and the examiner pass
     node scripts/publish-amsa-draft.mjs 196 --accept   publish when the gates pass and the examiner's blockers have been
                                                        read and answered by a person (they are printed and kept in the ledger)
     node scripts/publish-amsa-draft.mjs 196 --dry-run  review, write nothing

   Claude through lib/claude.mjs when ANTHROPIC_API_KEY is set, else the Claude Code CLI (lib/claude-cli.mjs). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXAMINER_SYSTEM, REVIEW_SCHEMA, EXAM_SYSTEM, EXAM_SCHEMA, reviewText } from './lib/generate.mjs';
import { shapeProblems, qualityProblems, reviewNotes, bankStats } from './lib/station-gates.mjs';
import { ddxFor } from './add-ddx.mjs';
import { writeIndex } from './build-index.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'), PUB = path.join(ROOT, 'public'), DIR = path.join(PUB, 'osce');
const LEDGER = path.join(ROOT, 'scripts', 'import', 'amsa-ledger.json');
const argv = process.argv.slice(2), flag = k => argv.includes(k), id = argv.find(a => /^\d+$/.test(a));
if (!id) { console.error('usage: node scripts/publish-amsa-draft.mjs <amsa resource id> [--accept] [--dry-run]'); process.exit(2); }
const ask = process.env.ANTHROPIC_API_KEY ? (await import('./lib/claude.mjs')).claudeJson : (await import('./lib/claude-cli.mjs')).claudeCliJson;
const F = path.join(ROOT, 'drafts', `amsa-${id}.json`), j = JSON.parse(fs.readFileSync(F, 'utf8'));
let st = j.station;
const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

if (!(st.ddx || []).length) {
  const r = await ddxFor(st, ask, console.log);
  if (r.problems) { console.error(`no differentials: ${r.problems.join('; ')}`); process.exit(1); }
  st = { ...st, ddx: r.ddx };
  if (!flag('--dry-run')) fs.writeFileSync(F, `${JSON.stringify({ ...j, station: st }, null, 1)}\n`);
  console.log(`differentials: ${st.ddx.map(d => `${d.dx} (${d.tier})`).join('; ')}`);
}
const bank = fs.readdirSync(DIR).filter(f => f.endsWith('.json') && f !== 'index.json').map(f => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')));
const { origin, schemaVersion, generatedAt, generator, source, licence, media, ...body } = st;
const core = { ...body, origin: 'ai' };
const gates = [...shapeProblems(core), ...qualityProblems(core, bankStats(bank))];
console.log(`${st.title}\ngates: ${gates.length ? gates.join(' | ') : 'pass'}`);
const { value: review } = await ask({ system: EXAMINER_SYSTEM, content: reviewText(core, reviewNotes(core)), schema: REVIEW_SCHEMA, effort: 'high', label: `review amsa-${id}` });
const blockers = (review.issues || []).filter(i => i.severity === 'blocker');
console.log(`examiner: ${review.pass && !blockers.length ? 'passes' : `${blockers.length} blocker(s)`}`);
for (const i of review.issues || []) console.log(`  [${i.severity}] ${i.where}: ${i.problem}\n     fix: ${i.fix}`);
fs.writeFileSync(path.join(ROOT, 'drafts', `amsa-${id}.review.json`), `${JSON.stringify({ at: now, gates, review }, null, 1)}\n`);
if (gates.length || ((!review.pass || blockers.length) && !flag('--accept')) || flag('--dry-run')) {
  console.log(flag('--dry-run') ? 'dry run: nothing written' : 'not published');
  process.exit(gates.length || blockers.length ? 1 : 0);
}
const { value: exam } = await ask({ system: EXAM_SYSTEM, content: `The station (JSON):\n${JSON.stringify(core)}`, schema: EXAM_SCHEMA, effort: 'medium', label: `exam findings amsa-${id}` });
const out = { ...st, generatedAt: now, revised: { at: now, by: 'publish-amsa-draft.mjs' } };
fs.writeFileSync(path.join(DIR, `${out.id}.json`), `${JSON.stringify(out, null, 1)}\n`);
const examFile = path.join(PUB, 'exam.json'), ex = JSON.parse(fs.readFileSync(examFile, 'utf8'));
ex.stations = Object.fromEntries(Object.entries({ ...ex.stations, [out.id]: exam }).sort(([a], [b]) => a.localeCompare(b)));
fs.writeFileSync(examFile, `${JSON.stringify(ex, null, 1)}\n`);
const ledger = JSON.parse(fs.readFileSync(LEDGER, 'utf8'));
ledger.cases[id] = { status: 'shipped', at: now, title: source?.title || st.title, station: out.id, by: 'publish-amsa-draft.mjs', ...(blockers.length ? { accepted: blockers.map(b => `${b.where}: ${b.problem}`) } : {}) };
fs.writeFileSync(LEDGER, `${JSON.stringify(ledger, null, 1)}\n`);
const { rows } = writeIndex(PUB);
console.log(`published · osce/${out.id}.json · index ${rows} stations`);
