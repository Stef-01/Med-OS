/* mcq/taxonomy.mjs - every question's categories, in one place (founder 2026-10-26: "evaluation and categorisation of
   everything in the schema"). A question reaches the duel and study by one of several routes (the reviewed pool, the
   station writers, the high-yield set, adapted open exams, a student's library), and each writes the same fields:

     source      where it came from (SOURCE_KINDS): a student, a model, a model from an AMSA case, an open USMLE-style
                 bank, or an open exam set adapted for Australian practice. The duel tags each question with it
     origin      who wrote the question: human (a student, an exam or bank) or ai; fixed by its source
     credit      the attribution a licence asks for, shown with the explanation; required where the source needs it
     topic       its specialty (study-kit/vocab.mjs SPECIALTIES); topics, every specialty it sits under, topic first
     cat         the kind of question, the duel's second layer: skills, clinical, physio, anatomy
     year        1 to 4, the year of medical school it is pitched at; difficulty 1 to 3 within that year (mcq/year.mjs)
     formats     derived, never stored: the duel's answer-time formats it fits (the vendored duel's fits)

   taxonomyProblems(q) says what a question is missing or has wrong; npm test runs it over every question in the duel
   pack, and scripts/mcq-audit.mjs counts the categories. Pure. */
import { SPECIALTIES } from '../study-kit/vocab.mjs';
import { isYear, isDiff } from './year.mjs';

export { SPECIALTIES };
export const CAT_IDS = Object.freeze(['skills', 'clinical', 'physio', 'anatomy']);
export const SOURCE_KINDS = Object.freeze({
  user: { label: 'Student', origin: 'human', brief: 'written by a student and sent to the reviewed bank' },
  ai: { label: 'AI-written', origin: 'ai', brief: 'written by a model from a Med-OS station or a topic list, or an open set another team wrote with a model (PrinciplismQA), with its credit' },
  amsa: { label: 'AMSA', origin: 'ai', brief: 'made from an AMSA MedEd OSCE case in an AI-written station' },
  'usmle-resource': { label: 'USMLE', origin: 'human', brief: 'an open USMLE-style bank (MedQA, MMLU), shown with its licence' },
  'open-exam': { label: 'Exam', origin: 'human', credit: true, brief: 'a real exam question from an open set, adapted for Australian practice by a model, with its credit' }
});
const SPEC = new Set(SPECIALTIES);
export const isSpecialty = s => SPEC.has(s);

/* what is missing or wrong in one question's categories: [] when it is fully categorised */
export function taxonomyProblems(q) {
  const out = [], src = SOURCE_KINDS[q?.source];
  if (!src) out.push(`source "${q?.source ?? ''}" is not one of ${Object.keys(SOURCE_KINDS).join(', ')}`);
  else {
    if (q.origin !== src.origin) out.push(`origin is "${q.origin}" but a ${q.source} question is ${src.origin}-written`);
    if (src.credit && !String(q.credit || '').trim()) out.push(`a ${q.source} question needs the credit its licence asks for`);
  }
  if (!isSpecialty(q?.topic)) out.push(`topic "${q?.topic ?? ''}" is not a specialty`);
  if (q?.topics !== undefined) {
    if (!Array.isArray(q.topics) || !q.topics.length) out.push('topics, when given, is a list');
    else {
      const bad = q.topics.filter(t => !isSpecialty(t));
      if (bad.length) out.push(`topics ${bad.map(t => `"${t}"`).join(', ')} are not specialties`);
      if (q.topics[0] !== q.topic) out.push('topics starts with the topic');
    }
  }
  if (!CAT_IDS.includes(q?.cat)) out.push(`cat "${q?.cat ?? ''}" is not one of ${CAT_IDS.join(', ')}`);
  if (!isYear(q?.year)) out.push(`year ${q?.year ?? 'none'} is not 1 to 4`);
  if (!isDiff(q?.difficulty)) out.push(`difficulty ${q?.difficulty ?? 'none'} is not 1 to 3`);
  return out;
}

/* the counts of every category over a list, for the audit: { source: {...}, cat: {...}, year, difficulty, topic } */
export function taxonomyCounts(list) {
  const out = { source: {}, cat: {}, year: {}, difficulty: {}, topic: {}, problems: 0 };
  for (const q of list || []) {
    for (const k of ['source', 'cat', 'year', 'difficulty', 'topic']) { const v = String(q?.[k] ?? 'none'); out[k][v] = (out[k][v] || 0) + 1; }
    if (taxonomyProblems(q).length) out.problems++;
  }
  return out;
}
