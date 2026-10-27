#!/usr/bin/env node
/* generate-mcq.mjs - new Step 2 CK-style questions written from the stations (lib/mcq-generate.mjs says how), kept in
   data/mcq/generated.json for the judge and the selector. Nothing written here reaches the pool by itself:
   node scripts/mcq-judge.mjs --kind ai, then node scripts/mcq-pool.mjs.

     node scripts/generate-mcq.mjs --stations amsa-187,ai-12e898ea [--focus management]
     node scripts/generate-mcq.mjs --sample 40            40 stations (seeded), the focus rotating over the four
     node scripts/generate-mcq.mjs --sample 80 --form rapid    short questions for the duel's Rapid 15 s format
     node scripts/generate-mcq.mjs --gaps 15 --form rapid --sample 60   aimed at the topics the audit finds thin at 15 s
   options: --jobs 3 · --per n (questions per station, focus and form; 2 for --gaps, else 1) · --dry-run (print, write nothing)

   Claude: lib/claude.mjs (the SDK) when ANTHROPIC_API_KEY is set, else the Claude Code CLI (lib/claude-cli.mjs); the
   item records which (generator.how "api" or "cli"). A question that still has a major flaw after its one revision goes
   to drafts/mcq/ with its problems. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeMcq, FOCUS, FORMS, gapJobs, topicStation, standIns, writtenFrom, twinOf, knownOf } from './lib/mcq-generate.mjs';
import { THIN } from './lib/mcq-audit.mjs';
import { readJsonl, benchmarkItem, readJson, allCandidates } from './lib/mcq-sources.mjs';
import { stationsOnDisk } from './build-duel-pack.mjs';
import { fnv } from '../public/js/mcq/schema.mjs';
import { claudeAsk } from './lib/ask.mjs';
import { tagOf } from '../public/js/mcq/schema.mjs';
import { cli } from './lib/disk.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const GENERATED = path.join(ROOT, 'data', 'mcq', 'generated.json');
const { argv, opt, list } = cli();

const stations = stationsOnDisk(path.join(ROOT, 'public')).sort((a, b) => a.id.localeCompare(b.id));
const bench = readJsonl(path.join(ROOT, 'data', 'benchmarks', 'medqa-us-step2-3.jsonl')).map(benchmarkItem).filter(Boolean);
const store = readJson(GENERATED, { note: 'Written by scripts/generate-mcq.mjs. Kind ai; each passes the judge and the selector before it reaches the pool.', items: [] });
const FORM = opt('--form') || 'vignette';
if (!FORMS[FORM]) { console.error(`--form is one of ${Object.keys(FORMS).join(', ')}`); process.exit(2); }
const formOf = q => (q.tags.find(t => t.startsWith('form:')) || 'form:vignette').slice(5);
/* how many questions each station has per focus and form; a slot is full at PER (--per; 2 for a gap run, where the
   thin topics' stations have used every focus once, else 1). The writer is shown what the station already has, so a
   second question asks for another answer */
