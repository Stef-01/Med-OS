#!/usr/bin/env node
/* tag-years.mjs - the year (1 to 4) and difficulty (1 to 3, public/js/mcq/year.mjs) of every question in the duel's pack,
   by Claude, kept in data/mcq/years.json ({ years: { id: year }, difficulty: { id: 1..3 } }) for build-duel-pack.mjs,
   which falls back to guessYear() and guessDiff() for a question not tagged yet. Only questions missing either are
   sent (a year already given is kept), so a run after new questions are written tags just those:

     node scripts/tag-years.mjs                every untagged question in public/duel/pack.json
     node scripts/tag-years.mjs --redo        tag them all again
     options: --batch 40 · --jobs 3 · --model sonnet · --dry-run (print the first batch's answer, write nothing)
   then: npm run duel-pack

   The Claude Code CLI on the signed-in subscription (lib/claude-cli.mjs), else the API (lib/claude.mjs) with a key. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { YEARS, isYear, DIFFICULTY, isDiff } from '../public/js/mcq/year.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const YEARS_FILE = path.join(ROOT, 'data', 'mcq', 'years.json');
const readFile = (file, k) => { try { const j = JSON.parse(fs.readFileSync(file, 'utf8')); return j && typeof j[k] === 'object' ? j[k] : {}; } catch { return {}; } };
export const readYears = (file = YEARS_FILE) => readFile(file, 'years');
export const readDifficulty = (file = YEARS_FILE) => readFile(file, 'difficulty');

export const SYSTEM = `You place medical school multiple-choice questions on the year of a four-year medical degree they are pitched at, so a student can learn from first principles upwards ("0 to 1": Year 1, then 2, then 3, then final year).

${Object.entries(YEARS).map(([n, y]) => `Year ${n} (${y.name}): ${y.brief}.`).join('\n')}

Judge what the question asks the student to know or do, not the setting of the vignette: a question set on a ward that asks which nerve supplies a muscle is Year 1; one that asks the mechanism of a drug or why a sign occurs is Year 2; one that asks the most likely diagnosis or the best test is Year 3; one that asks the next step in management, a dose, or what to do first in an unwell patient is Year 4. Give the earliest year a well-taught student could answer it.

Then its difficulty for a student of that year:
${Object.entries(DIFFICULTY).map(([n, d]) => `${n} ${d.label}: ${d.brief}.`).join('\n')}
Answer for every id given, with one integer year and one integer difficulty each.`;
export const SCHEMA = { type: 'object', additionalProperties: false, required: ['years'], properties: { years: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'year', 'difficulty'], properties: { id: { type: 'string' }, year: { type: 'integer', minimum: 1, maximum: 4 }, difficulty: { type: 'integer', minimum: 1, maximum: 3 } } } } } };
export const brief = q => ({ id: q.id, kind: q.cat || '', stem: String(q.stem).slice(0, 700), options: q.options });

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
  const pack = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'duel', 'pack.json'), 'utf8'));
  const redo = argv.includes('--redo'), years = redo ? {} : readYears(), diff = redo ? {} : readDifficulty();
  const todo = pack.questions.filter(q => !isYear(years[q.id]) || !isDiff(diff[q.id]));
  const size = Math.max(5, +opt('--batch', 40)), batches = [];
  for (let i = 0; i < todo.length; i += size) batches.push(todo.slice(i, i + size));
  const API = !!process.env.ANTHROPIC_API_KEY;
  const ask = API ? (await import('./lib/claude.mjs')).claudeJson : (await import('./lib/claude-cli.mjs')).claudeCliJson;
  console.log(`${todo.length} questions to tag in ${batches.length} batches · Claude via ${API ? 'the API' : 'the Claude Code CLI'}`);
  const save = () => { fs.mkdirSync(path.dirname(YEARS_FILE), { recursive: true }); fs.writeFileSync(YEARS_FILE, `${JSON.stringify({ note: 'Written by scripts/tag-years.mjs: the year (1 to 4, public/js/mcq/year.mjs) of each duel question, by Claude.', years: Object.fromEntries(Object.entries(years).sort(([a], [b]) => (a < b ? -1 : 1))), difficulty: Object.fromEntries(Object.entries(diff).sort(([a], [b]) => (a < b ? -1 : 1))) }, null, 1)}\n`); };
  let done = 0, failed = 0;
  const worker = async () => {
    for (let b; (b = batches.shift());) {
      const ids = new Set(b.map(q => q.id));
      try {
        const raw = await ask({ system: SYSTEM, content: JSON.stringify(b.map(brief)), schema: SCHEMA, effort: 'low', model: opt('--model', 'sonnet'), label: 'years' });
        const out = (raw?.years ? raw : raw?.value)?.years || [];
        if (argv.includes('--dry-run')) { console.log(JSON.stringify(out, null, 1)); process.exit(0); }
        let n = 0; for (const x of out) if (ids.has(x.id) && isYear(x.year)) { if (!isYear(years[x.id])) years[x.id] = x.year; if (isDiff(x.difficulty)) diff[x.id] = x.difficulty; n++; }
        done += n; save(); console.log(`batch: ${n} of ${b.length} tagged (${done} so far)`);
      } catch (e) { failed += b.length; console.error(`batch failed: ${String(e.message).slice(0, 200)}`); }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, +opt('--jobs', 3)) }, worker));
  const count = o => Object.values(o).reduce((m, y) => ((m[y] = (m[y] || 0) + 1), m), {});
  console.log(`tagged ${done} · failed ${failed} · by year ${JSON.stringify(count(years))} · by difficulty ${JSON.stringify(count(diff))}`);
}
