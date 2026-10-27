#!/usr/bin/env node
/* mcq-evals.mjs - the benchmarks that set the pool's bars, and the eval of the evals. Writes

     data/mcq/calibration.json   the bars the selector uses, and aggregate numbers per benchmark set
     data/mcq/evals.json         every number below, for the record
     docs/mcq-evals.md           the same as a report

   1 calibration  the flaw score of every item in each set (MedQA Step 2&3 and Step 1, MMLU, MedMCQA, the official
                  USMLE Step 2 CK samples, QUEST-AI's GPT-4 look-alikes) and, where judged, the combined quality. The
                  base bar is the official samples' 5th percentile of quality: nearly every official item passes it.
                  The AI bar is their 25th percentile.
   2 mutations    each MedQA Step 2&3 item with no major flaw, with one known flaw injected (lib/mcq-mutate.mjs):
                  how often the check meant to catch it fires, against how often it fires on the unmutated items
   3 QUEST-AI     how well the system separates the official items from GPT-4's, and how its verdict agrees with the
                  physicians' consensus on whether each GPT-4 item's key is correct
   4 wrong key    (--wrong-key n, makes model calls) n judged MedQA items with the key moved to a distractor: how often
                  the judge refuses them. Verdicts go to data/mcq/eval-verdicts.json (MIT items only)
   5 retest       (--retest n, makes model calls) about n judged candidates, spread over the kinds, reviewed again from
                  scratch (lib/mcq-retest.mjs): how often the two reviews agree, how far the quality moves, and how
                  many questions would pass the bar on one review and not the other

   The official items are read where they were downloaded ($MCQ_BENCH_DIR, else ../research/mcq-src) with their verdicts
   (verdicts/quest-ai.json there, from scripts/mcq-judge.mjs --bench); only aggregate numbers reach the repo.
     node scripts/mcq-evals.mjs [--from <dir>] [--wrong-key 30] [--retest 40] */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJsonl, readJson, benchmarkItem, benchOnlyItem, allCandidates } from './lib/mcq-sources.mjs';
import { flawReport, CHECK_IDS } from '../public/js/mcq/flaws.mjs';
import { mutantsOf, MUTATIONS, wrongKey } from './lib/mcq-mutate.mjs';
import { verdictFor, judgeScore, judgeGates, judgeItem } from './lib/mcq-judge.mjs';
import { quality, select, DEFAULT_BARS } from './lib/mcq-select.mjs';
import { benchDir } from './import-benchmarks.mjs';
import { sample } from './mcq-judge.mjs';
import { claudeAsk } from './lib/ask.mjs';
import { retestStats, retestFor, retestKey } from './lib/mcq-retest.mjs';
import { spotResults, CALLS } from './lib/mcq-spotcheck.mjs';
import { SPOT_FILE } from './mcq-spotcheck.mjs';
import { cli } from './lib/disk.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { argv, opt } = cli();
const DIR = benchDir(argv);
const pct = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.max(0, Math.floor(p * (s.length - 1))))] : null; };
const mean = xs => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
const rate = (n, d) => (d ? Math.round((1000 * n) / d) / 10 : null);
/* AUC: the chance a random item of `hi` scores above a random item of `lo` (ties count half) */
const auc = (hi, lo) => { let s = 0; for (const a of hi) for (const b of lo) s += a > b ? 1 : a === b ? 0.5 : 0; return hi.length && lo.length ? Math.round((1000 * s) / (hi.length * lo.length)) / 1000 : null; };

