/* mcq/schema.mjs - one single-best-answer question, the shape every writer of the MCQ pool uses (docs/mcq.md).

     { id, stem, ask?, options[4..5], answer (0-based), explanation, why[one per option, or null], topic, tags[], year? (1-4, mcq/year.mjs),
       provenance: { kind, source: { name, url, licence, retrieved }, author?, submittedBy?, createdAt,
                     generator?: { how, version, basis[], exemplars[]?, model? } },
       eval?: { ... the selector's record: flaws, scores, verdict, reasons, evaluatedAt, evalVersion } }

   kind says where the question came from, and it is never rewritten by a later step:
     user            written (or brought from an open resource) by a student through Submit a question
     ai              written by a model (generate-mcq.mjs), or made in code from an AI-written station
     amsa            made from an AMSA MedEd OSCE station (the station's case is AMSA's; its text is AI-written)
     usmle-resource  an open, licensed online USMLE-style bank (MedQA, MMLU professional medicine)
   The reviewer's suggestion for a question is kept beside it, in its verdict (data/mcq/verdicts.json, rubric.suggestion),
   and never applied to it: a user's question stays exactly the user's. Plain text throughout: every surface renders with textContent or esc(), so a question can carry no markup.
   Pure: the app's submit form, the scripts and the tests share it. */
import { isYear } from './year.mjs';

export const KINDS = Object.freeze({ user: 'User', ai: 'AI', amsa: 'AMSA', 'usmle-resource': 'USMLE resource' });
export const KIND_NOTE = Object.freeze({
  user: 'Written or brought by a student',
  ai: 'Written by AI',
  amsa: 'Made from an AMSA MedEd OSCE case (the station text is AI-written)',
  'usmle-resource': 'From an open online USMLE-style question bank'
});
export const HOWS = Object.freeze(['session', 'cli', 'api', 'duel-pack', 'stub']);
export const MAX = Object.freeze({ id: 80, stem: 4000, ask: 300, option: 300, explanation: 4000, why: 800, topic: 60, tag: 40, tags: 16, name: 200, url: 500, licence: 200, author: 80 });
export const OPTIONS = Object.freeze({ min: 4, max: 5 });
export const LETTERS = 'ABCDE';

/* the licences an item may ship under. "own" means the writer licenses it to this pool (a user's own question, a
   generated one); anything copyrighted, or from a commercial bank, never ships */
export const LICENCES = Object.freeze(['own', 'CC0', 'CC BY 4.0', 'CC BY-SA 4.0', 'CC BY-NC 4.0', 'CC BY-NC-SA 4.0', 'MIT', 'Public domain']);
const LICENCE_RE = /^(own|cc0|cc[ -]by(?:[ -](?:sa|nc|nc[ -]sa|nd))?(?:[ -]\d\.\d)?|mit\b|public domain)/i;
export const BANNED_SOURCE = /\b(nbme|fsmb|usmle\.org|uworld|amboss|kaplan|pastest|passmedicine|boards ?and ?beyond|truelearn|first ?aid q|rx ?bank|lecturio|onexamination|bmj onexamination|medbullets|osmosis)\b/i;
export const licenceOk = l => typeof l === 'string' && LICENCE_RE.test(l.trim()) && !/all rights reserved/i.test(l);   /* an MIT licence names its copyright holder; "Copyright NBME" alone does not match the list */

const line = (v, n) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b-\u001f]/g, '').replace(/[ \t]+/g, ' ').trim().slice(0, n) : '');
const block = (v, n) => (typeof v === 'string' ? v.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, n) : '');
const ID = /^[a-z0-9][a-z0-9._-]{2,79}$/i;
const ISO = /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/;
export const tagOf = s => line(String(s ?? ''), MAX.tag).toLowerCase().replace(/[^a-z0-9:+&.-]+/g, '-').replace(/^-+|-+$/g, '');

/* a question as stored, or null: unknown fields drop, text is trimmed and capped, provenance is copied as given (only
   cleaned), never re-derived. `problems` gives the reasons a null came back */
export function cleanItem(q) {
  if (!q || typeof q !== 'object' || Array.isArray(q)) return null;
  const id = typeof q.id === 'string' && ID.test(q.id) ? q.id : '';
  const options = Array.isArray(q.options) ? q.options.map(o => line(o, MAX.option)) : [];
  const out = { id, stem: block(q.stem, MAX.stem) };
  const ask = line(q.ask, MAX.ask); if (ask) out.ask = ask;
  out.options = options;
  out.answer = Number.isInteger(q.answer) ? q.answer : -1;
  out.explanation = block(q.explanation, MAX.explanation);
  out.why = options.map((_, i) => { const w = Array.isArray(q.why) ? line(q.why[i], MAX.why) : ''; return w || null; });
  out.topic = line(q.topic, MAX.topic);
  out.tags = [...new Set((Array.isArray(q.tags) ? q.tags : []).map(tagOf).filter(Boolean))].slice(0, MAX.tags);
  if (isYear(q.year)) out.year = q.year;
  out.provenance = cleanProvenance(q.provenance);
  if (q.eval && typeof q.eval === 'object' && !Array.isArray(q.eval)) out.eval = q.eval;
  return itemProblems(out).length ? null : out;
}

