/* vocab.mjs - the words the study overlay shares (study kit): where a station came from, the specialty emoji and the
   discipline row.

   SOURCES: 'ai' is a station written by the generator (scripts/generate-station.mjs), 'own' one the two of you wrote by
   hand. Every station carries its origin, and every surface that shows a station shows its tag.

   specialtyEmoji(name): one emoji per specialty name, from the table below. Unknown specialty → '' (no emoji, never
   "undefined"). */

export const SOURCES = Object.freeze([['ai', 'AI generated'], ['own', 'Written by you']]);
export const sourceLabel = k => (SOURCES.find(([v]) => v === k) || [])[1] || '';

const EMOJI = new Map(Object.entries({
  'Addiction Medicine': '💉', Anaesthesia: '😴', Cardiology: '🫀', 'Critical Care Medicine': '🥼', Dermatology: '🧴', 'Emergency Medicine': '🚑',
  Endocrinology: '🍬', Gastroenterology: '🔭', Geriatrics: '👵', Haematology: '🩸', Immunology: '🛡️', 'Infectious Diseases': '🦠', Nephrology: '🥔',
  Neurology: '🧠', 'Occupational/Environmental Medicine': '👷', Oncology: '🎗️', 'Pain Medicine': '🩹', 'Palliative Care': '💕', Radiology: '🩻',
  'Rehabilitation Medicine': '👨‍🦽', 'Respiratory Medicine': '🫁', Rheumatology: '👋', 'Sexual Health': '🍆', Toxicology: '🐍', 'Zoonotic Disease': '🐭',
  'Breast/Endocrine Surgery': '🍊', 'Cardiothoracic Surgery': '🫀', 'Gastrointestinal Surgery': '🔭', 'General Surgery': '🔪', Neurosurgery: '🧠',
  'OMS/Dental': '🦷', Ophthalmology: '👁️', Orthopaedics: '🦴', Otorhinolaryngology: '👃', 'Plastic Surgery': '👌', 'Trauma Surgery': '💥', Urology: '🥃',
  'Vascular Surgery': '🦵', Gynaecology: '🍓', Obstetrics: '🤰', Neonatology: '🐣', Paediatrics: '👶', Psychiatry: '🎭', Bioethics: '😇',
  'General Practice': '👨‍👩‍👦', 'Indigenous Health': '🪃', Medicolegal: '🧑‍⚖️', Professionalism: '⚖️', 'Public Health': '🌏',
  'Rural & Remote Medicine': '🧑‍🌾', Genetics: '🧬', Pathology: '🔬', Pharmacology: '💊',
}));
export const specialtyEmoji = name => EMOJI.get(name) || '';
export const emojiCount = () => EMOJI.size;

/* ---------------------------------------------------------------- source tags: one tag on every surface a station shows,
   two words at most, a token colour per source (study-kit.css .kit-src--ai | --own), the full name for a screen reader.
   `title` adds the hover reason (an AI station's focus). */
const TAG = { ai: ['AI', 'AI generated'], own: ['Own', 'Written by you'] };
const attr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
export const sourceKey = k => (TAG[k] ? k : 'own');
export function sourceTag(origin, title = '') {
  const k = sourceKey(origin), [short, long] = TAG[k];
  return `<span class="kit-src kit-src--${k}" role="img" aria-label="Source: ${long}"${title ? ` title="${attr(title)}"` : ''}>${short}</span>`;
}

/* ---------------------------------------------------------------- disciplines: a discipline is a rotation, the way a
   medical school groups the fine specialties: [id, name, emoji, specialties, short label]. A station belongs to every
   discipline one of its specialties is in; a name the table does not know lands in Medicine. */
