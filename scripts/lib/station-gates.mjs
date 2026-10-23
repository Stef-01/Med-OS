/* lib/station-gates.mjs - pure: what a station must be before it ships. The generator runs every gate on its draft and
   revises once on the problems; the validator runs the shape gates over the whole bank. Benchmarks come from the bank
   itself (bankStats): a new station's checklist sits inside the range the existing stations of its kind cover.
   -> [problems] (empty = passes). Tested in scripts/station-gates.test.js. */
import { allowlistCheck } from '../../public/js/study-kit/safe.mjs';
import { DISCIPLINES, specialtyEmoji } from '../../public/js/study-kit/vocab.mjs';
import { osceLeaves, CX, KINDS } from '../../public/js/osce/core.mjs';
import { cleanDemo, cleanObs, chartFor, chartById, zoneOf, escalation } from '../../public/js/osce/obs.mjs';
import { cleanLabs, labFlagProblems, FLAGS } from '../../public/js/osce/labs.mjs';
import { requestProblems } from '../imaging/rank.mjs';

export const TYPES = ['History', 'Examination', 'Management', 'Counselling', 'Emergency', 'Ward Call', 'Interpretation', 'Prescribing', 'Procedure'];
export const KNOWN_SPECIALTIES = new Set(DISCIPLINES.flatMap(d => d[3]));
export const isAcute = st => (st.type || []).some(t => t === 'Emergency' || t === 'Ward Call');
/* the format: 5 minutes reading, Part 1 history and examination 10, Part 2 interpretation, management and safety netting 5 */
export const READING_MIN = 5, PART1_MIN = 10, PART2_MIN = 5, STATION_MIN = PART1_MIN + PART2_MIN;
/* markable items (leaves) a 5 / 10 / 5 station has: fixed, not drawn from the bank, so rewriting or adding stations never
   moves the bar under the next one (a bank-relative range ratcheted up while the bank was being converted) */
export const LEAVES = Object.freeze({ min: 24, max: 52 });
/* the checklist sections every station is marked under, in order */
export const SECTIONS = [['Professionalism', /professional/i], ['History', /history/i], ['Examination', /examin|primary survey|a to e|abcde/i],
  ['Interpretation', /interpret/i], ['Management', /manage/i], ['Safety netting', /safety[- ]?net/i]];
