/* lib/mcq-generate.mjs - writing a new Step 2 CK-style question from a station, checked before it is kept:
     1 exemplars  three MedQA "step2&3" items close to the station's subject that pass every major flaw check, as the
                  benchmark for style (vignette, lead-in, five homogeneous options), never for content
     2 draft      the station (its case, differential, Part 2 results, learning points, guidelines) and a focus that is
                  not the station's own duel question (that one asks the diagnosis): management, investigation,
                  interpretation or a complication -> one question with a key, an explanation and a reason per option
     3 flaws      public/js/mcq/flaws.mjs; a major or block failure gets one revision with the reasons, then the checks
                  again; a question still failing is not kept
   Every kept question is kind "ai" with its basis (the station, and the station's duel question) and its exemplars,
   and it still has to pass the model judge and the selector's bar before it reaches the pool. Every Claude call goes
   through `ask`, so the flow is tested with a stub. Pure apart from `ask`. */
import { cleanItem, fnv, LETTERS } from '../../public/js/mcq/schema.mjs';
import { flawReport, content, keyIsLongest, signature, nearDuplicate } from '../../public/js/mcq/flaws.mjs';
import { SPECIALTIES } from './mcq-judge.mjs';
import { spreadKey } from './mcq-sources.mjs';
import { fits, readSecs } from '../../public/js/vendor/pup-duel/duel/core.mjs';
import { plain } from '../../public/js/study-kit/safe.mjs';

export const GEN_VERSION = 'generate-mcq-2';
/* the form a question is written in (founder 2026-10-26: questions that fit the duel's 15 s, 30 s and 1.5 min formats):
   vignette  a Step 2 CK case, 80 to 160 words before the lead-in: Long case, or Standard when it is short
   rapid     a compact case a student reads in about 10 s (at most 52 words with its options), for Rapid 15 s; it must
             fit 15 s by the duel's own rule (vendored pup-duel fits), checked here before it is kept */
export const FORMS = Object.freeze({ vignette: { secs: null }, rapid: { secs: 15 } });
export const FOCUS = Object.freeze({
  management: 'the most appropriate next step in management (or the most appropriate treatment)',
  investigation: 'the most appropriate next investigation, or the test most likely to confirm the diagnosis',
  interpretation: 'interpreting one of the Part 2 results (what the result shows, or what it means for this patient)',
  complication: 'the complication or risk this patient is most at risk of, or the most important thing to prevent or counsel about'
});
const strip = plain;   /* station HTML as text: the study kit's one helper (study-kit/safe.mjs) */

/* the station as the writer needs it: plain text, no patient script verbatim */
export function stationBrief(st) {
  const d = st.demo || {}, p2 = st.part2 || {};
  const res = (p2.handover || []).map(h => `- ${h.label}: ${strip(h.result).slice(0, 500)}${h.labs ? ` ${h.labs.flatMap(t => t.rows || []).map(r => `${r.t} ${[].concat(r.v).join('/')}${r.u ? ` ${r.u}` : ''}`).join('; ').slice(0, 600)}` : ''}${h.model ? ` (interpretation: ${strip(h.model).slice(0, 300)})` : ''}`);
  return [`Station ${st.id}: ${strip(st.title)}`, `Patient: ${d.age ?? '?'} ${d.unit || 'years'}, sex ${d.sex || '?'}, setting ${d.setting || '?'}`,
    `Summary: ${strip(st.desc)}`, `Diagnosis: ${(st.diagnosis || []).join('; ')}`,
    `Differential: ${(st.ddx || []).map(x => `${strip(x.dx)} (${x.tier}${x.for ? `; for: ${strip(x.for)}` : ''}${x.against ? `; against: ${strip(x.against)}` : ''})`).join(' | ').slice(0, 2500)}`,
    res.length ? `Part 2 results:\n${res.join('\n')}` : '', `Learning points: ${(st.points || []).map(strip).join(' | ').slice(0, 1500)}`,
    `Explanation: ${strip(st.explain).slice(0, 2000)}`, `Guidelines: ${(st.refs || []).map(r => strip(typeof r === 'string' ? r : r.t || r.title || '')).join('; ').slice(0, 600)}`].filter(Boolean).join('\n');
}

