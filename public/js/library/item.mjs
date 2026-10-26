/* library/item.mjs - a student's own question in their library (docs/library.md): the MCQ pool's item
   (mcq/schema.mjs, provenance kind "user", licence "own") plus the two layers every drill-down in Med-OS uses: topic
   (the specialty, study-kit/vocab.mjs) and cat (the kind: OSCE skills, Clinical, Physiology and pathophysiology,
   Anatomy, the same ids as the duel's questions, scripts/lib/mcq.mjs CATS).

     library item { ...the pool's item, cat }      a deck { id, name, items: [library item] }

   readUpload() reads what ChatGPT returned (library/prompt.mjs), or any JSON or CSV the pool's paste reads, into
   drafts; check() turns each into an item and lists what stops it (the shape, the specialty and kind, and the
   item-writing checks the pool runs, mcq/flaws.mjs). Plain text only. Pure: the view, the tests and nothing else. */
import { draftsFrom, parseCsv, userItem, cleanItem, itemProblems, newUserId, fnv, contentHash } from '../mcq/schema.mjs';
import { flawReport } from '../mcq/flaws.mjs';
import { DISCIPLINES } from '../study-kit/vocab.mjs';
import { yearOf, guessYear, YEARS, diffOf, guessDiff, DIFFICULTY } from '../mcq/year.mjs';

/* the kinds, in the order the drill-down shows them (the duel's pack.json cats use the same ids and labels) */
export const KINDS = Object.freeze({
  skills: { label: 'OSCE skills', brief: 'how to run the station: the question to ask, the examination step, what to say, the procedure.' },
  clinical: { label: 'Clinical', brief: 'diagnosis, investigation or management: the next test, its result, the treatment and dose.' },
  physio: { label: 'Physiology and pathophysiology', short: 'Physiology', brief: 'the mechanism behind a condition, sign, result or treatment.' },
  anatomy: { label: 'Anatomy', brief: 'the structure, its supply or innervation, a landmark, where a lesion sits.' }
});
export const KIND_IDS = Object.keys(KINDS);
export const SPECIALTIES = DISCIPLINES.flatMap(d => d[3]);
export const LIMITS = Object.freeze({ upload: 500, items: 2000, decks: 50, bytes: 16384, deckName: 40 });

