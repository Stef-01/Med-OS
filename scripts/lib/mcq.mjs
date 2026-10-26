/* lib/mcq.mjs - the duel's question bank by category (founder 2026-10-25: "make the drill down for question options have
   more layers ... choose Paeds and then click into OSCE skills, or clinical, or physiology and pathophysiology, or
   Anatomy"). Pure: the categories, the writer's prompt and schema, what is sent from a station, and the gates every
   question passes before scripts/generate-mcq.mjs writes it to public/duel/mcq/<station>.json. The pack builder
   (lib/duel-pack.mjs) adds them to the station's own diagnosis question, which is Clinical.

   Each station gets one question in each category, written from that station's case, single best answer, four options,
   and a reason for each wrong one. AI-written (origin "ai"): the duel shows the tag. */

export const CATS = [
  { id: 'skills', label: 'OSCE skills', brief: 'how to run this station well: the question to ask, the examination step or manoeuvre, what to say to the patient (explaining, consent, breaking news, safety netting), or the procedure, at the point the station reaches it' },
  { id: 'clinical', label: 'Clinical', brief: 'investigation or management of this patient: the next test, its interpretation, the first-line treatment and its dose or route, escalation, disposition or follow-up (not "what is the most likely diagnosis", which the bank already asks)' },
  { id: 'physio', label: 'Physiology and pathophysiology', brief: 'the mechanism behind this patient\'s condition, a sign, a result or a treatment: the normal physiology and what goes wrong' },
  { id: 'anatomy', label: 'Anatomy', brief: 'the anatomy this case turns on: the structure, its supply, drainage or innervation, a landmark for examination or a procedure, or where a lesion sits to explain a sign' }
];
export const CAT_IDS = CATS.map(c => c.id);
export const LIMITS = { stem: 420, option: 90, note: 260, why: 340, options: 4 };

const str = { type: 'string' };
const obj = props => ({ type: 'object', additionalProperties: false, required: Object.keys(props), properties: props });
export const MCQ_SCHEMA = obj({
  questions: { type: 'array', minItems: CATS.length, maxItems: CATS.length, items: obj({
    cat: { type: 'string', enum: CAT_IDS }, stem: str, options: { type: 'array', minItems: LIMITS.options, maxItems: LIMITS.options, items: str },
    answer: { type: 'integer', minimum: 0, maximum: LIMITS.options - 1 }, why: str, notes: { type: 'array', minItems: LIMITS.options, maxItems: LIMITS.options, items: str }
  }) }
});

export const MCQ_SYSTEM = `You write single-best-answer questions for Australian medical students in their clinical years, for a quiz they play in pairs on their phones after practising OSCE stations. You are given one OSCE station (the case, the patient, the results, the differential, the learning points). Write exactly one question in each of these four categories, each set in this station's case:
${CATS.map(c => `- ${c.id} (${c.label}): ${c.brief}.`).join('\n')}

Rules for every question:
- One option is clearly the best answer on current Australian practice (eTG, the Australian Medicines Handbook, RACGP, the relevant college or state guideline); a senior clinician would agree without argument. Check the answer twice before you commit to it.
- The stem gives what is needed to answer (a short vignette from this case, the patient's age and the setting) and ends with a direct question ending in "?". At most ${LIMITS.stem} characters, plain text, no HTML. Never name the answer in the stem. No "EXCEPT", "NOT", "all of the above" or "none of the above".
- Exactly ${LIMITS.options} options, each at most ${LIMITS.option} characters, the same kind of thing (four drugs, four nerves, four next steps), similar in length and specificity, so the right one does not stand out. Every wrong option is plausible to a student who half knows the topic, and is wrong for a reason you can state.
- answer is the index (0 to ${LIMITS.options - 1}) of the right option. Vary its position across the four questions.
- why is one or two sentences (at most ${LIMITS.why} characters) explaining why the right answer is right, with the fact the student should keep.
- notes has one entry per option in the same order: "" for the right one, and for each wrong one a single sentence (at most ${LIMITS.note} characters) saying why it is wrong here.
- Doses, thresholds and names as an Australian intern would use them (generic drug names, SI units, Australian spelling). Do not invent a fact the station does not support when the question depends on this patient.
- Make it fair at final-year level: testing understanding and the decision, not trivia.`;