const slotOf = q => `${q.provenance.generator.basis[0]}|${(q.tags.find(t => t.startsWith('focus:')) || '').slice(6)}|${formOf(q)}`;
const written = new Map();
for (const q of store.items) written.set(slotOf(q), (written.get(slotOf(q)) || 0) + 1);
const PER = Number(opt('--per')) || (opt('--gaps') ? 2 : 1), full = (st, fc) => (written.get(`${st.id}|${fc}|${FORM}`) || 0) >= PER;
const focuses = Object.keys(FOCUS);
let jobs = [];
if (opt('--stations')) jobs = list(opt('--stations')).map((id, i) => ({ st: stations.find(s => s.id === id), focus: opt('--focus') || focuses[i % focuses.length] }));
else if (opt('--gaps')) {   /* where the duel is thin: the audit's topics with fewer than THIN questions fitting a format */
  const secs = String(opt('--gaps')), f = readJson(path.join(ROOT, 'data', 'mcq', 'audit.json'), {}).pack?.formats?.[secs];
  if (!f) { console.error(`no audit for ${secs} s: node scripts/mcq-audit.mjs first (formats are ${Object.keys(readJson(path.join(ROOT, 'data', 'mcq', 'audit.json'), {}).pack?.formats || {}).join(', ')})`); process.exit(2); }
  const need = t => THIN - (f.byTopic[t] || 0), thin = new Set(f.thin);
  const covered = new Set(stations.flatMap(st => st.specialty || []));
  /* stand-ins (topicStation), a question each per focus, for a thin topic no station covers (at least two), and for one
     whose stations have too few open slots left for its gap (2026-10-27: the last five thin topics all had stations,
     every slot full) */
  const writtenFor = t => store.items.filter(q => q.tags.includes(tagOf(`topic:${t}`)) && formOf(q) === FORM).length;
  const openSlots = t => stations.filter(st => (st.specialty || []).includes(t)).reduce((n, st) => n + focuses.filter(fc => !full(st, fc)).length, 0);
  const variants = t => standIns({ topic: t, covered: covered.has(t), need: need(t), openSlots: openSlots(t), written: writtenFor(t), focuses: focuses.length });
  const standIns = f.thin.flatMap(t => Array.from({ length: variants(t) }, (_, v) => topicStation(t, v)));
  jobs = gapJobs([...stations, ...standIns], thin, need, Number(opt('--sample')) || 40, focuses, opt('--focus'), full);
  if (standIns.length) console.log(`${new Set(standIns.map(x => x.title)).size} thin topics need more than their stations give: ${standIns.length} stand-ins written from the specialty alone`);
  console.log(`gaps at ${secs} s: ${f.thin.length} thin topics; ${jobs.length} stations in them`);
}
else if (opt('--sample')) jobs = [...stations].sort((a, b) => fnv(`g:${a.id}`).localeCompare(fnv(`g:${b.id}`))).slice(0, Number(opt('--sample'))).map((st, i) => ({ st, focus: opt('--focus') || focuses[i % focuses.length] }));
else { console.error('usage: node scripts/generate-mcq.mjs --stations <id,id> | --sample <n> [--focus management|investigation|interpretation|complication] [--form vignette|rapid] [--gaps 15|30|90] [--jobs 3] [--dry-run]'); process.exit(2); }
if (jobs.some(j => !j.st)) { console.error('no such station'); process.exit(2); }
jobs = jobs.filter(j => !full(j.st, j.focus));
const { ask, how, name } = await claudeAsk();
console.log(`${jobs.length} ${FORM} questions to write · Claude via ${name}`);
let kept = 0, failed = 0;
const known = knownOf(allCandidates(ROOT, { stations }).items);   /* every question there is, for twinOf */
const save = () => { if (argv.includes('--dry-run')) return; fs.mkdirSync(path.dirname(GENERATED), { recursive: true }); store.items.sort((a, b) => a.id.localeCompare(b.id)); fs.writeFileSync(GENERATED, `${JSON.stringify(store, null, 1)}\n`); };
const worker = async () => {
  for (let j; (j = jobs.shift());) {
    try {
      /* told what is written from it so far, this run's questions included */
      const st = { ...j.st, avoid: writtenFrom(store.items, j.st, tagOf) };
      const r = await writeMcq(st, j.focus, { bench, ask, how, log: m => console.log(m), form: FORM });
      const twin = r.ok && twinOf(r.item, known);
      if (twin) { r.ok = false; r.problems = [`a near-duplicate of ${twin}`]; r.draft = r.item; }
      if (r.ok) { store.items.push(r.item); known.push(...knownOf([r.item])); save(); kept++; console.log(`kept ${r.item.id} · ${j.st.id} · ${j.focus}${r.rounds > 1 ? ' (revised)' : ''}`); }
      else {
        failed++; console.log(`not kept · ${j.st.id} · ${j.focus}: ${r.problems.join('; ')}`);
        if (!argv.includes('--dry-run')) { const d = path.join(ROOT, 'drafts', 'mcq'); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, `${j.st.id}-${j.focus}${FORM === 'vignette' ? '' : `-${FORM}`}.json`), `${JSON.stringify({ problems: r.problems, draft: r.draft }, null, 1)}\n`); }
      }
    } catch (e) { failed++; console.error(`fail ${j.st.id} ${j.focus}: ${String(e.message).slice(0, 200)}`); }
  }
};
await Promise.all(Array.from({ length: Math.max(1, Number(opt('--jobs')) || 3) }, worker));
console.log(`kept ${kept} · not kept ${failed}`);
