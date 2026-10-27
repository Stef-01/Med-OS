/* lib/mcq-spotcheck.mjs: a fixed, spread sample of the pool for a person to mark, and what the marks say */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spotSample, spotSheet, spotResults, CALLS } from './lib/mcq-spotcheck.mjs';

const q = (id, kind, topic = 'Cardiology') => ({ id, stem: `Stem of ${id}.`, ask: 'Most likely diagnosis?', options: ['A one', 'B two', 'C three', 'D four'], answer: 1, explanation: 'Because.', topic, provenance: { kind, source: { name: `${kind} source` } } });
const pool = [...Array.from({ length: 30 }, (_, i) => q(`ai-${i}`, 'ai')), ...Array.from({ length: 4 }, (_, i) => q(`amsa-${i}`, 'amsa')), q('bank-1', 'usmle-resource')];

test('spotSample: spread over the kinds, the same on every run, a kind with few questions all in', () => {
  const s = spotSample(pool, 12);
  assert.equal(s.length, 12); assert.deepEqual(spotSample(pool, 12).map(x => x.id), s.map(x => x.id), 'seeded');
  const kinds = s.reduce((m, x) => ((m[x.provenance.kind] = (m[x.provenance.kind] || 0) + 1), m), {});
  assert.equal(kinds['usmle-resource'], 1); assert.equal(kinds.amsa, 4); assert.equal(kinds.ai, 7);
});

test('spotSheet shows each question with its key and source, and how to mark it', () => {
  const md = spotSheet(pool.slice(0, 2));
  assert.match(md, /## 1\. ai-0 \(ai, Cardiology\)/); assert.match(md, /- B\. B two {2}\*\*\(key\)\*\*/); assert.match(md, /data\/mcq\/spotcheck\.json/);
  for (const k of Object.keys(CALLS)) assert.match(md, new RegExp(`\`${k}\``));
});

test('spotResults: the share a person accepts, by kind, and what is wrong with the rest; unknown calls ignored', () => {
  const s = [pool[0], pool[1], pool[30], pool[34]];
  const r = spotResults(s, { 'ai-0': { call: 'ok' }, 'ai-1': { call: 'key', note: 'B is wrong' }, 'amsa-0': { call: 'ok' }, 'bank-1': { call: 'maybe' } });
  assert.equal(r.marked, 3); assert.equal(r.okShare, 66.7); assert.equal(r.unmarked, 1);
  assert.deepEqual(r.byKind.ai, { marked: 2, ok: 1, okShare: 50 }); assert.deepEqual(r.problems, { key: 1 });
});
