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
import { flawReport, content } from '../../public/js/mcq/flaws.mjs';
import { SPECIALTIES } from './mcq-judge.mjs';
import { spreadKey } from './mcq-sources.mjs';

export const GEN_VERSION = 'generate-mcq-1';
export const FOCUS = Object.freeze({
  management: 'the most appropriate next step in management (or the most appropriate treatment)',
  investigation: 'the most appropriate next investigation, or the test most likely to confirm the diagnosis',
  interpretation: 'interpreting one of the Part 2 results (what the result shows, or what it means for this patient)',
  complication: 'the complication or risk this patient is most at risk of, or the most important thing to prevent or counsel about'
});
const strip = s => String(s ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

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
- has exactly five options of the same kind (all diagnoses, all drugs, all tests), similar in length and grammar, none "all/none of the above", no negatives, no absolute words, no word of the key repeated from the stem;
- has one answer that is clearly best by current Australian guidelines (eTG, RCH, RANZCOG, state health guidelines) and four distractors a weaker student would pick, each wrong for a clear reason;
- has an explanation that says why the key is right and a one-sentence reason why each other option is wrong.
Write a new patient: do not copy the station's script, and do not copy the example questions; they show the style only. Plain text, no markup.`;
export const ITEM_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['stem', 'ask', 'options', 'answer', 'explanation', 'why', 'topic'],
  properties: {
    stem: { type: 'string' }, ask: { type: 'string' }, options: { type: 'array', items: { type: 'string' }, minItems: 5, maxItems: 5 },
    answer: { type: 'string', enum: [...LETTERS] }, explanation: { type: 'string' }, why: { type: 'array', items: { type: 'string' }, minItems: 5, maxItems: 5 },
    topic: { type: 'string', enum: [...SPECIALTIES] }
  }
};
const exText = q => `${q.stem}\n${q.options.map((o, i) => `${LETTERS[i]}. ${o}`).join('\n')}\nKey: ${LETTERS[q.answer]}`;
export function writerPrompt(st, focus, ex) {
  return `Write one question from this OSCE station. It must test ${FOCUS[focus]}; the station's own question already asks for the diagnosis.

<station>
${stationBrief(st)}
</station>

Example Step 2 CK questions, for style only:
${ex.map((q, i) => `<example_${i + 1}>\n${exText(q)}\n</example_${i + 1}>`).join('\n')}

In "why", give one entry per option in order: for the key, why it is right; for each other option, why it is wrong.`;
}
export const reviseText = (draft, reasons) => `Revise this question. Fix every problem below and change nothing that is right. Return the whole question.
Problems found in code:
${reasons.map(r => `- ${r}`).join('\n')}

The question (JSON):
${JSON.stringify(draft)}`;

/* the model's draft as a question: the key letter to an index, the key spread by the id's hash, the provenance */
export function toItem(draft, { st, focus, ex, how, model, now }) {
  const id = `ai-mcq-${fnv(`${st.id}:${focus}:${now}`)}`;
  const answer = LETTERS.indexOf(String(draft.answer || '').toUpperCase());
  const why = (draft.why || []).map((w, i) => (i === answer ? null : w));
  return cleanItem(spreadKey({
    id, stem: draft.stem, ask: draft.ask, options: draft.options, answer, explanation: draft.explanation, why,
    topic: draft.topic || st.specialty?.[0] || '', tags: ['generated', `focus:${focus}`, `station:${st.id}`],
    provenance: { kind: 'ai', source: { name: `Written by AI from Med-OS station ${st.id}`, url: '', licence: 'own' }, createdAt: now,
      generator: { how, version: GEN_VERSION, basis: [st.id, `osce-${st.id}`], exemplars: ex.map(q => q.id), ...(model ? { model } : {}) } }
  }));
}
const blocking = q => (q ? flawReport(q).failed.filter(f => f.severity === 'major' || f.severity === 'block') : [{ reason: 'the draft is not a valid question (five options, a key, a stem)' }]);

/* one question from one station -> { ok, item, problems, rounds } */
export async function writeMcq(st, focus, { bench, ask, how = 'api', now = new Date().toISOString(), log = () => {} }) {
  const ex = exemplarsFor(st, bench);
  let { value: draft, model } = await ask({ system: WRITER_SYSTEM, content: writerPrompt(st, focus, ex), schema: ITEM_SCHEMA, effort: 'high', label: `${st.id} ${focus} draft` });
  let item = toItem(draft, { st, focus, ex, how, model, now }), problems = blocking(item), rounds = 1;
  if (problems.length) {
    log(`${st.id} ${focus}: revising (${problems.map(p => p.reason).join('; ')})`);
    ({ value: draft, model } = await ask({ system: WRITER_SYSTEM, content: reviseText(draft, problems.map(p => p.reason)), schema: ITEM_SCHEMA, effort: 'high', label: `${st.id} ${focus} revise` }));
    item = toItem(draft, { st, focus, ex, how, model, now }); problems = blocking(item); rounds = 2;
  }
  return { ok: !problems.length, item, problems: problems.map(p => p.reason), rounds, draft };
}
