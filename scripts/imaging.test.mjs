/* the imaging pipeline's pure parts: licences, search words, ranking, the two sources' replies, image sizes, the
   verdict rules, placing a file on a station; and resolveRequest end to end against stubbed fetch + verify */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { licenceOk, searchQueries, scoreCandidate, rankCandidates, requestProblems } from './imaging/rank.mjs';
import { commonsUrl, parseCommons, openiUrl, parseOpeni } from './imaging/sources.mjs';
import { imageSize } from './imaging/image-size.mjs';
import { acceptVerdict, VERIFY_SCHEMA, verifyText } from './imaging/verify.mjs';
import { placeMedia, pending, resolveRequest } from './imaging/resolve.mjs';

const REQ = { id: 'cxr-1', modality: 'xray', region: 'chest', view: 'PA', finding: 'right-sided tension pneumothorax with mediastinal shift', laterality: 'right', age: 'adult',
  place: 'patientScript', caption: 'Chest X-ray: show when asked', alt: 'Frontal chest radiograph', terms: ['tension pneumothorax'] };

/* a PNG header for w×h, enough for imageSize */
const png = (w, h, extra = 0) => { const b = new Uint8Array(33 + extra); b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]); const v = new DataView(b.buffer); v.setUint32(16, w); v.setUint32(20, h); return b; };
const jpeg = (w, h) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, ...new Array(14).fill(0), 0xff, 0xc0, 0, 17, 8, h >> 8, h & 255, w >> 8, w & 255, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

test('licences: public domain, CC0 and the CC BY family pass; unknown and restricted do not', () => {
  for (const l of ['Public domain', 'CC0', 'CC BY 4.0', 'CC BY-SA 3.0', 'CC-BY-SA-3.0-migrated', 'CC BY-NC-SA 4.0', 'GFDL']) assert.ok(licenceOk(l), l);
  for (const l of ['', 'All rights reserved', 'Fair use', 'Non-free', 'Copyright 2019', 'open-access', 'unknown']) assert.ok(!licenceOk(l), l);
});

test('search words: the finding without its side, with the modality and region, then each term', () => {
  const q = searchQueries(REQ);
  assert.equal(q[0], 'tension pneumothorax with mediastinal shift chest radiograph');
  assert.ok(q.includes('tension pneumothorax radiograph'));
  assert.ok(q.every(x => !/right-sided/.test(x)));
});

test('ranking: the matching radiograph first; drawings, the wrong licence and tiny files out', () => {
  const good = { title: 'Tension pneumothorax chest X-ray.jpg', description: 'Chest radiograph showing a right tension pneumothorax', categories: ['Pneumothorax radiographs'], license: 'CC BY-SA 4.0', width: 1280, height: 1100, mime: 'image/jpeg', url: 'u1' };
  const drawing = { ...good, title: 'Pneumothorax diagram.png', description: 'Illustration of a pneumothorax', url: 'u2' };
  const ct = { ...good, title: 'Pneumothorax CT scan.jpg', description: 'Computed tomography axial slice', categories: [], url: 'u3' };
  const closed = { ...good, license: 'All rights reserved', url: 'u4', title: 'other' };
  const tiny = { ...good, width: 200, height: 200, url: 'u5', title: 'tiny' };
  const unrelated = { ...good, title: 'Normal chest X-ray.jpg', description: 'Normal adult chest radiograph', categories: [], url: 'u6' };
  assert.ok(scoreCandidate(REQ, good).score > scoreCandidate(REQ, drawing).score);
  assert.ok(scoreCandidate(REQ, good).score > scoreCandidate(REQ, ct).score);
  assert.equal(scoreCandidate(REQ, closed).reject, 'licence');
  assert.equal(scoreCandidate(REQ, tiny).reject, 'size');
  const ranked = rankCandidates(REQ, [unrelated, drawing, closed, tiny, good, { ...good }]);
  assert.equal(ranked[0].url, 'u1');
  assert.equal(ranked.filter(c => c.url === 'u1').length, 1, 'duplicates collapse');
  assert.ok(!ranked.some(c => c.url === 'u4' || c.url === 'u5'));
});

test('requests are checked before anything is searched', () => {
  assert.deepEqual(requestProblems(REQ), []);
  assert.ok(requestProblems({ ...REQ, modality: 'xr', place: 'there', id: 'Bad Id' }).length === 3);
  assert.ok(requestProblems({ ...REQ, alt: '' }).some(p => /alt/.test(p)));
});

