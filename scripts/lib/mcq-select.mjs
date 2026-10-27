/* lib/mcq-select.mjs - which candidates enter the standard pool (public/mcq/pool.json), and why every other one did not.

   For each candidate, in order (the first that fails is its reason; every failed check is listed too):
     1 schema       public/js/mcq/schema.mjs itemProblems (a licence the pool accepts, a named source, a key)
     2 flaws        public/js/mcq/flaws.mjs: a "block" failure refuses it; the rest give the flaw score (0..100)
     3 judged       a current verdict from scripts/mcq-judge.mjs for this exact text; none yet = pending
     4 judge gates  the key judged wrong, unsafe, not a single best answer, solved to another answer both times, or
                    rejected by the reviewer; AI-written (ai, amsa) must be solved to the key both times
     5 the bar      quality = 0.4 x flaw score + 0.6 x judge score, against the bar calibrated on the benchmarks
                    (a close call, within CLOSE points of its bar, gets a second review: the judge score is then the
                    mean of the two, and either review's gates refuse it; mcq-evals --retest found the review drifts
                    2 points on average, 5 at the 90th percentile, and 10% of questions crossing the bar on a rerun)
                    (data/mcq/calibration.json): the base bar for user, usmle-resource and amsa items, a higher one for
                    ai (a model writing freely)
   Then, over everything that passed, best first within each kind:
     6 duplicates   a near-duplicate (word 3-gram Jaccard or containment of the question, or the same case with an
                    equivalent key: flaws.mjs DUP) of a question already admitted
                    is refused; user questions are admitted first, so a user's question is never displaced
     7 quotas       user questions that pass are always kept; each other kind has a cap (QUOTA), and no topic may hold
                    more than TOPIC_SHARE of the non-user questions. A question over a cap is "reserve": it passed, and
                    takes the place of one that drops out on the next rebuild
   Provenance is copied as it came; the selector only adds `eval`. Pure. */
import { cleanItem, itemProblems, KINDS } from '../../public/js/mcq/schema.mjs';
import { flawReport, signature, nearDuplicate, positionBalance, EVAL_VERSION } from '../../public/js/mcq/flaws.mjs';
import { verdictFor, judgeScore, judgeGates, solved, JUDGE_VERSION } from './mcq-judge.mjs';

export const PRIORITY = Object.freeze(['user', 'usmle-resource', 'open-exam', 'amsa', 'ai']);
export const QUOTA = Object.freeze({ 'usmle-resource': 160, 'open-exam': 120, amsa: 110, ai: 110, 'ai-rapid': 260 });   /* ai-rapid 80 -> 200 (2026-10-26): the first 80 filled it with 25 more passing, and 10 a topic in each of 44 topics needs more short questions than the bank's 662. 200 -> 260 (2026-10-27): full again with 35 passing on reserve, 15 of them in topics too thin to deal a Rapid duel; at 260 the thin topics at 15 s go from 14 to 8. A topic floor inside the quota was tried and changed nothing (it only reshuffles a full quota) */
/* the quota a question counts against: AI-written questions in the Rapid form (tag form:rapid, for the duel's 15 s
   format) have their own, so short questions and vignettes do not crowd each other out */
export const quotaOf = a => (a.kind === 'ai' && Array.isArray(a.q?.tags) && a.q.tags.includes('form:rapid') ? 'ai-rapid' : a.kind);
const QUOTA_NAME = { 'ai-rapid': 'AI-written Rapid' };
/* the route a candidate came by, finer than its kind: the open set it was taken from (its src: tag), or, for AI-written
   questions, the form it was written in. The audit's funnel (lib/mcq-audit.mjs) reads it to say which route earns its keep */
export const routeOf = q => {
  const tags = Array.isArray(q?.tags) ? q.tags : [], kind = q?.provenance?.kind || 'unknown', src = tags.find(t => t.startsWith('src:'));
  if (src) return `${kind} ${src.slice(4)}`;
  if (kind === 'ai') return tags.includes('form:rapid') ? 'ai rapid' : 'ai vignette';
  return kind;
};
/* the stage a candidate stopped at, in the order above; "pool" when it got in */
export const STAGES = Object.freeze(['schema', 'flaws', 'pending', 'review', 'bar', 'banned', 'duplicate', 'reserve', 'pool']);
export const TOPIC_SHARE = 0.15;
export const DEFAULT_BARS = Object.freeze({ base: 70, ai: 80 });
export const quality = (flaw, judge) => Math.round(0.4 * flaw + 0.6 * judge);
/* AI-written text (ai, and amsa: an AMSA case in an AI-written station) must be solved to its key both times; the higher
   quality bar is for kind ai, a model writing freely. An amsa question is made in code from the station's own
   differential, so it is held to the base bar (docs/mcq.md) */
const aiWritten = q => q.provenance?.kind === 'ai' || q.provenance?.kind === 'amsa';
const aiBar = q => q.provenance?.kind === 'ai';

