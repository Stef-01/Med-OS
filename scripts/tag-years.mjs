#!/usr/bin/env node
/* tag-years.mjs - the year (1 to 4, public/js/mcq/year.mjs) of every question in the duel's pack, by Claude, kept in
   data/mcq/years.json ({ years: { id: year } }) for build-duel-pack.mjs, which falls back to guessYear() for a question
   not tagged yet. Only questions without a year are sent, so a run after new questions are written tags just those:

     node scripts/tag-years.mjs                every untagged question in public/duel/pack.json
     node scripts/tag-years.mjs --redo        tag them all again
     options: --batch 40 · --jobs 3 · --model sonnet · --dry-run (print the first batch's answer, write nothing)
   then: npm run duel-pack

   The Claude Code CLI on the signed-in subscription (lib/claude-cli.mjs), else the API (lib/claude.mjs) with a key. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { YEARS, isYear } from '../public/js/mcq/year.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const YEARS_FILE = path.join(ROOT, 'data', 'mcq', 'years.json');
export const readYears = (file = YEARS_FILE) => { try { const j = JSON.parse(fs.readFileSync(file, 'utf8')); return j && typeof j.years === 'object' ? j.years : {}; } catch { return {}; } };

export const SYSTEM = `You place medical school multiple-choice questions on the year of a four-year medical degree they are pitched at, so a student can learn from first principles upwards ("0 to 1": Year 1, then 2, then 3, then final year).

${Object.entries(YEARS).map(([n, y]) => `Year ${n} (${y.name}): ${y.brief}.`).join('\n')}

Judge what the question asks the student to know or do, not the setting of the vignette: a question set on a ward that asks which nerve supplies a muscle is Year 1; one that asks the mechanism of a drug or why a sign occurs is Year 2; one that asks the most likely diagnosis or the best test is Year 3; one that asks the next step in management, a dose, or what to do first in an unwell patient is Year 4. Give the earliest year a well-taught student could answer it. Answer for every id given, with one integer year each.`;
export const SCHEMA = { type: 'object', additionalProperties: false, required: ['years'], properties: { years: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'year'], properties: { id: { type: 'string' }, year: { type: 'integer', minimum: 1, maximum: 4 } } } } } };
export const brief = q => ({ id: q.id, kind: q.cat || '', stem: String(q.stem).slice(0, 700), options: q.options });

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
  const pack = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'duel', 'pack.json'), 'utf8'));
  const years = argv.includes('--redo') ? {} : readYears();
  const todo = pack.questions.filter(q => !isYear(years[q.id]));
  const size = Math.max(5, +opt('--batch', 40)), batches = [];
  for (let i = 0; i < todo.length; i += size) batches.push(todo.slice(i, i + size));
  const API = !!process.env.ANTHROPIC_API_KEY;
  const ask = API ? (await import('./lib/claude.mjs')).claudeJson : (await import('./lib/claude-cli.mjs')).claudeCliJson;
  console.log(`${todo.length} questions to tag in ${batches.length} batches · Claude via ${API ? 'the API' : 'the Claude Code CLI'}`);
  const save = () => { fs.mkdirSync(path.dirname(YEARS_FILE), { recursive: true }); fs.writeFileSync(YEARS_FILE, `${JSON.stringify({ note: 'Written by scripts/tag-years.mjs: the year (1 to 4, public/js/mcq/year.mjs) of each duel question, by Claude.', years: Object.fromEntries(Object.entries(years).sort(([a], [b]) => (a < b ? -1 : 1))) }, null, 1)}\n`); };
  let done = 0, failed = 0;
  const worker = async () => {
    for (let b; (b = batches.shift());) {
      const ids = new Set(b.map(q => q.id));
      try {
        const raw = await ask({ system: SYSTEM, content: JSON.stringify(b.map(brief)), schema: SCHEMA, effort: 'low', model: opt('--model', 'sonnet'), label: 'years' });
        const out = (raw?.years ? raw : raw?.value)?.years || [];
        if (argv.includes('--dry-run')) { console.log(JSON.stringify(out, null, 1)); process.exit(0); }
        let n = 0; for (const x of out) if (ids.has(x.id) && isYear(x.year)) { years[x.id] = x.year; n++; }
        done += n; save(); console.log(`batch: ${n} of ${b.length} tagged (${done} so far)`);
      } catch (e) { failed += b.length; console.error(`batch failed: ${String(e.message).slice(0, 200)}`); }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, +opt('--jobs', 3)) }, worker));
  const count = Object.values(years).reduce((m, y) => ((m[y] = (m[y] || 0) + 1), m), {});
  console.log(`tagged ${done} · failed ${failed} · by year ${JSON.stringify(count)}`);
}
