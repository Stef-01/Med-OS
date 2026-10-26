#!/usr/bin/env node
/* mcq-audit.mjs - the pool, the duel pack and the selector's funnel (data/mcq/selection.json) as a whole
   (lib/mcq-audit.mjs says what it looks at). Writes
     data/mcq/audit.json   every number
     docs/mcq-audit.md     the report
   It reads only what is on disk and makes no model calls; run it after node scripts/mcq-pool.mjs and npm run duel-pack.
     node scripts/mcq-audit.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditPool, auditMarkdown } from './lib/mcq-audit.mjs';
import { fits, readSecs, FORMATS } from '../public/js/vendor/pup-duel/duel/core.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const audit = auditPool(read('public/mcq/pool.json'), { pack: read('public/duel/pack.json'), verdicts: read('data/mcq/verdicts.json'), funnel: read('data/mcq/selection.json').stats.funnel, fits, readSecs, formats: FORMATS });
fs.writeFileSync(path.join(ROOT, 'data/mcq/audit.json'), `${JSON.stringify(audit, null, 1)}\n`);
fs.writeFileSync(path.join(ROOT, 'docs/mcq-audit.md'), auditMarkdown(audit, { date: new Date().toISOString().slice(0, 10) }));
const f = audit.pack.formats;
console.log(`pool ${audit.pool.n} · pack ${audit.pack.n} · fit 15 s ${f[15].fit}, 30 s ${f[30].fit}, 90 s ${f[90].fit} · ${audit.duplicates.length} near-duplicate pairs -> data/mcq/audit.json, docs/mcq-audit.md`);