/* the leaves under each heading: { heading text: [leaf keys] } */
export function sectionLeaves(check) {
  const out = {}; let head = '';
  for (const i of check || []) {
    if (i.t === 'heading') { head = String(i.x || '').replace(/<[^>]*>/g, '').trim(); out[head] ||= []; continue; }
    if (i.t !== 'checkbox') continue;
    const kids = (i.kids || []).filter(k => k.t === 'checkbox' || !k.t);
    (out[head] ||= []).push(...(kids.length ? kids.map(k => `${i.id}.${k.id}`) : [String(i.id)]));
  }
  return out;
}

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
  ((st.part2 && st.part2.handover) || []).forEach((h, n) => allowlistCheck(h && h.result, { attrs: false }).forEach(x => p.push(`part2.handover[${n}]: ${x}`)));
  if (st.part2 != null && (typeof st.part2 !== 'object' || Array.isArray(st.part2))) p.push('part2 is not an object');
  if (st.part2?.patient != null && typeof st.part2.patient !== 'string') p.push('part2.patient is not HTML text');
  (Array.isArray(st.part2?.expect) ? st.part2.expect : []).forEach((h, n) => allowlistCheck(h || '', { attrs: false }).forEach(x => p.push(`part2.expect[${n}]: ${x}`)));
  allowlistCheck(typeof st.part2?.patient === 'string' ? st.part2.patient : '', { attrs: false }).forEach(x => p.push(`part2.patient: ${x}`));
  ((st.part2 && st.part2.handover) || []).forEach((h, n) => {
    if (!h) return;
    if (h.kind != null && !KINDS[h.kind]) p.push(`part2.handover[${n}]: kind "${h.kind}" is not one of ${Object.keys(KINDS).join(', ')}`);
    allowlistCheck(h.model || '', { attrs: false }).forEach(x => p.push(`part2.handover[${n}].model: ${x}`));
    if (h.obs != null && h.kind !== 'obs') p.push(`part2.handover[${n}]: observation rows on a result whose kind is not "obs"`);
    if (h.kind === 'obs' && h.obs != null) {
      const raw = Array.isArray(h.obs.rows) ? h.obs.rows : [], clean = cleanObs(h.obs)?.rows || [];
      if (clean.length !== raw.length) p.push(`part2.handover[${n}].obs: ${raw.length - clean.length} row(s) without a valid time (HH:MM) or not an object`);
      raw.forEach((r, i) => { const c = clean.find(x => x.t === r?.t); if (c) for (const k of Object.keys(r)) if (!(k in c)) p.push(`part2.handover[${n}].obs row ${r.t}: "${k}" ${JSON.stringify(r[k])} is not a value the chart takes`); });
    }
  });
  ((st.part2 && st.part2.handover) || []).forEach((h, n) => {
    if (!h || h.labs == null) return;
    const raw = (Array.isArray(h.labs) ? h.labs : []).flatMap(x => (Array.isArray(x?.rows) ? x.rows : [])), kept = (cleanLabs(h.labs) || []).flatMap(x => x.rows);
    if (!Array.isArray(h.labs) || kept.length !== raw.length) p.push(`part2.handover[${n}].labs: ${raw.length - kept.length} row(s) without a value, or panels that are not {title, cols, rows}`);
    raw.forEach(r => [].concat(r?.f ?? []).forEach(f => { if (!FLAGS.includes(f)) p.push(`part2.handover[${n}].labs: flag "${f}" on ${r.t || 'a row'} is not one of H, L, HH, LL, A`); }));
  });
  if (st.demo != null && !cleanDemo(st.demo)) p.push('demo (the patient: age, unit, sex, setting) is malformed');
  for (const i of st.check || []) for (const h of [i.x, i.d, ...(i.kids || []).flatMap(k => [k.x, k.d])]) allowlistCheck(h || '', { attrs: false }).forEach(x => p.push(`check ${i.id}: ${x}`));
  return p;
}

