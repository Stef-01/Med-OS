/* study-log.test.mjs - the leaderboard's Today: what counts as study time (public/js/osce/study-log.mjs) */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { creditFor, IDLE, localDay } from '../public/js/osce/study-log.mjs';

test('time counts only on screen, near a sign of study, and never more than a tick at once', () => {
  assert.equal(creditFor(2, 10, true), 2);
  assert.equal(creditFor(2, IDLE + 1, true), 0, 'idle: an open app on a desk adds nothing');
  assert.equal(creditFor(2, 1, false), 0, 'hidden: nothing');
  assert.equal(creditFor(600, 1, true), 5, 'a phone asleep for ten minutes adds one tick, not ten minutes');
  assert.equal(creditFor(-3, 1, true), 0);
});

test('the day is the phone own date, and every place a question is answered reports it', () => {
  assert.equal(localDay(new Date(2026, 9, 29, 23, 30)), '2026-10-29');
  const src = f => readFileSync(new URL(`../public/js/osce/${f}`, import.meta.url), 'utf8');
  assert.match(src('library-study.mjs'), /answeredQ\(1\)/);
  assert.match(src('duel.mjs'), /l\.answered\(r\.rounds\)/);
  assert.match(src('session.mjs'), /studyActive\(\)/);
});
