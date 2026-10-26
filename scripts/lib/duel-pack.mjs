/* duel-pack.mjs: the duel's MCQs, made from the station bank (scripts/build-duel-pack.mjs writes them to
   public/duel/pack.json; npm test fails when that file is stale).

   One single-best-answer question per station: "what is the most likely diagnosis?"
     stem     the patient (age, sex, setting from `demo`) and the findings the station's own differential gives for
              its likely diagnosis (ddx[tier=likely].for)
     options  that diagnosis and three more from the same station's differential, dangerous ones first: the
              alternatives an examiner wants ruled out, so the question tests the reasoning, not a guess
     notes    for each wrong option, why it is not it (that differential's `against`)
     why      the station's first learning point
   The stations are AI-written (origin "ai"), so every question is too, and the duel shows the AI tag. Pure.
   Known limit: the likely diagnosis is often the most specific name, so it is the longest option in about 4 of 10
   questions (1 in 4 by chance); the duel shuffles the options, and an AI-written pack can replace this one. */

import { CATS, gate } from './mcq.mjs';

export const LIMITS = { option: 70, minDistractors: 3 }, LONG = 1.8;
const SETTING = { gp: 'in general practice', ed: 'in the emergency department', ward: 'on the ward', clinic: 'in clinic', 'birth suite': 'in the birth suite', recovery: 'in recovery' };
const strip = s => String(s ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
const sentence = s => { const t = strip(s); return !t ? '' : /[.?!]$/.test(t) ? t : `${t}.`; };

/* the name of a diagnosis without its qualifiers, so the right option is not the one that reads like a textbook:
   "Acute ischaemic stroke in the right ACA territory, cardioembolic from AF" is "Acute ischaemic stroke in the right
   ACA territory"; "Generalised (nodal) osteoarthritis of the hands" keeps its noun; "Early seropositive, erosive
   rheumatoid arthritis" keeps both adjectives; "Duodenal ulcer associated with H. pylori" is "Duodenal ulcer" */
const QUALIFIER = /,\s|;\s|\s(?:with|due to|from|secondary to|caused by|after|arising|triggered by|following|plus|alongside)\s/;
const ADJ_COMMA = /\b([A-Za-z-]+(?:ive|ous|al|ic|ed|ent|ant|ary)|early|late|acute|chronic|severe|mild)\s*,\s+(?=[a-z])/g;
export function shortDx(s) {
  let t = strip(s).replace(/\.$/, '').replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
  t = t.replace(ADJ_COMMA, '$1 ');
  t = t.split(QUALIFIER)[0].trim().replace(/\s+(?:associated|related|complicated|caused|induced|accompanied|presenting|combined)$/i, '');
  if (t.length > LIMITS.option) t = t.split(/\s(?:in|of|on)\s/)[0].trim();
  if (t.length > LIMITS.option) t = t.slice(0, LIMITS.option).replace(/\s+\S*$/, '');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/* "A 65-year-old man in the emergency department", "A 5-week-old baby boy in general practice" */
export function patientLine(demo = {}) {
  const age = Number(demo.age), unit = demo.unit || 'years', sex = demo.sex;
  const place = SETTING[demo.setting] ? ` ${SETTING[demo.setting]}` : '';
  if (!Number.isFinite(age) || age <= 0) return `A patient${place}`;
  const one = { years: 'year', months: 'month', weeks: 'week', days: 'day' }[unit] || 'year';
  const who = unit !== 'years' || age < 1
    ? (sex === 'M' ? 'baby boy' : sex === 'F' ? 'baby girl' : 'baby')
    : age < 13 ? (sex === 'M' ? 'boy' : sex === 'F' ? 'girl' : 'child')
      : age < 18 ? (sex === 'M' ? 'boy' : sex === 'F' ? 'girl' : 'teenager')
        : (sex === 'M' ? 'man' : sex === 'F' ? 'woman' : 'person');
  const n = String(age);
  return `${/^8/.test(n) || n === '11' || n === '18' ? 'An' : 'A'} ${n}-${one}-old ${who}${place}`;
}

const same = (a, b) => { const x = a.toLowerCase(), y = b.toLowerCase(); return x === y || x.includes(y) || y.includes(x); };

/* one station's question, or { q: null, why } when it cannot make a fair one. `pool` is every station, for the rare
   differential too short to give three wrong options */
export function stationQuestion(st, pool = []) {
  const ddx = Array.isArray(st?.ddx) ? st.ddx : [];
  const likely = ddx.find(d => d.tier === 'likely');
  if (!likely) return { q: null, why: `${st?.id}: no likely diagnosis` };
  let answer = shortDx(likely.dx);
  const found = sentence(likely.for);
  if (!answer || !found) return { q: null, why: `${st.id}: no diagnosis or findings` };
  const rank = { dangerous: 0, reasonable: 1 };
  const alts = ddx.filter(d => d !== likely).sort((a, b) => (rank[a.tier] ?? 2) - (rank[b.tier] ?? 2));
  const picked = [];
  for (const d of alts) {
    const o = shortDx(d.dx);
    if (o && !same(o, answer) && !picked.some(p => same(p.o, o))) picked.push({ o, note: sentence(d.against) || null });
    if (picked.length === LIMITS.minDistractors) break;
  }
  if (picked.length < LIMITS.minDistractors) {   /* top up from other stations of the same specialty */
    const spec = st.specialty?.[0];
    for (const other of pool) {
      if (other === st || other.id === st.id || (spec && other.specialty?.[0] !== spec)) continue;
      const l = (other.ddx || []).find(d => d.tier === 'likely');
      const o = l && shortDx(l.dx);
      if (o && !same(o, answer) && !picked.some(p => same(p.o, o))) picked.push({ o, note: null });
      if (picked.length === LIMITS.minDistractors) break;
    }
  }
  if (picked.length < LIMITS.minDistractors) return { q: null, why: `${st.id}: fewer than ${LIMITS.minDistractors} wrong options` };
  /* the longest option should not be the right one by a mile: trim its "in the ..." when it is */
  const mean = picked.reduce((n, p) => n + p.o.length, 0) / picked.length;
  if (answer.length > LONG * mean) { const cut = answer.split(/\s(?:in|of|on)\s/)[0].trim(); if (cut.split(' ').length >= 2 && !picked.some(p => same(p.o, cut))) answer = cut; }
  const stem = `${patientLine(st.demo)}. ${found} What is the most likely diagnosis?`;
  if (stem.toLowerCase().includes(answer.toLowerCase())) return { q: null, why: `${st.id}: the findings name the answer` };
  return {
    q: {
      id: `osce-${st.id}`, stem, options: [answer, ...picked.map(p => p.o)], answer: 0,
      notes: [null, ...picked.map(p => p.note)], why: sentence(st.points?.[0]) || undefined,
      topic: st.specialty?.[0] || undefined, cat: 'clinical', origin: 'ai', station: st.id
    },
    why: ''
  };
}

/* the pack: every station that makes a fair question, in id order, then the station's category questions
   (scripts/generate-mcq.mjs, public/duel/mcq/<station>.json; each passes lib/mcq.mjs gate again here, so a hand edit
   that breaks one leaves it out), all under the station's first specialty; `dropped` says why any are not in */
export function buildPack(stations, mcq = {}) {
  const list = [...stations].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)), questions = [], dropped = [];
  for (const st of list) {
    const { q, why } = stationQuestion(st, list); if (q) questions.push(q); else dropped.push(why);
    for (const m of mcq[st.id]?.questions || []) {
      const issues = gate(m);
      if (issues.length) { dropped.push(`${m.id}: ${issues.join('; ')}`); continue; }
      questions.push({ id: m.id, stem: m.stem, options: m.options, answer: m.answer, notes: m.notes, why: m.why, topic: st.specialty?.[0] || undefined, cat: m.cat, origin: 'ai', station: st.id });
    }
  }
  return {
    pack: { schemaVersion: 1, version: `stations-${list.length}-mcq-${Object.keys(mcq).length}`, title: 'OSCE questions', source: 'Built by scripts/build-duel-pack.mjs from public/osce/ and public/duel/mcq/: per station, its likely diagnosis against its own differential, and one question in each of OSCE skills, Clinical, Physiology and pathophysiology, and Anatomy.', origin: 'ai',
      cats: CATS.map(c => ({ id: c.id, label: c.label })), questions },
    dropped
  };
}
