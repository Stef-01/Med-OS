/* lib/mcq-tag-retest.mjs: the tags, tagged twice */
import test from 'node:test';
import assert from 'node:assert/strict';
import { tagSample, kappa, tagRetestStats, medianTag } from './lib/mcq-tag-retest.mjs';

test('the sample: fixed, spread over the sources', () => {
  const qs = [...Array.from({ length: 30 }, (_, i) => ({ id: `a${i}`, source: 'ai' })), ...Array.from({ length: 4 }, (_, i) => ({ id: `u${i}`, source: 'usmle-resource' }))];
  const s = tagSample(qs, 10);
  assert.equal(s.length, 10);
  assert.equal(s.filter(q => q.source === 'usmle-resource').length, 4, 'a small source gives all it has');
  assert.deepEqual(tagSample(qs, 10).map(q => q.id), s.map(q => q.id));
});

test('kappa: 1 for perfect agreement, 0 when agreement is what chance gives', () => {
  assert.equal(kappa([[1, 1], [2, 2], [3, 3]]), 1);
  assert.equal(kappa([[1, 1], [1, 2], [2, 1], [2, 2]]), 0);
  assert.equal(kappa([]), null);
});

test('the stats: exact and within-one agreement for year and difficulty, exact for kind, by source', () => {
  const rows = [{ id: 'a', source: 'ai', year: [3, 3], difficulty: [2, 2], kind: ['clinical', 'clinical'] }, { id: 'b', source: 'ai', year: [3, 4], difficulty: [1, 3], kind: ['physio', 'clinical'] },
    { id: 'c', source: 'open-exam', year: [2, 2], difficulty: [2, 2] }, { id: 'd', source: 'open-exam', year: [1, 3], difficulty: [2, 1] }];
  const s = tagRetestStats(rows);
  assert.deepEqual([s.year.same, s.year.withinOne, s.difficulty.same, s.difficulty.withinOne], [50, 75, 50, 75]);
  assert.equal(s.kind.n, 2); assert.equal(s.kind.same, 50); assert.equal(s.kind.withinOne, undefined);
  assert.deepEqual(s.bySource, { ai: { n: 2, yearSame: 50 }, 'open-exam': { n: 2, yearSame: 50 } });
});

test('the tag from several passes: the median, the lower middle when even, nothing from nothing', () => {
  assert.equal(medianTag([2, 1, 2]), 2); assert.equal(medianTag([3, 1, 2]), 2); assert.equal(medianTag([1, 3]), 1);
  assert.equal(medianTag([2, null, 3]), 2); assert.equal(medianTag([]), null);
});