/* the exemplars: the benchmark items sharing most subject words with the station, among those with no major flaw */
export function exemplarsFor(st, bench, k = 3) {
  const words = new Set(content(`${st.title} ${(st.diagnosis || []).join(' ')} ${(st.presentation || []).join(' ')} ${(st.specialty || []).join(' ')}`));
  const clean = bench.filter(q => !flawReport(q).failed.some(f => f.severity === 'major' || f.severity === 'block'));
  return clean.map(q => ({ q, n: content(q.stem).filter(w => words.has(w)).length, h: fnv(`${st.id}:${q.id}`) }))
    .sort((a, b) => b.n - a.n || a.h.localeCompare(b.h)).slice(0, k).map(x => x.q);
}

export const WRITER_SYSTEM = `You write single-best-answer questions in the style of USMLE Step 2 Clinical Knowledge, following the NBME item-writing guide, for Australian medical students. Each question:
- is a clinical vignette in this order: age and sex, setting, presenting complaint and its history, relevant past history and medicines, examination findings (vital signs with units), then investigation results (with units and, where it helps, reference ranges);
- is 80 to 160 words before the lead-in (the Step 2 CK median is about 140), with only the findings the question needs;
- ends with a lead-in that is one closed question a student could answer with the options covered ("Which of the following is the most appropriate next step in management?");
- has exactly five options of the same kind (all diagnoses, all drugs, all tests), similar in length and grammar, the key never the longest, none "all/none of the above", no negatives, no absolute words, no word of the key repeated from the stem;
- has one answer that is clearly best by current Australian guidelines (eTG, RCH, RANZCOG, state health guidelines) and four distractors a weaker student would pick, each wrong for a clear reason;
- has an explanation that says why the key is right and a one-sentence reason why each other option is wrong.
Write a new patient: do not copy the station's script, and do not copy the example questions; they show the style only. Plain text, no markup.`;
export const RAPID_SYSTEM = `You write short single-best-answer questions for a 15-second quiz round, for Australian medical students, in the spirit of USMLE Step 2 Clinical Knowledge and the NBME item-writing guide. Each question:
- is a compact clinical case of 18 to 32 words before the lead-in: age and sex, then the presenting problem and only the one or two findings that decide the answer (a vital sign or result with its unit if it is one of them);
- ends with a short closed lead-in ("Most likely diagnosis?", "Most appropriate next step?", "Which drug is first line?");
- has exactly five options of the same kind, each one to four words, similar in length, the key never the longest, none "all/none of the above", no negatives, no absolute words;
- can be read with its options in about ten seconds: at most 52 words in all;
- has one answer that is clearly best by current Australian guidelines (eTG, RCH, RANZCOG, state health guidelines) and four plausible distractors, each wrong for a clear reason;
- has an explanation of one to three sentences, and a one-sentence reason why each other option is wrong.
It tests one decisive piece of clinical reasoning, not trivia. Write a new patient: do not copy the station's script or the examples. Plain text, no markup.`;
export const systemFor = form => (form === 'rapid' ? RAPID_SYSTEM : WRITER_SYSTEM);
export const ITEM_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['stem', 'ask', 'options', 'answer', 'explanation', 'why', 'topic'],
  properties: {
    stem: { type: 'string' }, ask: { type: 'string' }, options: { type: 'array', items: { type: 'string' }, minItems: 5, maxItems: 5 },
    answer: { type: 'string', enum: [...LETTERS] }, explanation: { type: 'string' }, why: { type: 'array', items: { type: 'string' }, minItems: 5, maxItems: 5 },
    topic: { type: 'string', enum: [...SPECIALTIES] }
  }
};
const exText = q => `${q.stem}\n${q.options.map((o, i) => `${LETTERS[i]}. ${o}`).join('\n')}\nKey: ${LETTERS[q.answer]}`;
/* a specialty with no Med-OS station (the duel thin there, founder 2026-10-26): a stand-in the writer works from, one per
   variant, so a topic can have more than one question a focus. topicOnly marks it; avoid lists the lead-ins already
   written for it, so a second question asks something else */