/* ---- the sets */
const rd = f => readJsonl(path.join(DIR, f));
const local = fs.existsSync(path.join(DIR, 'quest-ai', 'normalised.jsonl'));
const quest = local ? rd('quest-ai/normalised.jsonl') : [];
const sets = {
  'MedQA Step 2&3': readJsonl(path.join(ROOT, 'data/benchmarks/medqa-us-step2-3.jsonl')).map(benchmarkItem),
  'MMLU professional medicine': readJsonl(path.join(ROOT, 'data/benchmarks/mmlu-professional-medicine.jsonl')).map(benchmarkItem),
  ...(local ? {
    'Official USMLE Step 2 CK samples': quest.filter(r => r.origin.startsWith('human')).map(benchOnlyItem),
    'QUEST-AI GPT-4 look-alikes': quest.filter(r => r.origin.startsWith('ai')).map(benchOnlyItem),
    'MedQA Step 1': rd('medqa-us-test/normalised.jsonl').filter(r => r.meta_info === 'step1').map(benchmarkItem),
    'MMLU clinical knowledge + college medicine': rd('mmlu-med/normalised.jsonl').filter(r => r.topic !== 'professional_medicine').map(benchmarkItem),
    'MedMCQA dev (Indian PG entrance)': rd('medmcqa-dev/normalised.jsonl').map(benchmarkItem)
  } : {})
};
for (const k of Object.keys(sets)) sets[k] = sets[k].filter(Boolean);
const { items: cands } = allCandidates(ROOT);
sets['Station-derived (AMSA)'] = cands.filter(q => q.provenance.kind === 'amsa');
sets['Station-derived (AI stations)'] = cands.filter(q => q.provenance.kind === 'ai' && q.provenance.generator?.how === 'duel-pack');
sets['Generated (generate-mcq.mjs)'] = cands.filter(q => q.provenance.kind === 'ai' && q.provenance.generator?.how !== 'duel-pack');
sets['Open exam (HEAD-QA, Spanish MIR)'] = cands.filter(q => q.provenance.kind === 'open-exam');
const verdicts = { ...readJson(path.join(ROOT, 'data/mcq/verdicts.json'), {}), ...readJson(path.join(DIR, 'verdicts', 'quest-ai.json'), {}) };

/* ---- 1 calibration */
const calib = {};
for (const [name, items] of Object.entries(sets)) {
  const reps = items.map(q => ({ q, r: flawReport(q) })), fs_ = reps.map(x => x.r.score);
  const checks = Object.fromEntries(CHECK_IDS.filter(c => c !== 'explanation').map(c => [c, rate(reps.filter(x => x.r.failed.some(f => f.check === c)).length, reps.length)]));
  const judged = reps.map(x => ({ ...x, v: verdictFor(verdicts, x.q) })).filter(x => x.v);
  const qs = judged.map(x => quality(x.r.score, judgeScore(x.v, x.q)));
  calib[name] = { n: items.length, flaw: { mean: mean(fs_), p5: pct(fs_, 0.05), p10: pct(fs_, 0.1), p50: pct(fs_, 0.5), anyMajor: rate(reps.filter(x => x.r.failed.some(f => f.severity === 'major' || f.severity === 'block')).length, reps.length) }, checks,
    judged: judged.length, ...(judged.length ? { quality: { mean: mean(qs), p5: pct(qs, 0.05), p10: pct(qs, 0.1), p25: pct(qs, 0.25), p50: pct(qs, 0.5) },
      gatesPass: rate(judged.filter(x => !judgeGates(x.v, x.q).length).length, judged.length), solved2: rate(judged.filter(x => x.v.solves.filter(s => s.answer === x.q.answer).length === 2).length, judged.length),
      keyCorrect: rate(judged.filter(x => x.v.rubric.key_correct === 'yes').length, judged.length) } : {}), _qs: qs, _judged: judged };
}
const off = calib['Official USMLE Step 2 CK samples'];
const prevBars = readJson(path.join(ROOT, 'data/mcq/calibration.json'), {}).bars;
const bars = off?.judged >= 20 ? { base: pct(off._qs, 0.05), ai: pct(off._qs, 0.25), from: `the official USMLE Step 2 CK samples (n=${off.judged}): 5th and 25th percentile of quality` } : (prevBars || { ...DEFAULT_BARS, from: 'defaults (no official samples here)' });
for (const c of Object.values(calib)) if (c._judged.length) {
  const ok = (x, strict) => !judgeGates(x.v, x.q, { strict }).length && !x.r.blocked;
  c.passBase = rate(c._judged.filter(x => ok(x, false) && quality(x.r.score, judgeScore(x.v, x.q)) >= bars.base).length, c._judged.length);
  c.passAi = rate(c._judged.filter(x => ok(x, true) && quality(x.r.score, judgeScore(x.v, x.q)) >= bars.ai).length, c._judged.length);
  c.passAsSelected = rate(c._judged.filter(x => { const k = x.q.provenance?.kind; return ok(x, k === 'ai' || k === 'amsa') && quality(x.r.score, judgeScore(x.v, x.q)) >= (k === 'ai' ? bars.ai : bars.base); }).length, c._judged.length);
}

