/* lib/station-gates.mjs - pure: what a station must be before it ships. The generator runs every gate on its draft and
   revises once on the problems; the validator runs the shape gates over the whole bank. Benchmarks come from the bank
   itself (bankStats): a new station's checklist sits inside the range the existing stations of its kind cover.
   -> [problems] (empty = passes). Tested in scripts/station-gates.test.js. */
import { allowlistCheck } from '../../public/js/study-kit/safe.mjs';
import { DISCIPLINES, specialtyEmoji } from '../../public/js/study-kit/vocab.mjs';
import { osceLeaves, CX } from '../../public/js/osce/core.mjs';
import { requestProblems } from '../imaging/rank.mjs';

export const TYPES = ['History', 'Examination', 'Management', 'Counselling', 'Emergency', 'Ward Call', 'Interpretation', 'Prescribing', 'Procedure'];
export const KNOWN_SPECIALTIES = new Set(DISCIPLINES.flatMap(d => d[3]));
export const isAcute = st => (st.type || []).some(t => t === 'Emergency' || t === 'Ward Call');
export const STATION_MIN = 8, READING_MIN = 2;

/* checklist size per kind, from the bank: the 10th to 90th centile of leaves, widened a little; Critical share 10-80% */
export function bankStats(stations) {
  const pct = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))] : 0; };
  const out = {};
  for (const kind of ['acute', 'clinic']) {
    const n = stations.filter(s => (kind === 'acute') === isAcute(s)).map(s => osceLeaves(s.check).length).filter(Boolean);
    out[kind] = n.length >= 3 ? { min: Math.max(12, Math.floor(pct(n, 0.1) * 0.9)), max: Math.ceil(pct(n, 0.9) * 1.1), median: pct(n, 0.5) } : { min: 15, max: 50, median: 30 };
  }
  return out;
}

