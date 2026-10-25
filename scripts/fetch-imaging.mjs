#!/usr/bin/env node
/* fetch-imaging.mjs - find, check and attach the right images for stations.

     node scripts/fetch-imaging.mjs <station id> [more ids]   resolve each station's imaging requests
     node scripts/fetch-imaging.mjs --all                      every station
     options:  --plan       ask Claude to propose requests for stations that have none (the first run on old stations)
               --refresh    look again even for requests that already have a file
               --dry-run    plan and search, write nothing
               --staged <dir>  take each request's candidates from a stage (imaging/staged.mjs: real ECGs drawn from
                            PhysioNet, files from open collections) and the pixel check from <dir>/verdicts.json, a
                            reviewer's verdict per candidate (or --verdicts <file>); no web search, no API call

   Needs network access to commons.wikimedia.org, upload.wikimedia.org and openi.nlm.nih.gov, and Claude credentials
   (ANTHROPIC_API_KEY or `ant auth login`). Writes public/media/<station>/…, the station's `imaging` and `media`, and
   rebuilds osce/index.json. Prints one line per request: the file and its licence, or why nothing passed. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveStation, planImaging, pending } from './imaging/resolve.mjs';
import { stagedCandidates, sessionVerify, readVerdicts } from './imaging/staged.mjs';
import { writeIndex } from './build-index.mjs';

const PUB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const args = process.argv.slice(2), flag = f => args.includes(f), opt = f => (args.includes(f) ? args[args.indexOf(f) + 1] : '');
const stage = opt('--staged'), verdictFile = opt('--verdicts') || (stage && path.join(stage, 'verdicts.json'));
const valued = new Set([stage, opt('--verdicts')].filter(Boolean));
const staged = stage ? { staged: (sid, rid) => stagedCandidates(stage, sid, rid), verify: sessionVerify(readVerdicts(verdictFile)) } : {};
const ids = flag('--all') ? fs.readdirSync(path.join(PUB, 'osce')).filter(f => f.endsWith('.json') && f !== 'index.json').map(f => f.slice(0, -5)) : args.filter(a => !a.startsWith('--') && !valued.has(a));
if (!ids.length) { console.error('usage: node scripts/fetch-imaging.mjs <station id …> | --all  [--plan] [--refresh] [--dry-run]'); process.exit(2); }

let resolved = 0, missed = 0;
for (const id of ids) {
  const file = path.join(PUB, 'osce', `${id}.json`);
  if (!fs.existsSync(file)) { console.error(`${id}: no such station`); missed++; continue; }
  let st = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(st.imaging) || (flag('--plan') && !st.imaging.length)) {
    if (!flag('--plan')) { console.log(`${id}: no imaging requests (run with --plan to propose some)`); continue; }
    st = { ...st, imaging: await planImaging(st) };
    console.log(`${id}: planned ${st.imaging.length} request${st.imaging.length === 1 ? '' : 's'}${st.imaging.map(r => ` · ${r.id} ${r.modality} ${r.finding}`).join('')}`);
  }
  if (!pending(st, flag('--refresh')).length) { if (!flag('--dry-run')) fs.writeFileSync(file, `${JSON.stringify(st, null, 1)}\n`); continue; }
  const pub = flag('--dry-run') ? fs.mkdtempSync(path.join((await import('node:os')).tmpdir(), 'osce-dry-')) : PUB;
  const { station, report } = await resolveStation(st, { pub, refresh: flag('--refresh'), log: m => console.log(m), ...staged });
  for (const r of report) {
    if (r.skipped) continue;
    if (r.ok) { resolved++; console.log(`${id} ${r.id}: ${r.src} (${r.license})`); }
    else { missed++; console.log(`${id} ${r.id}: nothing passed\n${r.why.slice(0, 6).map(w => `    - ${w}`).join('\n')}`); }
  }
  if (!flag('--dry-run')) fs.writeFileSync(file, `${JSON.stringify(station, null, 1)}\n`);
}
if (!flag('--dry-run')) { const { rows, problems } = writeIndex(PUB); console.log(`osce/index.json · ${rows} stations${problems.length ? ` · ${problems.length} problems` : ''}`); }
console.log(`${resolved} image${resolved === 1 ? '' : 's'} attached, ${missed} request${missed === 1 ? '' : 's'} unresolved`);
