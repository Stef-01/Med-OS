#!/usr/bin/env node
/* build-index.mjs - public/osce/index.json from the station bodies public/osce/<id>.json.
   The app browses, searches, filters and builds a Fast Run from the index alone (one light row per station); a body is
   fetched only when a station is previewed, started or reviewed. Deterministic: the same bodies write the same bytes,
   rows sorted by title. Run after a station is added, edited or removed:   node scripts/build-index.mjs [public dir] */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const arr = v => (Array.isArray(v) ? v : []);
const bytes = s => Buffer.byteLength(s, 'utf8');

/* the number of images a station carries: the media lists plus any on checklist items */
export function mediaCount(s) {
  const lists = s.media && typeof s.media === 'object' && !Array.isArray(s.media) ? Object.values(s.media) : [];
  const walk = l => arr(l).reduce((n, i) => n + arr(i && i.media).length + walk(i && i.kids), 0);
  return lists.reduce((n, l) => n + arr(l).length, 0) + walk(s.check);
}

/* one index row: what the browser, the filters and Fast Run read */
export function stationRow(s, size) {
  return { id: String(s.id), title: String(s.title), desc: typeof s.desc === 'string' ? s.desc : '', specialty: arr(s.specialty), type: arr(s.type),
    complexity: typeof s.complexity === 'string' ? s.complexity : '', context: arr(s.context), presentation: arr(s.presentation), diagnosis: arr(s.diagnosis),
    ...(s.origin ? { origin: String(s.origin) } : {}), ...(typeof s.focus === 'string' && s.focus ? { focus: s.focus } : {}),
    ...(s.source && typeof s.source.label === 'string' ? { source: { label: s.source.label } } : {}), ...(arr(s.basis).length ? { basis: arr(s.basis) } : {}),
    ...(s.request && typeof s.request.id === 'string' ? { request: s.request.id } : {}),   /* the case request it answers: the requester's app sees it is ready */
    hasPatient: !!(typeof s.patient === 'string' && s.patient.trim()) || arr(s.media && s.media.patientScript).length > 0, mediaCount: mediaCount(s), size };
}

/* pure: [{name, text}] (the body files) -> { index (string), problems [] } */
export function buildIndex(files) {
  const rows = [], problems = [], seen = new Set();
  for (const { name, text } of files) {
    let s;
    try { s = JSON.parse(text); } catch (e) { problems.push(`${name}: not JSON (${e.message})`); continue; }
    if (!s || !s.id || !s.title) { problems.push(`${name}: no id or title`); continue; }
    if (`${s.id}.json` !== name) { problems.push(`${name}: holds station ${s.id}`); continue; }
    if (seen.has(String(s.id))) { problems.push(`${name}: duplicate id`); continue; }
    seen.add(String(s.id));
    rows.push(stationRow(s, bytes(text)));
  }
  rows.sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
  return { index: `${JSON.stringify({ schemaVersion: 1, stations: rows })}\n`, problems };
}

export function readBodies(dir) {
  return fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'index.json').sort()
    .map(name => ({ name, text: fs.readFileSync(path.join(dir, name), 'utf8') }));
}

export function writeIndex(pub) {
  const dir = path.join(pub, 'osce');
  const { index, problems } = buildIndex(readBodies(dir));
  const out = path.join(dir, 'index.json');
  if (!fs.existsSync(out) || fs.readFileSync(out, 'utf8') !== index) fs.writeFileSync(out, index);
  return { rows: JSON.parse(index).stations.length, problems };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pub = process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
  const { rows, problems } = writeIndex(pub);
  for (const p of problems) console.error(p);
  console.log(`osce/index.json · ${rows} stations`);
  if (problems.length) process.exit(1);
}