export function cleanProvenance(p) {
  const o = p && typeof p === 'object' && !Array.isArray(p) ? p : {}, s = o.source && typeof o.source === 'object' ? o.source : {};
  const out = { kind: Object.hasOwn(KINDS, o.kind) ? o.kind : '', source: { name: line(s.name, MAX.name), url: line(s.url, MAX.url), licence: line(s.licence, MAX.licence) } };
  const ret = line(s.retrieved, 30); if (ret) out.source.retrieved = ret;
  const author = line(o.author, MAX.author); if (author) out.author = author;
  const by = line(o.submittedBy, MAX.author); if (by) out.submittedBy = by;
  out.createdAt = ISO.test(String(o.createdAt || '')) ? String(o.createdAt) : '';
  if (o.generator && typeof o.generator === 'object') {
    const g = o.generator, gen = { how: HOWS.includes(g.how) ? g.how : '', version: line(g.version, 40), basis: (Array.isArray(g.basis) ? g.basis : []).map(b => line(b, MAX.id)).filter(Boolean) };
    const ex = (Array.isArray(g.exemplars) ? g.exemplars : []).map(b => line(b, MAX.id)).filter(Boolean); if (ex.length) gen.exemplars = ex;
    const model = line(g.model, 60); if (model) gen.model = model;
    out.generator = gen;
  }
  return out;
}

/* every reason the question cannot be stored as it is (empty when it can) */
export function itemProblems(q) {
  const p = [];
  if (!q || typeof q !== 'object') return ['not an object'];
  if (!ID.test(String(q.id || ''))) p.push('id: letters, digits, dot, dash or underscore, 3 to 80 characters');
  if (typeof q.stem !== 'string' || q.stem.trim().length < 20) p.push('stem: at least 20 characters');
  if (/<\/?[a-z][^>]*>/i.test(`${q.stem} ${q.ask || ''} ${(q.options || []).join(' ')} ${q.explanation || ''}`)) p.push('plain text only: no HTML tags');
  const n = Array.isArray(q.options) ? q.options.length : 0;
  if (n < OPTIONS.min || n > OPTIONS.max) p.push(`options: ${OPTIONS.min} or ${OPTIONS.max} (${n} given)`);
  else if (q.options.some(o => typeof o !== 'string' || !o.trim())) p.push('options: an empty option');
  if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= n) p.push('answer: mark one option as the key');
  if (q.why && (!Array.isArray(q.why) || q.why.length !== n)) p.push('why: one entry per option');
  if (q.year != null && !isYear(q.year)) p.push('year: 1, 2, 3 or 4');
  const pv = q.provenance || {};
  if (!Object.hasOwn(KINDS, pv.kind)) p.push(`provenance.kind: one of ${Object.keys(KINDS).join(', ')}`);
  if (!pv.source || !String(pv.source.name || '').trim()) p.push('provenance.source.name: where the question came from');
  if (!pv.source || !licenceOk(pv.source.licence)) p.push(`provenance.source.licence: one of ${LICENCES.join(', ')}`);
  if (pv.source && BANNED_SOURCE.test(`${pv.source.name} ${pv.source.url}`)) p.push('provenance.source: a copyrighted commercial or official bank cannot be shared here');
  if (!ISO.test(String(pv.createdAt || ''))) p.push('provenance.createdAt: an ISO date');
  if (pv.kind === 'ai' && !(pv.generator && pv.generator.how)) p.push('provenance.generator: an AI question says how it was made');
  if (pv.kind === 'user' && !String(pv.submittedBy || pv.author || '').trim()) p.push('provenance.submittedBy: who submitted it');
  return p;
}

/* the whole question the student reads: the vignette and its lead-in */
export const fullStem = q => (q.ask ? `${q.stem.trim()} ${q.ask.trim()}` : q.stem.trim());
/* the chip a surface shows, and the duel's origin (the vendored duel knows 'ai' and 'human' only) */
export const kindLabel = q => KINDS[q?.provenance?.kind] || '';
export const duelOrigin = q => (q?.provenance?.kind === 'ai' || q?.provenance?.kind === 'amsa' ? 'ai' : 'human');

/* a stable short hash (FNV-1a, 32-bit, hex) of a question's content: a verdict is for this exact text */
export function fnv(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16).padStart(8, '0'); }
export const contentHash = q => fnv(JSON.stringify([fullStem(q), q.options, q.answer]));

/* a user's question id: the time and four random characters, "u-" first */
export const newUserId = (now, rnd = Math.random) => `u-${Math.floor(now).toString(36)}${Math.floor(rnd() * 36 ** 4).toString(36).padStart(4, '0')}`;

