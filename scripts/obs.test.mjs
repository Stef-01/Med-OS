/* the observation charts: the zones extracted from the PDFs agree with the thresholds printed on each chart and with the
   NSW CERS criteria (an independent source for every band), the right chart for each age, and the escalation rules */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHARTS, chartById, chartFor, zoneOf, catZone, cleanObs, escalation, obsText, rowFindings, cleanDemo } from '../public/js/osce/obs.mjs';

/* the "Standard Thresholds" table printed on the front of each paediatric chart: yellow ranges are inclusive, red is < / > */
const PRINTED = {
  'spoc-3-12m': { rr: { yellow: [[15, 25], [55, 65]], red: [15, 65] }, hr: { yellow: [[80, 90], [170, 180]], red: [80, 180] } },
  'spoc-1-4': { rr: { yellow: [[15, 20], [50, 60]], red: [15, 60] }, hr: { yellow: [[70, 80], [150, 170]], red: [70, 170] } },
  'spoc-5-11': { rr: { yellow: [[10, 15], [35, 50]], red: [10, 50] }, hr: { yellow: [[60, 70], [140, 160]], red: [60, 160] } },
  'spoc-12': { rr: { yellow: [[5, 10], [30, 40]], red: [5, 40] }, hr: { yellow: [[40, 50], [130, 150]], red: [40, 150] } },
};
test('every paediatric chart: the graph zones match the thresholds printed on its front page', () => {
  for (const [id, t] of Object.entries(PRINTED)) {
    const c = chartById(id);
    for (const key of ['rr', 'hr', 'spo2']) {
      const want = key === 'spo2' ? { yellow: [[90, 95]], red: [90, 1000] } : t[key];
      for (let v = Math.max(1, c.params[key].min); v <= c.params[key].max; v++) {
        const z = zoneOf(c, key, v).zone;
        const red = v < want.red[0] || v > want.red[1], yellow = want.yellow.some(([a, b]) => v >= a && v <= b);
        assert.equal(z === 'red', red, `${id} ${key} ${v}: ${z}`);
        assert.equal(z === 'yellow', yellow && !red, `${id} ${key} ${v}: ${z}`);
      }
    }
  }
});

test('the adult chart: red exactly where the NSW CERS criteria put it (RR <= 5 or >= 30, SBP <= 90 or >= 200, HR <= 40 or >= 140)', () => {
  const c = chartById('sago');
  const crit = { rr: v => v <= 5 || v >= 30, sbp: v => v <= 90 || v >= 200, hr: v => v <= 40 || v >= 140 };
  for (const [key, red] of Object.entries(crit)) for (let v = 1; v <= 250; v++) {
    const z = zoneOf(c, key, v); if (!z) continue;
    assert.equal(z.zone === 'red', red(v), `${key} ${v}: ${z.zone}`);
  }
  assert.equal(zoneOf(c, 'spo2', 91).zone, 'yellow');
  assert.equal(zoneOf(c, 'spo2', 88).zone, 'red');
  assert.equal(zoneOf(c, 'temp', 38.9).zone, 'yellow');
  assert.equal(zoneOf(c, 'temp', 36.8).zone, 'white');
  assert.equal(zoneOf(c, 'rr', 22).line, false);
  assert.equal(zoneOf(c, 'rr', 25).line, true, 'a value on a zone line is flagged');
});

test('every chart: bands run top to bottom without gaps, and every category row has a zone', () => {
  for (const c of CHARTS) {
    for (const [k, p] of Object.entries(c.params)) {
      assert.equal(p.bands[0][1], null, `${c.id} ${k} top open`);
      assert.equal(p.bands.at(-1)[0], null, `${c.id} ${k} bottom open`);
      for (let i = 1; i < p.bands.length; i++) assert.equal(p.bands[i][1], p.bands[i - 1][0], `${c.id} ${k} contiguous`);
      assert.ok(p.min < p.labels.at(-1) && p.max > p.labels[0]);
    }
    for (const k of ['avpu', 'pain', 'lactate', 'concern']) assert.ok(c.cats[k]?.length >= 3, `${c.id} ${k}`);
    assert.deepEqual(c.cats.avpu.map(r => r[1]), ['white', 'yellow', 'yellow', 'red', 'red'], c.id);
    assert.match(c.form, /^SMR110\.0\d\d$/);
  }
  assert.equal(catZone(chartById('spoc-1-4'), 'distress', 'severe'), 'red');
  assert.equal(catZone(chartById('spoc-1-4'), 'crt', '3+'), 'yellow');
});