const plain = h => String(h || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const HTML_FIELDS = ['stem', 'patient', 'guide', 'explain'];

/* the shape every station in the bank must have */
export function shapeProblems(st) {
  const p = [];
  if (!st || typeof st !== 'object') return ['not an object'];
  if (!/^[\w-]{3,64}$/.test(String(st.id || ''))) p.push('id missing or malformed');
  for (const k of ['title', 'desc', 'stem', 'patient']) if (!plain(st[k])) p.push(`${k} is empty`);
  if (!Array.isArray(st.specialty) || !st.specialty.length) p.push('no specialty');
  if (!Array.isArray(st.type) || !st.type.length) p.push('no station type');
  if (st.complexity && !CX.includes(st.complexity)) p.push(`complexity ${st.complexity} is not ${CX.join(' | ')}`);
  if (!Array.isArray(st.tasks) || !st.tasks.length) p.push('no tasks');
  if (!Array.isArray(st.check) || !osceLeaves(st.check).length) p.push('no checklist items');
  const ids = new Set();
  for (const i of st.check || []) {
    if (ids.has(i.id)) p.push(`checklist id ${i.id} is used twice`); ids.add(i.id);
    const kid = new Set();
    for (const k of i.kids || []) { if (kid.has(k.id)) p.push(`checklist id ${i.id}.${k.id} is used twice`); kid.add(k.id); }
  }
  for (const k of HTML_FIELDS) for (const prob of allowlistCheck(st[k] || '', { attrs: false })) p.push(`${k}: ${prob}`);
  for (const [k, list] of [['tasks', st.tasks], ['points', st.points], ['refs', st.refs]]) (list || []).forEach((h, n) => allowlistCheck(h, { attrs: false }).forEach(x => p.push(`${k}[${n}]: ${x}`)));
  for (const i of st.check || []) for (const h of [i.x, i.d, ...(i.kids || []).flatMap(k => [k.x, k.d])]) allowlistCheck(h || '', { attrs: false }).forEach(x => p.push(`check ${i.id}: ${x}`));
  return p;
}

/* the bar a NEW station clears on top of its shape: benchmarks, timing, structure, guidelines, imaging requests */
export function qualityProblems(st, stats) {
  const p = [], kind = isAcute(st) ? 'acute' : 'clinic', b = stats[kind];
  for (const s of st.specialty || []) if (!KNOWN_SPECIALTIES.has(s) && !specialtyEmoji(s)) p.push(`specialty "${s}" is not a known specialty name`);
  for (const t of st.type || []) if (!TYPES.includes(t)) p.push(`station type "${t}" is not one of ${TYPES.join(', ')}`);
  if (!CX.includes(st.complexity)) p.push('complexity must be Low, Moderate or High');
  const leaves = osceLeaves(st.check), crit = leaves.filter(l => l.crit).length;
  if (leaves.length < b.min || leaves.length > b.max) p.push(`${leaves.length} checklist items; ${kind} stations in the bank have ${b.min} to ${b.max}`);
  if (crit < 2) p.push(`${crit} Critical items; mark at least 2 (the ones a safe junior doctor must not miss)`);
  if (crit > Math.ceil(leaves.length * 0.6)) p.push(`${crit} of ${leaves.length} items are Critical; keep Critical for the safety-critical ones (60% at most)`);
  const heads = (st.check || []).filter(i => i.t === 'heading').map(i => plain(i.x));
  /* the headings a station of these types is marked under (a counselling-only station has no History section) */
  const ty = new Set(st.type || []), any = (...t) => t.some(x => ty.has(x));
  const need = [['Professionalism', /professional/i, true],
    ['History, Assessment or Examination', /history|assess|examin|primary survey|recogni|resuscitat/i, any('History', 'Examination', 'Emergency', 'Ward Call')],
    ['Management, Interpretation or Diagnosis', /manage|interpret|diagnos|investigat|plan|treatment|prescri/i, any('Management', 'Interpretation', 'Prescribing', 'Emergency', 'Ward Call')],
    ['Communication or Counselling', /communicat|counsel|explain|question|closing/i, any('Counselling', 'History')]];
  for (const [name, re, wanted] of need) if (wanted && !heads.some(h => re.test(h))) p.push(`no ${name} heading in the checklist`);
  if (st.tasks.length < 2 || st.tasks.length > 4) p.push(`${st.tasks.length} tasks; stations have 2 to 4`);
  const mins = st.tasks.map(t => Number((plain(t).match(/\((\d+)\s*min/i) || [])[1] || 0));
  if (mins.some(Boolean) && mins.reduce((a, c) => a + c, 0) !== STATION_MIN) p.push(`task times add to ${mins.reduce((a, c) => a + c, 0)} minutes; the station is ${STATION_MIN}`);
  if (!new RegExp(`\\b${STATION_MIN}\\s*min`, 'i').test(plain(st.stem) + plain(st.tasks.join(' '))) && !mins.some(Boolean)) p.push(`say the station is ${STATION_MIN} minutes (in the stem or as task times)`);
  const pat = plain(st.patient).length;
  if (pat < 1200 || pat > 9000) p.push(`patient and examiner script is ${pat} characters; the bank's run 1,600 to 6,600`);
  if ((st.points || []).length < 3) p.push('at least 3 learning points');
  const refs = (st.refs || []).map(plain);
  if (refs.length < 2) p.push('at least 2 references');
  const spec = new Set(st.specialty || []);
  if (spec.has('Paediatrics') || spec.has('Neonatology')) {
    if (!refs.some(r => /\bRCH\b|Royal Children's Hospital/i.test(r))) p.push('a paediatric station cites the RCH Clinical Practice Guideline it follows, by name');
  }
  if (spec.has('Obstetrics') || spec.has('Gynaecology')) {
    if (!refs.some(r => /RANZCOG|Safer Care Victoria|NSW Health|Queensland Clinical Guidelines|King Edward Memorial|SA Health/i.test(r))) p.push('an O&G station cites RANZCOG or a state guideline (Safer Care Victoria, NSW Health, Queensland Clinical Guidelines)');
  }
  if (!refs.some(r => /RCH|RANZCOG|eTG|Therapeutic Guidelines|ANZCOR|Safer Care Victoria|NSW Health|Queensland|RACGP|Heart Foundation|ACSQHC|Australian|Immunisation Handbook|ASCIA|ANZCA|ACEM|CARPA|Cancer Council|NHMRC|AMH/i.test(r))) p.push('cite at least one Australian guideline');
  for (const r of st.imaging || []) for (const x of requestProblems(r)) p.push(`imaging ${r.id || '?'}: ${x}`);
  const ids = (st.imaging || []).map(r => r.id);
  if (new Set(ids).size !== ids.length) p.push('imaging request ids repeat');
  return p;
}

/* things the examiner pass must look at but that do not block on their own: a fixed amount in a paediatric checklist
   item with no per-kg dose beside it (right for a few fixed-dose drugs such as vitamin K, wrong for most) */
export function reviewNotes(st) {
  const n = [], spec = new Set(st.specialty || []);
  if (spec.has('Paediatrics') || spec.has('Neonatology')) {
    const fixed = (st.check || []).flatMap(i => [i, ...(i.kids || [])]).map(i => plain(`${i.x} ${i.d || ''}`))
      .filter(t => !/\/\s*kg|per\s+kg/i.test(t)).flatMap(t => t.match(/\b\d+(?:\.\d+)?\s*(?:mg|mcg|microgram|g|mL|units?)\b/gi) || []);
    if (fixed.length) n.push(`paediatric checklist doses with no per-kg dose beside them (${[...new Set(fixed)].slice(0, 6).join(', ')}): each must be a fixed-dose drug in the cited guideline, else give it per kg`);
  }
  return n;
}
