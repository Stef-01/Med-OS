/* the chart drawn: two pages like the paper chart, a mark for every value, everything escaped; the candidate sees the chart
   and never the zones or the model interpretation, which sit on the examiner's card */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { obsChartHtml, obsTableHtml, obsZonesHtml, FILL } from '../public/js/osce/obs-chart.mjs';
import { oscePart2 } from '../public/js/osce/core.mjs';
import { qaSlides, qaHtml, part2Html } from '../public/js/osce/session.mjs';

const rows = { rows: [
  { t: '14:05', rr: 26, spo2: 91, dev: 'NP', o2: 2, sbp: 98, dbp: 60, hr: 118, temp: 38.9, avpu: 'A', pain: 6, init: 'JM' },
  { t: '14:20', rr: 44, spo2: 88, dev: 'FM', o2: 6, sbp: 86, dbp: 50, hr: 132, temp: 39.1, avpu: 'C', init: 'JM', note: 'Rapid response called <script>x</script>' }] };

test('the adult chart: two pages, a dot per value and v over ^ per blood pressure, the zones in the chart\'s own colours', () => {
  const h = obsChartHtml('sago', rows, { label: 'Obs' });
  assert.equal((h.match(/<svg class="os-obs-page"/g) || []).length, 2);
  assert.match(h, /Standard Adult General Observation Chart/);
  assert.match(h, /SMR110\.010/);
  /* dots: rr, spo2, hr, temp per row (8) + consciousness (2) + pain (1) */
  assert.equal((h.match(/<circle /g) || []).length, 11);
  assert.equal((h.match(/<path d="M/g) || []).length, 4, 'a v and a ^ for each blood pressure');
  assert.match(h, new RegExp(`fill="${FILL.red}"`));
  assert.match(h, />44<\/text>/, 'RR 44 is off the adult scale (top 40): the value is written beside the dot');
  assert.match(h, /&lt;script&gt;/);
  assert.doesNotMatch(h, /<script/);
  assert.equal(obsChartHtml('nope', rows), '');
  assert.equal(obsChartHtml('sago', { rows: [] }), '');
});

test('no chart for the patient: the rows written out, times across the top', () => {
  const t = obsTableHtml(rows);
  assert.match(t, /<th>14:05<\/th><th>14:20<\/th>/);
  assert.match(t, /<td>2 L\/min NP<\/td>/);
  assert.match(t, /<td>98\/60<\/td>/);
  assert.doesNotMatch(t, /Cap refill/, 'a row nobody measured is left out');
});

test('the zones at each time, worked out from the chart', () => {
  const z = obsZonesHtml('sago', rows);
  assert.match(z, /class="os-z-yellow"><span class="os-zt">14:05<\/span><span class="os-zc">Clinical review/);
  assert.match(z, /class="os-z-red"><span class="os-zt">14:20<\/span><span class="os-zc">Rapid response/);
});

test('Part 2 with observations: the candidate gets the chart only; the examiner\'s card has the table, the zones and the model', () => {
  const st = { id: 's2', demo: { age: 70, unit: 'years', sex: 'F', setting: 'ed' },
    part2: oscePart2({ lead: 'Here', ask: ['What do you see?', 'Next?'], handover: [
      { label: 'Observations', kind: 'obs', result: '<p>On oxygen since 14:10.</p>', model: '<p>MODEL: RR in the red zone</p>', obs: rows },
      { label: 'Bloods', kind: 'bloods', result: '<p>Hb 92</p>', model: '<p>MODEL: anaemia</p>' }] }) };
  const slides = qaSlides(st);
  assert.match(slides[0].html, /<svg class="os-obs-page"/);
  assert.match(slides[0].html, /On oxygen since 14:10/);
  for (const x of slides) assert.doesNotMatch(x.html, /MODEL|os-obs-zones/, 'nothing of the examiner\'s on a slide');
  assert.doesNotMatch(part2Html(st), /MODEL|os-obs-zones|Rapid response called <|os-model/);
  const card = qaHtml(st);
  assert.match(card, /class="os-obs-table"/);
  assert.match(card, /<details class="os-model">/);
  assert.match(card, /MODEL: RR in the red zone/);
  assert.match(card, /os-z-red/);
  assert.match(card, /<small class="os-kind os-kind--obs">Observations<\/small>/);
  assert.match(card, /The candidate sees this on the adult chart/);
  const gp = { ...st, demo: { ...st.demo, setting: 'gp' } };
  assert.match(qaSlides(gp)[0].html, /os-obs-table/, 'a GP room: written out');
  assert.doesNotMatch(qaHtml(gp), /os-obs-zones/, 'no chart, no zones');
});

import { flagHtml } from '../public/js/osce/session.mjs';
test('lab flags: a cell that is a flag, or a number then a flag, marks its row high or low; nothing else changes', () => {
  const t = flagHtml('<table><tr><th>Test</th><th>Result</th></tr><tr><td>Hb</td><td>78 L</td></tr><tr><td>WCC</td><td>14.2</td><td>H</td></tr><tr><td>Lactate</td><td>5.2 (H)</td></tr><tr><td>Na</td><td>139</td></tr><tr><td>HbA1c</td><td>Hepatitis</td></tr></table>');
  assert.match(t, /<tr class="os-lo"><td>Hb<\/td><td>78 <b class="os-flag os-flag-l">L<\/b><\/td><\/tr>/);
  assert.match(t, /<tr class="os-hi"><td>WCC<\/td><td>14.2<\/td><td><b class="os-flag os-flag-h">H<\/b><\/td><\/tr>/);
  assert.match(t, /<td>5.2 <b class="os-flag os-flag-h">H<\/b><\/td>/);
  assert.match(t, /<tr><td>Na<\/td><td>139<\/td><\/tr>/);
  assert.match(t, /<tr><td>HbA1c<\/td><td>Hepatitis<\/td><\/tr>/);
  assert.equal(flagHtml('<p>Hb 92 L</p>'), '<p>Hb 92 L</p>', 'only table cells');
});
