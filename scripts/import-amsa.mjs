#!/usr/bin/env node
/* import-amsa.mjs - AMSA MedEd OSCE cases (course 115) into the bank, one station per case, through the same writer,
   gates, examiner and exam-findings flow as generate-station.mjs (lib/generate.mjs). The difference is the brief: the
   case's own text (scripts/import/amsa-raw/<slug>.md, extracted from the course PDF by scripts/import/amsa-page.js) is
   the source the writer converts, following docs/station-format.md "Converting a station written for the old format":
   keep the patient, the facts, the diagnosis, the marking points and the teaching; reshape to 5 / 10 / 5.

     node scripts/import-amsa.mjs                 every raw case not yet imported, oldest section first
     node scripts/import-amsa.mjs --limit 5       at most 5 this run
     node scripts/import-amsa.mjs --only 200,201  these resource ids
     node scripts/import-amsa.mjs --retry         include cases whose last attempt failed the gates
     node scripts/import-amsa.mjs --pause 60      seconds between cases (default 30: the machine and the CLI are shared)
     node scripts/import-amsa.mjs --workers 3     convert 3 cases at a time
     node scripts/import-amsa.mjs --watch         keep picking up raw cases until every manifest case is exported
     node scripts/import-amsa.mjs --dry-run       print, write nothing

   The result is an ordinary bank station (Stefan 2026-10-23: the case content feeds the existing OSCE UI, AI writes what
   the case lacks, none of AMSA's tiles or categories come over). Provenance: id amsa-<resource id>, origin "ai" with
   source {label: "AMSA MedEd OSCEs", url, file, ...}, so the AI tag reads "AI generated from AMSA MedEd OSCEs". Claude is reached through
   lib/claude.mjs when ANTHROPIC_API_KEY is set, else through the Claude Code CLI on the signed-in subscription
   (lib/claude-cli.mjs). Imaging requests are kept on the station but not resolved here (the image check needs the API);
   run `node scripts/fetch-imaging.mjs <id>` later. Progress is in scripts/import/amsa-ledger.json; a case that fails the
   gates twice is written to drafts/ with its problems and skipped until --retry. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeStation } from './lib/generate.mjs';
import { writeIndex } from './build-index.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'), PUB = path.join(ROOT, 'public');
const IMPORT = path.join(ROOT, 'scripts', 'import'), RAW = path.join(IMPORT, 'amsa-raw'), LEDGER = path.join(IMPORT, 'amsa-ledger.json');
const argv = process.argv.slice(2);
const opt = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
const flag = k => argv.includes(k);
const LIMIT = Number(opt('--limit') || Infinity), PAUSE = Number(opt('--pause') ?? 30) * 1000, ONLY = (opt('--only') || '').split(',').map(s => s.trim()).filter(Boolean).map(Number);
const log = m => console.log(m);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const stamp = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

/* ---------------------------------------------------------------- the raw case files */
export function parseRaw(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return null;
  const meta = {};
  for (const line of m[1].split('\n')) { const i = line.indexOf(':'); if (i < 0) continue; const k = line.slice(0, i).trim(); let v = line.slice(i + 1).trim(); if (/^".*"$/.test(v)) v = JSON.parse(v); meta[k] = v; }
  meta.id = Number(meta.id); meta.pages = Number(meta.pages || 0);
  return { meta, body: m[2].trim() };
}
export const readRaw = dir => fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort().map(f => ({ slug: f.replace(/\.md$/, ''), ...parseRaw(fs.readFileSync(path.join(dir, f), 'utf8')) })).filter(r => r.meta);

