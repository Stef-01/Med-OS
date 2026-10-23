/* lab results: the pathology viewer's layout (the fixture is a real FBC report's layout), ranges printed as a lab prints
   them, and every flag checked against its own value and range */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanLabs, refBounds, refText, expectedFlag, labFlagProblems, labsHtml, labsText } from '../public/js/osce/labs.mjs';

const FBC = [{ rows: [
  { t: 'Haemoglobin', v: '65', u: 'g/L', r: '115-165', f: 'L' }, { t: 'White cell count', v: '5.96', u: '10^9/L', r: '3.50-11.00' },
  { t: 'Mean cell volume', v: '100.5', u: 'fL', r: '80-100', f: 'H' }, { t: 'Mean cell haemoglobin', v: '33.0', u: 'pg', r: '26.5-33.0' },
  { t: 'Red cell distribution width', v: '53.6', u: 'fL', r: '38.0-48.0', f: 'H' }, { t: '', v: '14.6', u: '%', r: '12.0-14.5', f: 'H' },
  { t: 'Neutrophils', v: '67.3', u: '%' }, { t: '', v: '4.01', u: '10^9/L', r: '1.7-7.0' },
  { t: 'Lymphocytes', v: '23.0', u: '%' }, { t: '', v: '1.37', u: '10^9/L', r: '1.5-4.0', f: 'L' }] }];

test('the layout: Test | Result | Ref. Range (Units); abnormal results red with an asterisk; a second unit on its own row', () => {
  const h = labsHtml(FBC);
  assert.match(h, /<th class="os-lab-n">Test<\/th><th class="os-lab-v">Result<\/th><th class="os-lab-r">Ref. Range \(Units\)<\/th>/);
  assert.match(h, /<th class="os-lab-n" scope="row">Haemoglobin<\/th><td class="os-lab-v os-lab-ab"><i aria-hidden="true">\*<\/i>65<span class="kit-sr"> \(low\)<\/span><\/td><td class="os-lab-r">115-165 \(g\/L\)<\/td>/);
  assert.equal((h.match(/os-lab-ab/g) || []).length, 5);
  assert.equal((h.match(/<tr class="os-lab-c">/g) || []).length, 3, 'RDW %, neutrophil and lymphocyte counts continue the row above');
  assert.match(h, /<td class="os-lab-v">67.3<\/td><td class="os-lab-r">\(%\)<\/td>/, 'a percentage with no range shows its units alone');
  assert.match(h, /<td class="os-lab-v">33.0<\/td>/, 'a value at the top of its range is not flagged');
  assert.match(labsHtml([{ rows: [{ t: '<b>x</b>', v: '1 & 2' }] }]), /&lt;b&gt;x&lt;\/b&gt;.*1 &amp; 2/);
  assert.equal(labsHtml(null), '');
});

test('a gas from two vessels, or a result beside an earlier one: a column each, flagged each', () => {
  const cord = [{ title: 'Cord blood gas', cols: ['Artery', 'Vein'], rows: [{ t: 'pH', v: ['7.18', '7.25'], r: '7.20-7.35', f: ['L', ''] }, { t: 'pCO2', v: ['54', '46'], u: 'mmHg', r: '40-60' }] }];
  const h = labsHtml(cord);
  assert.match(h, /<th colspan="4">Cord blood gas<\/th>/);
  assert.match(h, /<th class="os-lab-v">Artery<\/th><th class="os-lab-v">Vein<\/th>/);
  assert.match(h, /<i aria-hidden="true">\*<\/i>7.18.*<td class="os-lab-v">7.25<\/td>/);
  assert.deepEqual(labFlagProblems(cord), []);
  assert.match(labsText(cord), /^Cord blood gas: pH Artery 7.18 \*L, Vein 7.25 \(7.20-7.35\); pCO2 Artery 54, Vein 46 mmHg \(40-60\)$/);
});

test('ranges as a lab prints them, and the flag each value should carry', () => {
  assert.equal(refText('115 to 160'), '115-160');
  assert.equal(refText('3.50-11.00'), '3.50-11.00');
  assert.equal(refText('-2 to +2'), '-2 to +2');
  assert.equal(refText('below 5'), '<5');
  assert.equal(refText('≥ 30'), '≥30');
  assert.equal(refText('Not detected'), 'Not detected');
  assert.equal(refText('≥10 indicates immunity'), '≥10 indicates immunity');
  assert.equal(refText('3.0 to 7.7 (random)'), '3.0-7.7 (random)');
  assert.equal(expectedFlag('3', '≥10 indicates immunity'), 'L');
  assert.equal(expectedFlag('10', '≥10'), '');
  assert.deepEqual(refBounds('115 to 160'), { lo: 115, hi: 160, rest: '' });
  assert.equal(expectedFlag('65', '115-165'), 'L');
  assert.equal(expectedFlag('100.5', '80-100'), 'H');
  assert.equal(expectedFlag('100', '80-100'), '');
  assert.equal(expectedFlag('4.2', 'below 2.0'), 'H');
  assert.equal(expectedFlag('2.0', '<2.0'), 'H', 'a "<2.0" limit excludes 2.0');
  assert.equal(expectedFlag('1,250', '150-450'), 'H');
  assert.equal(expectedFlag('-9', '-2 to +2'), 'L');
  assert.equal(expectedFlag('<5', '<5'), '', 'a censored result inside its range');
  assert.equal(expectedFlag('<40', '55 to 310'), 'L');
  assert.equal(expectedFlag('>90', 'above 60'), '');
  assert.equal(expectedFlag('<10', '≥10 indicates immunity'), 'L');
  assert.equal(expectedFlag('<60', '55 to 310'), null, 'could be either side');
  assert.equal(expectedFlag('Positive', 'Negative'), null);
});

test('every flag against its range: the fixture is right; a missing or wrong flag is named', () => {
  assert.deepEqual(labFlagProblems(FBC), []);
  const bad = structuredClone(FBC); bad[0].rows[0].f = ''; bad[0].rows[1].f = 'H';
  assert.deepEqual(labFlagProblems(bad), ['Haemoglobin: 65 g/L against 115-165 should be flagged L, is unflagged', 'White cell count: 5.96 10^9/L against 3.50-11.00 should be unflagged, is flagged H']);
});

test('cleaning: malformed rows and panels drop, values and flags pad to the columns', () => {
  const c = cleanLabs([{ cols: ['Artery', 'Vein'], rows: [{ t: 'pH', v: '7.18', f: 'Q' }, null, { t: 'x', v: '' }] }, { rows: [] }, 'junk']);
  assert.deepEqual(c, [{ cols: ['Artery', 'Vein'], rows: [{ t: 'pH', v: ['7.18', ''], f: ['', ''] }] }]);
  assert.equal(cleanLabs([]), null);
});
