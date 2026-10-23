/* the data the app loads: the validator finds nothing wrong, the index is deterministic and current, sync shards the
   shared record and keeps the running session on the device, figures escape what they print */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from './validate.mjs';
import { buildIndex, readBodies, stationRow } from './build-index.mjs';
import { SPEC, shardsOf, applyShard, diffShards } from '../public/js/study-kit/sync.mjs';
import { figureHtml, creditHtml, mediaAttr } from '../public/js/study-kit/media.mjs';

const PUB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

test('the bank validates with no errors', () => {
  const { errors, count } = validate(PUB);
  assert.deepEqual(errors, []);
  assert.equal(count, 26);
});

test('the index: the same bodies always write the same bytes, rows sorted by title, light rows only', () => {
  const files = readBodies(path.join(PUB, 'osce'));
  const a = buildIndex(files), b = buildIndex([...files].reverse());
  assert.equal(a.index, b.index);
  assert.deepEqual(a.problems, []);
  const rows = JSON.parse(a.index).stations;
  assert.deepEqual(rows.map(r => r.title), [...rows.map(r => r.title)].sort((x, y) => x.localeCompare(y)));
  for (const r of rows) for (const k of ['stem', 'patient', 'check']) assert.ok(!(k in r), `${r.id} row carries ${k}`);
  assert.equal(stationRow({ id: 'x', title: 'T', media: { stem: [{}, {}] }, check: [{ media: [{}], kids: [{ media: [{}] }] }] }, 10).mediaCount, 4);
  assert.match(buildIndex([{ name: 'a.json', text: '{"id":"b","title":"x"}' }]).problems[0], /holds station b/);
});

test('sync: attempts per station, saved stations, timing and names are shared; the session and filters stay on the device', () => {
  const mem = { hist: { s1: [{ id: 'a' }] }, bm: { s2: 1 }, timing: { reading: 2, station: 8 }, people: ['Alex', 'Sam'], sess: { queue: ['s1'] }, disc: ['paeds'], run: {}, details: true, att: {} };
  const shards = shardsOf(SPEC.osce, mem);
  assert.deepEqual(Object.keys(shards).sort(), ['bm/s2', 'hist/s1', 'k/people', 'k/timing']);
  const back = applyShard(SPEC.osce, {}, 'k/people', ['Alex', 'Sam']);
  assert.deepEqual(back.people, ['Alex', 'Sam']);
  assert.deepEqual(diffShards({ 'hist/s1': '[]' }, {}), [{ id: 'hist/s1', value: null, json: 'null' }], 'a removed shard travels as null');
});

test('figures: local files only, everything printed is escaped, credit links only http(s)', () => {
  assert.equal(mediaAttr('https://evil.example/x.png'), '');
  assert.equal(mediaAttr('../secret.png'), '');
  assert.equal(mediaAttr('media/s/cxr-1.jpg'), ' src="./media/s/cxr-1.jpg"');
  assert.equal(figureHtml({ src: 'javascript:alert(1)' }), '');
  const html = figureHtml({ src: 'media/s/a.jpg', alt: 'a "chest" <film>', w: 10, h: 20, caption: 'CXR <b>', credit: { author: 'Dr <X>', license: 'CC BY 4.0', licenseUrl: 'javascript:x', page: 'https://commons.wikimedia.org/wiki/File:A.jpg', via: 'Wikimedia Commons' } });
  assert.match(html, /alt="a &quot;chest&quot; &lt;film&gt;"/);
  assert.match(html, /CXR &lt;b&gt;/);
  assert.match(html, /Dr &lt;X&gt;/);
  assert.doesNotMatch(html, /javascript:/);
  assert.match(html, /href="https:\/\/commons\.wikimedia\.org\/wiki\/File:A\.jpg"[^>]*>Wikimedia Commons</);
  assert.equal(creditHtml(null), '');
});
