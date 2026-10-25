#!/usr/bin/env node
/* supabase-setup.mjs - point Med-OS at its own Supabase project and bring the schema up to date.
     SUPABASE_ACCESS_TOKEN=sbp_... node scripts/supabase-setup.mjs [--ref <project_ref>] [--dry]
   Runs every supabase/migrations/*.sql in order (each is idempotent), lists the tables that answer, writes the project
   URL and publishable key into public/config.js, and pins vercel.json's CSP to this project. Med-OS does not share
   Optimus's Supabase. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROJECT_REF, projectUrl, pickPublicKey, writeConfig, pinCsp, runSql, apiKeys } from './lib/supabase-setup.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const ref = args.includes('--ref') ? args[args.indexOf('--ref') + 1] : PROJECT_REF;
const dry = args.includes('--dry');
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error('SUPABASE_ACCESS_TOKEN is not set: make one at supabase.com/dashboard/account/tokens');
  process.exit(1);
}

const dir = path.join(ROOT, 'supabase/migrations');
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
  console.log(`${dry ? 'would run' : 'running'} ${f}`);
  if (!dry) await runSql(ref, token, fs.readFileSync(path.join(dir, f), 'utf8'), fetch);
}
if (!dry) {
  const t = await runSql(ref, token, "select table_name from information_schema.tables where table_schema = 'public' order by 1", fetch);
  console.log('tables:', t.map(r => r.table_name).join(', '));
}
const key = pickPublicKey(await apiKeys(ref, token, fetch));
if (!key) throw new Error('the project has no publishable or anon key');
const cfg = path.join(ROOT, 'public/config.js'), vj = path.join(ROOT, 'vercel.json');
const nextCfg = writeConfig(fs.readFileSync(cfg, 'utf8'), projectUrl(ref), key);
const nextVj = pinCsp(fs.readFileSync(vj, 'utf8'), ref);
if (dry) console.log(`would write ${projectUrl(ref)} into config.js and pin the CSP to it`);
else {
  fs.writeFileSync(cfg, nextCfg);
  fs.writeFileSync(vj, nextVj);
  console.log(`config.js now names ${projectUrl(ref)}; CSP pinned to ${ref}`);
}