/* a close call's second review, kept inside its first verdict (verdict.second) for the same text */
export const CLOSE = 5;
export const secondFor = v => (v?.second && v.second.hash === v.hash ? v.second : null);
/* the candidates whose fate a second review could change: reviewed once, past the gates, within `pts` of the bar */
export function closeCalls(candidates, { verdicts = {}, bars = DEFAULT_BARS, pts = CLOSE } = {}) {
  return candidates.map(c => assess(c, { verdicts, bars })).filter(a => a.reviews === 1 && (a.stage === 'pass' || a.stage === 'bar') && Math.abs(a.quality - a.bar) <= pts).map(a => a.q);
}

/* one candidate on its own (steps 1-5) -> { id, kind, status: 'pass'|'rejected'|'pending', reasons, ... } */
export function assess(raw, { verdicts = {}, bars = DEFAULT_BARS } = {}) {
  const id = String(raw?.id || '?'), kind = Object.hasOwn(KINDS, raw?.provenance?.kind) ? raw.provenance.kind : 'unknown';
  const q = cleanItem(raw);
  if (!q) return { id, kind, route: routeOf(raw), stage: 'schema', status: 'rejected', reasons: itemProblems(raw || {}), flaws: [] };
  const rep = flawReport(q), flaws = rep.failed.map(f => ({ check: f.check, severity: f.severity, reason: f.reason }));
  const base = { id, kind, route: routeOf(q), q, flaws, flawScore: rep.score };
  if (rep.blocked) return { ...base, stage: 'flaws', status: 'rejected', reasons: rep.failed.filter(f => f.severity === 'block').map(f => f.reason) };
  const v = verdictFor(verdicts, q);
  if (!v) return { ...base, stage: 'pending', status: 'pending', reasons: ['waiting for the model review (node scripts/mcq-judge.mjs)'] };
  const second = secondFor(v), bar = aiBar(q) ? bars.ai : bars.base;
  const js = second ? Math.round((judgeScore(v, q) + judgeScore(second, q)) / 2) : judgeScore(v, q), score = quality(rep.score, js);
  const out = { ...base, verdict: v, judgeScore: js, quality: score, bar, reviews: second ? 2 : 1 };
  const gates = [...new Set([v, ...(second ? [second] : [])].flatMap(x => judgeGates(x, q, { strict: aiWritten(q) })))];
  if (gates.length) return { ...out, stage: 'review', status: 'rejected', reasons: gates };
  if (score < bar) return { ...out, stage: 'bar', status: 'rejected', reasons: [`quality ${score} is below the ${aiBar(q) ? 'AI-written' : 'base'} bar of ${bar} (flaws ${rep.score}, review ${js})${rep.failed.length ? `: ${rep.failed.filter(f => f.severity !== 'info').map(f => f.check).join(', ')}` : ''}`] };
  return { ...out, stage: 'pass', status: 'pass', reasons: [] };
}

/* the question as the pool holds it: as it came, its topic filled from the review when it had none, and the eval */
export function poolItem(a) {
  const q = a.q, r = a.verdict.rubric, topic = q.topic || r.topic || 'General Practice';
  return {
    ...q, topic,
    eval: {
      flaws: a.flaws.filter(f => f.severity !== 'info').map(f => `${f.check}:${f.severity}`), flawScore: a.flawScore, judgeScore: a.judgeScore, quality: a.quality, bar: a.bar,
      solved: solved(a.verdict, q), keyCorrect: r.key_correct, singleBest: r.single_best, review: r.verdict, judge: a.verdict.judge, reviews: a.reviews,
      ...(q.topic ? {} : { topicFrom: 'review' }), verdict: 'pool', reasons: [], evaluatedAt: a.verdict.at, evalVersion: `${EVAL_VERSION}+${JUDGE_VERSION}`
    }
  };
}

