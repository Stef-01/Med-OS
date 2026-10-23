/* Observations on the NSW Health "Between the Flags" charts: which chart a patient is charted on, which zone a value is
   in, and what that zone asks the team to do. Pure: no DOM, tested in scripts/obs.test.mjs. The zones themselves come
   from obs-charts.mjs, which scripts/charts/extract_zones.py writes from the chart PDFs. */
import { CHARTS } from './obs-charts.mjs';

export { CHARTS };
export const chartById = id => CHARTS.find(c => c.id === id) || null;

/* ---- who: the station's patient ---------------------------------------------------------------------------------- */
export const AGE_UNITS = Object.freeze({ years: 12, months: 1, weeks: 12 / 52.1775, days: 12 / 365.25 });
/* where the station happens; the charts are inpatient and ED forms, so a clinic or GP station has no chart */
export const SETTINGS = Object.freeze(['ed', 'ward', 'icu', 'theatre', 'recovery', 'birth suite', 'clinic', 'gp', 'community']);
const OUTPATIENT = new Set(['clinic', 'gp', 'community']);
export function cleanDemo(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
  const age = Number(d.age), unit = AGE_UNITS[d.unit] ? d.unit : null;
  if (!(age >= 0 && age < 130) || !unit) return null;
  const out = { age, unit, sex: ['F', 'M', 'X'].includes(d.sex) ? d.sex : 'X', setting: SETTINGS.includes(d.setting) ? d.setting : 'ward' };
  const w = Number(d.weight); if (w > 0 && w < 400) out.weight = w;
  if (d.pregnant === true) out.pregnant = true;
  if (d.postpartum === true) out.postpartum = true;
  return out;
}
export const ageMonths = d => (d ? d.age * AGE_UNITS[d.unit] : null);
export function ageText(d) {
  if (!d) return '';
  const n = d.age, u = n === 1 ? d.unit.replace(/s$/, '') : d.unit;
  return `${n} ${u}`;
}
/* the chart this patient's observations go on, or none and why (said in words to the examiner) */
export function chartFor(demo) {
  const d = cleanDemo(demo);
  if (!d) return { id: null, why: 'No patient details for this station, so the observations are written out.' };
  if (OUTPATIENT.has(d.setting)) return { id: null, why: 'Clinic and GP observations are written in the notes, not on an inpatient chart.' };
  if (d.pregnant || d.postpartum) return { id: null, why: 'A pregnant or postnatal woman is charted on the maternity observation chart, which is not in this set, so the observations are written out.' };
  const m = ageMonths(d);
  if (m < 3) return { id: null, why: 'A baby under 3 months is charted on the 0 to 3 months or newborn chart, which is not in this set, so the observations are written out.' };
  const c = CHARTS.find(c => m >= c.months[0] && (c.months[1] == null || m < c.months[1]));
  return c ? { id: c.id, why: `${c.title}, ${c.ages.toLowerCase()} (${c.form})` } : { id: null, why: 'No chart for this age.' };
}

/* ---- zones -------------------------------------------------------------------------------------------------------- */
export const SEVERITY = Object.freeze({ white: 0, grey: 0, blue: 1, yellow: 2, red: 3 });
/* a value exactly on the line between two zones. The paediatric charts print their own thresholds (yellow "90 - 95",
   red "<90"), so on those a red/yellow line is yellow and otherwise the more severe zone applies. The adult chart prints
   none; the NSW CERS red criteria read "RR <= 5 or >= 30, SBP <= 90 or >= 200, HR <= 40 or >= 140", so on the adult
   chart a line takes the more severe zone. Stations avoid line values (a review note), so this decides only edge cases. */
const ON_LINE = { sago: 'severe' };
const worse = (a, b) => (SEVERITY[a] >= SEVERITY[b] ? a : b);
export function zoneOf(chart, key, v) {
  const p = chart?.params?.[key], x = Number(v);
  if (!p || v == null || v === '' || !Number.isFinite(x)) return null;
  const i = p.bands.findIndex(([lo, hi]) => (lo == null || x >= lo) && (hi == null || x < hi));
  if (i < 0) return null;
  const [lo, , z] = p.bands[i], below = p.bands[i + 1];
  if (lo != null && x === lo && below) {
    const b = below[2], rule = ON_LINE[chart.id] || 'yellow-first';
    const zone = rule === 'yellow-first' && (z === 'yellow' || b === 'yellow') ? 'yellow' : worse(z, b);
    return { zone, line: z !== b, between: [z, b] };
  }
  return { zone: z, line: false };
}
/* the category rows (consciousness, pain, respiratory distress, capillary refill, lactate, concern) */
export const PAIN_ROW = n => (n >= 7 ? 'severe' : n >= 4 ? 'moderate' : n >= 1 ? 'mild' : 'nil');
export const CRT_ROW = s => (s >= 3 ? '3+' : '<3');
export const LACTATE_ROW = l => (l >= 4 ? '4+' : l >= 2 ? '2-3.9' : '<2');
export function catZone(chart, cat, k) {
  const row = (chart?.cats?.[cat] || []).find(r => r[0] === k);
  return row ? row[1] : null;
}

