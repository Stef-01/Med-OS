#!/usr/bin/env node
/* check-station.mjs - one station against every gate the generator applies (shape, the 5 / 10 / 5 format, checklist
   sections, Part 2, guidelines, imaging requests) plus the notes the examiner pass looks at.
   node scripts/check-station.mjs <station id> [more ids]   ·  exit 1 when any station has a problem */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { shapeProblems, qualityProblems, reviewNotes, bankStats } from './lib/station-gates.mjs';
import { readBodies } from './build-index.mjs';
import { chartFor, chartById, cleanObs, escalation, obsText, ageText, cleanDemo } from '../public/js/osce/obs.mjs';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'osce');
const bank = readBodies(dir).map(f => { try { return JSON.parse(f.text); } catch { return null; } }).filter(Boolean), stats = bankStats(bank);   /* a file being rewritten is skipped */
const ids = process.argv.slice(2);
if (!ids.length) { console.error('usage: node scripts/check-station.mjs <station id …>'); process.exit(2); }
let bad = 0;
for (const id of ids) {
  const st = bank.find(s => s.id === id);
  if (!st) { console.log(`${id}: no such station`); bad++; continue; }
  const probs = [...shapeProblems(st), ...qualityProblems(st, stats)], notes = reviewNotes(st);
  console.log(`${id}: ${probs.length ? `${probs.length} problem${probs.length === 1 ? '' : 's'}` : 'passes every gate'}`);
  for (const p of probs) console.log(`  - ${p}`);
  for (const n of notes) console.log(`  note: ${n}`);
  /* what Part 2's observations will look like: the chart this patient is on, and each row's zone and response */
  const d = cleanDemo(st.demo), ch = chartFor(st.demo), chart = chartById(ch.id);
  if (d) console.log(`  patient: ${ageText(d)}, ${d.sex}, ${d.setting}${d.pregnant ? ', pregnant' : ''}${d.postpartum ? ', postnatal' : ''} → ${ch.id ? `chart ${ch.why}` : ch.why}`);
  for (const h of (st.part2?.handover || []).filter(h => h?.kind === 'obs')) for (const r of cleanObs(h.obs)?.rows || []) {
    const e = chart ? escalation(chart, r) : null;
    console.log(`  obs ${obsText(r)}${e ? ` → ${e.zone}${e.action ? ` (${e.action}): ${e.why.join('; ')}` : ''}` : ''}`);
  }
  if (probs.length) bad++;
}
process.exit(bad ? 1 : 0);
