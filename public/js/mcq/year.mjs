/* mcq/year.mjs - the year of medical school a question is pitched at (founder 2026-10-26: "a mode called 0 to 1 ... first
   year medical content to second year to third year, then final year ... so you can learn from first principles; the
   schema tagged so it's easy to see year 1 versus 2 versus 3 versus 4 content").

     1  first principles: normal structure and function (anatomy, physiology, biochemistry, cell biology), one step
     2  how it goes wrong: pathology, pathophysiology, microbiology, pharmacology mechanisms, the classic presentation
     3  clinical years: history, examination, the likely diagnosis, the right test and how to read it
     4  final year: management, doses, escalation, the sick patient, prioritising, complications and safety

   A question carries `year` (1 to 4). Who sets it: the writer (ChatGPT through library/prompt.mjs; the classifier
   scripts/tag-years.mjs for the bank), else guessYear() here, which reads the kind and the lead-in. Pure. */

export const YEARS = Object.freeze({
  1: { label: 'Year 1', name: 'First principles', brief: 'normal structure and function: anatomy, physiology, biochemistry; one step of reasoning' },
  2: { label: 'Year 2', name: 'How it goes wrong', brief: 'pathology, pathophysiology, microbiology, how drugs work, the classic presentation' },
  3: { label: 'Year 3', name: 'Clinical years', brief: 'history, examination, the likely diagnosis, the right test and how to read it' },
  4: { label: 'Year 4', name: 'Final year', brief: 'management and doses, escalation, the unwell patient, priorities, complications' }
});
export const YEAR_IDS = [1, 2, 3, 4];
export const isYear = y => Number.isInteger(y) && y >= 1 && y <= 4;

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
  const ask = `${q?.ask || ''} ${String(q?.stem || '').split(/(?<=[.?!])\s+/).slice(-1)[0] || ''}`, vignette = /\b\d{1,3}[- ](?:year|month|week|day)[- ]old\b/i.test(q?.stem || '');
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

/* a 0 to 1 run: the questions in year order (Year 1 first), and within a year in the order given; per: at most that
   many from each year (0: all), so a short run still climbs every year it has */
export function ladder(list, yearOfItem = x => x.year, per = 0) {
  const by = new Map(YEAR_IDS.map(y => [y, []]));
  for (const x of list || []) { const y = yearOfItem(x); (by.get(isYear(y) ? y : 3)).push(x); }
  return YEAR_IDS.flatMap(y => (per ? by.get(y).slice(0, per) : by.get(y)));
}