test('Wikimedia Commons: the query asks for bitmaps with licence metadata; a reply parses into candidates', () => {
  const u = new URL(commonsUrl('tension pneumothorax radiograph'));
  assert.equal(u.searchParams.get('gsrsearch'), 'tension pneumothorax radiograph filetype:bitmap');
  assert.equal(u.searchParams.get('gsrnamespace'), '6');
  assert.match(u.searchParams.get('iiprop'), /extmetadata/);
  const reply = { query: { pages: [{ pageid: 1, ns: 6, title: 'File:Tension pneumothorax.jpg', imageinfo: [{ url: 'https://upload.wikimedia.org/a/b/Tension_pneumothorax.jpg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:Tension_pneumothorax.jpg',
    thumburl: 'https://upload.wikimedia.org/thumb/a/b/1280px-Tension_pneumothorax.jpg', thumbwidth: 1280, thumbheight: 1024, width: 2000, height: 1600, mime: 'image/jpeg',
    extmetadata: { LicenseShortName: { value: 'CC BY-SA 4.0' }, LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/4.0' }, Artist: { value: '<a href="//commons.wikimedia.org/wiki/User:X">Dr X</a>' },
      ImageDescription: { value: 'Right <b>tension</b> pneumothorax' }, Categories: { value: 'Pneumothorax|Chest radiographs' } } }] }, { pageid: 2, title: 'File:Broken.jpg' }] } };
  const [c, ...rest] = parseCommons(reply);
  assert.equal(rest.length, 0);
  assert.equal(c.title, 'Tension pneumothorax.jpg');
  assert.equal(c.url, 'https://upload.wikimedia.org/thumb/a/b/1280px-Tension_pneumothorax.jpg');
  assert.equal(c.author, 'Dr X');
  assert.equal(c.description, 'Right tension pneumothorax');
  assert.deepEqual(c.categories, ['Pneumothorax', 'Chest radiographs']);
  assert.equal(c.width, 1280);
  assert.equal(c.page, 'https://commons.wikimedia.org/wiki/File:Tension_pneumothorax.jpg');
});

test('Open-i: the query carries the image type; relative image paths become absolute; no licence, no pass', () => {
  const u = new URL(openiUrl('pneumothorax', 'x', 10));
  assert.equal(u.searchParams.get('it'), 'x');
  assert.equal(u.searchParams.get('n'), '10');
  const [a, b] = parseOpeni({ list: [
    { uid: 'PMC1_1', imgLarge: '/imgs/512/1/1/PMC1_a.png', title: 'A case', image: { caption: 'Chest radiograph: right pneumothorax' }, MeSH: { major: ['Pneumothorax'] }, licenseTag: 'CC BY' },
    { uid: 'PMC2_2', imgLarge: '/imgs/512/2/2/PMC2_b.png', title: 'Another', image: { caption: 'x' } }, { uid: 'none' }] });
  assert.equal(a.url, 'https://openi.nlm.nih.gov/imgs/512/1/1/PMC1_a.png');
  assert.equal(a.license, 'CC BY');
  assert.deepEqual(a.mesh, ['Pneumothorax']);
  assert.equal(scoreCandidate(REQ, b).reject, 'licence');
});

test('image sizes from the first bytes', () => {
  assert.deepEqual(imageSize(png(1280, 1024)), { mime: 'image/png', width: 1280, height: 1024 });
  assert.deepEqual(imageSize(jpeg(800, 600)), { mime: 'image/jpeg', width: 800, height: 600 });
  assert.deepEqual(imageSize(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x20, 0x03, 0x58, 0x02])), { mime: 'image/gif', width: 800, height: 600 });
  assert.equal(imageSize(new Uint8Array([1, 2, 3])), null);
  assert.equal(imageSize(Buffer.from('<html>not an image</html>')), null);
});

const VERDICT = { observed: { modality: 'xray', region: 'chest', view: 'PA', age_group: 'adult', findings: ['large right pneumothorax', 'mediastinal shift to the left'], laterality: 'right' },
  single_image: true, annotations: 'minor_marks', quality: 'good', sees: 'PA chest radiograph with a large right tension pneumothorax.', matches_request: true, confidence: 0.92, reason: 'clear' };