/* ------------------------------------------------------------------ import: JSON or CSV pasted into the form */
/* CSV with a header row: stem, ask?, a..e (or option1..option5), answer (a letter or 1-based number), explanation?,
   topic?, source?, url?, licence?, author?. Quoted fields may hold commas, quotes ("") and new lines. */
export function parseCsv(text) {
  const rows = [], s = String(text ?? '').replace(/\r\n?/g, '\n');
  let row = [], f = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"') { if (s[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; continue; }
    if (c === '"' && f === '') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim()));
}
const letterIndex = (v, n) => {
  const t = String(v ?? '').trim();
  if (/^[A-Ea-e]$/.test(t)) return t.toUpperCase().charCodeAt(0) - 65;
  if (/^\d$/.test(t)) return Number(t) - 1;
  return Number.isInteger(v) ? v : -1;
};
/* the drafts in what was pasted: a question, a list, { questions: [...] }, an exported submissions file, or CSV. Each
   draft is the form's fields (not yet a question: the submitter's name, id and provenance are added on submit) */
export function draftsFrom(text) {
  const s = String(text ?? '').trim(); if (!s) return [];
  let j; try { j = JSON.parse(s); } catch { j = undefined; }
  if (j !== undefined) {
    const list = Array.isArray(j) ? j : Array.isArray(j?.questions) ? j.questions : Array.isArray(j?.items) ? j.items.map(x => x?.item || x) : [j];
    return list.filter(x => x && typeof x === 'object').map(x => {
      const options = Array.isArray(x.options) ? x.options.map(String) : ['a', 'b', 'c', 'd', 'e'].map(k => x[k] ?? x[k.toUpperCase()]).filter(v => v != null).map(String);
      const answer = Number.isInteger(x.answer) && x.answer >= 0 && x.answer < options.length ? x.answer : letterIndex(x.answer ?? x.key ?? x.correct, options.length);
      const src = x.provenance?.source || x.source || {};
      return { stem: String(x.stem ?? x.question ?? ''), ask: String(x.ask ?? ''), options, answer, explanation: String(x.explanation ?? ''),
        why: Array.isArray(x.why) ? x.why : [], topic: String(x.topic ?? ''), tags: Array.isArray(x.tags) ? x.tags : [],
        source: typeof src === 'string' ? src : String(src.name ?? ''), url: String(src.url ?? x.url ?? ''), licence: String(src.licence ?? x.licence ?? ''), author: String(x.provenance?.author ?? x.author ?? '') };
    });
  }
  const rows = parseCsv(s); if (rows.length < 2) return [];
  const head = rows[0].map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
  const col = (...names) => head.findIndex(h => names.includes(h));
  const c = { stem: col('stem', 'question', 'vignette'), ask: col('ask', 'leadin'), answer: col('answer', 'key', 'correct'), explanation: col('explanation', 'rationale'),
    topic: col('topic', 'specialty'), source: col('source'), url: col('url', 'link'), licence: col('licence', 'license'), author: col('author') };
  const opt = ['a', 'b', 'c', 'd', 'e'].map((k, i) => col(k, `option${k}`, `option${i + 1}`, `opt${i + 1}`));
  if (c.stem < 0 || opt.filter(i => i >= 0).length < OPTIONS.min) return [];
  const get = (r, i) => (i >= 0 ? String(r[i] ?? '').trim() : '');
  return rows.slice(1).map(r => {
    const options = opt.map(i => get(r, i)).filter(Boolean);
    return { stem: get(r, c.stem), ask: get(r, c.ask), options, answer: letterIndex(get(r, c.answer), options.length), explanation: get(r, c.explanation), why: [],
      topic: get(r, c.topic), tags: [], source: get(r, c.source), url: get(r, c.url), licence: get(r, c.licence), author: get(r, c.author) };
  });
}

/* a draft from the form (or an import) into a user question: the submitter, the time, and the source they stated. A
   question the student wrote is "own"; one they brought from elsewhere names it and its licence */
const trailing = a => { const o = (Array.isArray(a) ? a : []).map(x => String(x ?? '')); while (o.length && !o[o.length - 1].trim()) o.pop(); return o; };   /* an empty fifth option is no option; an empty one in the middle stays, and is reported */
export function userItem(d, { by, now, id }) {
  const own = !String(d.source || '').trim(), options = trailing(d.options);
  return {
    id, stem: d.stem, ...(String(d.ask || '').trim() ? { ask: d.ask } : {}), options, answer: d.answer,
    explanation: d.explanation || '', why: options.map((_, i) => (Array.isArray(d.why) && d.why[i]) || null), topic: d.topic || '', tags: d.tags || [],
    provenance: {
      kind: 'user', source: own ? { name: 'Written by the submitter', url: '', licence: 'own' } : { name: d.source, url: d.url || '', licence: d.licence || '' },
      ...(String(d.author || '').trim() ? { author: d.author } : {}), submittedBy: by, createdAt: new Date(now).toISOString()
    }
  };
}
