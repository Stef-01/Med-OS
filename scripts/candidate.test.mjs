/* the candidate screen link: what the examiner's device writes is what the candidate's phone reads */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { candidateLink, parseCandidate } from '../public/js/osce/candidate.mjs';
import { osceLeft, osceTick } from '../public/js/osce/core.mjs';

test('round trip: station, phase, seconds left at the moment it was read, the timing of all three phases', () => {
  const now = 1_700_000_000_000, timer = { c: 'reading', left: 300, at: now - 30_000 }, timing = { reading: 5, station: 10, mx: 5 };
  const url = candidateLink('https://example.org/app/?x=1#h', 'ai-12345678', timer, timing, now);
  assert.match(url, /^https:\/\/example\.org\/app\/\?cand=ai-12345678&c=r&left=270&t=1700000000000&r=5&s=10&m=5$/);
  const p = parseCandidate(new URL(url).search);
  assert.equal(p.sid, 'ai-12345678');
  assert.deepEqual(p.timing, timing);
  assert.equal(osceLeft(p.timer, now + 10_000), 260);
  const later = osceTick(p.timer, p.timing, now + 280_000);   /* reading ran out 10 s ago: Part 1, 590 s left */
  assert.deepEqual([later.c, osceLeft(later, now + 280_000)], ['station', 590]);
  const part2 = parseCandidate(new URL(candidateLink('https://example.org/', 'ai-1', { c: 'mx', left: 120, at: now }, timing, now)).search);
  assert.deepEqual([part2.timer.c, part2.timer.left], ['mx', 120]);
});

test('anything else is not a candidate link', () => {
  assert.equal(parseCandidate(''), null);
  assert.equal(parseCandidate('?cand=../x&t=1&left=5'), null);
  assert.equal(parseCandidate('?cand=ai-1&t=abc&left=5'), null);
  assert.equal(parseCandidate('?cand=ai-1&t=1&left=-5'), null);
  assert.equal(parseCandidate('?cand=ai-1&t=1&left=9999999'), null);
  assert.deepEqual(parseCandidate('?cand=ai-1&t=1&left=5&r=junk&s=500').timing, { reading: 5, station: 10, mx: 5 }, 'an old link without m gets the default Part 2');
  assert.equal(parseCandidate('?cand=ai-1&t=1&left=5&c=m&m=0'), null, 'Part 2 cannot run when it is switched off');
});