/* ---- a station's observations: one row per time they were taken ------------------------------------------------- */
export const DEVICES = Object.freeze({ RA: 'room air', NP: 'nasal prongs', FM: 'face mask', NRB: 'non-rebreather mask', VM: 'Venturi mask', HF: 'high flow' });
export const AVPU = Object.freeze({ A: 'Alert', C: 'New confusion', V: 'Responds to voice', P: 'Responds to pain', U: 'Unresponsive' });
export const DISTRESS = Object.freeze(['normal', 'mild', 'moderate', 'severe']);
const NUMS = { rr: [0, 150], spo2: [40, 100], hr: [0, 300], sbp: [20, 300], dbp: [5, 200], temp: [28, 44], o2: [0, 70], crt: [0, 15], pain: [0, 10], bgl: [0.2, 60], lactate: [0, 30], weight: [0.3, 400] };
export function cleanObs(o) {
  const rows = (Array.isArray(o?.rows) ? o.rows : []).map(r => {
    if (!r || typeof r !== 'object' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(r.t || '')) return null;
    const x = { t: r.t };
    for (const [k, [a, b]] of Object.entries(NUMS)) { const n = Number(r[k]); if (r[k] != null && r[k] !== '' && n >= a && n <= b) x[k] = n; }
    if (x.dbp != null && (x.sbp == null || x.dbp >= x.sbp)) delete x.dbp;
    if (DEVICES[r.dev]) x.dev = r.dev;
    if (AVPU[r.avpu]) x.avpu = r.avpu;
    if (DISTRESS.includes(r.distress)) x.distress = r.distress;
    if (['yes', 'no', 'na'].includes(r.concern)) x.concern = r.concern;
    if (['Reg', 'Irreg'].includes(r.rhythm)) x.rhythm = r.rhythm;
    for (const k of ['init', 'note']) if (typeof r[k] === 'string' && r[k].trim()) x[k] = r[k].trim().slice(0, k === 'init' ? 4 : 200);
    return x;
  }).filter(Boolean);
  return rows.length ? { rows } : null;
}

/* what each charted value is, in the chart's own zones */
export const PARAM_NAMES = Object.freeze({ rr: 'RR', spo2: 'SpO2', sbp: 'Systolic BP', hr: 'HR', temp: 'Temperature' });
export function rowFindings(chart, r) {
  const f = [], add = (key, label, text, z) => z && f.push({ key, label, text, zone: z.zone || z, line: !!z.line });
  if (!chart) return f;
  add('rr', 'RR', `${r.rr}/min`, r.rr != null && zoneOf(chart, 'rr', r.rr));
  add('spo2', 'SpO2', `${r.spo2}%`, r.spo2 != null && zoneOf(chart, 'spo2', r.spo2));
  add('sbp', 'Systolic BP', `${r.sbp} mmHg`, r.sbp != null && zoneOf(chart, 'sbp', r.sbp));
  add('hr', 'HR', `${r.hr}/min`, r.hr != null && zoneOf(chart, 'hr', r.hr));
  add('temp', 'Temperature', `${r.temp} °C`, r.temp != null && zoneOf(chart, 'temp', r.temp));
  if (r.avpu) add('avpu', 'Consciousness', AVPU[r.avpu], catZone(chart, 'avpu', r.avpu));
  if (r.distress && chart.cats.distress) add('distress', 'Respiratory distress', r.distress, catZone(chart, 'distress', r.distress));
  if (r.crt != null && chart.cats.crt) add('crt', 'Capillary refill', `${r.crt} s`, catZone(chart, 'crt', CRT_ROW(r.crt)));
  if (r.pain != null) add('pain', 'Pain', `${r.pain}/10`, catZone(chart, 'pain', PAIN_ROW(r.pain)));
  if (r.lactate != null) add('lactate', 'Lactate', `${r.lactate} mmol/L`, catZone(chart, 'lactate', LACTATE_ROW(r.lactate)));
  if (r.concern === 'yes') add('concern', 'Family concern', 'yes', catZone(chart, 'concern', 'yes'));
  return f;
}
/* what the zones ask for at one time point: the worst zone, the response it calls for, and why */
export const RESPONSE = Object.freeze({ red: 'Rapid response', yellow: 'Clinical review', blue: 'Increase the frequency of observations' });
export function escalation(chart, r) {
  const f = rowFindings(chart, r).filter(x => SEVERITY[x.zone] > 0);
  let zone = f.reduce((z, x) => worse(z, x.zone), 'white');
  const yellows = f.filter(x => x.zone === 'yellow').length;
  const why = f.map(x => `${x.label} ${x.text} (${x.zone})`);
  if (chart && chart.id !== 'sago' && zone === 'yellow' && yellows >= 3) { zone = 'red'; why.push('3 or more yellow zone observations at once (a red zone criterion on this chart)'); }
  return { zone, action: RESPONSE[zone] || '', why, findings: f };
}

/* the row in words: for the marker, screen readers and anyone without the chart */
const fmt = n => (Number.isInteger(n) ? String(n) : String(n));
export function obsText(r) {
  const o2 = r.dev && r.dev !== 'RA' ? ` on ${r.o2 != null ? `${fmt(r.o2)} L/min ` : ''}${DEVICES[r.dev]}` : r.dev === 'RA' ? ' on room air' : '';
  const parts = [r.rr != null && `RR ${fmt(r.rr)}`, r.spo2 != null && `SpO2 ${fmt(r.spo2)}%${o2}`, r.sbp != null && `BP ${fmt(r.sbp)}${r.dbp != null ? `/${fmt(r.dbp)}` : ''}`,
    r.hr != null && `HR ${fmt(r.hr)}${r.rhythm === 'Irreg' ? ' irregular' : ''}`, r.temp != null && `T ${fmt(r.temp)} °C`, r.crt != null && `CRT ${fmt(r.crt)} s`,
    r.distress && r.distress !== 'normal' && `${r.distress} respiratory distress`, r.avpu && AVPU[r.avpu], r.pain != null && `pain ${fmt(r.pain)}/10`,
    r.bgl != null && `BGL ${fmt(r.bgl)}`, r.lactate != null && `lactate ${fmt(r.lactate)}`].filter(Boolean);
  return `${r.t}: ${parts.join(', ')}${r.note ? `. ${r.note}` : ''}`;
}
