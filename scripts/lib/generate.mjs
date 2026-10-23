/* lib/generate.mjs - writing one OSCE station with Claude, checked before it ships:
     1 draft     the topic + three stations of the same kind from the bank as the benchmark → a station (JSON schema)
     2 gates     shape + quality in code (station-gates.mjs): checklist size against the bank, Critical items, headings,
                 task times, script length, guideline citations, imaging requests
     3 examiner  a second, independent pass checks every checklist item against the cited guideline and the station
                 against itself (stem, script, checklist, explanation, imaging)
     4 revise    once, on the gate problems and the examiner's blockers; then gates and examiner again
     5 findings  the Exam tab: vitals, general inspection, examination steps and bedside tests consistent with the case
   A station ships only when the gates pass and the examiner has no blocker. Imaging is resolved after (resolve.mjs).
   Every Claude call goes through `ask` (lib/claude.mjs claudeJson by default), so the flow is tested with a stub. */
import crypto from 'node:crypto';
import { shapeProblems, qualityProblems, reviewNotes, bankStats, isAcute, TYPES, READING_MIN, PART1_MIN, PART2_MIN } from './station-gates.mjs';
import { REQUEST_SCHEMA } from '../imaging/resolve.mjs';
import { CX } from '../../public/js/osce/core.mjs';

const str = { type: 'string' }, strs = { type: 'array', items: str }, obj = (props, req = Object.keys(props)) => ({ type: 'object', additionalProperties: false, required: req, properties: props });
const KID = obj({ id: { type: 'integer' }, x: str, crit: { type: 'boolean' }, d: str });
const ITEM = obj({ id: { type: 'integer' }, t: { type: 'string', enum: ['heading', 'checkbox', 'info'] }, x: str, crit: { type: 'boolean' }, d: str, kids: { type: 'array', items: KID } });
export const STATION_SCHEMA = obj({
  title: str, desc: str, focus: str, specialty: strs, type: { type: 'array', items: { type: 'string', enum: TYPES } }, complexity: { type: 'string', enum: CX },
  context: strs, presentation: strs, diagnosis: strs, stem: str, tasks: strs, patient: str, check: { type: 'array', items: ITEM },
  part2: obj({ lead: str, handover: { type: 'array', items: obj({ label: str, result: str }) }, ask: strs }),
  guide: str, explain: str, points: strs, refs: strs, imaging: { type: 'array', items: REQUEST_SCHEMA },
});
export const REVIEW_SCHEMA = obj({ pass: { type: 'boolean' }, issues: { type: 'array', items: obj({ where: str, problem: str, fix: str, severity: { type: 'string', enum: ['blocker', 'minor'] } }) } });
export const EXAM_SCHEMA = obj({ vitals: str, general: str, steps: { type: 'array', items: obj({ area: str, do: str, find: str }) }, bedside: { type: 'array', items: obj({ test: str, find: str }) }, key: str });

const HTML = 'HTML fields (stem, tasks, patient, guide, explain, points, refs, checklist text) use only these tags, with no attributes: p ul ol li strong em h3 h4 sup sub br table thead tbody tr th td.';

export const WRITER_SYSTEM = `You write OSCE stations for Australian medical students in their clinical years. Every station has the same shape:
${READING_MIN} minutes reading; Part 1, ${PART1_MIN} minutes: a focused history and a focused examination (the examiner gives examination findings as the candidate says what they examine); Part 2, ${PART2_MIN} minutes: the examiner hands over observations, investigation results or scans, and the candidate interprets them, gives a management approach and safety-nets. Two students use your stations to practise together: one is the candidate, the other plays the patient, gives findings and results, and marks.

Write one station on the topic you are given, at the depth, tone and checklist granularity of the example stations (they come from the same bank and show the house style).
- stem: Instructions to Candidate. Setting, the candidate's role, the patient (name, age) and why they are here. Never the diagnosis. No times (the page shows the format).
- tasks: exactly 2. Task 1 is Part 1 and ends "(${PART1_MIN} minutes)": take a focused history from the patient and perform a focused examination, telling the examiner what you are examining. Task 2 is Part 2 and ends "(${PART2_MIN} minutes)": the examiner will give you the named results; interpret them, then outline your management approach and safety netting.
- patient: the script for Part 1, for the person playing the patient and the examiner: opening line, the history by domain with the answers to give only when asked, feelings, ideas, concerns and expectations, questions to raise, and a note that examination findings are given from the Exam findings when the candidate says what they examine. For an acute station, what the nurse reports and how the patient changes with what the candidate does.
- part2: lead is the examiner's opening line for Part 2 ("Here are her observations and blood results."). handover is 2 to 6 results, each {label, result}: observations, bedside tests, bloods (with units and reference ranges where they matter), an ECG, an imaging report in words. They fit the history and the examination exactly. ask is 3 to 5 examiner questions in order: what the results show, the most likely diagnosis and what else to consider, the management approach (immediate, definitive, disposition and who to involve), and how the candidate would safety-net and follow up.
- check: the marking checklist, under these headings in this order: Professionalism, History, Examination, Interpretation, Management, Safety netting (communication items sit under Professionalism or Management). Items are specific, observable and markable from what the candidate says or does ("States that PERC cannot be used because ..." not "Knows PERC"). Examination items match the examination this case needs. Interpretation has an item for each result that matters. Safety netting has at least 2 items: the specific red flags in plain words, when and where to come back (000, ED, GP), and the follow-up arranged. Use kids for a multi-part item. Mark crit true on the items a safe junior doctor must not miss (usually a third to a half). Ids are integers in order; kid ids start at 1 within their item. crit false, d "" and kids [] where they do not apply.
- guide: a short note for the examiner on running and marking the station ("" if not needed).
- explain: the teaching after the station: the diagnosis and the reasoning, the differentials that matter, the interpretation of the results, management and safety netting as the cited guideline sets them out.
- points: 4 to 6 learning points. refs: 2 to 6 references, each a named guideline with the page or section (for example "RCH Clinical Practice Guideline: Croup (laryngotracheobronchitis)").
- Guidelines: paediatrics and neonates follow the Royal Children's Hospital Melbourne Clinical Practice Guidelines (cite the page by name) and give every paediatric dose per kg; obstetrics follows RANZCOG and a state guideline (Safer Care Victoria, NSW Health or Queensland Clinical Guidelines); adult medicine follows Therapeutic Guidelines (eTG) and the relevant Australian body (Heart Foundation, ACSQHC, RACGP, ANZCOR for resuscitation). Write only what those guidelines say; where you are unsure of a detail, leave it out rather than guess.
- imaging: when a Part 2 result is an image (a chest or abdominal X-ray, CT, ultrasound, ECG, a clinical photograph), add a request so a real image can be found and checked: place "part2", the finding in plain radiological words, the side from the patient's point of view, the age group, a caption, alt text that does not name the diagnosis, and 1 to 3 search terms. The handover always gives the result in words too, so the station works without the image.
- focus is one line naming what the station tests. context, presentation and diagnosis are short tags.
${HTML}
Australian spelling and practice throughout (000, ED, GP, Medicare, PBS).`;

