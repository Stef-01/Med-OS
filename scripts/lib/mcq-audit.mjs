/* mcq-audit.mjs - pure: the standard pool and the duel pack as a whole, where one question's checks cannot see. Every
   question in the pool already passed the flaw checks, the model review and the bar; this asks what the set looks like
   (scripts/mcq-audit.mjs writes it to data/mcq/audit.json and docs/mcq-audit.md).

   formats     how many questions fit each answer-time format (the duel's Rapid 15 s, Standard 30 s, Long case 90 s: a
               question fits when reading it takes at most two thirds of the time), per kind and per topic, and the
               topics too thin to deal a 10-question duel in a format
   cues        how often the key is the longest option (chance is 1 in the number of options), where the key sits, and
               how often each flaw check still fires on a pooled question (a minor flaw passes the bar)
   duplicates  pairs of different questions whose stems share most of their word runs (two items on one patient)
   review      what the model review recommended for the pooled questions (accept, revise), its solve agreement and
               its rubric scores, per kind

   auditPool(pool, { pack, verdicts, fits, readSecs, formats }) -> report; fits/readSecs/formats come from the vendored
   duel package (duel/core.mjs), so the audit and the duel time questions the same way. */

import { flawReport, keyIsLongest, shingles, containment } from '../../public/js/mcq/flaws.mjs';
import { taxonomyCounts, taxonomyProblems } from '../../public/js/mcq/taxonomy.mjs';

export const THIN = 10;                 /* a topic with fewer fitting questions than the duel's longest pick is thin */
export const DUP_AT = 0.5;              /* stems sharing half their word triples are near-duplicates */
const round1 = x => Math.round(x * 10) / 10;
const pct = (n, d) => (d ? round1((100 * n) / d) : null);
const median = xs => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
const p90 = xs => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(0.9 * (s.length - 1))] : null; };
const kindOf = q => q?.provenance?.kind || q?.source || 'unknown';
const count = (xs, f) => xs.reduce((m, x) => { const k = f(x); m[k] = (m[k] || 0) + 1; return m; }, {});


/* the key is the longest option by characters, with no tie */
export const keyLongest = keyIsLongest;

export function formatsOf(list, { fits, readSecs, formats, topicOf = q => q.topic || 'No topic' }) {
  const out = {};
  for (const f of formats) {
    const fit = list.filter(q => fits(q, f.secs));
    const byTopic = count(fit, topicOf), all = count(list, topicOf);
    const thin = Object.keys(all).filter(t => (byTopic[t] || 0) < THIN).sort();
    out[f.secs] = { name: f.name, fit: fit.length, of: list.length, share: pct(fit.length, list.length), byKind: count(fit, kindOf), byTopic, topics: Object.keys(all).length, thin };
  }
  const read = list.map(q => readSecs(q));
  return { formats: out, readSecs: { median: median(read), p90: p90(read), max: read.length ? Math.max(...read) : null } };
}

/* the cues of each group: key-longest against chance, key position, option count, the flaw checks still firing.
   asItem turns a group's question into the flaw checks' shape (a pack question keeps its explanation as why) */
export function cuesOf(list, groupOf, asItem = q => q) {
  const cues = {};
  for (const k of [...new Set(list.map(groupOf))].sort()) {
    const l = list.filter(q => groupOf(q) === k), n = l.length, chance = n ? round1(100 * l.reduce((s, q) => s + 1 / q.options.length, 0) / n) : null;
    const fired = {};
    for (const q of l) for (const r of flawReport(asItem(q)).failed) fired[r.check] = (fired[r.check] || 0) + 1;
    cues[k] = { n, keyLongest: pct(l.filter(keyLongest).length, n), chance, keyAt: count(l, q => 'ABCDEFGH'[q.answer]), options: count(l, q => q.options.length), checks: Object.fromEntries(Object.entries(fired).sort((a, b) => b[1] - a[1]).map(([id, c]) => [id, { n: c, share: pct(c, n) }])) };
  }
  return cues;
}
/* pairs of different questions whose stems share most of their word triples; with groupOf, whether they came by
   different routes (the same case written twice by two writers) */