export const topicStation = (spec, variant = 0, avoid = []) => ({ id: `topic-${spec.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${variant}`, title: spec, specialty: [spec], diagnosis: [], presentation: [], topicOnly: true, avoid });
export function writerPrompt(st, focus, ex, form = 'vignette') {
  if (st.topicOnly) return `Write one ${form === 'rapid' ? 'short (15-second) ' : ''}question in ${st.title} for Australian medical students, on a common or high-stakes problem a final-year student must recognise or manage in ${st.title}. It must test ${FOCUS[focus]}.
${st.avoid?.length ? `\nAlready written for ${st.title}, so ask about something else:\n${st.avoid.map(a => `- ${a}`).join('\n')}\n` : ''}
Example Step 2 CK questions, for style only${form === 'rapid' ? ' (yours is far shorter)' : ''}:
${ex.map((q, i) => `<example_${i + 1}>\n${exText(q)}\n</example_${i + 1}>`).join('\n')}

In "why", give one entry per option in order: for the key, why it is right; for each other option, why it is wrong.`;
  return `Write one ${form === 'rapid' ? 'short (15-second) ' : ''}question from this OSCE station. It must test ${FOCUS[focus]}; the station's own question already asks for the diagnosis.

<station>
${stationBrief(st)}
</station>
${st.avoid?.length ? `\nAlready written from this station, so ask for a different answer:\n${st.avoid.map(a => `- ${a}`).join('\n')}\n` : ''}
Example Step 2 CK questions, for style only${form === 'rapid' ? ' (yours is far shorter)' : ''}:
${ex.map((q, i) => `<example_${i + 1}>\n${exText(q)}\n</example_${i + 1}>`).join('\n')}

In "why", give one entry per option in order: for the key, why it is right; for each other option, why it is wrong.`;
}
export const reviseText = (draft, reasons) => `Revise this question. Fix every problem below and change nothing that is right. Return the whole question.
Problems found in code:
${reasons.map(r => `- ${r}`).join('\n')}

The question (JSON):
${JSON.stringify(draft)}`;

/* what is already written from a station (or for a stand-in's topic), as the writer is shown it: the lead-in and the
   key, so a new question asks for another answer (the same case asked for the same key twice is a near-duplicate the
   selector refuses, 2026-10-26) */
export const writtenFrom = (items, st, tagOf = t => t) => items
  .filter(q => q.provenance?.generator?.basis?.[0] === st.id || (st.topicOnly && (q.tags || []).includes(tagOf(`topic:${st.title}`))))
  .map(q => `${(q.ask || q.stem.slice(-120)).trim()} (answer: ${q.options[q.answer]})`);

/* the question a new one would twin, by the selector's own near-duplicate rule, or null. The writer is only shown what
   its station or topic has (writtenFrom), so a stand-in can retell a case written under another topic: on 2026-10-27
   an Oncology stand-in retold two Palliative Care questions' spinal cord compression, and the pool kept it in their
   place. Checked as each question is written, a twin is not kept and its slot goes to the next job */
export function twinOf(item, known) {
  const sig = signature(item);
  for (const k of known) if (k.id !== item.id && nearDuplicate(sig, k.sig).dup) return k.id;
  return null;
}
export const knownOf = items => items.map(q => ({ id: q.id, sig: signature(q) }));

/* the model's draft as a question: the key letter to an index, the key spread by the id's hash, the provenance */
export function toItem(draft, { st, focus, ex, how, model, now, form = 'vignette' }) {
  const id = `ai-mcq-${fnv(`${st.id}:${focus}:${form === 'vignette' ? '' : `${form}:`}${now}`)}`;
  const answer = LETTERS.indexOf(String(draft.answer || '').toUpperCase());
  const why = (draft.why || []).map((w, i) => (i === answer ? null : w));
  return cleanItem(spreadKey({
    id, stem: draft.stem, ask: draft.ask, options: draft.options, answer, explanation: draft.explanation, why,
    topic: draft.topic || st.specialty?.[0] || '', tags: ['generated', `focus:${focus}`, st.topicOnly ? `topic:${st.title}` : `station:${st.id}`, ...(form === 'vignette' ? [] : [`form:${form}`])].map(t => t.slice(0, 40)),
    provenance: { kind: 'ai', source: { name: st.topicOnly ? `Written by AI for ${st.title} (no Med-OS station)` : `Written by AI from Med-OS station ${st.id}`, url: '', licence: 'own' }, createdAt: now,
      generator: { how, version: GEN_VERSION, basis: st.topicOnly ? [st.id] : [st.id, `osce-${st.id}`], exemplars: ex.map(q => q.id), ...(model ? { model } : {}) } }
  }));
}
/* what a draft must fix before it is kept: a major or block flaw; the key as the single longest option (a cue a
   test-wise student uses: in the pool of 2026-10-26 the AI-written key was the longest 38% of the time against 20% by
   chance); and, for a form with a time, reading that does not fit it, as the duel reads it (stem and lead-in, options) */
