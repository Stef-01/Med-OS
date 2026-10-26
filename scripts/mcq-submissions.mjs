#!/usr/bin/env node
/* mcq-submissions.mjs - students' questions into data/mcq/submissions.json, where the pool's selector finds them.

     node scripts/mcq-submissions.mjs                       pull the shared table (OSCE_SUPABASE_URL and OSCE_SUPABASE_KEY,
                                                            else public/config.js), when a project is named
     node scripts/mcq-submissions.mjs <export.json> [...]   files exported from the app (Your questions → Export file)
     node scripts/mcq-submissions.mjs --list                each submission and its last decision

   Then: node scripts/mcq-judge.mjs --kind user, node scripts/mcq-pool.mjs (public/mcq/status.json tells each submitter
   what happened), npm run duel-pack, npm test, commit and push. Reads only: nothing is written to the shared table. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectFrom } from './lib/requests-store.mjs';
import { remoteSubmissions, submissionsFrom, mergeSubmissions } from './lib/mcq-intake.mjs';
import { readJson } from './lib/mcq-sources.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2), oi = argv.indexOf('--out');
const FILE = oi >= 0 ? path.resolve(argv[oi + 1]) : path.join(ROOT, 'data', 'mcq', 'submissions.json');   /* --out: another file (the e2e) */
const files = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--out');
const store = readJson(FILE, { note: 'Students\' questions as submitted (scripts/mcq-submissions.mjs). Never edited: the review\'s suggestion stays in its verdict (verdicts.json).', items: [] });

if (argv.includes('--list')) {
  const sel = readJson(path.join(ROOT, 'data', 'mcq', 'selection.json'), { decisions: [] }), by = new Map(sel.decisions.map(d => [d.id, d]));
  for (const q of store.items) { const d = by.get(q.id); console.log(`${q.id} · ${q.provenance?.submittedBy || '?'} · ${d ? d.status : 'not built yet'}${d?.reasons?.length ? ` · ${d.reasons[0]}` : ''}\n  ${String(q.stem).slice(0, 110)}`); }
  process.exit(0);
}
const incoming = [];
for (const f of files) { const got = submissionsFrom(fs.readFileSync(f, 'utf8')); console.log(`${f}: ${got.length} question${got.length === 1 ? '' : 's'}`); incoming.push(...got); }
if (!files.length) {
  const cfg = fs.existsSync(path.join(ROOT, 'public', 'config.js')) ? fs.readFileSync(path.join(ROOT, 'public', 'config.js'), 'utf8') : '';
  const project = projectFrom(process.env, cfg);
  if (!project) { console.error('No shared table is named (OSCE_SUPABASE_URL / OSCE_SUPABASE_KEY, or public/config.js), and no file was given.'); process.exit(2); }
  const got = await remoteSubmissions(project, fetch); console.log(`mcq_submissions: ${got.length} rows`); incoming.push(...got);
}
const { items, added, conflicts, refused } = mergeSubmissions(store.items, incoming);
for (const m of [...conflicts, ...refused]) console.log(`  ${m}`);
fs.mkdirSync(path.dirname(FILE), { recursive: true });
fs.writeFileSync(FILE, `${JSON.stringify({ ...store, items }, null, 1)}\n`);
console.log(`${added.length} new · ${items.length} in ${path.relative(ROOT, FILE)}. Next: node scripts/mcq-judge.mjs --kind user && node scripts/mcq-pool.mjs && npm run duel-pack`);