const squash = s => String(s ?? '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '');
const SPEC_BY = new Map(SPECIALTIES.map(s => [squash(s), s]));
/* the short names students use, to the specialty (the discipline's own short name, e.g. Paeds, goes to its first) */
for (const [, name, , specs, short] of DISCIPLINES) { if (!SPEC_BY.has(squash(short))) SPEC_BY.set(squash(short), specs[0]); if (!SPEC_BY.has(squash(name))) SPEC_BY.set(squash(name), specs[0]); }
for (const [k, v] of Object.entries({ paeds: 'Paediatrics', peds: 'Paediatrics', pediatrics: 'Paediatrics', obgyn: 'Obstetrics', obs: 'Obstetrics', gynae: 'Gynaecology', gyn: 'Gynaecology', ed: 'Emergency Medicine', emergency: 'Emergency Medicine', icu: 'Critical Care Medicine', cardio: 'Cardiology', resp: 'Respiratory Medicine', gastro: 'Gastroenterology', neuro: 'Neurology', endo: 'Endocrinology', renal: 'Nephrology', haem: 'Haematology', heme: 'Haematology', rheum: 'Rheumatology', id: 'Infectious Diseases', derm: 'Dermatology', onc: 'Oncology', surgery: 'General Surgery', ortho: 'Orthopaedics', ent: 'Otorhinolaryngology', ophthal: 'Ophthalmology', psych: 'Psychiatry', gp: 'General Practice', ethics: 'Bioethics' })) if (!SPEC_BY.has(k)) SPEC_BY.set(k, v);
export const specialtyOf = s => SPEC_BY.get(squash(s)) || '';

const KIND_BY = new Map([...KIND_IDS.map(k => [k, k]), ...Object.entries(KINDS).map(([k, v]) => [squash(v.label), k]),
  ['osceskills', 'skills'], ['osce', 'skills'], ['skill', 'skills'], ['communication', 'skills'], ['examination', 'skills'], ['procedure', 'skills'],
  ['diagnosis', 'clinical'], ['management', 'clinical'], ['investigation', 'clinical'], ['pharmacology', 'clinical'],
  ['physiology', 'physio'], ['pathophysiology', 'physio'], ['pathology', 'physio'], ['mechanism', 'physio'], ['anat', 'anatomy']]);
export const kindOf = s => KIND_BY.get(squash(s)) || '';

/* the extra fields the pool's reader drops: specialty and kind, per draft in order (JSON list, { questions }, or CSV) */
function layersOf(text) {
  const s = String(text ?? '').trim();
  let j; try { j = JSON.parse(stripFence(s)); } catch { j = undefined; }
  if (j !== undefined) {
    const list = Array.isArray(j) ? j : Array.isArray(j?.questions) ? j.questions : Array.isArray(j?.items) ? j.items.map(x => x?.item || x) : [j];
    return list.filter(x => x && typeof x === 'object').map(x => ({ specialty: String(x.specialty ?? x.topic ?? ''), kind: String(x.kind ?? x.cat ?? x.category ?? ''), year: x.year ?? x.level ?? '', difficulty: x.difficulty ?? x.diff ?? '' }));
  }
  const rows = parseCsv(s); if (rows.length < 2) return [];
  const head = rows[0].map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
  const sp = head.findIndex(h => ['specialty', 'topic'].includes(h)), kd = head.findIndex(h => ['kind', 'cat', 'category'].includes(h)), yr = head.findIndex(h => ['year', 'level'].includes(h)), df = head.findIndex(h => ['difficulty', 'diff'].includes(h));
  return rows.slice(1).map(r => ({ specialty: sp >= 0 ? String(r[sp] ?? '') : '', kind: kd >= 0 ? String(r[kd] ?? '') : '', year: yr >= 0 ? String(r[yr] ?? '') : '', difficulty: df >= 0 ? String(r[df] ?? '') : '' }));
}
/* ChatGPT often wraps its answer in a ```json fence, or says a line first: keep the JSON */
export function stripFence(s) {
  const t = String(s ?? '').trim(), f = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (f) return f[1].trim();
  const a = t.indexOf('['), b = t.lastIndexOf(']');
  return a > 0 && b > a && !/^[\[{]/.test(t) ? t.slice(a, b + 1) : t;
}

/* drafts from an upload: the pool's draft fields plus topic (the specialty as written) and kind (as written) */
export function readUpload(text) {
  const clean = stripFence(text), drafts = draftsFrom(clean), layers = layersOf(clean);
  return drafts.map((d, i) => ({ ...d, topic: layers[i]?.specialty || d.topic, kind: layers[i]?.kind || '', year: layers[i]?.year ?? '', difficulty: layers[i]?.difficulty ?? '' }));
}

/* one draft as a library item, and every reason it cannot be saved yet (worst first); a question with only "Fix" or
   "Tip" findings can be saved, a "Must fix" cannot. by: the account's name; id: given, else a fresh one */
const SEV_ORDER = { block: 0, major: 1, minor: 2 };
export function check(draft, { by, now, id } = {}) {
  const topic = specialtyOf(draft.topic), cat = kindOf(draft.kind), out = [];
  const base = userItem({ ...draft, topic, source: '', url: '', licence: '' }, { by: by || 'You', now, id: id || newUserId(now) });
  for (const reason of itemProblems(base)) out.push({ check: 'schema', severity: 'block', reason });
  if (!topic) out.push({ check: 'specialty', severity: 'block', reason: draft.topic ? `specialty: "${String(draft.topic).slice(0, 40)}" is not one Med-OS knows` : 'specialty: give one (e.g. Paediatrics)' });
  if (!cat) out.push({ check: 'kind', severity: 'block', reason: draft.kind ? `kind: "${String(draft.kind).slice(0, 40)}" is not one of OSCE skills, Clinical, Physiology, Anatomy` : 'kind: give one (skills, clinical, physio or anatomy)' });
  if (!out.length) for (const f of flawReport(base).failed) if (f.severity !== 'info' && f.check !== 'schema') out.push({ check: f.check, severity: f.severity, reason: f.reason });
  /* the year (mcq/year.mjs): as given, else a guess from the kind and the lead-in, said as a tip */
  let year = yearOf(draft.year);
  if (!year) { year = guessYear({ ...base, cat }); if (!out.some(x => x.severity === 'block')) out.push({ check: 'year', severity: 'minor', reason: `year: ${String(draft.year ?? '').trim() ? `"${String(draft.year).slice(0, 20)}" is not 1 to 4` : 'not given'}, so ${YEARS[year].label} (${YEARS[year].name}) is guessed` }); }
  let difficulty = diffOf(draft.difficulty);
  if (!difficulty) { difficulty = guessDiff(base); if (!out.some(x => x.severity === 'block')) out.push({ check: 'difficulty', severity: 'minor', reason: `difficulty: not given, so ${DIFFICULTY[difficulty].label} is guessed` }); }
  out.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]);
  const item = out.some(x => x.severity === 'block') ? null : cleanItem(base);
  if (item && JSON.stringify(item).length > LIMITS.bytes) return { item: null, problems: [{ check: 'size', severity: 'block', reason: 'too long: keep a question under 16 KB' }, ...out] };
  return { item: item ? { ...item, year, difficulty, cat } : null, problems: out };
}

/* a whole upload: { ready: [item], rows: [{ n, stem, item, problems }] }; a question already in `have` (the same
   stem, options and key) is skipped, so pasting the same answer twice adds nothing */
export function checkUpload(text, { by, now, have = [] } = {}) {
  const seen = new Set(have.map(contentHash)), rows = [], ready = [];
  readUpload(text).slice(0, LIMITS.upload).forEach((d, i) => {
    const r = check(d, { by, now, id: `u-${Math.floor(now).toString(36)}${fnv(`${i}:${d.stem}`).slice(0, 5)}` });
    if (r.item && seen.has(contentHash(r.item))) r.problems.unshift({ check: 'repeat', severity: 'block', reason: 'already in your library' }), (r.item = null);
    if (r.item) { seen.add(contentHash(r.item)); ready.push(r.item); }
    rows.push({ n: i + 1, stem: String(d.stem || '').slice(0, 160), item: r.item, problems: r.problems });
  });
  return { ready, rows, more: readUpload(text).length > LIMITS.upload };
}

/* a deck's name: trimmed, one line, at most 40 characters; '' when there is none */
export const deckName = s => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, LIMITS.deckName);
/* "Paediatrics › Clinical", and with the year "Year 2 · Paediatrics › Clinical" */
export const layerLabel = it => `${it.topic || 'No specialty'}${it.cat ? ` › ${KINDS[it.cat]?.label || it.cat}` : ''}`;
export const yearLabel = it => (YEARS[it?.year] ? YEARS[it.year].label : '');
export const diffLabel = it => (DIFFICULTY[it?.difficulty] ? DIFFICULTY[it.difficulty].label : '');

/* the drill-down over a set of items: [{ topic, count, cats: [{ id, label, count }] }], biggest topic first */
export function layers(items) {
  const by = new Map();
  for (const it of items || []) { const t = by.get(it.topic) || by.set(it.topic, { topic: it.topic, count: 0, cats: Object.fromEntries(KIND_IDS.map(k => [k, 0])) }).get(it.topic); t.count++; if (it.cat in t.cats) t.cats[it.cat]++; }
  return [...by.values()].sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic)).map(t => ({ ...t, cats: KIND_IDS.map(id => ({ id, label: KINDS[id].label, count: t.cats[id] })) }));
}
export const inPick = (it, { topic = '', cat = '' } = {}) => (!topic || it.topic === topic) && (!cat || it.cat === cat);
