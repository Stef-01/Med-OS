#!/usr/bin/env node
/* imaging/stage-files.mjs - images from open collections as staged candidates. Each entry names a file already prepared
   on this machine (a radiograph windowed for display and resized, a CT or ultrasound frame exported from its DICOM) and
   the credit of the image it came from; the file is copied into the stage with its manifest entry, and
   fetch-imaging.mjs --staged takes it through the licence and size rules, the reviewer's verdict and acceptVerdict.

     node scripts/imaging/stage-files.mjs <stage dir> <entries.json>
   entries.json: [ { "station", "req", "file", "name"?, "title", "description"?, "source", "via", "license", "licenseUrl"?,
                     "author", "page" } ] */
import fs from 'node:fs';
import path from 'node:path';
import { addStaged } from './staged.mjs';

export function entryProblems(e) {
  const p = [];
  for (const k of ['station', 'req', 'file', 'title', 'source', 'via', 'license', 'author', 'page']) if (!String(e?.[k] || '').trim()) p.push(`${k} is empty`);
  if (e?.page && !/^https:\/\//.test(e.page)) p.push('page must be an https link to the image or its case');
  return p;
}

function main() {
  const [stage, file] = process.argv.slice(2);
  if (!stage || !file) { console.error('usage: node scripts/imaging/stage-files.mjs <stage dir> <entries.json>'); process.exit(2); }
  const list = JSON.parse(fs.readFileSync(file, 'utf8'));
  let n = 0;
  for (const e of list) {
    const bad = entryProblems(e);
    if (bad.length) { console.error(`${e.station}/${e.req}: ${bad.join('; ')}`); process.exitCode = 1; continue; }
    const { station, req, file: src, name = path.basename(src), ...meta } = e;
    addStaged(stage, { station, req, name, bytes: new Uint8Array(fs.readFileSync(src)), ...meta });
    n++; console.log(`${station}/${req}: ${name}`);
  }
  console.log(`${n} file${n === 1 ? '' : 's'} staged in ${path.resolve(stage)}`);
}
if (process.argv[1] && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href) main();
