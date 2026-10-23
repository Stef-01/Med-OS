#!/usr/bin/env node
/* validate.mjs - the bank as the app will load it:
     every public/osce/<id>.json has the station shape (lib/station-gates.mjs shapeProblems: ids, fields, the HTML
     allowlist), osce/index.json is what build-index.mjs would write now, exam.json only names stations that exist and
     each entry has its parts, and every image a station shows is a file under public/media with an acceptable licence
     and a credit. The quality gates are the generator's job (they report, not fail, here: --quality lists them).
   node scripts/validate.mjs [public dir] [--quality]  ·  exit 1 on any error */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { shapeProblems, qualityProblems, bankStats } from './lib/station-gates.mjs';
import { buildIndex, readBodies } from './build-index.mjs';
import { licenceOk } from './imaging/rank.mjs';
import { isLocal } from '../public/js/study-kit/media.mjs';

export function validate(pub, { quality = false } = {}) {
  const errors = [], notes = [];
  const dir = path.join(pub, 'osce'), files = readBodies(dir), stations = [];
  for (const { name, text } of files) {
    let s; try { s = JSON.parse(text); } catch { errors.push(`osce/${name}: not JSON`); continue; }
    stations.push(s);
    for (const p of shapeProblems(s)) errors.push(`osce/${name}: ${p}`);
    for (const [place, list] of Object.entries(s.media && typeof s.media === 'object' ? s.media : {})) {
      if (!Array.isArray(list)) { errors.push(`osce/${name}: media.${place} is not a list`); continue; }
      for (const m of list) {
        if (!m || !isLocal(m.src) || !String(m.src).startsWith(`media/${s.id}/`)) { errors.push(`osce/${name}: media.${place} path ${m?.src} is not under media/${s.id}/`); continue; }
        if (!fs.existsSync(path.join(pub, m.src))) errors.push(`osce/${name}: ${m.src} is missing`);
        if (!m.alt) errors.push(`osce/${name}: ${m.src} has no alt text`);
        if (!m.credit || !licenceOk(m.credit.license)) errors.push(`osce/${name}: ${m.src} has no acceptable licence (${m.credit?.license || 'none'})`);
        else if (!m.credit.author || !m.credit.page) errors.push(`osce/${name}: ${m.src} credit needs an author and a source page`);
      }
    }
  }
  const { index } = buildIndex(files), idxFile = path.join(dir, 'index.json');
  if (!fs.existsSync(idxFile)) errors.push('osce/index.json is missing: node scripts/build-index.mjs');
  else if (fs.readFileSync(idxFile, 'utf8') !== index) errors.push('osce/index.json is stale: node scripts/build-index.mjs');
  const ids = new Set(stations.map(s => String(s.id)));
  const examFile = path.join(pub, 'exam.json');
  if (fs.existsSync(examFile)) {
    const ex = JSON.parse(fs.readFileSync(examFile, 'utf8')).stations || {};
    for (const [id, e] of Object.entries(ex)) {
      if (!ids.has(id)) errors.push(`exam.json: ${id} is not a station`);
      if (!e || !e.vitals || !Array.isArray(e.steps) || !e.steps.length) errors.push(`exam.json: ${id} needs vitals and steps`);
      else for (const st of e.steps) if (!st.area || !st.find) errors.push(`exam.json: ${id} has a step without an area or a finding`);
    }
    for (const id of ids) if (!ex[id]) notes.push(`${id}: no exam findings (the Exam tab is hidden)`);
  }
  for (const f of fs.existsSync(path.join(pub, 'media')) ? fs.readdirSync(path.join(pub, 'media')) : []) if (!ids.has(f)) errors.push(`media/${f} belongs to no station`);
  if (quality) { const stats = bankStats(stations); for (const s of stations) for (const p of qualityProblems(s, stats)) notes.push(`${s.id}: ${p}`); }
  return { errors, notes, count: stations.length };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), pub = args.find(a => !a.startsWith('--')) || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
  const { errors, notes, count } = validate(pub, { quality: args.includes('--quality') });
  for (const n of notes) console.log(`note  ${n}`);
  for (const e of errors) console.error(`error ${e}`);
  console.log(`${count} stations · ${errors.length} error${errors.length === 1 ? '' : 's'}`);
  process.exit(errors.length ? 1 : 0);
}