/* the bar a NEW station clears on top of its shape: benchmarks, timing, structure, guidelines, imaging requests */
export function qualityProblems(st, stats) {
  const p = [];   /* `stats` (bankStats) is kept in the signature for callers; the size band is LEAVES */
  for (const s of st.specialty || []) if (!KNOWN_SPECIALTIES.has(s) && !specialtyEmoji(s)) p.push(`specialty "${s}" is not a known specialty name`);
  for (const t of st.type || []) if (!TYPES.includes(t)) p.push(`station type "${t}" is not one of ${TYPES.join(', ')}`);
  if (!CX.includes(st.complexity)) p.push('complexity must be Low, Moderate or High');
  const leaves = osceLeaves(st.check), crit = leaves.filter(l => l.crit).length;
  if (leaves.length < LEAVES.min || leaves.length > LEAVES.max) p.push(`${leaves.length} checklist items; a 5 / 10 / 5 station has ${LEAVES.min} to ${LEAVES.max}`);
  if (crit < 2) p.push(`${crit} Critical items; mark at least 2 (the ones a safe junior doctor must not miss)`);
  if (crit > Math.ceil(leaves.length * 0.6)) p.push(`${crit} of ${leaves.length} items are Critical; keep Critical for the safety-critical ones (60% at most)`);
  /* the sections, the timing, Part 2 */
  const secs = sectionLeaves(st.check), heads = Object.keys(secs);
  for (const [name, re] of SECTIONS) if (!heads.some(h => re.test(h))) p.push(`no ${name} heading in the checklist`);
  const safety = heads.filter(h => /safety[- ]?net/i.test(h)).flatMap(h => secs[h]);
  if (heads.some(h => /safety[- ]?net/i.test(h)) && safety.length < 2) p.push(`${safety.length} safety-netting item; give at least 2 (the red flags in plain words, when and where to come back, follow-up)`);
  if (st.tasks.length < 2 || st.tasks.length > 3) p.push(`${st.tasks.length} tasks; a station has 2 (or 3): Part 1 history and examination, Part 2 interpretation, management and safety netting`);
  const mins = st.tasks.map(t => Number((plain(t).match(/\((\d+)\s*min/i) || [])[1] || 0));
  if (mins.some(m => !m)) p.push('every task ends with its time in brackets, for example "(10 minutes)"');
  else {
    if (mins.reduce((a, c) => a + c, 0) !== STATION_MIN) p.push(`task times add to ${mins.reduce((a, c) => a + c, 0)} minutes; Part 1 and Part 2 are ${PART1_MIN} + ${PART2_MIN}`);
    if (mins[mins.length - 1] !== PART2_MIN) p.push(`the last task is Part 2 (${PART2_MIN} minutes): interpretation, management and safety netting`);
  }
  if (/\b\d+\s*min(ute)?s?\b/i.test(plain(st.stem))) p.push('leave times out of the stem: the tasks carry them and the page shows the format');
  const p2 = st.part2 || {};
  if (!cleanDemo(st.demo)) p.push('demo: the patient (age with its unit, sex, setting) so the station shows the right observation chart');
  for (const [n, h] of (p2.handover || []).entries()) {
    if (!h) continue;
    if (!KINDS[h.kind]) p.push(`Part 2 result "${plain(h.label)}" names its kind (${Object.keys(KINDS).join(', ')})`);
    if ((h.kind === 'bloods' || h.kind === 'gas') && !cleanLabs(h.labs)) p.push(`Part 2 result "${plain(h.label)}" gives its values as lab panels (labs: test, value, units, range, flag), printed the way a pathology system prints them`);
    for (const x of labFlagProblems(h.labs)) p.push(`Part 2 result "${plain(h.label)}", lab flag: ${x}`);
    if (h.kind !== 'obs' && !plain(h.model)) p.push(`Part 2 result "${plain(h.label)}" has the examiner's model interpretation (model): what a good candidate says about it, in order`);
    if (h.kind === 'obs' && chartFor(st.demo).id && !(h.obs?.rows || []).length) p.push(`Part 2 result "${plain(h.label)}": this patient is charted on the ${chartFor(st.demo).why}; give the observations as rows (obs) so they are charted`);
  }
  if (!Array.isArray(p2.handover) || p2.handover.filter(h => h && plain(h.label) && (plain(h.result) || (h.obs?.rows || []).length || cleanLabs(h.labs))).length < 2) p.push('Part 2 hands over at least 2 results (observations, investigations or imaging reports), each with its numbers');
  if (!Array.isArray(p2.ask) || p2.ask.filter(q => plain(q)).length < 2) p.push('Part 2 has at least 2 examiner questions (interpretation, then management and safety netting)');
  if (!plain(p2.lead)) p.push('Part 2 needs the examiner\'s opening line (lead)');
  p.push(...askProblems(p2));
  for (const b of part2InScript(st.patient)) p.push(`the patient script is for Part 1; move what the patient says in Part 2 to part2.patient: "${b.slice(0, 70)}…"`);
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

/* a lab table's flags against its own numbers: in a table whose header names a Result and a Reference column, a value
   outside its printed range should carry H or L and one inside should not (a review note: a reference written in words,
   or a measure such as BMI that is not flagged, is for the reader to judge) */
export function flagIssues(html) {
  const out = [], txt = s => s.replace(/<[^>]+>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  for (const tbl of String(html).match(/<table>[\s\S]*?<\/table>/g) || []) {
    const rows = (tbl.match(/<tr>[\s\S]*?<\/tr>/g) || []).map(r => (r.match(/<t[dh]>[\s\S]*?<\/t[dh]>/g) || []).map(txt));
    const head = rows[0] || [], ri = head.findIndex(h => /^result|^value|^today/i.test(h)), fi = head.findIndex(h => /^ref|^normal|^range/i.test(h));
    if (ri < 0 || fi < 0) continue;
    for (const r of rows.slice(1)) {
      const res = r[ri] || '', ref = r[fi] || '';
      const m = res.match(/^([<>]?)\s*(-?\d+(?:\.\d+)?)/); if (!m || m[1]) continue;
      const v = +m[2], flag = (r.join(' ').match(/(?:^|\s)\(?(HH|LL|H|L)\)?(?:\s|$)/) || [])[1] || '';
      let lo = null, hi = null, mm;
      if ((mm = ref.match(/(-?\d+(?:\.\d+)?)\s*(?:to|-|–)\s*(-?\d+(?:\.\d+)?)/))) { lo = +mm[1]; hi = +mm[2]; }
      else if ((mm = ref.match(/(?:below|under|less than|<|≤)\s*(-?\d+(?:\.\d+)?)/i))) hi = +mm[1];
      else if ((mm = ref.match(/(?:above|over|more than|greater than|>|≥)\s*(-?\d+(?:\.\d+)?)/i))) lo = +mm[1];
      else if (/not detected|undetectable/i.test(ref)) hi = 0;   /* a measured amount where none should be: a viral load, a DNA level */
      else continue;
      const want = lo != null && v < lo ? 'L' : hi != null && v > hi ? 'H' : '';
      const got = flag.replace(/HH/, 'H').replace(/LL/, 'L');
      if (want !== got) out.push(`${r[0]}: ${res} vs ${ref} → ${want || 'no flag'}, has ${got || 'no flag'}`);
    }
  }
  return out;
}

/* a blood gas against itself: bicarbonate from pH and pCO2 (Henderson-Hasselbalch, HCO3 = 0.0307 x pCO2[mmHg] x
   10^(pH - 6.1)), column by column so a paired arterial and venous cord gas is checked as two gases; more than 2.5 mmol/L
   apart is a note (pCO2 in kPa is converted) */
export function gasIssues(html) {
  const out = [], txt = x => x.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(), num = x => { const m = String(x || '').match(/-?\d+(?:\.\d+)?/); return m ? +m[0] : null; };
  for (const tbl of String(html).match(/<table>[\s\S]*?<\/table>/g) || []) {
    const rows = (tbl.match(/<tr>[\s\S]*?<\/tr>/g) || []).map(r => (r.match(/<t[dh]>[\s\S]*?<\/t[dh]>/g) || []).map(txt));
    const find = re => rows.find(r => re.test(r[0] || ''));
    const ph = find(/^pH\b/i), co2 = find(/^p(?:v|a)?CO2|^PCO2|carbon dioxide/i), hco3 = find(/^(?:HCO3|bicarbonate|standard bicarbonate|actual bicarbonate)/i);
    if (!ph || !co2 || !hco3) continue;
    const kpa = /kpa/i.test(co2.join(' '));
    for (let c = 1; c < ph.length; c++) {
      if (/ref|range|normal|interval/i.test((rows[0] || [])[c] || '')) continue;   /* a reference column is not a gas */
      const p = num(ph[c]), q = num(co2[c]), h = num(hco3[c]);
      if (p == null || q == null || h == null || p < 6.5 || p > 8) continue;
      const calc = 0.0307 * q * (kpa ? 7.5 : 1) * 10 ** (p - 6.1);
      if (Math.abs(h - calc) > 2.5) out.push(`${(rows[0] || [])[c] || `column ${c + 1}`}: pH ${p}, pCO2 ${q}${kpa ? ' kPa' : ''} gives HCO3 ${calc.toFixed(1)}, the table has ${h}`);
    }
  }
  return out;
}

/* the examiner's Part 2 questions in the order a real OSCE examiner asks them: an ISBAR handover carrying the
   interpretation of the results, then the diagnosis and differentials, then management; each with its expected answer */
export function askProblems(p2) {
  const ask = (p2?.ask || []).map(plain), exp = (p2?.expect || []).map(plain), p = [];
  if (ask.length < 3 || ask.length > 4) p.push(`${ask.length} examiner questions; Part 2 asks 3 or 4 (ISBAR handover, differentials, management, then safety netting or a focused question)`);
  if (ask.length && !/\bISBAR\b/i.test(ask[0])) p.push('the first examiner question asks for an ISBAR handover that includes the interpretation of the results');
  if (ask.length > 1 && !/differential|diagnos|else would you consider/i.test(ask[1])) p.push('the second examiner question asks for the most likely diagnosis and the differentials');
  if (ask.length > 2 && !/manag/i.test(ask[2])) p.push('the third examiner question asks how the candidate would manage the patient');
  if (exp.length !== ask.length || exp.some(e => !e)) p.push('every examiner question has its expected answer (part2.expect, same order and number as part2.ask)');
  else if (!/Situation[\s\S]*Background[\s\S]*Assessment[\s\S]*Recommendation/i.test(exp[0])) p.push('the expected ISBAR answer fills in Situation, Background, Assessment and Recommendation for this patient');
  return p;
}

/* a paragraph or heading of the Part 1 script that is Part 2 role-play ("In Part 2, …", "Questions to ask … (usually in Part 2)");
   a passing mention ("management is marked in Part 2", "handed over in Part 2") is not */
export const part2InScript = html => (String(html || '').match(/<(p|h[2-4])>[\s\S]*?<\/\1>/g) || []).map(plain).filter(t => /^(?:In|During) Part 2\b|\((?:usually )?in Part 2\b/i.test(t));

/* lab panels as a plain table for the gas check: a header row of the result columns, then test | value per column */
const labsTable = labs => (cleanLabs(labs) || []).map(p => `<table><tr><th>Test</th>${(p.cols || ['Result']).map(c => `<th>${c}</th>`).join('')}</tr>${p.rows.map(r => `<tr><td>${r.t}${r.u ? ` (${r.u})` : ''}</td>${r.v.map(v => `<td>${v}</td>`).join('')}</tr>`).join('')}</table>`).join('');

/* things the examiner pass must look at but that do not block on their own: a fixed amount in a paediatric checklist
   item with no per-kg dose beside it (right for a few fixed-dose drugs such as vitamin K, wrong for most) */
export function reviewNotes(st) {
  const n = [], spec = new Set(st.specialty || []);
  if (spec.has('Paediatrics') || spec.has('Neonatology')) {
    const fixed = (st.check || []).flatMap(i => [i, ...(i.kids || [])]).map(i => plain(`${i.x} ${i.d || ''}`))
      .filter(t => !/\/\s*kg|per\s+kg/i.test(t)).flatMap(t => t.match(/\b\d+(?:\.\d+)?\s*(?:mg|mcg|microgram|g|mL|units?)\b/gi) || []);
    if (fixed.length) n.push(`paediatric checklist doses with no per-kg dose beside them (${[...new Set(fixed)].slice(0, 6).join(', ')}): each must be a fixed-dose drug in the cited guideline, else give it per kg`);
  }
  for (const h of st.part2?.handover || []) for (const i of flagIssues(h?.result || '')) n.push(`lab flag in "${plain(h.label)}": ${i}`);
  for (const h of st.part2?.handover || []) for (const i of [...gasIssues(h?.result || ''), ...gasIssues(labsTable(h?.labs))]) n.push(`blood gas in "${plain(h.label)}" does not add up: ${i}`);
  /* observations on the chart: a value exactly on a zone line reads two ways (pick one clearly inside a zone), and a red
     or yellow zone the checklist never asks the candidate to act on */
  const chart = chartById(chartFor(st.demo).id);
  if (chart) {
    const rows = (st.part2?.handover || []).filter(h => h?.kind === 'obs').flatMap(h => cleanObs(h.obs)?.rows || []);
    for (const r of rows) for (const k of ['rr', 'spo2', 'sbp', 'hr', 'temp']) if (r[k] != null && zoneOf(chart, k, r[k])?.line) n.push(`obs ${r.t} ${k} ${r[k]} sits on the line between two zones on the ${chart.id} chart; move it clearly inside one`);
    const worst = rows.map(r => escalation(chart, r)).reduce((w, e) => (e.zone === 'red' || (e.zone === 'yellow' && w !== 'red') ? e.zone : w), '');
    let head = '';   /* only what the candidate is asked to do: items under Interpretation, Management, Safety netting */
    const items = (st.check || []).filter(i => (i.t === 'heading' ? ((head = plain(i.x)), false) : /interpret|manage|safety|escalat/i.test(head)))
      .flatMap(i => [i, ...(i.kids || [])]).map(i => plain(`${i.x} ${i.d || ''}`)).join(' ');
    if (worst && !/rapid response|\bMET\b|medical emergency|escalat|clinical review|senior|registrar|consultant|\bICU\b|retrieval|call for help|team leader/i.test(items))
      n.push(`the observations reach the ${worst} zone on the chart but no checklist item asks the candidate to escalate (${worst === 'red' ? 'rapid response' : 'clinical review'})`);
  }
  return n;
}