export const EXAMINER_SYSTEM = `You are a senior OSCE examiner and practising clinician in Australia reviewing a new station before students use it. Be exacting: a wrong checklist item teaches a wrong practice.
Check, item by item:
1. Every checklist item and every statement in the explanation against the guideline the station cites and current Australian practice. Drug, dose, route, threshold, timing and escalation must be right; paediatric doses per kg unless the guideline gives a fixed dose.
2. Consistency: the stem, the tasks, the patient script, the Part 2 results, the checklist, the explanation and the imaging requests describe the same patient and the same findings (same side, same numbers, same age). The Part 2 results follow from the history and examination.
3. Fairness: Part 1 items can be earned in ${PART1_MIN} minutes and Part 2 items in ${PART2_MIN}, from what the candidate says or does; the script and the Part 2 results give the candidate what the checklist expects them to find. Safety-netting items name specific red flags. Critical items are the safety-critical ones.
4. Imaging requests show a finding that the case really has and that is visible on that kind of image.
Report each problem with where it is, what is wrong and the exact fix. severity is blocker for anything clinically wrong, inconsistent, unfair or unsafe, minor for wording and polish. pass is true only if there is no blocker.`;

export const EXAM_SYSTEM = `You write the examination findings for Part 1 of an OSCE station, used in an "Exam mode" where the candidate says what they would examine and then sees what they find. The findings must fit the station exactly (the same patient, observations, side and severity as the patient script). vitals is one line of observations with units. general is the general inspection. steps are 6 to 10 examination areas in a sensible order, each with what the candidate does and what they find (normal findings stated as normal). bedside are the bedside tests with results (urinalysis, BGL, ECG, bladder scan, ...). key is two or three sentences on the findings that matter and why. Australian spelling. Plain text, no HTML.`;

/* the benchmark: up to three bank stations of the same kind, those sharing a specialty first, without media or ids */
export function exemplars(bank, { acute, specialty = [] }, n = 3) {
  const spec = new Set(specialty);
  return bank.filter(s => isAcute(s) === acute)
    .map(s => ({ s, k: (s.specialty || []).filter(x => spec.has(x)).length }))
    .sort((a, b) => b.k - a.k || String(a.s.id).localeCompare(String(b.s.id)))
    .slice(0, n)
    .map(({ s }) => {
      const { id, origin, basis, source, media, imaging, schemaVersion, generatedAt, generator, licence, ...rest } = s;
      return rest;
    });
}

export function writerPrompt(topic, opts, ex, stats) {
  const kind = opts.acute ? 'acute' : 'clinic', b = stats[kind];
  return `Topic: ${topic}
Kind: ${opts.acute ? 'an acute station (simulated ward or ED, a nurse assistant, observations that change with management)' : 'a clinic or ward station (history, explanation, counselling, management planning)'}${opts.specialty?.length ? `\nSpecialty: ${opts.specialty.join(', ')}` : ''}${opts.types?.length ? `\nStation types: ${opts.types.join(', ')}` : ''}${opts.notes ? `\nAlso cover: ${opts.notes}` : ''}
Checklist size: ${Math.max(20, b.min)} to ${Math.min(55, Math.max(b.max, Math.max(20, b.min) + 10))} markable items counting kids, across the six sections.

Example stations from the bank (JSON), for depth and house style only; do not copy their cases:
${ex.map((s, i) => `<example_${i + 1}>\n${JSON.stringify(s)}\n</example_${i + 1}>`).join('\n')}`;
}

