#!/usr/bin/env node
/* build-duel-pack.mjs: public/duel/pack.json, the duel's questions, from the standard MCQ pool public/mcq/pool.json and
   the stations' category questions in public/duel/mcq/ (scripts/lib/duel-pack.mjs says how). Run it after the pool is
   rebuilt (node scripts/mcq-pool.mjs), which a station change also needs, and after generate-duel-mcq.mjs:

     npm run duel-pack            write the pack and list what was left out
     npm run duel-pack -- --check exit 1 when the pack on disk is not what the stations make (npm test runs this) */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPack } from './lib/duel-pack.mjs';
import { readYears, readDifficulty, readKinds } from './tag-years.mjs';
import { readHy } from './generate-hy.mjs';
import { readMxq, CREDIT } from './import-medexpqa.mjs';
import { readExplanations } from './explain-mcq.mjs';
import { stationsIn } from './lib/disk.mjs';

const PUB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const OUT = path.join(PUB, 'duel', 'pack.json');
export const poolOnDisk = (pub = PUB) => JSON.parse(fs.readFileSync(path.join(pub, 'mcq', 'pool.json'), 'utf8'));

export function stationsOnDisk(pub = PUB) {
  return stationsIn(path.join(pub, 'osce'));
}
export const packText = pack => JSON.stringify(pack, null, 1) + '\n';
/* the category questions scripts/generate-duel-mcq.mjs wrote: { station: file } */
export function mcqOnDisk(pub = PUB) {
  const dir = path.join(pub, 'duel', 'mcq');
  if (!fs.existsSync(dir)) return {};
  return Object.fromEntries(fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => { const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); return [j.station, j]; }));
}

/* everything buildPack reads besides the pool, from disk: one list, for this script and the test that the pack is current */
export const packInputs = (pub = PUB) => ({ mcq: mcqOnDisk(pub), stations: stationsOnDisk(pub), years: readYears(), difficulty: readDifficulty(), kinds: readKinds(), hy: readHy(), mxq: readMxq(), mxqCredit: CREDIT, explanations: readExplanations() });

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { pack, dropped } = buildPack(poolOnDisk(), packInputs());
  const text = packText(pack);
  if (process.argv.includes('--check')) {
    const now = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    if (now !== text) { console.error('public/duel/pack.json is stale: run node scripts/mcq-pool.mjs, then npm run duel-pack'); process.exit(1); }
    console.log(`duel pack: current (${pack.questions.length} questions)`);
  } else {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, text);
    console.log(`duel pack: ${pack.questions.length} questions to public/duel/pack.json${dropped.length ? `; left out:\n  ${dropped.join('\n  ')}` : ''}`);
  }
}
