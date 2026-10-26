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
import { readYears } from './tag-years.mjs';

const PUB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const OUT = path.join(PUB, 'duel', 'pack.json');
export const poolOnDisk = (pub = PUB) => JSON.parse(fs.readFileSync(path.join(pub, 'mcq', 'pool.json'), 'utf8'));

export function stationsOnDisk(pub = PUB) {
  const dir = path.join(pub, 'osce');
  return fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'index.json').map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
}
export const packText = pack => JSON.stringify(pack, null, 1) + '\n';
/* the category questions scripts/generate-duel-mcq.mjs wrote: { station: file } */
export function mcqOnDisk(pub = PUB) {
  const dir = path.join(pub, 'duel', 'mcq');
  if (!fs.existsSync(dir)) return {};
  return Object.fromEntries(fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => { const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); return [j.station, j]; }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { pack, dropped } = buildPack(poolOnDisk(), { mcq: mcqOnDisk(), stations: stationsOnDisk(), years: readYears() });
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