/* the model's checklist into the bank's shape: headings carry only id/t/x, false crit and empty d/kids are dropped */
export function normalize(draft) {
  const item = i => {
    if (i.t === 'heading' || i.t === 'info') return { id: i.id, t: i.t, x: i.x };
    const kids = (i.kids || []).filter(k => String(k.x || '').trim()).map(k => ({ id: k.id, t: 'checkbox', x: k.x, ...(k.crit ? { crit: true } : {}), ...(k.d ? { d: k.d } : {}) }));
    return { id: i.id, t: 'checkbox', x: i.x, ...(i.crit ? { crit: true } : {}), ...(i.d ? { d: i.d } : {}), ...(kids.length ? { kids } : {}) };
  };
  const out = { ...draft, check: (draft.check || []).map(item) };
  if (!out.guide) out.guide = '';
  return out;
}
export const stationId = (title, now) => `ai-${crypto.createHash('sha1').update(`${title}\n${now}`).digest('hex').slice(0, 8)}`;

const reviewText = (st, notes) => `${notes.length ? `Check these in particular:\n${notes.map(n => `- ${n}`).join('\n')}\n\n` : ''}The station (JSON):\n${JSON.stringify(st)}`;
const reviseText = (st, gates, issues) => `Revise this station. Fix every problem below and change nothing else that is right. Return the whole station.
${gates.length ? `\nProblems found in code (each must be fixed):\n${gates.map(g => `- ${g}`).join('\n')}` : ''}
${issues.length ? `\nThe examiner's review:\n${issues.map(i => `- [${i.severity}] ${i.where}: ${i.problem} Fix: ${i.fix}`).join('\n')}` : ''}

The station (JSON):
${JSON.stringify(st)}`;

/* the whole flow. ask({system, content, schema, effort, label}) -> {value, model}. Returns
   { ok, station, exam, rounds: [{gates, review}], models } - ok false keeps the last draft for a person to look at. */
export async function writeStation(topic, opts, { bank, ask, now = new Date().toISOString(), log = () => {} }) {
  const stats = bankStats(bank), ex = exemplars(bank, opts);
  log(`draft · ${ex.length} example stations, checklist ${stats[opts.acute ? 'acute' : 'clinic'].min} to ${stats[opts.acute ? 'acute' : 'clinic'].max} items`);
  let { value: draft, model } = await ask({ system: WRITER_SYSTEM, content: writerPrompt(topic, opts, ex, stats), schema: STATION_SCHEMA, effort: 'high', label: 'draft' });
  const id = opts.id || stationId(draft.title, now), rounds = [], models = { writer: model };
  let st = { id, ...normalize(draft), origin: 'ai' };
  for (let round = 0; round < 2; round++) {
    const gates = [...shapeProblems(st), ...qualityProblems(st, stats)];
    const { value: review, model: rm } = await ask({ system: EXAMINER_SYSTEM, content: reviewText(st, reviewNotes(st)), schema: REVIEW_SCHEMA, effort: 'high', label: `review ${round + 1}` });
    models.examiner = rm;
    const blockers = (review.issues || []).filter(i => i.severity === 'blocker');
    rounds.push({ gates, review });
    log(`round ${round + 1} · ${gates.length} gate problem${gates.length === 1 ? '' : 's'} · examiner ${review.pass && !blockers.length ? 'passes' : `${blockers.length} blocker${blockers.length === 1 ? '' : 's'}`}`);
    if (!gates.length && review.pass && !blockers.length) {
      const { value: exam } = await ask({ system: EXAM_SYSTEM, content: `The station (JSON):\n${JSON.stringify(st)}`, schema: EXAM_SCHEMA, effort: 'medium', label: 'exam findings' });
      return { ok: true, station: st, exam, rounds, models };
    }
    if (round === 1) break;
    const { value: fixed } = await ask({ system: WRITER_SYSTEM, content: reviseText(st, gates, review.issues || []), schema: STATION_SCHEMA, effort: 'high', label: 'revise' });
    st = { id, ...normalize(fixed), origin: 'ai' };
  }
  return { ok: false, station: st, exam: null, rounds, models };
}

/* an existing station through the same examiner and gates, revised once if it falls short */
export async function reviseStation(station, { bank, ask, log = () => {} }) {
  const { id, origin, schemaVersion, generatedAt, generator, source: _s, licence, basis, ...body } = station;
  const topic = station.focus || station.title;
  const res = await writeStation(topic, { acute: isAcute(station), specialty: station.specialty, id }, {
    bank: bank.filter(s => s.id !== id), log,
    ask: (() => { let first = true; return async a => { if (first && a.label === 'draft') { first = false; return { value: { ...body, imaging: body.imaging || [] }, model: 'existing' }; } return ask(a); }; })(),
  });
  return res;
}