/* ---- 2 mutations */
const good = sets['MedQA Step 2&3'].filter(q => !flawReport(q).failed.some(f => f.severity === 'major' || f.severity === 'block'));
const mut = {};
for (const name of Object.keys(MUTATIONS)) mut[name] = { n: 0, caught: 0, scoreDrop: 0, expect: [].concat(MUTATIONS[name].expect), baseRate: null };
for (const q of good) {
  const base = flawReport(q);
  for (const m of mutantsOf(q)) { const r = flawReport(m.item), s = mut[m.name]; s.n++; if (r.failed.some(f => m.expect.includes(f.check))) s.caught++; if (r.score < base.score) s.scoreDrop++; }
}
for (const s of Object.values(mut)) { s.baseRate = rate(good.filter(q => flawReport(q).failed.some(f => s.expect.includes(f.check))).length, good.length); s.detection = rate(s.caught, s.n); s.scoreDropRate = rate(s.scoreDrop, s.n); }

/* ---- 3 QUEST-AI */
let questOut = null;
if (local) {
  const offJ = calib['Official USMLE Step 2 CK samples']._judged, gptJ = calib['QUEST-AI GPT-4 look-alikes']._judged;
  const offAll = sets['Official USMLE Step 2 CK samples'], gptAll = sets['QUEST-AI GPT-4 look-alikes'];
  const flawAuc = auc(offAll.map(q => flawReport(q).score), gptAll.map(q => flawReport(q).score));
  const qOf = x => quality(x.r.score, judgeScore(x.v, x.q));
  const label = new Map(quest.map(r => [r.id, r.review?.consensusAnswerCorrect]));
  const labelled = gptJ.filter(x => ['yes', 'no', '50/50'].includes(label.get(x.q.id)));
  /* positive = the physicians found a problem (key incorrect or 50/50); predicted positive = the system refuses it */
  const agree = (bar, strict) => {
    const c = { tp: 0, fn: 0, fp: 0, tn: 0 };
    for (const x of labelled) { const bad = label.get(x.q.id) !== 'yes', refused = judgeGates(x.v, x.q, { strict }).length > 0 || qOf(x) < bar; c[bad ? (refused ? 'tp' : 'fn') : (refused ? 'fp' : 'tn')]++; }
    const n = labelled.length, po = (c.tp + c.tn) / (n || 1), pe = (((c.tp + c.fn) * (c.tp + c.fp)) + ((c.tn + c.fp) * (c.tn + c.fn))) / ((n * n) || 1);
    return { confusion: c, accuracy: rate(c.tp + c.tn, n), sensitivity: rate(c.tp, c.tp + c.fn), specificity: rate(c.tn, c.tn + c.fp), kappa: Math.round(((po - pe) / ((1 - pe) || 1)) * 100) / 100 };
  };
  const atAi = agree(bars.ai, true), atBase = agree(bars.base, false), gatesOnly = agree(0, false), conf = atAi.confusion, n = labelled.length;
  const keyAgree = labelled.filter(x => (x.v.rubric.key_correct !== 'no' && x.v.rubric.single_best > 2) === (label.get(x.q.id) === 'yes')).length;
  questOut = { official: offAll.length, gpt: gptAll.length, judgedOfficial: offJ.length, judgedGpt: gptJ.length, aucFlaw: flawAuc, aucQuality: auc(offJ.map(qOf), gptJ.map(qOf)),
    officialPassBase: calib['Official USMLE Step 2 CK samples'].passBase, gptPassAi: calib['QUEST-AI GPT-4 look-alikes'].passAi, gptPassBase: calib['QUEST-AI GPT-4 look-alikes'].passBase,
    labels: { n, bad: conf.tp + conf.fn, good: conf.tn + conf.fp }, ...atAi, atBase, gatesOnly, reviewerKeyAgreement: rate(keyAgree, n) };
}

