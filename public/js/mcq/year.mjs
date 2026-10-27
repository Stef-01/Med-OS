/* mcq/year.mjs - the year of medical school a question is pitched at (founder 2026-10-26: "a mode called 0 to 1 ... first
   year medical content to second year to third year, then final year ... so you can learn from first principles; the
   schema tagged so it's easy to see year 1 versus 2 versus 3 versus 4 content").

     1  first principles: normal structure and function (anatomy, physiology, biochemistry, cell biology), one step
     2  how it goes wrong: pathology, pathophysiology, microbiology, pharmacology mechanisms, the classic presentation
     3  clinical years: history, examination, the likely diagnosis, the right test and how to read it
     4  final year: management, doses, escalation, the sick patient, prioritising, complications and safety

   DIFFICULTY is the other axis (founder 2026-10-26: "account for difficulty and year of medical school level"): how
   hard the question is for a student of its own year, 1 Easy (the core fact, most get it), 2 Medium, 3 Hard (a
   discriminator: two steps, a close distractor, the exception to the rule). A Year 1 question can be Hard and a
   Year 4 one Easy; 0 to 1 climbs the years and, within each, Easy to Hard.

   A question carries `year` (1 to 4) and `difficulty` (1 to 3). Who sets it: the writer (ChatGPT through library/prompt.mjs; the classifier
   scripts/tag-years.mjs for the bank), else guessYear() here, which reads the kind and the lead-in. Pure. */

export const YEARS = Object.freeze({
  1: { label: 'Year 1', name: 'First principles', brief: 'normal structure and function: anatomy, physiology, biochemistry; one step of reasoning' },
  2: { label: 'Year 2', name: 'How it goes wrong', brief: 'pathology, pathophysiology, microbiology, how drugs work, the classic presentation' },
  3: { label: 'Year 3', name: 'Clinical years', brief: 'history, examination, the likely diagnosis, the right test and how to read it' },
  4: { label: 'Year 4', name: 'Final year', brief: 'management and doses, escalation, the unwell patient, priorities, complications' }
});
export const YEAR_IDS = [1, 2, 3, 4];
export const isYear = y => Number.isInteger(y) && y >= 1 && y <= 4;

export const DIFFICULTY = Object.freeze({
  1: { label: 'Easy', brief: 'the core fact or the classic picture: most students of that year get it' },
  2: { label: 'Medium', brief: 'needs one step of reasoning or a less common fact' },
  3: { label: 'Hard', brief: 'a discriminator: two steps, a close distractor, or the exception to the rule' }
});
export const DIFF_IDS = [1, 2, 3];
export const isDiff = d => Number.isInteger(d) && d >= 1 && d <= 3;
/* "hard", "Medium", "3", "difficult", 2 -> 1..3; 0 when it is none of them */
export function diffOf(v) {
  if (isDiff(v)) return v;
  const s = String(v ?? '').trim().toLowerCase();
  if (/^[1-3]$/.test(s)) return +s;
  return { easy: 1, simple: 1, basic: 1, medium: 2, moderate: 2, intermediate: 2, hard: 3, difficult: 3, challenging: 3 }[s] || 0;
}
/* a guess when nobody said: the length of the reasoning (a long vignette, a negative lead-in, five options) */
export function guessDiff(q) {
  const words = String(q?.stem || '').split(/\s+/).length + String(q?.ask || '').split(/\s+/).length;
  let s = words > 90 ? 2 : words > 45 ? 1 : 0;
  if ((q?.options || []).length >= 5) s++;
  if (/\b(except|not|least likely|false)\b/i.test(q?.ask || '')) s++;
  return s >= 3 ? 3 : s >= 1 ? 2 : 1;
}

/* "Year 2", "y2", "2", "second year", "final year", "MS3", 3 -> the year; 0 when it is none of them */
const WORDS = { first: 1, one: 1, second: 2, two: 2, third: 3, three: 3, fourth: 4, four: 4, final: 4, last: 4 };
export function yearOf(v) {
  if (isYear(v)) return v;
  const s = String(v ?? '').trim().toLowerCase();
  const d = s.match(/^(?:y(?:ear|r)?|ms|pgy)?\s*-?\s*([1-4])(?:st|nd|rd|th)?(?:\s*year)?$/);
  if (d) return +d[1];
  const w = s.match(/^(first|second|third|fourth|final|last|one|two|three|four)(?:\s*-?\s*year)?$/) || s.match(/^year\s+(one|two|three|four)$/);
  return w ? WORDS[w[1]] : 0;
}

/* a fair guess when nobody said: the kind first (OSCE skills and clinical are the clinical years), then the lead-in
   (management and doses are final year; a mechanism with no patient is first principles) */
const MANAGE = /\b(manage|management|next step|most appropriate|treat|treatment|dose|dosing|first[- ]line|escalat|prescri|initial (?:step|action|therapy)|disposition|refer)/i;
const DIAG = /\b(diagnos|investigat|test|imaging|interpret|finding|sign|examination|most likely|cause)/i;
const MECH = /\b(mechanism|pathophysiolog|why does|explains|responsible for|mediat|receptor|enzyme|pathway)/i;
export function guessYear(q) {
  const ask = `${q?.ask || ''} ${String(q?.stem || '').replace(/([.?!])\s+/g, '$1\u0000').split('\u0000').slice(-1)[0] || ''}`, vignette = /\b\d{1,3}[- ](?:year|month|week|day)[- ]old\b/i.test(q?.stem || '');
  switch (q?.cat) {
    case 'anatomy': return vignette ? 2 : 1;
    case 'physio': return vignette || !MECH.test(ask) ? 2 : 1;
    case 'skills': return MANAGE.test(ask) ? 4 : 3;
    case 'clinical': return MANAGE.test(ask) ? 4 : 3;
  }
  if (MANAGE.test(ask)) return vignette ? 4 : 3;
  if (DIAG.test(ask)) return vignette ? 3 : 2;
  return vignette ? 3 : 1;
}

/* a 0 to 1 run: the questions in year order (Year 1 first) and, within a year, Easy to Hard (otherwise the order
   given); per: at most that many from each year (0: all), so a short run still climbs every year it has */
export function ladder(list, yearOfItem = x => x.year, per = 0, diffOfItem = x => x.difficulty) {
  const by = new Map(YEAR_IDS.map(y => [y, []]));
  for (const x of list || []) { const y = yearOfItem(x); (by.get(isYear(y) ? y : 3)).push(x); }
  const d = x => (isDiff(diffOfItem(x)) ? diffOfItem(x) : 2);
  return YEAR_IDS.flatMap(y => { const l = per ? by.get(y).slice(0, per) : by.get(y); return l.map((x, i) => [x, i]).sort((a, b) => d(a[0]) - d(b[0]) || a[1] - b[1]).map(e => e[0]); });
}