export const keyLongest = keyIsLongest;
export const asDuel = q => ({ stem: q.ask ? `${q.stem} ${q.ask}` : q.stem, options: q.options });
export function blocking(q, form = 'vignette') {
  if (!q) return [{ reason: 'the draft is not a valid question (five options, a key, a stem)' }];
  const out = flawReport(q).failed.filter(f => f.severity === 'major' || f.severity === 'block');
  if (keyLongest(q)) out.push({ reason: 'The key is the longest option: make another option at least as long, or the key shorter, so length gives nothing away.' });
  const secs = FORMS[form]?.secs;
  if (secs && !fits(asDuel(q), secs)) out.push({ reason: `It takes ${readSecs(asDuel(q))} s to read at 4 words a second past the first 12: cut the case and the options to at most 52 words in all so it reads in ${Math.floor((secs * 2) / 3)} s.` });
  return out;
}

/* one question from one station -> { ok, item, problems, rounds } */
export async function writeMcq(st, focus, { bench, ask, how = 'api', now = new Date().toISOString(), log = () => {}, form = 'vignette' }) {
  const ex = exemplarsFor(st, bench), system = systemFor(form);
  let { value: draft, model } = await ask({ system, content: writerPrompt(st, focus, ex, form), schema: ITEM_SCHEMA, effort: 'high', label: `${st.id} ${focus} draft` });
  let item = toItem(draft, { st, focus, ex, how, model, now, form }), problems = blocking(item, form), rounds = 1;
  if (problems.length) {
    log(`${st.id} ${focus}: revising (${problems.map(p => p.reason).join('; ')})`);
    ({ value: draft, model } = await ask({ system, content: reviseText(draft, problems.map(p => p.reason)), schema: ITEM_SCHEMA, effort: 'high', label: `${st.id} ${focus} revise` }));
    item = toItem(draft, { st, focus, ex, how, model, now, form }); problems = blocking(item, form); rounds = 2;
  }
  return { ok: !problems.length, item, problems: problems.map(p => p.reason), rounds, draft };
}

/* the questions to write when filling the duel's gaps: for each thin topic (thinnest first: need says how many more
   it wants), its stations with each focus in turn, so a topic with two stations can still get eight questions;
   round-robin over the topics so one does not take every place; skip(st, focus) leaves out what is already written,
   so the run picks others instead. Pure */
export function gapJobs(stations, thin, need, n, focuses, focus, skip = () => false) {
  const by = new Map();
  for (const st of stations) { const t = (st.specialty || []).find(x => thin.has(x)); if (t) (by.get(t) || by.set(t, []).get(t)).push(st); }
  const fs = focus ? [focus] : focuses, queue = new Map();
  for (const [t, list] of by) queue.set(t, fs.flatMap(f => list.map(st => ({ st, focus: f, gap: t }))).filter(j => !skip(j.st, j.focus)).slice(0, Math.max(0, need(t))));
  const topics = [...queue.keys()].sort((a, b) => need(b) - need(a) || a.localeCompare(b)), out = [];
  for (let round = 0; out.length < n && topics.some(t => queue.get(t).length > round); round++)
    for (const t of topics) { const j = queue.get(t)[round]; if (j && out.length < n) out.push(j); }
  return out;
}

/* how many stand-ins (topicStation variants, a question each per focus) a thin topic gets in a gap run: a topic no
   station covers gets enough for its gap and what it already has written (at least two); a covered topic only when its
   stations' open slots fall short of its gap (2026-10-27: the last five thin topics all had stations, every slot full),
   plus enough to step past what stand-ins have already written for it. Pure; generate-mcq.mjs --gaps calls it */
export function standIns({ topic, covered, need, openSlots, written, focuses }) {
  const per = Math.max(1, focuses);
  if (!covered) return Math.max(2, Math.ceil((need + written) / per));
  const short = Math.max(0, need - openSlots);
  return short ? Math.ceil(short / per) + Math.ceil(written / per) : 0;
}