/* ---------------------------------------------------------------- the brief: how a course section and a title map to the bank's vocabulary */
export const SECTION_SPECIALTY = {
  Cardiovascular: ['Cardiology'], Respiratory: ['Respiratory Medicine'], Gastrointestinal: ['Gastroenterology'], Neurological: ['Neurology'],
  Endocrinological: ['Endocrinology'], 'Musculoskeletal & Rheumatological': ['Rheumatology', 'Orthopaedics'], Urology: ['Urology'], Paediatrics: ['Paediatrics'],
  'Obstetrics & Gynaecology': ['Obstetrics', 'Gynaecology'], 'General Practice': ['General Practice'], Psychiatry: ['Psychiatry'], 'Aged Care': ['Geriatrics'],
  Dermatology: ['Dermatology'], Surgery: ['General Surgery'], 'Interactive MEKSI Cases': ['Emergency Medicine'],
};
export function brief(raw) {
  const { meta, body } = raw, t = meta.title || '';
  const types = /examination/i.test(t) ? ['Examination'] : /counsel|explain|educat/i.test(t) ? ['Counselling'] : /management|emergency|acute/i.test(t) ? ['Management'] : ['History'];
  /* acute when the case opens in the ED, on the ward or by ambulance, or its title says so */
  const opening = body.split(/---page---/)[0] || '';
  const acute = /emergency|acute|collapse|deteriorat|resus|meksi|overdose|post-op/i.test(`${t} ${meta.section}`) || /emergency department|\bED\b|ambulance|ward call|on the ward|intensive care/i.test(opening);
  const specialty = SECTION_SPECIALTY[meta.section] || [];
  const topic = `${t} (AMSA MedEd ${meta.section} OSCE), converted to the 5 / 10 / 5 format`;
  const source = `Source case, from AMSA MedEd's OSCE course (section "${meta.section}", "${t}"), written for an 8-minute format (a short history, then examiner questions). Convert it faithfully: keep this patient (name, age, their story and every fact the script gives), the diagnosis, the differentials, the marking points and the teaching notes; reshape it to Part 1 (focused history and examination) and Part 2 (results handed over, interpretation, management, safety netting). Where the case describes an image or result in words, hand it over as a formal report in Part 2. Add only the Part 2 results the case needs, consistent with everything the case says. Part 2 is 5 minutes: hand over 2 to 4 results and ask the case's own core questions, choosing the most important where the case offers alternatives (the examiner "chooses 1 of the following"); move the rest into the explanation, never into extra checklist items. Observation rows in Part 2 describe the patient before treatment or what happens whatever the candidate does (a deterioration, a nurse's repeat set); they never record treatment the candidate may not have ordered, and their notes never name the diagnosis. Anything the candidate can only judge from a Part 2 result is marked in Part 2, not in Part 1. Text extracted from the PDF (page breaks marked ---page---):\n<source_case>\n${body}\n</source_case>`;
  return { topic, opts: { acute, specialty, types, source, id: `amsa-${meta.id}`, rounds: 3 } };
}

/* the station as the bank holds it: envelope first, then the station, then the provenance that must not be lost */
export function envelope(st, raw, now) {
  const { meta } = raw;
  const { origin: _o, ...body } = st;
  return { schemaVersion: 1, generatedAt: now, generator: 'import-amsa.mjs', source: { label: 'AMSA MedEd OSCEs', url: meta.url, file: meta.file, course: 115, section: meta.section, title: meta.title },
    licence: 'own', ...body, origin: 'ai', media: {} };
}

