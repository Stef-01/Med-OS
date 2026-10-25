/* real ECGs and staged candidates: the WFDB reader (formats 16 and 212), the printed ECG's layout and scale, staged
   candidates and the reviewer's verdicts, and a staged request run end to end through resolveRequest */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseHeader, decode16, decode212, leadsMv, ecgSvg, stripSvg, LAYOUT, leadName } from './imaging/ecg.mjs';
import { addStaged, stagedCandidates, candidatesFrom, verdictProblems, sessionVerify, REVIEWER } from './imaging/staged.mjs';
import { resolveRequest } from './imaging/resolve.mjs';
import { licenceOk } from './imaging/rank.mjs';

const HEADER = `00001_hr 12 500 5000
00001_hr.dat 16 1000.0(0)/mV 16 0 -119 1508 0 I
00001_hr.dat 16 1000.0(0)/mV 16 0 -55 723 0 II
00001_hr.dat 16 1000.0(0)/mV 16 0 64 64758 0 III
00001_hr.dat 16 1000.0(0)/mV 16 0 86 64423 0 AVR
00001_hr.dat 16 1000.0(0)/mV 16 0 -91 1211 0 AVL
00001_hr.dat 16 1000.0(0)/mV 16 0 4 7 0 AVF
00001_hr.dat 16 1000.0(0)/mV 16 0 -69 63827 0 V1
00001_hr.dat 16 1000.0(0)/mV 16 0 -31 6999 0 V2
00001_hr.dat 16 1000.0(0)/mV 16 0 0 63759 0 V3
00001_hr.dat 16 1000.0(0)/mV 16 0 -26 61447 0 V4
00001_hr.dat 16 1000.0(0)/mV 16 0 -39 64979 0 V5
00001_hr.dat 16 1000.0(0)/mV 16 0 -79 832 0 V6`;
/* n frames of 12 interleaved int16 samples: lead s at frame i is s * 100 + i (so every value is known) */
const frames16 = n => { const b = new Uint8Array(n * 12 * 2), dv = new DataView(b.buffer); for (let i = 0; i < n; i++) for (let s = 0; s < 12; s++) dv.setInt16((i * 12 + s) * 2, s * 100 + i - 600, true); return b; };

