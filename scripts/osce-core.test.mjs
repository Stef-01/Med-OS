/* the OSCE laws this repo added or changed: partner mode, the progress-file merge, the save migration, the source
   vocabulary, the station gate over the shipped bank */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { oscePeople, osceName, osceNextCand, osceWho, osceAttBy, osceCounts, osceMergeImport, osceMigrate, osceOrigin, osceStations, osceIndexRows, osceBody, osceCleanStation, osceLeaves, osceScore, ORIGINS } from '../public/js/osce/core.mjs';
import { sourceTag, specialtyEmoji, disciplineOf } from '../public/js/study-kit/vocab.mjs';

const PUB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

test('names: trimmed, capped, two slots, Partner A / B when empty', () => {
  assert.deepEqual(oscePeople(['  Alex  ', 'Sam'.repeat(20)]), ['Alex', 'SamSamSamSamSamSamSamSam']);
  assert.deepEqual(oscePeople('nope'), ['', '']);
  assert.deepEqual(oscePeople([5, null]), ['', '']);
  assert.equal(osceName(['', 'Sam'], 0), 'Partner A');
  assert.equal(osceName(['', 'Sam'], 1), 'Sam');
});

test('the next candidate alternates when asked to, stays otherwise', () => {
  assert.equal(osceNextCand(0, true), 1);
  assert.equal(osceNextCand(1, true), 0);
  assert.equal(osceNextCand(1, false), 1);
  assert.equal(osceNextCand(undefined, false), 0);
});

test('who did what: per person, unassigned attempts counted apart, unfinished ignored', () => {
  const hist = { s1: [{ id: 'a', who: 0, fin: 1 }, { id: 'b', who: 1, fin: 2 }], s2: [{ id: 'c', who: 1, fin: 3 }], s3: [{ id: 'd', fin: 4 }], s4: [{ id: 'e', who: 0, fin: null }] };
  assert.equal(osceWho({ who: 1 }), 1);
  assert.equal(osceWho({ who: 'x' }), null);
  assert.deepEqual(osceAttBy(hist, 0), { s1: 1 });
  assert.deepEqual(osceAttBy(hist, 1), { s1: 1, s2: 1 });
  assert.deepEqual(osceAttBy(hist, null), { s1: 1, s2: 1, s3: 1 });
  assert.deepEqual(osceCounts(hist), [1, 2, 1]);
});

test('a progress file merges by attempt id and never mutates the record it merges into', () => {
  const mine = { hist: { s1: [{ id: 'a', sid: 's1', at: 1, fin: 2, ticks: ['1'] }] }, bm: { s1: 1 }, people: ['Alex', ''] };
  const before = JSON.stringify(mine);
  const file = { kind: 'osce-progress', people: ['Zed', 'Sam'], bm: { s2: 1 },
    hist: { s1: [{ id: 'a', at: 1, fin: 2, ticks: ['1', '2'], ai: { status: 'done', result: { items: [] } } }, { id: 'b', at: 3, fin: 4, ticks: [] }], s2: [{ id: 'c', at: 5, fin: null }, { id: 'x' }, 'junk'] } };
  const { mem, added } = osceMergeImport(mine, file);
  assert.equal(JSON.stringify(mine), before);
  assert.equal(added, 1);
  assert.deepEqual(mem.hist.s1.map(a => a.id), ['a', 'b']);
  assert.deepEqual(mem.hist.s1[0].ticks, ['1', '2'], 'the AI-marked copy wins');
  assert.equal(mem.hist.s2, undefined, 'unfinished and malformed attempts are skipped');
  assert.deepEqual(mem.bm, { s1: 1, s2: 1 });
  assert.deepEqual(mem.people, ['Alex', 'Sam'], 'names fill only the empty slots');
});

test('the save migration gives partner mode its defaults and keeps a broken store opening', () => {
  const m = osceMigrate({ v: 2, hist: { s1: 'junk', s2: [{ id: 'a', ticks: 'x', ai: 'y' }] }, people: ['Alex'], sess: { queue: ['s1'], cand: 7 } }, 1000);
  assert.deepEqual(m.people, ['Alex', '']);
  assert.equal(m.sess.cand, 0);
  assert.equal(m.alt, true);
  assert.equal(m.hist.s1, undefined);
  assert.deepEqual(m.hist.s2[0].ticks, []);
  assert.deepEqual(osceMigrate({ v: 2, alt: false, sess: { queue: [], cand: 1 } }, 1).sess.cand, 1);
  assert.equal(osceMigrate({ v: 2, alt: false }, 1).alt, false);
});

test('sources: AI generated or written by you, one tag each', () => {
  assert.equal(osceOrigin({ origin: 'ai' }), 'ai');
  assert.equal(osceOrigin({}), 'own');
  assert.deepEqual(ORIGINS.map(o => o[0]), ['ai', 'own']);
  assert.match(sourceTag('ai', 'AI generated: croup'), /kit-src--ai[^>]*title="AI generated: croup">AI</);
  assert.match(sourceTag('own'), /kit-src--own[^>]*>Own</);
  assert.equal(specialtyEmoji('Paediatrics'), '👶');
  assert.equal(specialtyEmoji('Nope'), '');
  assert.equal(disciplineOf('Obstetrics'), 'og');
});

test('the shipped bank: every index row has its body, every body passes the station gate, the rubric is intact', () => {
  const index = JSON.parse(fs.readFileSync(path.join(PUB, 'osce', 'index.json'), 'utf8'));
  const rows = osceStations(osceIndexRows(index), null);
  assert.equal(rows.length, 26);
  for (const r of rows) {
    const body = JSON.parse(fs.readFileSync(path.join(PUB, 'osce', `${r.id}.json`), 'utf8'));
    const full = osceBody(r, body);
    assert.ok(full, `${r.id} body matches its row`);
    assert.equal(osceOrigin(full), 'ai');
    assert.ok(osceCleanStation(body).check.length > 5);
    const leaves = osceLeaves(full.check);
    assert.ok(leaves.length >= 15, `${r.id} has ${leaves.length} marking items`);
    assert.ok(leaves.some(l => l.crit), `${r.id} has Critical items`);
    assert.equal(osceScore(full.check, leaves.map(l => l.key)).got, leaves.length);
    assert.ok(full.patient.length > 1000, `${r.id} has a patient script`);
  }
});