export const DISCIPLINES = [
  ['paeds', 'Paediatrics', '🧸', ['Paediatrics', 'Neonatology'], 'Paeds'],
  ['og', 'Obstetrics & Gynaecology', '🤰', ['Obstetrics', 'Gynaecology', 'Sexual Health'], 'O&G'],
  ['ed', 'Emergency & Critical Care', '🚑', ['Emergency Medicine', 'Critical Care Medicine', 'Toxicology'], 'Emergency'],
  ['med', 'Medicine', '🫀', ['Cardiology', 'Respiratory Medicine', 'Gastroenterology', 'Neurology', 'Endocrinology', 'Nephrology',
    'Haematology', 'Rheumatology', 'Infectious Diseases', 'Dermatology', 'Oncology', 'Immunology', 'Geriatrics', 'Palliative Care', 'Pathology'], 'Medicine'],
  ['surg', 'Surgery', '🔪', ['General Surgery', 'Gastrointestinal Surgery', 'Orthopaedics', 'Urology', 'Vascular Surgery',
    'Cardiothoracic Surgery', 'Neurosurgery', 'Plastic Surgery', 'Otorhinolaryngology', 'Breast/Endocrine Surgery', 'Trauma Surgery', 'Ophthalmology', 'OMS/Dental'], 'Surgery'],
  ['psych', 'Psychiatry', '💭', ['Psychiatry', 'Addiction Medicine'], 'Psych'],
  ['gp', 'General Practice & Community', '🩺', ['General Practice', 'Indigenous Health', 'Rural & Remote Medicine', 'Occupational/Environmental Medicine',
    'Public Health', 'Bioethics', 'Professionalism', 'Medicolegal'], 'GP'],
];
const DISC_OF = new Map(DISCIPLINES.flatMap(([id, , , specs]) => specs.map(s => [s, id])));
export const disciplineOf = name => DISC_OF.get(name) || 'med';
export const disciplineName = id => (DISCIPLINES.find(d => d[0] === id) || [])[1] || '';
/* does an item with these specialty names pass a selection? none selected = every item */
export const discMatch = (sel, names) => !(sel && sel.length) || [].concat(names || []).some(n => sel.includes(disciplineOf(n)));
/* items per discipline, in the table's order: [[id, n]]; an item with two specialties in one discipline counts once */
export function discCounts(items, namesOf) {
  const n = new Map(DISCIPLINES.map(d => [d[0], 0]));
  for (const x of items || []) for (const id of new Set([].concat(namesOf(x) || []).map(disciplineOf))) n.set(id, n.get(id) + 1);
  return [...n];
}
/* a tap: '' is All (clears), else the id toggles; every discipline on is All again */
export function discToggle(sel, id, present = DISCIPLINES.map(d => d[0])) {
  if (!id) return [];
  const s = (sel || []).includes(id) ? sel.filter(x => x !== id) : [...(sel || []), id];
  return present.every(x => s.includes(x)) ? [] : s;
}
/* the row: All + one pill per discipline present (emoji, short name, count). counts: [[id, n]] (a zero hides the pill),
   state: id -> 'on' | 'part' | 'off', all: { on, n }. A tap carries data-disc (id, '' for All); the row's data-disc-row
   names the page so one listener can tell two rows apart. */
export function discRowHtml(page, counts, state, all) {
  const pill = (id, label, emoji, n, st, name) => `<button class="kit-disc-b${st === 'on' ? ' on' : st === 'part' ? ' part' : ''}" data-disc="${id}" aria-pressed="${st === 'on' ? 'true' : st === 'part' ? 'mixed' : 'false'}" aria-label="${attr(name)}, ${n}">${emoji ? `<i aria-hidden="true">${emoji}</i>` : ''}<span aria-hidden="true">${attr(label)}</span><b aria-hidden="true">${n}</b></button>`;
  return `<div class="kit-disc" role="group" aria-label="Discipline" data-disc-row="${attr(page)}">${pill('', 'All', '', all.n, all.on ? 'on' : 'off', 'All disciplines')}${
    counts.filter(([, n]) => n).map(([id, n]) => { const d = DISCIPLINES.find(x => x[0] === id); return pill(id, d[4], d[2], n, state(id), d[1]); }).join('')}</div>`;
}