/* the whole selection -> { pool: [...items], decisions: [{ id, kind, status, reasons, quality? }], stats } */
export function select(candidates, { verdicts = {}, bars = DEFAULT_BARS, quota = QUOTA, topicShare = TOPIC_SHARE, banned = null } = {}) {
  const assessed = candidates.map(c => assess(c, { verdicts, bars }));
  if (banned) for (const a of assessed) if (a.q && a.status !== 'rejected') { const hit = banned(a.q); if (hit) Object.assign(a, { stage: 'banned', status: 'rejected', reasons: [hit] }); }
  const rank = (x, y) => PRIORITY.indexOf(x.kind) - PRIORITY.indexOf(y.kind) || y.quality - x.quality || (x.id < y.id ? -1 : 1);
  const passing = assessed.filter(a => a.status === 'pass').sort(rank), admitted = [], sigs = [];
  /* 6: duplicates, best first; a user's question is checked first, so it is the one kept */
  for (const a of passing) {
    const sig = signature(a.q), dup = sigs.findIndex(s => nearDuplicate(sig, s).dup);
    if (dup >= 0) { Object.assign(a, { stage: 'duplicate', status: 'rejected', twin: admitted[dup], sig, reasons: [`a near-duplicate of ${admitted[dup].id}, which is kept (${PRIORITY.indexOf(admitted[dup].kind) < PRIORITY.indexOf(a.kind) ? 'its source ranks first' : 'it scores higher'})`] }); continue; }
    admitted.push(a); sigs.push(sig);
  }
  /* 7: quotas and topic balance (users are exempt from both) */
  const users = admitted.filter(a => a.kind === 'user'), rest = admitted.filter(a => a.kind !== 'user');
  const room = Object.fromEntries(Object.entries(quota).map(([k, n]) => [k, Math.min(n, rest.filter(a => quotaOf(a) === k).length)]));
  const topicCap = Math.max(6, Math.ceil(topicShare * Object.values(room).reduce((s, n) => s + n, 0)));
  const used = {}, perTopic = {}, kept = [...users];
  for (const a of rest.sort((x, y) => y.quality - x.quality || rank(x, y))) {
    const topic = a.q.topic || a.verdict.rubric.topic || 'General Practice';
    const qk = quotaOf(a);
    if ((used[qk] || 0) >= (quota[qk] ?? Infinity)) { Object.assign(a, { stage: 'reserve', status: 'reserve', reasons: [`passed (quality ${a.quality}), but the ${QUOTA_NAME[qk] || KINDS[a.kind]} quota of ${quota[qk]} is full`] }); continue; }
    if ((perTopic[topic] || 0) >= topicCap) { Object.assign(a, { stage: 'reserve', status: 'reserve', reasons: [`passed (quality ${a.quality}), but ${topic} already holds ${topicCap} questions (topic balance)`] }); continue; }
    used[qk] = (used[qk] || 0) + 1; perTopic[topic] = (perTopic[topic] || 0) + 1; kept.push(a);
  }
  /* 6 again: a near-duplicate whose twin went to reserve copies nothing in the pool, so it has its own chance, unless
     it copies another question that is kept */
  const keptSigs = kept.map(a => signature(a.q));
  for (const a of assessed.filter(x => x.twin && kept.indexOf(x.twin) < 0).sort((x, y) => y.quality - x.quality || rank(x, y))) {
    const other = keptSigs.findIndex(sg => nearDuplicate(a.sig, sg).dup);
    if (other >= 0) { a.reasons = [`a near-duplicate of ${kept[other].id}, which is kept`]; continue; }
    const topic = a.q.topic || a.verdict.rubric.topic || 'General Practice', qk = quotaOf(a);
    if (a.kind !== 'user' && ((used[qk] || 0) >= (quota[qk] ?? Infinity) || (perTopic[topic] || 0) >= topicCap)) { Object.assign(a, { stage: 'reserve', status: 'reserve', reasons: [`passed (quality ${a.quality}); its near-duplicate ${a.twin.id} is on reserve, and there is no room for either`] }); continue; }
    if (a.kind !== 'user') { used[qk] = (used[qk] || 0) + 1; perTopic[topic] = (perTopic[topic] || 0) + 1; }
    kept.push(a); keptSigs.push(a.sig); a.reasons = [];
  }
  for (const a of assessed) { delete a.twin; delete a.sig; }
  for (const a of kept) a.status = a.stage = 'pool';
  const pool = kept.map(a => poolItem(a)).sort((x, y) => (x.id < y.id ? -1 : 1));
  const decisions = assessed.map(a => ({ id: a.id, kind: a.kind, route: a.route, stage: a.stage, status: a.status, reasons: a.reasons, ...(a.quality != null ? { quality: a.quality } : {}), ...(a.flaws?.length ? { flaws: a.flaws.filter(f => f.severity !== 'info').map(f => `${f.check}:${f.severity}`) } : {}) }))
    .sort((x, y) => (x.id < y.id ? -1 : 1));
  const count = (list, key) => list.reduce((m, x) => ((m[key(x)] = (m[key(x)] || 0) + 1), m), {});
  const stats = {
    candidates: count(assessed, a => a.kind), pool: count(pool, q => q.provenance.kind), status: count(decisions, d => d.status),
    topics: count(pool, q => q.topic), positions: positionBalance(pool), topicCap, bars, funnel: funnelOf(decisions)
  };
  return { pool, decisions, stats };
}

/* per route, how many candidates stopped at each stage -> { route: { n, schema, flaws, ..., pool } } (stages with none
   left out) */
export function funnelOf(decisions) {
  const out = {};
  for (const d of decisions) {
    const r = (out[d.route || d.kind] ||= { n: 0 });
    r.n++; r[d.stage || d.status] = (r[d.stage || d.status] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(out).sort((x, y) => y[1].n - x[1].n || (x[0] < y[0] ? -1 : 1)));
}

/* what a submitter sees: one line per user question */
export const statusOf = decisions => Object.fromEntries(decisions.filter(d => d.kind === 'user').map(d => [d.id, { status: d.status === 'reserve' ? 'pool-reserve' : d.status, reasons: d.reasons }]));