export function duplicatesOf(list, groupOf = () => '') {
  const sh = list.map(q => shingles(q.stem)), out = [];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const o = sh[i].size && sh[j].size ? containment(sh[i], sh[j]) : 0;
    if (o >= DUP_AT) out.push({ a: list[i].id, b: list[j].id, overlap: round1(o * 100), ...(groupOf(list[i]) !== groupOf(list[j]) ? { across: [groupOf(list[i]), groupOf(list[j])] } : {}) });
  }
  return out.sort((x, y) => y.overlap - x.overlap || (x.a < y.a ? -1 : 1));
}
const packItem = q => ({ id: q.id, stem: q.stem, options: q.options, answer: q.answer, explanation: q.why || '', tags: q.tags || [] });
const routeOf = q => (q.source === 'ai' ? (q.id.startsWith('hy-') ? 'ai high-yield' : q.station ? 'ai station' : 'ai pool') : q.source || 'unknown');

export function auditPool(pool, { pack = null, verdicts = {}, funnel = null, tags = null, fits, readSecs, formats }) {
  const qs = pool?.questions || [], kinds = [...new Set(qs.map(kindOf))].sort();
  const per = k => qs.filter(q => kindOf(q) === k);
  const cues = cuesOf(qs, kindOf);
  const duplicates = duplicatesOf(qs);
  /* what the model review said of the pooled questions */
  const review = {};
  for (const k of kinds) {
    const vs = per(k).map(q => verdicts[q.id]).filter(Boolean), n = vs.length;
    const agreed = vs.filter(v => (v.solves || []).length && v.solves.every(s => s.answer === v.solves[0].answer)).length;
    const r = f => median(vs.map(v => v.rubric?.[f]).filter(Number.isFinite));
    review[k] = { judged: n, verdict: count(vs, v => v.rubric?.verdict || 'none'), solvesAgree: pct(agreed, n), median: { single_best: r('single_best'), distractors: r('distractors'), relevance: r('relevance'), accuracy: r('accuracy'), explanation: r('explanation') } };
  }
  const out = { pool: { n: qs.length, byKind: count(qs, kindOf), ...formatsOf(qs, { fits, readSecs, formats }) }, cues, duplicates, review };
  if (funnel) out.funnel = funnelRates(funnel);
  if (pack && tags) out.pack_categorised = categorised(pack.questions || [], tags);
  if (pack) {
    const pq = pack.questions || [], dups = duplicatesOf(pq, routeOf);
    out.pack = { n: pq.length, bySource: count(pq, q => q.source || q.origin || 'unknown'), byRoute: count(pq, routeOf), ...formatsOf(pq, { fits, readSecs, formats }),
      taxonomy: taxonomyCounts(pq), uncategorised: pq.filter(q => taxonomyProblems(q).length).map(q => q.id).slice(0, 20),
      cues: cuesOf(pq, routeOf, packItem), duplicates: { n: dups.length, across: dups.filter(d => d.across).length, top: dups.slice(0, 20) } };
  }
  return out;
}

/* the selector's funnel (lib/mcq-select.mjs funnelOf: per route, how many stopped at each stage) with its two rates:
   passed, the share of the reviewed that cleared the review and the bar (what the route's writing is worth), and
   admitted, the share of all its candidates now in the pool */
export function funnelRates(funnel) {
  const out = {};
  for (const [route, f] of Object.entries(funnel)) {
    const g = k => f[k] || 0, reviewed = f.n - g('schema') - g('flaws') - g('pending'), cleared = g('banned') + g('duplicate') + g('reserve') + g('pool');
    out[route] = { ...f, reviewed, passed: pct(cleared, reviewed), admitted: pct(g('pool'), f.n) };
  }
  return out;
}

/* how the duel's years and difficulties were set: by the model (scripts/tag-years.mjs, tags.years / tags.difficulty) or
   by the fallback guess, and how often the guess agrees with the model where both exist, which says how far a guessed
   one (a question written since the last tagging run) can be trusted */
