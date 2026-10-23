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

import { osceStart, osceTick, osceNext, osceLeft, osceFinished, osceResume, oscePause, phasesOf, nextPhase, DEFAULT_TIMING, oscePart2, hasPart2 } from '../public/js/osce/core.mjs';

test('the clock: 5 minutes reading, 10 of history and examination, 5 of interpretation and management', () => {
  const T = DEFAULT_TIMING;
  assert.deepEqual(T, { reading: 5, station: 10, mx: 5 });
  assert.deepEqual(phasesOf(T), ['reading', 'station', 'mx']);
  let t = osceStart(T, 0);
  assert.deepEqual(t, { c: 'reading', left: 300, at: 0 });
  t = osceTick(t, T, 300_000);
  assert.deepEqual(t, { c: 'station', left: 600, at: 300_000 });
  t = osceTick(t, T, 905_000);   /* Part 1 ran out 5 s ago while the tab was hidden: Part 2 started then */
  assert.deepEqual([t.c, osceLeft(t, 905_000)], ['mx', 295]);
  t = osceTick(t, T, 1_200_000);
  assert.ok(osceFinished(t));
  assert.equal(osceResume(t, 1), t, 'a finished clock cannot be resumed');
});

test('skip moves one phase at a time; Part 2 at 0 runs without it; a paused clock stays paused', () => {
  const T = DEFAULT_TIMING;
  let t = osceNext(osceStart(T, 0), T, 10);
  assert.deepEqual(t, { c: 'station', left: 600, at: 10 });
  t = osceNext(t, T, 20);
  assert.deepEqual(t, { c: 'mx', left: 300, at: 20 });
  assert.ok(osceFinished(osceNext(t, T, 30)));
  const two = { ...T, mx: 0 };
  assert.deepEqual(phasesOf(two), ['reading', 'station']);
  assert.equal(nextPhase('station', two), null);
  assert.ok(osceFinished(osceNext({ c: 'station', left: 100, at: 0 }, two, 5)));
  const p = oscePause({ c: 'station', left: 600, at: 0 }, 60_000);
  assert.deepEqual(p, { c: 'station', left: 540, at: null });
  assert.ok(!osceFinished(p));
  assert.equal(osceTick(p, T, 10_000_000), p, 'paused time does not run');
});

test('timing: the old 2 + 8 default moves to 5 / 10 / 5; chosen times stay; a station finished under the old clock stays finished', () => {
  assert.deepEqual(osceMigrate({ v: 2, timing: { reading: 2, station: 8 } }, 1).timing, DEFAULT_TIMING);
  assert.deepEqual(osceMigrate({ v: 2, timing: { reading: 3, station: 9 } }, 1).timing, { reading: 3, station: 9, mx: 5 });
  assert.deepEqual(osceMigrate({ v: 2, tv: 3, timing: { reading: 5, station: 10, mx: 0 } }, 1).timing, { reading: 5, station: 10, mx: 0 });
  const m = osceMigrate({ v: 2, sess: { queue: ['a'], idx: 0, timer: { c: 'station', left: 0, at: null } } }, 1);
  assert.ok(osceFinished(m.sess.timer));
});

test('Part 2: results with a label and a result, questions in order, anything malformed dropped', () => {
  const p = oscePart2({ lead: ' Here are the bloods. ', handover: [{ label: 'FBC', result: '<p>Hb 92</p>' }, { label: '', result: 'x' }, 'junk'], ask: ['What do they show?', '', 7] });
  assert.deepEqual(p, { lead: 'Here are the bloods.', handover: [{ label: 'FBC', result: '<p>Hb 92</p>' }], ask: ['What do they show?'] });
  assert.deepEqual(oscePart2(null), { lead: '', handover: [], ask: [] });
  assert.ok(hasPart2({ part2: p }));
  assert.ok(hasPart2({ part2: oscePart2(null), media: { part2: [{}] } }));
  assert.ok(!hasPart2({ part2: oscePart2(null) }));
});

import { qaSlides, qaHtml } from '../public/js/osce/session.mjs';

test('Part 2 slides: each result, then each image labelled by its alt text; the examiner\'s caption never reaches the candidate', () => {
  const st = { id: 's1', part2: oscePart2({ lead: 'Say this', handover: [{ label: 'Bloods', result: '<p>Hb 92</p>' }], ask: ['What do they show?', 'Management?'] }),
    media: { part2: [{ src: 'media/s1/cxr-1.png', alt: 'Frontal chest radiograph', caption: 'Chest X-ray: show when asked', credit: { author: 'A', license: 'CC BY 4.0', page: 'https://commons.wikimedia.org/x' } }] } };
  const slides = qaSlides(st);
  assert.deepEqual(slides.map(x => x.label), ['Bloods', 'Frontal chest radiograph']);
  assert.match(slides[0].html, /Hb 92/);
  assert.match(slides[1].html, /<img src=".\/media\/s1\/cxr-1.png"/);
  assert.doesNotMatch(slides[1].html, /show when asked/);
  assert.match(slides[1].html, /CC BY 4.0/, 'the licence credit stays with the image');
  const html = qaHtml(st);
  assert.match(html, /data-os="present" data-sid="s1" data-i="0"/);
  assert.equal((html.match(/data-os="present"/g) || []).length, 3, 'Show results plus one pop-out per result');
  assert.match(html, /<ol><li>What do they show\?<\/li><li>Management\?<\/li><\/ol>/);
  assert.equal(qaHtml({ id: 'x', part2: oscePart2(null) }), '');
});
