#!/usr/bin/env node
/* build-duel-pack.mjs: public/duel/pack.json, the duel's questions, from the stations in public/osce/
   (scripts/lib/duel-pack.mjs says how). Run it after any station changes, like build-index.mjs:

     npm run duel-pack            write the pack and list what was left out
     npm run duel-pack -- --check exit 1 when the pack on disk is not what the stations make (npm test runs this) */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPack } from './lib/duel-pack.mjs';

const PUB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const OUT = path.join(PUB, 'duel', 'pack.json');

export function stationsOnDisk(pub = PUB) {
  const dir = path.join(pub, 'osce');
  return fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'index.json').map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
}
export const packText = pack => JSON.stringify(pack, null, 1) + '\n';
/* the category questions scripts/generate-mcq.mjs wrote: { station: file } */
export function mcqOnDisk(pub = PUB) {
  const dir = path.join(pub, 'duel', 'mcq');
  if (!fs.existsSync(dir)) return {};
  return Object.fromEntries(fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => { const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); return [j.station, j]; }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { pack, dropped } = buildPack(stationsOnDisk(), mcqOnDisk());
  const text = packText(pack);
  if (process.argv.includes('--check')) {
    const now = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    if (now !== text) { console.error('public/duel/pack.json is stale: run npm run duel-pack'); process.exit(1); }
    console.log(`duel pack: current (${pack.questions.length} questions)`);
  } else {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, text);
    console.log(`duel pack: ${pack.questions.length} questions to public/duel/pack.json${dropped.length ? `; left out:\n  ${dropped.join('\n  ')}` : ''}`);
  }
}
