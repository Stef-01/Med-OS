#!/usr/bin/env node
/* rewrite-part2-asks.mjs - bring an existing station's Part 2 examiner questions into the house format (Stefan
   2026-10-23): an ISBAR handover that carries the interpretation of the results, then the most likely diagnosis and the
   differentials, then management, then optionally safety netting or a focused question; each with its expected answer
   (part2.expect). Only part2.ask and part2.expect change; the rest of the station is the context Claude reads.
   The result must pass askProblems (lib/station-gates.mjs); one retry with the problems, else the station is left as it
   was and listed. A rewritten station gets revised: {at, by}. The index is rebuilt at the end.

     node scripts/rewrite-part2-asks.mjs                  every station whose Part 2 is not yet in the format
     node scripts/rewrite-part2-asks.mjs --only ai-1234   these ids (comma-separated)
     node scripts/rewrite-part2-asks.mjs --workers 2      two at a time
     node scripts/rewrite-part2-asks.mjs --dry-run        print, write nothing

   Claude through lib/claude.mjs when ANTHROPIC_API_KEY is set, else the Claude Code CLI (lib/claude-cli.mjs). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WRITER_SYSTEM } from './lib/generate.mjs';
import { askProblems, shapeProblems } from './lib/station-gates.mjs';
import { writeIndex } from './build-index.mjs';
import { claudeAsk } from './lib/ask.mjs';
import { cli, list } from './lib/disk.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'), PUB = path.join(ROOT, 'public'), DIR = path.join(PUB, 'osce');
const { argv, opt, flag } = cli();

/* the house rules for the questions, taken from the writer's own prompt so the two never drift apart */
export const ASK_RULES = (() => { const s = WRITER_SYSTEM, a = s.indexOf('ask is 3 or 4'), b = s.indexOf('\n- check:'); return a >= 0 && b > a ? s.slice(a, b).trim() : ''; })();
const str = { type: 'string' };
export const ASK_SCHEMA = { type: 'object', additionalProperties: false, required: ['ask', 'expect'], properties: { ask: { type: 'array', items: str }, expect: { type: 'array', items: str } } };
export const SYSTEM = `You are a senior Australian OSCE examiner rewriting the Part 2 examiner questions of an existing station so they run the way a real medical OSCE examiner asks them. Change nothing else about the station: the patient, the results, the diagnosis, the checklist and the teaching stay as they are, and every expected answer must agree with them (the results' model interpretations, the checklist's Interpretation, Management and Safety netting items, the explanation and its cited guideline).
Rules for the questions and answers:
${ASK_RULES}
HTML in expect uses only: p ul ol li strong em br, with no attributes. Australian spelling.`;

export const userPrompt = (st, problems = []) => {
  const { media, imaging, ...body } = st;
  return `${problems.length ? `Your last answer had these problems; fix every one:\n${problems.map(p => `- ${p}`).join('\n')}\n\n` : ''}The station (JSON):\n${JSON.stringify(body)}`;
};
export const needsRewrite = st => askProblems(st.part2 || {}).length > 0;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { ask } = await claudeAsk();
  if (!ASK_RULES) { console.error('could not find the ask rules in WRITER_SYSTEM'); process.exit(2); }
  const only = list(opt('--only'));
  const files = fs.readdirSync(DIR).filter(f => f.endsWith('.json') && f !== 'index.json');
  const todo = files.map(f => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')))
    .filter(st => (only.length ? only.includes(st.id) : needsRewrite(st)) && st.part2 && (st.part2.handover || []).length);
  const WORKERS = Math.max(1, Number(opt('--workers') || 1));
  console.log(`${todo.length} station(s) to rewrite · ${WORKERS} worker(s)`);
  const failed = [], done = [];
  async function one(st) {
    let problems = [], value = null;
    for (let round = 0; round < 2; round++) {
      try { ({ value } = await ask({ system: SYSTEM, content: userPrompt(st, problems), schema: ASK_SCHEMA, effort: 'high', label: `asks ${st.id}` })); }
      catch (e) { problems = [e.message]; continue; }
      problems = askProblems({ ask: value.ask, expect: value.expect });
      const next = { ...st, part2: { ...st.part2, ask: value.ask, expect: value.expect } };
      problems.push(...shapeProblems(next).filter(p => /part2\.expect/.test(p)));
      if (!problems.length) break;
      console.log(`  ${st.id} round ${round + 1}: ${problems.join(' | ')}`);
    }
    if (problems.length) { failed.push(`${st.id} (${st.title}): ${problems.join('; ')}`); return; }
    const out = { ...st, part2: { ...st.part2, ask: value.ask, expect: value.expect }, revised: { at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), by: 'rewrite-part2-asks.mjs' } };
    if (flag('--dry-run')) { console.log(JSON.stringify(out.part2, null, 1)); return; }
    fs.writeFileSync(path.join(DIR, `${st.id}.json`), `${JSON.stringify(out, null, 1)}\n`);
    done.push(st.id);
    console.log(`  ${st.id} · ${st.title} · rewritten (${value.ask.length} questions)`);
  }
  const queue = [...todo];
  await Promise.all(Array.from({ length: WORKERS }, async () => { for (let st; (st = queue.shift());) await one(st); }));
  if (!flag('--dry-run')) { const { rows } = writeIndex(PUB); console.log(`osce/index.json · ${rows} stations`); }
  console.log(`\n${done.length} rewritten, ${failed.length} left as they were`);
  for (const f of failed) console.log(`  - ${f}`);
}