/* ---- 4 wrong key (model calls) */
const evf = path.join(ROOT, 'data/mcq/eval-verdicts.json'), evv = readJson(evf, {});
if (opt('--wrong-key')) {
  const judgedMedqa = sets['MedQA Step 2&3'].filter(q => verdictFor(verdicts, q) && !judgeGates(verdictFor(verdicts, q), q).length);
  const todo = sample(judgedMedqa, Number(opt('--wrong-key'))).map(wrongKey).filter(q => !verdictFor(evv, q));
  const { ask, name } = await claudeAsk(), via = `via ${name}`;
  console.log(`wrong key: judging ${todo.length}`);
  await Promise.all(Array.from({ length: 4 }, async () => { for (let q; (q = todo.shift());) { try { let m = ''; const v = await judgeItem(q, { ask: async a => { const r = await ask(a); m = r.model || m; return r; } }); v.judge = `${m} ${via}`; evv[q.id] = v; fs.writeFileSync(evf, `${JSON.stringify(evv, null, 1)}\n`); console.log(`wrong key ${q.id}: ${judgeGates(v, q).length ? 'refused' : 'passed'}`); } catch (e) { console.error(`fail ${q.id}: ${e.message}`); } } }));
}
const wkItems = sets['MedQA Step 2&3'].map(wrongKey).filter(q => verdictFor(evv, q));
const wk = wkItems.length ? { n: wkItems.length, refused: rate(wkItems.filter(q => judgeGates(verdictFor(evv, q), q).length).length, wkItems.length), keyJudgedWrong: rate(wkItems.filter(q => verdictFor(evv, q).rubric.key_correct === 'no').length, wkItems.length), solvedToWrongKey: rate(wkItems.filter(q => verdictFor(evv, q).solves.some(s => s.answer === q.answer)).length, wkItems.length) } : null;

/* ---- 5 retest (model calls): judged candidates reviewed a second time */
const poolVerdicts = readJson(path.join(ROOT, 'data/mcq/verdicts.json'), {});
const judgedCands = cands.filter(q => verdictFor(poolVerdicts, q) && !flawReport(q).blocked);
if (opt('--retest')) {
  const kinds = [...new Set(judgedCands.map(q => q.provenance.kind))].sort(), per = Math.ceil(Number(opt('--retest')) / kinds.length);
  const todo = kinds.flatMap(k => sample(judgedCands.filter(q => q.provenance.kind === k), per)).filter(q => !retestFor(evv, q));
  const { ask, name } = await claudeAsk(), via = `via ${name}`;
  console.log(`retest: reviewing ${todo.length} again (${kinds.join(', ')})`);
  await Promise.all(Array.from({ length: 4 }, async () => { for (let q; (q = todo.shift());) { try { let m = ''; const v = await judgeItem(q, { ask: async a => { const r = await ask(a); m = r.model || m; return r; } }); v.judge = `${m} ${via}`; evv[retestKey(q)] = v; fs.writeFileSync(evf, `${JSON.stringify(evv, null, 1)}\n`); console.log(`retest ${q.id}: ${verdictFor(poolVerdicts, q).rubric.verdict} then ${v.rubric.verdict}`); } catch (e) { console.error(`fail ${q.id}: ${e.message}`); } } }));
}
const rtPairs = judgedCands.map(q => ({ q, a: verdictFor(poolVerdicts, q), b: retestFor(evv, q) })).filter(x => x.b);
const rt = rtPairs.length ? retestStats(rtPairs, { bars }) : null;

/* ---- the pool as selected now */
const { stats } = select(cands, { verdicts: poolVerdicts, bars });

/* ---- write */
const strip = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Object.fromEntries(Object.entries(v).filter(([x]) => !x.startsWith('_')))]));
/* ---- 6 the human spot-check (scripts/mcq-spotcheck.mjs): what people say of a sample of the pool */
const spotFile = readJson(SPOT_FILE, { sample: [], marks: {} }), poolNow = readJson(path.join(ROOT, 'public/mcq/pool.json'), { questions: [] }).questions;
const spot = spotFile.sample.length ? spotResults(spotFile.sample.map(id => poolNow.find(q => q.id === id)).filter(Boolean), spotFile.marks) : null;
const record = { bars, calibration: strip(calib), mutations: mut, quest: questOut, wrongKey: wk, retest: rt, spot, pool: stats };
fs.mkdirSync(path.join(ROOT, 'data/mcq'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'data/mcq/calibration.json'), `${JSON.stringify({ note: 'Written by scripts/mcq-evals.mjs. Aggregate numbers only: no official item text.', bars, sets: strip(calib) }, null, 1)}\n`);
fs.writeFileSync(path.join(ROOT, 'data/mcq/evals.json'), `${JSON.stringify(record, null, 1)}\n`);

