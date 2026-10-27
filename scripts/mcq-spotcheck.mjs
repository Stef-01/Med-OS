#!/usr/bin/env node
/* mcq-spotcheck.mjs - the human check on the pool (lib/mcq-spotcheck.mjs says why). Writes docs/mcq-spotcheck.md, the
   sheet, and keeps data/mcq/spotcheck.json: the sample's ids (fixed once drawn, so the sheet a person is marking does not
   move under them) and their marks. Makes no model calls.
     node scripts/mcq-spotcheck.mjs [--n 40]   draw the sample if there is none, write the sheet
     node scripts/mcq-spotcheck.mjs --redraw   draw a new sample (marks on questions still in it are kept) */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spotSample, spotSheet, spotResults } from './lib/mcq-spotcheck.mjs';
import { cli, readJson } from './lib/disk.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SPOT_FILE = path.join(ROOT, 'data', 'mcq', 'spotcheck.json');

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { opt, flag } = cli();
  const pool = readJson(path.join(ROOT, 'public', 'mcq', 'pool.json'), { questions: [] }).questions, byId = new Map(pool.map(q => [q.id, q]));
  const spot = readJson(SPOT_FILE, { note: 'The human spot-check of the pool (scripts/mcq-spotcheck.mjs, docs/mcq-spotcheck.md). marks: { id: { call, note, by } }; calls: lib/mcq-spotcheck.mjs CALLS.', sample: [], marks: {} });
  const still = spot.sample.filter(id => byId.has(id));
  if (flag('--redraw') || !still.length) spot.sample = spotSample(pool, +opt('--n', 40)).map(q => q.id);
  else if (still.length < spot.sample.length) console.log(`${spot.sample.length - still.length} sampled questions have left the pool; their marks stay, the sheet shows the rest`);
  const qs = spot.sample.map(id => byId.get(id)).filter(Boolean);
  spot.marks = Object.fromEntries(Object.entries(spot.marks || {}).filter(([id]) => spot.sample.includes(id)));
  fs.writeFileSync(SPOT_FILE, `${JSON.stringify(spot, null, 1)}\n`);
  fs.writeFileSync(path.join(ROOT, 'docs', 'mcq-spotcheck.md'), spotSheet(qs, { date: new Date().toISOString().slice(0, 10) }));
  const r = spotResults(qs, spot.marks);
  console.log(`spot-check: ${qs.length} questions -> docs/mcq-spotcheck.md · marked ${r.marked}${r.marked ? `, ${r.okShare}% fine` : ''}`);
}