const readLedger = () => (fs.existsSync(LEDGER) ? JSON.parse(fs.readFileSync(LEDGER, 'utf8')) : { note: 'import-amsa.mjs progress: one entry per AMSA resource id', cases: {} });
const writeLedger = l => fs.writeFileSync(LEDGER, `${JSON.stringify(l, null, 1)}\n`);

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const ask = process.env.ANTHROPIC_API_KEY ? (await import('./lib/claude.mjs')).claudeJson : (await import('./lib/claude-cli.mjs')).claudeCliJson;
  log(`Claude via ${process.env.ANTHROPIC_API_KEY ? 'the API' : 'the Claude Code CLI (subscription)'}`);
  const dir = path.join(PUB, 'osce');
  const bank = () => fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'index.json').map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
  const ledger = readLedger();
  /* what is left: raw cases with no station yet, not failed (unless --retry), not taken by another worker */
  const claimed = new Set();
  const pending = () => readRaw(RAW).filter(r => !ONLY.length || ONLY.includes(r.meta.id)).filter(r => {
    const e = ledger.cases[r.meta.id];
    if (claimed.has(r.meta.id) || fs.existsSync(path.join(dir, `amsa-${r.meta.id}.json`))) return false;
    return !e || !['failed', 'error'].includes(e.status) || flag('--retry');
  });
  /* --watch: keep going while the browser is still exporting cases, until every manifest resource has a raw file */
  const MF = path.join(IMPORT, 'amsa-manifest.json'), manifest = fs.existsSync(MF) ? JSON.parse(fs.readFileSync(MF, 'utf8')) : { items: [] };
  const exportDone = () => manifest.items.filter(i => i.mod === 'resource').every(i => fs.existsSync(path.join(RAW, `${i.slug}.md`)));
  const WORKERS = Math.max(1, Number(opt('--workers') || 1));
  log(`${pending().length} case(s) ready · ${WORKERS} worker(s)${flag('--watch') ? ' · watching for more' : ''}`);
  let n = 0, shipped = 0, started = 0;
  async function one(raw) {
    const { topic, opts } = brief(raw), now = stamp(), k = ++n;
    const say = m => log(`[${k}] ${m}`);
    say(`${raw.meta.title} · ${raw.meta.section} · ${opts.types.join(', ')}${opts.acute ? ' · acute' : ''}`);
    let res;
    try { res = await writeStation(topic, opts, { bank: bank(), ask, now, log: m => say(`  ${m}`) }); }
    catch (e) { say(`  error: ${e.message}`); ledger.cases[raw.meta.id] = { status: 'error', at: now, title: raw.meta.title, why: e.message.slice(0, 300) }; if (!flag('--dry-run')) writeLedger(ledger); return; }
    if (!res.ok) {
      const last = res.rounds[res.rounds.length - 1], blockers = (last.review.issues || []).filter(i => i.severity === 'blocker');
      say(`  not shipped: ${last.gates.length} gate problem(s), ${blockers.length} examiner blocker(s)`);
      for (const g of last.gates) say(`    - ${g}`);
      for (const i of blockers) say(`    - ${i.where}: ${i.problem}`);
      if (!flag('--dry-run')) {
        const out = path.join(ROOT, 'drafts', `${res.station.id}.json`);
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, `${JSON.stringify({ station: envelope(res.station, raw, now), rounds: res.rounds }, null, 1)}\n`);
        ledger.cases[raw.meta.id] = { status: 'failed', at: now, title: raw.meta.title, gates: last.gates, blockers: blockers.map(b => `${b.where}: ${b.problem}`) };
        writeLedger(ledger);
      }
      return;
    }
    const st = envelope(res.station, raw, now);
    if (flag('--dry-run')) { console.log(JSON.stringify({ station: st, exam: res.exam }, null, 1)); return; }
    /* synchronous read-modify-write: the workers share one thread, so these never interleave */
    fs.writeFileSync(path.join(dir, `${st.id}.json`), `${JSON.stringify(st, null, 1)}\n`);
    const examFile = path.join(PUB, 'exam.json'), exam = JSON.parse(fs.readFileSync(examFile, 'utf8'));
    exam.stations = Object.fromEntries(Object.entries({ ...exam.stations, [st.id]: res.exam }).sort(([a], [b]) => a.localeCompare(b)));
    fs.writeFileSync(examFile, `${JSON.stringify(exam, null, 1)}\n`);
    ledger.cases[raw.meta.id] = { status: 'shipped', at: now, title: raw.meta.title, station: st.id, rounds: res.rounds.length, models: res.models, imaging: (st.imaging || []).length };
    writeLedger(ledger);
    const { rows, problems } = writeIndex(PUB);
    shipped++;
    say(`  written · osce/${st.id}.json · ${st.title} · index ${rows} stations${problems.length ? ` · ${problems.join('; ')}` : ''}`);
  }
  async function worker(w) {
    await sleep(w * 20000);   /* stagger the start */
    for (;;) {
      if (started >= LIMIT) return;
      const raw = pending()[0];
      if (!raw) { if (flag('--watch') && !exportDone()) { await sleep(60000); continue; } return; }
      claimed.add(raw.meta.id); started++;
      await one(raw);
      await sleep(PAUSE);
    }
  }
  await Promise.all(Array.from({ length: WORKERS }, (_, w) => worker(w)));
  log(`\n${shipped} of ${started} shipped`);
}
