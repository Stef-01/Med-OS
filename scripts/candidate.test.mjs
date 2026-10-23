/* the candidate screen link: what the examiner's device writes is what the candidate's phone reads */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { candidateLink, parseCandidate } from '../public/js/osce/candidate.mjs';
import { osceLeft, osceTick } from '../public/js/osce/core.mjs';

test('round trip: station, component, seconds left at the moment it was read, the timing', () => {
  const now = 1_700_000_000_000, timer = { c: 'reading', left: 120, at: now - 30_000 }, timing = { reading: 2, station: 8 };
  const url = candidateLink('https://example.org/app/?x=1#h', 'ai-12345678', timer, timing, now);
  assert.match(url, /^https:\/\/example\.org\/app\/\?cand=ai-12345678&c=r&left=90&t=1700000000000&r=2&s=8$/);
  const p = parseCandidate(new URL(url).search);
  assert.equal(p.sid, 'ai-12345678');
  assert.deepEqual(p.timing, timing);
  assert.equal(osceLeft(p.timer, now + 10_000), 80);
  const later = osceTick(p.timer, p.timing, now + 100_000);   /* reading ran out 10 s ago: station time, 470 s left */
  assert.equal(later.c, 'station');
  assert.equal(osceLeft(later, now + 100_000), 470);
});

test('anything else is not a candidate link', () => {
  assert.equal(parseCandidate(''), null);
  assert.equal(parseCandidate('?cand=../x&t=1&left=5'), null);
  assert.equal(parseCandidate('?cand=ai-1&t=abc&left=5'), null);
  assert.equal(parseCandidate('?cand=ai-1&t=1&left=-5'), null);
  assert.equal(parseCandidate('?cand=ai-1&t=1&left=9999999'), null);
  assert.deepEqual(parseCandidate('?cand=ai-1&t=1&left=5&r=junk&s=500').timing, { reading: 2, station: 8 });
});