export function categorised(questions, { years = {}, difficulty = {}, kinds = {}, pooled = null, guessYear, guessDiff }) {
  const n = questions.length, yt = questions.filter(q => years[q.id]), dt = questions.filter(q => difficulty[q.id]);
  const fromPool = pooled ? questions.filter(q => pooled.has(q.id)) : [], kindUntagged = fromPool.filter(q => !kinds[q.id]).length;
  const agree = (list, map, guess, within = 0) => pct(list.filter(q => Math.abs(guess(q) - map[q.id]) <= within).length, list.length);
  return { n, yearTagged: yt.length, diffTagged: dt.length, pooled: fromPool.length, kindUntagged, yearGuessAgrees: agree(yt, years, guessYear), yearGuessWithinOne: agree(yt, years, guessYear, 1), diffGuessAgrees: agree(dt, difficulty, guessDiff) };
}

/* the report as Markdown: short; the numbers live in audit.json */
export function auditMarkdown(a, { date = '' } = {}) {
  const L = [];
  const fmtRow = (label, f) => `| ${label} | ${Object.values(f.formats).map(x => `${x.fit} of ${x.of} (${x.share}%)`).join(' | ')} | ${f.readSecs.median} / ${f.readSecs.p90} s |`;
  const names = Object.values(a.pool.formats).map(x => `${x.name} ${Object.keys(a.pool.formats).find(k => a.pool.formats[k] === x)} s`);
  L.push('# MCQ audit', '', `Written by \`node scripts/mcq-audit.mjs\`${date ? ` on ${date}` : ''} from the standard pool (\`public/mcq/pool.json\`) and the duel pack (\`public/duel/pack.json\`). Every pooled question has passed the flaw checks, the model review and the bar; this looks at the set as a whole. The numbers are in \`data/mcq/audit.json\`.`, '');
  L.push('## Answer-time formats', '', 'A question fits a format when reading it (4 words a second past the first 12, options included) takes at most two thirds of the time, leaving a third to think. The duel deals fitting questions first and gives the rest time to read.', '');
  L.push(`| | ${names.join(' | ')} | reading, median / 90th |`, `|---|${names.map(() => '---').join('|')}|---|`, fmtRow('pool', a.pool));
  if (a.pack) L.push(fmtRow('duel pack', a.pack));
  L.push('');
  for (const [secs, f] of Object.entries((a.pack || a.pool).formats)) {
    const kinds = Object.entries(f.byKind).map(([k, n]) => `${k} ${n}`).join(', ') || 'none';
    L.push(`- **${f.name} (${secs} s)**: ${kinds}. ${f.thin.length ? `Thin (under ${THIN} fitting) in ${f.thin.length} of ${f.topics} topics: ${f.thin.slice(0, 12).join(', ')}${f.thin.length > 12 ? ', …' : ''}.` : 'Every topic can deal 10.'}`);
  }
  if (a.pack) {
    const t = a.pack.taxonomy, row = o => Object.entries(o).sort((x, y) => y[1] - x[1]).map(([k, n]) => `${k} ${n}`).join(', ');
    L.push('', '## Every question in the duel, by its categories (mcq/taxonomy.mjs)', '', `${a.pack.n} questions; ${t.problems ? `**${t.problems} not fully categorised**` : 'every one fully categorised'} (source, origin, credit, specialty, kind, year, difficulty; \`npm test\` fails on any gap).`, '',
      `- **Source**: ${row(t.source)}`, `- **Route**: ${row(a.pack.byRoute)}`, `- **Kind**: ${row(t.cat)}`, `- **Year**: ${Object.entries(t.year).sort().map(([k, n]) => `${k} ${n}`).join(', ')}`, `- **Difficulty**: ${Object.entries(t.difficulty).sort().map(([k, n]) => `${k} ${n}`).join(', ')}`,
      `- **Specialties**: ${Object.keys(t.topic).length}; the five largest ${Object.entries(t.topic).sort((x, y) => y[1] - x[1]).slice(0, 5).map(([k, n]) => `${k} ${n}`).join(', ')}; the five smallest ${Object.entries(t.topic).sort((x, y) => x[1] - y[1]).slice(0, 5).map(([k, n]) => `${k} ${n}`).join(', ')}`);
    const c = a.pack_categorised;
    if (c) L.push('', `**Years and difficulties** (\`scripts/tag-years.mjs\`): the model set the year of ${c.yearTagged} of ${c.n} and the difficulty of ${c.diffTagged}; the rest use the fallback guess. Where both exist, the guessed year matches the model's in ${c.yearGuessAgrees}% (within a year in ${c.yearGuessWithinOne}%) and the guessed difficulty in ${c.diffGuessAgrees}%: run the tagger after new questions are written. Of the ${c.pooled} pooled questions, ${c.kindUntagged ? `**${c.kindUntagged} are filed clinical by default**` : 'every one has its kind from the tagger'} (\`tag-years.mjs --kinds\`).`);
    L.push('', '## Cues and residual flaws in the duel, by route', '', 'The same checks the pool uses, run over every question the duel can deal, whichever writer made it.', '', '| route | n | key is the longest option | chance | key position | checks firing (share of the route) |', '|---|---|---|---|---|---|');
    for (const [k, c] of Object.entries(a.pack.cues)) L.push(`| ${k} | ${c.n} | ${c.keyLongest}% | ${c.chance}% | ${Object.entries(c.keyAt).sort().map(([p, n]) => `${p} ${n}`).join(', ')} | ${Object.entries(c.checks).slice(0, 4).map(([id, x]) => `${id} ${x.share}%`).join(', ') || 'none'} |`);
    const d = a.pack.duplicates;
    L.push('', `Near-duplicate stems in the duel: ${d.n} pair${d.n === 1 ? '' : 's'}, ${d.across} of them across routes (two writers making the same case).`);
    for (const x of d.top.slice(0, 10)) L.push(`- ${x.a} and ${x.b}: ${x.overlap}%${x.across ? ` (${x.across.join(' / ')})` : ''}`);
  }
  if (a.funnel) {
    const cols = ['schema', 'flaws', 'pending', 'review', 'bar', 'duplicate', 'reserve', 'pool'];
    L.push('', '## From candidate to pool, by route', '', 'Where each route\'s candidates stopped (lib/mcq-select.mjs, the stages in order). **Passed** is the share of the reviewed that cleared the review and the bar: what the route\'s writing is worth. **Admitted** is the share of all its candidates in the pool; a passed question left out is on reserve behind its quota or its topic\'s cap.', '',
      `| route | candidates | ${cols.join(' | ')} | passed | admitted |`, `|---|---|${cols.map(() => '---').join('|')}|---|---|`);
    for (const [r, f] of Object.entries(a.funnel)) L.push(`| ${r} | ${f.n} | ${cols.map(c => f[c] || 0).join(' | ')} | ${f.reviewed ? `${f.passed}%` : '-'} | ${f.admitted}% |`);
  }
  L.push('', '## Cues and residual flaws in the pool', '', '| kind | n | key is the longest option | chance | key position | checks still firing (share of the kind) |', '|---|---|---|---|---|---|');
  for (const [k, c] of Object.entries(a.cues)) L.push(`| ${k} | ${c.n} | ${c.keyLongest}% | ${c.chance}% | ${Object.entries(c.keyAt).sort().map(([p, n]) => `${p} ${n}`).join(', ')} | ${Object.entries(c.checks).slice(0, 4).map(([id, x]) => `${id} ${x.share}%`).join(', ') || 'none'} |`);
  L.push('', '## Near-duplicate stems', '', a.duplicates.length ? `${a.duplicates.length} pair${a.duplicates.length === 1 ? '' : 's'} share at least ${DUP_AT * 100}% of their word triples:` : `No two pooled questions share ${DUP_AT * 100}% of their word triples.`);
  for (const d of a.duplicates.slice(0, 15)) L.push(`- ${d.a} and ${d.b}: ${d.overlap}%`);
  L.push('', '## The model review of the pooled questions', '', '| kind | judged | verdicts | both solves agree | single best | distractors | relevance | accuracy | explanation |', '|---|---|---|---|---|---|---|---|---|');
  for (const [k, r] of Object.entries(a.review)) L.push(`| ${k} | ${r.judged} | ${Object.entries(r.verdict).map(([v, n]) => `${v} ${n}`).join(', ')} | ${r.solvesAgree}% | ${r.median.single_best} | ${r.median.distractors} | ${r.median.relevance} | ${r.median.accuracy} | ${r.median.explanation} |`);
  L.push('', 'Rubric scores are medians on the review\'s 1 to 5 scale.', '');
  return L.join('\n');
}