test('the chart for each patient: by age and setting; none for clinics, pregnancy or under 3 months', () => {
  const id = d => chartFor(d).id;
  assert.equal(id({ age: 4, unit: 'months', setting: 'ed' }), 'spoc-3-12m');
  assert.equal(id({ age: 18, unit: 'months', setting: 'ed' }), 'spoc-1-4');
  assert.equal(id({ age: 2, unit: 'years', setting: 'ward' }), 'spoc-1-4');
  assert.equal(id({ age: 5, unit: 'years', setting: 'ed' }), 'spoc-5-11');
  assert.equal(id({ age: 13, unit: 'years', setting: 'ed' }), 'spoc-12');
  assert.equal(id({ age: 16, unit: 'years', setting: 'ed' }), 'sago');
  assert.equal(id({ age: 78, unit: 'years', setting: 'ed' }), 'sago');
  assert.equal(id({ age: 5, unit: 'weeks', setting: 'ed' }), null);
  assert.equal(id({ age: 34, unit: 'years', setting: 'gp' }), null);
  assert.equal(id({ age: 30, unit: 'years', setting: 'birth suite', postpartum: true }), null);
  assert.match(chartFor({ age: 30, unit: 'years', setting: 'ward', pregnant: true }).why, /maternity/);
  assert.equal(id(null), null);
  assert.equal(cleanDemo({ age: 'x', unit: 'years' }), null);
});

test('escalation: the worst zone and its response; three yellows on a paediatric chart is a rapid response', () => {
  const kid = chartById('spoc-1-4'), adult = chartById('sago');
  assert.deepEqual(escalation(kid, { t: '10:00', rr: 30, hr: 120, spo2: 98 }).action, '');
  const e = escalation(kid, { t: '10:00', rr: 55, hr: 160, spo2: 93 });
  assert.equal(e.zone, 'red');
  assert.match(e.why.join(), /3 or more yellow/);
  assert.equal(escalation(adult, { t: '10:00', rr: 26, hr: 125, spo2: 93 }).zone, 'yellow', 'the adult chart has no such rule');
  assert.equal(escalation(adult, { t: '10:00', rr: 34 }).action, 'Rapid response');
  assert.equal(escalation(kid, { t: '10:00', rr: 45 }).action, 'Increase the frequency of observations');
  assert.deepEqual(rowFindings(adult, { t: '10:00', avpu: 'V' }).map(f => f.zone), ['yellow']);
});

test('observation rows: malformed values are dropped, the row reads in words', () => {
  const o = cleanObs({ rows: [{ t: '14:05', rr: 32, spo2: 91, o2: 2, dev: 'NP', sbp: 98, dbp: 60, hr: 128, temp: 38.9, avpu: 'A', pain: 6, init: 'JM', junk: 1 },
    { t: '25:00', rr: 20 }, { t: '14:20', rr: 'x', spo2: 140, sbp: 90, dbp: 95, avpu: 'Q', dev: 'TENT' }] });
  assert.equal(o.rows.length, 2);
  assert.deepEqual(o.rows[1], { t: '14:20', sbp: 90 });
  assert.equal(obsText(o.rows[0]), '14:05: RR 32, SpO2 91% on 2 L/min nasal prongs, BP 98/60, HR 128, T 38.9 °C, Alert, pain 6/10');
  assert.equal(cleanObs({ rows: [] }), null);
});

import { parseVitals, vitalsMismatch } from '../public/js/osce/obs.mjs';
test('Part 1 vitals read from the exam findings line, and set against the first charted row', () => {
  assert.deepEqual(parseVitals('HR 128 bpm, BP 98/60 mmHg, RR 26/min, SpO2 91% on 2 L/min nasal prongs, temperature 38.9 °C'), { rr: 26, spo2: 91, hr: 128, sbp: 98, dbp: 60, temp: 38.9 });
  assert.deepEqual(parseVitals('Heart rate 152, respiratory rate 46, sats 93% on air, T 37.9°C'), { rr: 46, spo2: 93, hr: 152, temp: 37.9 });
  assert.deepEqual(vitalsMismatch('HR 128, RR 26, SpO2 91%', { t: '14:05', hr: 128, rr: 28, spo2: 91 }), ['rr 26 in Part 1, 28 on the chart at 14:05']);
  assert.deepEqual(vitalsMismatch('', { t: '14:05', hr: 1 }), []);
});