test('WFDB header: the record line, each signal\'s gain, baseline and lead, the lead names as an ECG prints them', () => {
  const h = parseHeader(HEADER);
  assert.equal(h.nsig, 12); assert.equal(h.fs, 500); assert.equal(h.nsamp, 5000);
  assert.deepEqual(h.signals.map(s => s.lead), ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6']);
  assert.equal(h.signals[0].gain, 1000); assert.equal(h.signals[0].baseline, 0); assert.equal(h.signals[0].fmt, '16');
  assert.equal(parseHeader('cu01 1 250 127232\ncu01.dat 212 400 12 0 -109 -28468 0 ECG').signals[0].gain, 400);
  assert.equal(leadName('AVF'), 'aVF');
  assert.throws(() => parseHeader('x 3 500 10\nx.dat 16 1000/mV 16 0 0 0 0 I'));
});

test('format 16 is interleaved little-endian; format 212 packs two 12-bit samples in three bytes, signed', () => {
  const d = decode16(frames16(3), 12);
  assert.equal(d.length, 12); assert.deepEqual([...d[0]], [-600, -599, -598]); assert.deepEqual([...d[11]], [500, 501, 502]);
  /* 0x123 and -2 (0xffe): byte0 = 0x23, byte1 = (0xf << 4) | 0x1, byte2 = 0xfe */
  assert.deepEqual([...decode212(new Uint8Array([0x23, 0xf1, 0xfe]), 1)[0]], [0x123, -2]);
  const mv = leadsMv(parseHeader(HEADER), frames16(2));
  assert.equal(mv.I[0], -0.6); assert.equal(mv.aVR[1], -0.299);
});

test('the printed ECG: 25 mm/s and 10 mm/mV on a 1 mm grid, the standard 3 by 4 layout, lead II as the rhythm strip', () => {
  const n = 5000, leads = {};
  for (const l of LAYOUT.flat()) leads[l] = new Float64Array(n);
  leads.II = Float64Array.from({ length: n }, (_, k) => (k === 0 ? 1 : 0));   /* a 1 mV step at the first sample */
  const mm = 4, { svg, width, height } = ecgSvg(leads, 500, { mm });
  assert.equal(width, Math.round((12 + 250 + 4) * mm)); assert.equal(height, Math.round((6 + 4 * 34 + 8) * mm));
  for (const l of LAYOUT.flat()) assert.match(svg, new RegExp(`>${l}</text>`));
  assert.equal((svg.match(/>II<\/text>/g) || []).length, 2);   /* in its column, and the rhythm strip */
  assert.match(svg, /25 mm\/s · 10 mm\/mV/);
  /* lead II's first sample is 10 mm above its baseline: the second row's baseline is at 6 + 34 * 1.62 mm */
  const y0 = (6 + 34 * 1.62) * mm, yUp = Math.round((y0 - 10 * mm) * 100) / 100;
  assert.ok(svg.includes(`M${12 * mm} ${yUp}`), 'a 1 mV sample sits 10 mm above the baseline');
  delete leads.V6; assert.throws(() => ecgSvg(leads, 500), /V6/);
  assert.match(stripSvg(new Float64Array(2500), 250, { lead: 'Monitor' }).svg, />Monitor</);
});

test('licences: Open Data Commons Attribution (PhysioNet\'s older databases) passes like CC BY', () => {
  for (const l of ['ODC-BY 1.0 (Open Data Commons Attribution)', 'Open Data Commons Attribution License v1.0']) assert.ok(licenceOk(l), l);
  assert.ok(!licenceOk('Open Data Commons Open Database License v1.0'));
});

const VERDICT = { observed: { modality: 'ecg', region: 'heart', view: '12-lead', age_group: 'unknown', findings: ['inferior ST elevation'], laterality: 'none' },
  single_image: true, annotations: 'minor_marks', quality: 'good', sees: 'Inferior STEMI.', matches_request: true, confidence: 0.9, reason: 'matches', findings: 'ST elevation in II, III and aVF.' };

test('verdicts as the reviewer writes them: the schema\'s fields and values, and a findings sentence of at most 300 characters', () => {
  assert.deepEqual(verdictProblems(VERDICT), []);
  assert.ok(verdictProblems({ ...VERDICT, observed: { ...VERDICT.observed, modality: 'drawing' } }).some(p => /modality/.test(p)));
  assert.ok(verdictProblems({ ...VERDICT, confidence: 2 }).some(p => /confidence/.test(p)));
  assert.ok(verdictProblems({ ...VERDICT, findings: 'x'.repeat(301) }).some(p => /300/.test(p)));
  const { findings, ...noFind } = VERDICT;
  assert.deepEqual(verdictProblems(noFind), [], 'findings default to sees');
  assert.ok(verdictProblems({ ...VERDICT, sees: '', findings: '' }).some(p => /findings is empty/.test(p)));
});

test('staged candidates keep their order and credit; a candidate without a verdict is never accepted', async () => {
  const list = [{ key: 's/r/b.png', station: 's', req: 'r', file: 's/r/b.png', width: 900, height: 500, mime: 'image/png', license: 'CC BY 4.0', author: 'A', page: 'https://p', via: 'V', title: 'B' },
    { key: 's/r/a.png', station: 's', req: 'r', file: 's/r/a.png', width: 900, height: 500, mime: 'image/png', license: 'CC BY 4.0', author: 'A', page: 'https://p', via: 'V', title: 'A' },
    { key: 's/q/c.png', station: 's', req: 'q', file: 's/q/c.png', width: 900, height: 500, mime: 'image/png' }];
  const c = candidatesFrom(list, '/stage', 's', 'r');
  assert.deepEqual(c.map(x => x.title), ['B', 'A']);
  assert.equal(c[0].url, `file://${path.resolve('/stage', 's/r/b.png')}`); assert.equal(c[0].key, 's/r/b.png');
  const verify = sessionVerify({ 's/r/a.png': VERDICT });
  assert.equal((await verify({}, null, '', c[0])).verdict.matches_request, false);
  const ok = await verify({}, null, '', c[1]);
  assert.equal(ok.verdict.matches_request, true); assert.equal(ok.model, REVIEWER); assert.equal(ok.verdict.findings, VERDICT.findings);
  assert.equal((await sessionVerify({ 's/r/a.png': { ...VERDICT, quality: 'great' } })({}, null, '', c[1])).verdict.matches_request, false);
});

test('a staged request end to end: the reviewed candidate is saved with its credit, findings and reviewer', async () => {
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'stage-')), pub = fs.mkdtempSync(path.join(os.tmpdir(), 'pub-'));
  const png = (w, h) => { const b = new Uint8Array(64); b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]); const v = new DataView(b.buffer); v.setUint32(16, w); v.setUint32(20, h); return b; };
  const meta = { license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', author: 'Wagner P et al.', page: 'https://physionet.org/content/ptb-xl/1.0.3/x.hea', via: 'PTB-XL (PhysioNet)', source: 'ptb-xl' };
  addStaged(stage, { station: 'st1', req: 'ecg-1', name: 'one.png', bytes: png(1000, 600), title: 'record one', ...meta });
  addStaged(stage, { station: 'st1', req: 'ecg-1', name: 'two.png', bytes: png(1000, 600), title: 'record two', ...meta });
  addStaged(stage, { station: 'st1', req: 'ecg-1', name: 'small.png', bytes: png(200, 200), title: 'too small', ...meta });
  assert.throws(() => addStaged(stage, { station: 'st1', req: 'ecg-1', name: '../x.png', bytes: png(1000, 600) }));
  const req = { id: 'ecg-1', modality: 'ecg', region: 'heart', finding: 'inferior STEMI', laterality: 'none', age: 'adult', place: 'part2', caption: 'ECG', alt: '12-lead ECG' };
  const verdicts = { 'st1/ecg-1/one.png': { ...VERDICT, matches_request: false, confidence: 0.2 }, 'st1/ecg-1/two.png': VERDICT };
  const { entry, tried } = await resolveRequest(req, { stationId: 'st1', pub, candidates: stagedCandidates(stage, 'st1', 'ecg-1'), verify: sessionVerify(verdicts) });
  assert.equal(entry.src, 'media/st1/ecg-1.png');
  assert.ok(fs.existsSync(path.join(pub, entry.src)));
  assert.equal(entry.findings, VERDICT.findings);
  assert.equal(entry.credit.license, 'CC BY 4.0'); assert.equal(entry.credit.via, 'PTB-XL (PhysioNet)'); assert.match(entry.credit.page, /physionet\.org/);
  assert.equal(entry.verified.model, REVIEWER);
  assert.deepEqual(tried.map(t => t.title), ['record one', 'record two'], 'the small one is out before it is looked at');
});
