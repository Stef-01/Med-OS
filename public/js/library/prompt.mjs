/* library/prompt.mjs - the prompt a student gives ChatGPT (or any chat model) to turn their notes, a lecture or a list
   of questions into Med-OS questions (docs/library.md). Its output is what Upload reads (library/item.mjs): a JSON
   array, each question with the specialty and the kind the duel and Study drill down by. Pure: the view copies it and
   the tests read it. */
import { KINDS, SPECIALTIES } from './item.mjs';
import { YEARS } from '../mcq/year.mjs';

const EXAMPLE = [{
  stem: 'A 4-year-old boy is brought to the emergency department with 2 days of a barking cough and noisy breathing. He has a temperature of 38.1°C, inspiratory stridor at rest and mild subcostal recession. Oxygen saturation is 96% on room air.',
  ask: 'Which of the following is the most appropriate initial treatment?',
  options: ['Oral dexamethasone', 'Nebulised salbutamol', 'Intravenous ceftriaxone', 'Oral amoxicillin', 'Inhaled budesonide alone'],
  answer: 'A',
  explanation: 'Croup (viral laryngotracheobronchitis) with stridor at rest is moderate; a single dose of oral dexamethasone 0.15 mg/kg reduces airway swelling within hours.',
  why: ['Correct: a steroid treats the subglottic oedema.', 'Bronchodilators do not help upper-airway oedema.', 'Antibiotics are for bacterial tracheitis or epiglottitis, which this is not.', 'Croup is viral.', 'Nebulised budesonide works but oral dexamethasone is first line and easier.'],
  specialty: 'Paediatrics',
  kind: 'clinical',
  year: 4,
  tags: ['croup', 'stridor']
}];

/* the whole prompt; `material` (optional) goes at the end so a student can paste their notes in one go */
export function chatPrompt(material = '') {
  const kinds = Object.entries(KINDS).map(([id, k]) => `  - "${id}": ${k.label}. ${k.brief}`).join('\n');
  const years = Object.entries(YEARS).map(([n, y]) => `  - ${n}: ${y.name}: ${y.brief}`).join('\n');
  return `You are writing single-best-answer multiple-choice questions for a medical student's question bank (Med-OS, mdosce.vercel.app). Turn the material I give you at the end into questions.

Output ONLY a JSON array, no prose before or after it, no markdown code fence. Each element is one question:
{
  "stem": "the clinical vignette: age, sex, setting, the presenting complaint, the history, examination and results that matter (2 to 5 sentences, at most 120 words)",
  "ask": "the lead-in, one question ending with ?, e.g. Which of the following is the most likely diagnosis?",
  "options": ["four or five options, short, all the same kind of thing (all diagnoses, or all drugs), one clearly best"],
  "answer": "the letter of the best option: A, B, C, D or E",
  "explanation": "why the answer is right (2 to 4 sentences)",
  "why": ["one short line per option, in order, saying why it is right or wrong"],
  "specialty": "exactly one of the specialties below",
  "kind": "exactly one of the kinds below",
  "year": "the year of medical school it is pitched at: 1, 2, 3 or 4 (below)",
  "tags": ["2 to 4 lowercase keywords"]
}

Specialties (use the spelling exactly):
${SPECIALTIES.join(', ')}

Kinds:
${kinds}

Years (a number):
${years}
A question on a first principle is Year 1 even about a clinical topic; give each question the earliest year a student could answer it.

Rules:
- Plain text only: no HTML, no markdown, no images, no "all of the above" or "none of the above".
- Put everything needed to answer in the stem; the lead-in must be answerable before reading the options.
- Keep stems short: the questions are also played against a timer.
- Make the wrong options plausible to a student who half knows the topic, and no longer or more detailed than the answer.
- Put the correct answer in a different position from question to question.
- Use Australian spelling and units (mmol/L, °C).
- Only write questions from my own material or your own knowledge. Never copy questions from a paid bank (UWorld, AMBOSS, Passmedicine and the like).
- Check every answer is correct by current guidelines. If a fact in my material is wrong, write the question on the correct fact.
- Write as many good questions as the material supports, up to 30.

Example of one element:
${JSON.stringify(EXAMPLE, null, 1)}

My material:
${String(material || '').trim() || '[paste your notes, lecture slides or questions here]'}`;
}