const row = (...c) => `| ${c.map(x => (x == null ? '–' : x)).join(' | ')} |`;
const md = [];
md.push('# MCQ evals: calibration and the eval of the evals', '', `Written by \`node scripts/mcq-evals.mjs\` (do not edit by hand). The numbers are in \`data/mcq/evals.json\`; how the system works is \`docs/mcq.md\`.`, '');
md.push('## 1. Calibration on the benchmarks', '', 'Flaw score: 100 minus the cost of each failed check in `public/js/mcq/flaws.mjs` (major 20, minor 6, block 100). Quality: 0.4 × flaw score + 0.6 × the model review\'s score (`scripts/lib/mcq-judge.mjs`), for the items that were reviewed. "Passes" includes the review\'s hard gates (key judged wrong, unsafe, not a single best answer, solved to another answer both times, rejected).', '');
md.push(row('Set', 'Items', 'Flaw mean', 'Flaw p5', 'Any major (%)', 'Reviewed', 'Quality p5', 'Quality p25', 'Quality median', 'Solved 2/2 (%)', 'Passes base bar (%)', 'Passes AI bar (%)', 'Passes as selected (%)'), row('---', '---:', '---:', '---:', '---:', '---:', '---:', '---:', '---:', '---:', '---:', '---:', '---:'));
for (const [k, c] of Object.entries(calib)) md.push(row(k, c.n, c.flaw.mean, c.flaw.p5, c.flaw.anyMajor, c.judged, c.quality?.p5, c.quality?.p25, c.quality?.p50, c.solved2, c.passBase, c.passAi, c.passAsSelected));
md.push('', `**Bars:** base ${bars.base}, AI-written ${bars.ai} (${bars.from}). "As selected": the bar and gates each kind meets in the selector (ai: the AI bar and two solves; amsa: the base bar and two solves; the rest: the base bar).`, '');
md.push('Failure rate of each check (% of items):', '', row('Set', ...CHECK_IDS.filter(c => c !== 'explanation')), row('---', ...CHECK_IDS.filter(c => c !== 'explanation').map(() => '---:')));
for (const [k, c] of Object.entries(calib)) md.push(row(k, ...Object.values(c.checks)));
md.push('', '## 2. Mutation test: does each check catch the flaw it is for?', '', `${good.length} MedQA Step 2&3 items with no major flaw, each with one flaw injected (\`scripts/lib/mcq-mutate.mjs\`). Detection: the check meant to catch it fires on the mutant. Base rate: the same check fires on the unmutated items (its false-positive rate on good items).`, '');
md.push(row('Flaw injected', 'Check', 'Mutants', 'Detected (%)', 'Score drops (%)', 'Base rate on good items (%)'), row('---', '---', '---:', '---:', '---:', '---:'));
for (const [k, s] of Object.entries(mut)) md.push(row(k, s.expect.join(' or '), s.n, s.detection, s.scoreDropRate, s.baseRate));
if (wk) md.push('', `**Wrong key (model review):** ${wk.n} reviewed MedQA items that passed, with the key moved to a distractor. Refused: ${wk.refused}%; the reviewer judged the key wrong in ${wk.keyJudgedWrong}%; an independent solve picked the wrong key in ${wk.solvedToWrongKey}%.`);
md.push('', '## 3. QUEST-AI: official items against GPT-4 look-alikes, and the physicians\' labels', '');
if (questOut) {
  md.push(`${questOut.official} official USMLE Step 2 CK sample items and ${questOut.gpt} GPT-4 items written to look like them (QUEST-AI, Shah lab 2024), all reviewed by the same judge. The official items are read from outside the repo; none of their text is stored here.`, '',
    `- **Separation (AUC, official above GPT-4):** flaw score ${questOut.aucFlaw}; quality ${questOut.aucQuality} (0.5 is chance).`,
    `- **Pass rates:** official at the base bar ${questOut.officialPassBase}%; GPT-4 at the base bar ${questOut.gptPassBase}%, at the AI bar (what an AI item must clear) ${questOut.gptPassAi}%.`,
    `- **Agreement with the physicians' consensus** on whether a GPT-4 item's key is correct (${questOut.labels.n} labelled: ${questOut.labels.good} correct, ${questOut.labels.bad} incorrect or 50/50). Refusing at the AI bar: accuracy ${questOut.accuracy}%, sensitivity to a bad item ${questOut.sensitivity}%, specificity ${questOut.specificity}%, Cohen's kappa ${questOut.kappa}. The reviewer's own key verdict agrees with the physicians on ${questOut.reviewerKeyAgreement}%.`,
    `- Confusion at the AI bar (positive = physicians found a problem; predicted positive = refused): TP ${questOut.confusion.tp}, FN ${questOut.confusion.fn}, FP ${questOut.confusion.fp}, TN ${questOut.confusion.tn}.`,
    `- The same at the base bar: accuracy ${questOut.atBase.accuracy}%, sensitivity ${questOut.atBase.sensitivity}%, specificity ${questOut.atBase.specificity}%, kappa ${questOut.atBase.kappa}. The review's hard gates alone (no bar): accuracy ${questOut.gatesOnly.accuracy}%, sensitivity ${questOut.gatesOnly.sensitivity}%, specificity ${questOut.gatesOnly.specificity}%, kappa ${questOut.gatesOnly.kappa}.`);
} else md.push('The QUEST-AI set was not found under the benchmark folder, so this section was not recomputed (see data/mcq/evals.json from the last run).');
md.push('', '## 4. The review, reviewed twice', '');
if (rt) {
  md.push(`${rt.n} judged candidates, spread over the kinds, reviewed a second time from scratch (\`--retest\`, \`scripts/lib/mcq-retest.mjs\`). A flip is a question that passes the selector's checks and bar on one review and not the other: the share of the pool's membership that is the reviewer's noise.`, '',
    row('Kind', 'Retested', 'Same verdict (%)', 'Same key verdict (%)', 'Same solves (%)', 'Quality drift mean', 'Drift p90', 'Drift max', 'Pass first / second', 'Flips (%)'), row('---', '---:', '---:', '---:', '---:', '---:', '---:', '---:', '---:', '---:'));
  for (const [k, r] of [...Object.entries(rt.byKind), ['all', rt]]) md.push(row(k === 'all' ? '**all**' : k, r.n, r.verdictAgree, r.keyAgree, r.solvesAgree, r.drift.mean, r.drift.p90, r.drift.max, `${r.passFirst} / ${r.passSecond}`, `${r.flips} (${r.flipRate})`));
  if (rt.flipped.length) md.push('', `Flipped: ${rt.flipped.slice(0, 12).map(f => `${f.id} (${f.quality.join(' then ')}, passed on the ${f.passed})`).join('; ')}${rt.flipped.length > 12 ? '; …' : ''}.`);
} else md.push('Not run yet: `node scripts/mcq-evals.mjs --retest 40` (model calls).');
md.push('', '## 5. The pool as selected', '', `Candidates by kind: ${JSON.stringify(stats.candidates)}. Decisions: ${JSON.stringify(stats.status)}. In the pool: ${JSON.stringify(stats.pool)}. Topic cap ${stats.topicCap}. Key positions: ${Object.entries(stats.positions).map(([k, v]) => `${k} options ${v.counts.join('/')} (χ² ${v.chi2})`).join('; ')}.`, '');
md.push('## 6. The human spot-check', '');
if (spot?.marked) {
  md.push(`${spot.marked} of the ${spot.sample} sampled pool questions marked by a person (\`docs/mcq-spotcheck.md\`): **${spot.okShare}% fine as they are**, the pool's precision as people judge it.`, '',
    row('Kind', 'Marked', 'Fine (%)'), row('---', '---:', '---:'), ...Object.entries(spot.byKind).map(([k, v]) => row(k, v.marked, v.okShare)), '',
    `Problems found: ${Object.entries(spot.problems).map(([c, n]) => `${n} ${CALLS[c] || c}`).join('; ') || 'none'}.${spot.unmarked ? ` ${spot.unmarked} still to mark.` : ''}`, '');
} else md.push(`Not marked yet: ${spot ? `the ${spot.sample} questions in \`docs/mcq-spotcheck.md\` wait for a person's calls in \`data/mcq/spotcheck.json\`` : 'run `node scripts/mcq-spotcheck.mjs` to draw the sample'}. Until then every number above is a model judging.`, '');
md.push('## Limits', '', '- The judge is one model family; MedQA and MMLU items may be in its training data, so its solve rate on them is an upper bound.', '- The generated questions are written and reviewed by the same model family, which may favour its own writing: their scores above the official samples\' are not proof they are better. The blind solves, the code checks and the higher bar are the guard; a person\'s spot-check of the pool (section 6, scripts/mcq-spotcheck.mjs) is the ground truth.', '- The official sample is small (41 text items), so the bars move by a few points with each item.', '- The physicians\' labels cover only the GPT-4 half of QUEST-AI.', '');
fs.writeFileSync(path.join(ROOT, 'docs/mcq-evals.md'), md.join('\n'));
console.log(`bars ${JSON.stringify(bars)}`); console.log(JSON.stringify(questOut)); console.log(JSON.stringify(Object.fromEntries(Object.entries(mut).map(([k, s]) => [k, s.detection]))));
