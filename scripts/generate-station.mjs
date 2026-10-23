#!/usr/bin/env node
/* generate-station.mjs - a new OSCE station, written, gated, examined, revised, given exam findings and real images.

     node scripts/generate-station.mjs "tension pneumothorax after a fall from a ladder" --acute --specialty "Emergency Medicine"
     node scripts/generate-station.mjs "explaining a new diagnosis of type 1 diabetes to a parent" --specialty Paediatrics --notes "sick day rules, DKA signs"
     node scripts/generate-station.mjs --revise ai-1337df24        an existing station through the same examiner and gates
   options: --acute (default: a clinic station) · --specialty "A, B" · --type "History, Management" · --notes "…"
            --request <id> (the case request it answers: the station carries the id, so the requester sees it is ready;
            scripts/requests.mjs passes it) · --rounds <n> (examiner passes, at least 2; the import runs 4)
            --no-imaging · --dry-run (print, write nothing)

   Claude is reached as import-amsa.mjs reaches it: through lib/claude.mjs (the SDK; `npm install` once) when
   ANTHROPIC_API_KEY is set, else through the Claude Code CLI on the signed-in subscription (lib/claude-cli.mjs). Imaging
   needs the API for its pixel check and network access to commons.wikimedia.org, upload.wikimedia.org and
   openi.nlm.nih.gov; on the CLI the requests stay on the station for `node scripts/fetch-imaging.mjs <id>` later. A
   station that does not pass is written to drafts/ with its problems instead of the bank. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeStation, reviseStation } from './lib/generate.mjs';
import { claudeJson } from './lib/claude.mjs';
import { resolveStation } from './imaging/resolve.mjs';
import { writeIndex } from './build-index.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'), PUB = path.join(ROOT, 'public');
const argv = process.argv.slice(2);
const opt = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
const flag = k => argv.includes(k);
const list = v => (v ? v.split(',').map(s => s.trim()).filter(Boolean) : []);
const VALUED = ['--specialty', '--type', '--notes', '--revise', '--request', '--rounds'];
const topic = argv.filter((a, i) => !a.startsWith('--') && !VALUED.includes(argv[i - 1])).join(' ').trim();
if (opt('--request') != null && !/^r[a-z0-9]{6,24}$/.test(opt('--request'))) { console.error(`--request: "${opt('--request')}" is not a request id`); process.exit(2); }
if (!topic && !opt('--revise')) { console.error('usage: node scripts/generate-station.mjs "<topic>" [--acute] [--specialty "…"] [--type "…"] [--notes "…"] [--no-imaging] [--dry-run]\n       node scripts/generate-station.mjs --revise <station id>'); process.exit(2); }

const dir = path.join(PUB, 'osce');
const bank = fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'index.json').map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
const log = m => console.log(m);
const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
const API = !!process.env.ANTHROPIC_API_KEY;
const ask = API ? claudeJson : (await import('./lib/claude-cli.mjs')).claudeCliJson;
const rounds = Math.max(2, Number(opt('--rounds')) || 2);
log(`Claude via ${API ? 'the API' : 'the Claude Code CLI (subscription)'} · ${rounds} examiner rounds`);

let res, original = null;
if (opt('--revise')) {
  original = bank.find(s => s.id === opt('--revise'));
  if (!original) { console.error(`no station ${opt('--revise')}`); process.exit(2); }
  log(`revising ${original.id} · ${original.title}`);
  res = await reviseStation(original, { bank, ask, log });
} else {
  log(`writing · ${topic}`);
  res = await writeStation(topic, { acute: flag('--acute'), specialty: list(opt('--specialty')), types: list(opt('--type')), notes: opt('--notes'), rounds }, { bank, ask, now, log });
}

if (!res.ok) {
  const last = res.rounds[res.rounds.length - 1];
  const out = path.join(ROOT, 'drafts', `${res.station.id}.json`);
  if (!flag('--dry-run')) { fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, `${JSON.stringify({ station: res.station, rounds: res.rounds }, null, 1)}\n`); }
  console.log(`\nnot shipped: ${last.gates.length} gate problem(s), ${(last.review.issues || []).filter(i => i.severity === 'blocker').length} examiner blocker(s)`);
  for (const g of last.gates) console.log(`  - ${g}`);
  for (const i of (last.review.issues || []).filter(x => x.severity === 'blocker')) console.log(`  - ${i.where}: ${i.problem}`);
  if (!flag('--dry-run')) console.log(`the draft and the reviews are in ${path.relative(ROOT, out)}`);
  process.exit(1);
}

/* the station as the bank holds it: the envelope, the station, the AI origin; a revised station keeps its own history fields */
let st = res.station;
if (original) {
  const keep = (original.media && typeof original.media === 'object') ? original.media : {};
  const same = new Map((st.imaging || []).map(r => [r.id, r.finding]));
  const media = Object.fromEntries(Object.entries(keep).map(([p, l]) => [p, (l || []).filter(m => !m.req || (same.has(m.req) && (original.imaging || []).find(r => r.id === m.req)?.finding === same.get(m.req)))]).filter(([, l]) => l.length));
  st = { schemaVersion: original.schemaVersion ?? 1, generatedAt: original.generatedAt, ...(original.generator ? { generator: original.generator } : {}), source: 'ai', licence: original.licence || 'own',
    ...st, ...(original.basis ? { basis: original.basis } : {}), ...(original.request ? { request: original.request } : {}), ...(original.source && typeof original.source === 'object' ? { source: original.source } : {}), media, revised: { at: now, by: 'generate-station.mjs' } };
} else {
  st = { schemaVersion: 1, generatedAt: now, generator: 'generate-station.mjs', source: 'ai', licence: 'own', ...(opt('--request') ? { request: { id: opt('--request'), at: now } } : {}), ...st, media: {} };
}
if (flag('--dry-run')) { console.log(JSON.stringify({ station: st, exam: res.exam }, null, 1)); process.exit(0); }

const file = path.join(dir, `${st.id}.json`);
fs.writeFileSync(file, `${JSON.stringify(st, null, 1)}\n`);
const examFile = path.join(PUB, 'exam.json'), exam = JSON.parse(fs.readFileSync(examFile, 'utf8'));
const unchanged = original && res.rounds.length === 1 && exam.stations[st.id];   /* a revise that passed as it was keeps its findings */
exam.stations = Object.fromEntries(Object.entries({ ...exam.stations, [st.id]: unchanged ? exam.stations[st.id] : res.exam }).sort(([a], [b]) => a.localeCompare(b)));
fs.writeFileSync(examFile, `${JSON.stringify(exam, null, 1)}\n`);
log(`\nwritten · osce/${st.id}.json · ${st.title}`);

if (!API && (st.imaging || []).length) log(`imaging · ${st.imaging.length} request${st.imaging.length === 1 ? '' : 's'} kept: the image check needs the API, so run node scripts/fetch-imaging.mjs ${st.id} with ANTHROPIC_API_KEY set`);
else if (!flag('--no-imaging') && (st.imaging || []).length) {
  log(`imaging · ${st.imaging.length} request${st.imaging.length === 1 ? '' : 's'}`);
  const { station, report } = await resolveStation(st, { pub: PUB, log });
  fs.writeFileSync(file, `${JSON.stringify(station, null, 1)}\n`);
  for (const r of report) log(r.ok ? `  ${r.id}: ${r.src} (${r.license})` : `  ${r.id}: nothing passed (${r.why[0] || ''}); the script describes it in words`);
}
const { rows, problems } = writeIndex(PUB);
log(`osce/index.json · ${rows} stations${problems.length ? ` · ${problems.join('; ')}` : ''}`);