/* the station as the writer reads it: its case in plain text, no images, no marking sheet */
const strip = s => String(s ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
export function stationBrief(st) {
  const p2 = st.part2 || {}, lines = [];
  lines.push(`Title: ${strip(st.title)}`);
  lines.push(`Specialty: ${(st.specialty || []).join(', ')}`);
  if (st.demo) lines.push(`Patient: ${st.demo.age} ${st.demo.unit || 'years'}, ${st.demo.sex || ''}, setting ${st.demo.setting || ''}`);
  lines.push(`Candidate's instructions: ${strip(st.stem)} ${(st.tasks || []).map(strip).join(' ')}`);
  lines.push(`The patient: ${strip(st.patient).slice(0, 3500)}`);
  if (p2.lead) lines.push(`Part 2: ${strip(p2.lead)}`);
  for (const h of (Array.isArray(p2.handover) ? p2.handover : []).slice(0, 8)) lines.push(`Result (${strip(h.label)}): ${strip(h.result).slice(0, 700)} Model interpretation: ${strip(h.model).slice(0, 500)}`);
  (Array.isArray(p2.ask) ? p2.ask : []).slice(0, 6).forEach((q, i) => lines.push(`Part 2 question: ${strip(q)} Expected: ${strip((p2.expect || [])[i]).slice(0, 600)}`));
  for (const d of st.ddx || []) lines.push(`Differential (${d.tier}): ${strip(d.dx)}. For: ${strip(d.for)} Against: ${strip(d.against)}`);
  for (const pt of st.points || []) lines.push(`Learning point: ${strip(pt)}`);
  lines.push(`Explanation: ${strip(st.explain).slice(0, 3000)}`);
  return lines.filter(Boolean).join('\n');
}

const norm = s => strip(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
/* every reason a question cannot ship ([] when it can) */
export function gate(q) {
  const out = [];
  if (!q || typeof q !== 'object') return ['not a question'];
  if (!CAT_IDS.includes(q.cat)) out.push(`unknown category ${q.cat}`);
  const stem = strip(q.stem);
  if (!stem || stem.length > LIMITS.stem) out.push(`stem length ${stem.length}`);
  if (!/\?$/.test(stem)) out.push('the stem does not end with a question');
  if (/\b(EXCEPT|all of the above|none of the above)\b/i.test(stem) || /\bNOT\b/.test(stem)) out.push('a negative or all/none question');
  const opts = Array.isArray(q.options) ? q.options.map(strip) : [];
  if (opts.length !== LIMITS.options) out.push(`${opts.length} options`);
  if (opts.some(o => !o || o.length > LIMITS.option)) out.push('an empty or long option');
  if (new Set(opts.map(norm)).size !== opts.length) out.push('two options the same');
  if (opts.some(o => /^(all|none|both) of the above/i.test(o))) out.push('an all/none option');
  if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= opts.length) out.push('no valid answer');
  else if (opts[q.answer] && norm(opts[q.answer]).length > 3 && norm(stem).includes(norm(opts[q.answer]))) out.push('the stem names the answer');
  const why = strip(q.why);
  if (!why || why.length > LIMITS.why) out.push(`why length ${why.length}`);
  const notes = Array.isArray(q.notes) ? q.notes.map(strip) : [];
  if (notes.length !== opts.length) out.push('a note per option');
  else notes.forEach((n, i) => { if (i !== q.answer && (!n || n.length > LIMITS.note)) out.push(`note ${i} missing or long`); });
  return out;
}

/* a writer's answer to the file's questions: each passing question with its id and source, and why the others failed */
export function normalizeMcq(st, draft) {
  const kept = [], failed = [], seen = new Set();
  for (const q of (draft && Array.isArray(draft.questions) ? draft.questions : [])) {
    const issues = gate(q);
    if (seen.has(q?.cat)) issues.push(`a second ${q.cat} question`);
    if (issues.length) { failed.push(`${st.id} ${q?.cat || '?'}: ${issues.join('; ')}`); continue; }
    seen.add(q.cat);
    const notes = q.notes.map((n, i) => (i === q.answer ? null : strip(n)));
    kept.push({ id: `osce-${st.id}-${q.cat}`, cat: q.cat, stem: strip(q.stem), options: q.options.map(strip), answer: q.answer, why: strip(q.why), notes });
  }
  return { kept, failed };
}
export const mcqFile = (st, kept, at) => ({ schemaVersion: 1, station: st.id, origin: 'ai', writtenAt: at, questions: kept });
