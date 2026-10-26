/* the data the app loads: the validator finds nothing wrong, the index is deterministic and current, sync shards the
   shared record and keeps the running session on the device, figures escape what they print */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
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
  const files = fs.readdirSync(path.join(PUB, 'osce')).filter(f => f.endsWith('.json') && f !== 'index.json');
  assert.equal(count, files.length, 'every station body is validated');
  assert.ok(count >= 26, 'the bank never shrinks below the 26 stations it started with');
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
  /* the findings: escaped, closed until tapped, labelled AI-written; none when the entry has none */
  const f = figureHtml({ src: 'media/s/ecg.png', alt: '12-lead ECG', findings: 'ST elevation in II, III <and> aVF' });
  assert.match(f, /<details class="os-findings"><summary><span>Findings<\/span><b>AI-written<\/b><\/summary><p>ST elevation in II, III &lt;and&gt; aVF<\/p><\/details>/);
  assert.doesNotMatch(f, /<details[^>]* open/);
  assert.doesNotMatch(html, /os-findings/);
  assert.match(f, /<a class="os-figzoom" href="\.\/media\/s\/ecg\.png"/);
});

/* 2026-10-26: signed out, the shared record is everyone's; a game switch (Settings → Games) must not travel through it,
   or one person turning Duel a Mate off turns it off for every signed-out phone */
test('sync: the game switches travel only on your own account', () => {
  const mem = { games: { duel: true }, timing: { read: 60 } };
  assert.ok(!('k/games' in shardsOf(SPEC.osce, mem, false)), 'signed out: no games shard');
  assert.ok('k/timing' in shardsOf(SPEC.osce, mem, false), 'signed out: the shared settings still travel');
  assert.deepEqual(shardsOf(SPEC.osce, mem, true)['k/games'], { duel: true }, 'signed in: the switches follow the account');
});