test('the verdict rules: the model saying yes is not enough on its own', () => {
  assert.deepEqual(acceptVerdict(REQ, VERDICT), { ok: true, why: [] });
  assert.match(acceptVerdict(REQ, { ...VERDICT, observed: { ...VERDICT.observed, laterality: 'left' } }).why.join(), /left side/);
  assert.match(acceptVerdict(REQ, { ...VERDICT, confidence: 0.6 }).why.join(), /confidence/);
  assert.match(acceptVerdict(REQ, { ...VERDICT, annotations: 'text_revealing_diagnosis' }).why.join(), /annotated/);
  assert.ok(acceptVerdict({ ...REQ, place: 'explanation' }, { ...VERDICT, annotations: 'labels_or_arrows' }).ok, 'labels are fine in the explanation');
  assert.match(acceptVerdict(REQ, { ...VERDICT, observed: { ...VERDICT.observed, modality: 'ct' } }).why.join(), /modality/);
  assert.match(acceptVerdict(REQ, { ...VERDICT, single_image: false }).why.join(), /single/);
  assert.match(acceptVerdict({ ...REQ, age: 'child' }, VERDICT).why.join(), /adult/);
  assert.match(acceptVerdict(REQ, { ...VERDICT, matches_request: false }).why.join(), /finding/);
  assert.equal(acceptVerdict(REQ, null).ok, false);
  assert.deepEqual(Object.keys(VERIFY_SCHEMA.properties)[0], 'observed', 'the model describes what it sees before it judges');
  assert.match(verifyText(REQ), /side of the finding \(patient's\): right/);
});

test('placing a file: one per request, the old one replaced, empty lists dropped; pending skips resolved requests', () => {
  const st = { id: 's', imaging: [REQ, { ...REQ, id: 'ecg-1' }], media: { stem: [{ src: 'media/s/cxr-1.jpg', req: 'cxr-1' }] } };
  assert.deepEqual(pending(st).map(r => r.id), ['ecg-1']);
  assert.deepEqual(pending(st, true).map(r => r.id), ['cxr-1', 'ecg-1']);
  const next = placeMedia(st, 'patientScript', { src: 'media/s/cxr-1.png', req: 'cxr-1' });
  assert.equal(next.media.stem, undefined);
  assert.deepEqual(next.media.patientScript.map(m => m.src), ['media/s/cxr-1.png']);
  assert.equal(st.media.stem.length, 1, 'the input is untouched');
});

test('resolveRequest end to end: search → rank → download → verify → the file and its credit', async () => {
  const pub = fs.mkdtempSync(path.join(os.tmpdir(), 'osce-img-'));
  const commons = { query: { pages: [
    { title: 'File:Pneumothorax diagram.png', imageinfo: [{ url: 'https://x/diagram.png', thumburl: 'https://x/diagram.png', descriptionurl: 'https://c/d', thumbwidth: 900, thumbheight: 900, mime: 'image/png', extmetadata: { LicenseShortName: { value: 'CC BY 4.0' }, ImageDescription: { value: 'Illustration of a pneumothorax' }, Artist: { value: 'A' } } }] },
    { title: 'File:Left pneumothorax radiograph.jpg', imageinfo: [{ url: 'https://x/left.png', thumburl: 'https://x/left.png', descriptionurl: 'https://c/left', thumbwidth: 900, thumbheight: 900, mime: 'image/png', extmetadata: { LicenseShortName: { value: 'CC BY 4.0' }, ImageDescription: { value: 'Tension pneumothorax chest radiograph' }, Artist: { value: 'B' } } }] },
    { title: 'File:Tension pneumothorax chest radiograph.jpg', imageinfo: [{ url: 'https://x/right.png', thumburl: 'https://x/right.png', descriptionurl: 'https://c/right', thumbwidth: 900, thumbheight: 900, mime: 'image/png', extmetadata: { LicenseShortName: { value: 'CC BY-SA 4.0' }, LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/4.0' }, ImageDescription: { value: 'Tension pneumothorax with mediastinal shift, chest radiograph' }, Artist: { value: 'Dr C' } } }] }] } };
  const f = async url => {
    if (url.includes('commons.wikimedia.org/w/api.php')) return { ok: true, json: async () => commons };
    if (url.includes('openi.nlm.nih.gov')) return { ok: false, status: 503 };
    return { ok: true, arrayBuffer: async () => png(900, 900, url.includes('left') ? 200 : 100).buffer };   /* the byte length tells the stub which film it got */
  };
  const seen = [];
  const verify = async (req, bytes) => { seen.push(bytes.length); return { model: 'stub', verdict: bytes.length === 233 ? { ...VERDICT, observed: { ...VERDICT.observed, laterality: 'left' } } : VERDICT }; };
  const { entry, tried } = await resolveRequest(REQ, { stationId: 'ai-x', pub, f, verify });
  assert.ok(entry, JSON.stringify(tried));
  assert.equal(entry.src, 'media/ai-x/cxr-1.png');
  assert.ok(fs.existsSync(path.join(pub, entry.src)));
  assert.deepEqual([entry.w, entry.h], [900, 900]);
  assert.equal(entry.credit.via, 'Wikimedia Commons');
  assert.equal(entry.verified.confidence, 0.92);
  assert.equal(entry.credit.author, 'Dr C', 'the right-sided film is the one kept');
  assert.ok(tried.every(t => t.title !== 'Left pneumothorax radiograph.jpg' || /left side/.test(t.why.join())), 'a left-sided film, if looked at, is refused');
  assert.ok(!tried.some(t => /diagram/.test(t.title)), 'the drawing never reached the pixel check');
});
