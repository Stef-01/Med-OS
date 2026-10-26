/* the day's study and the sessions you can build (public/js/library/plan.mjs) */
import test from 'node:test';
import assert from 'node:assert/strict';
import { today, streak, heat, which, session, timedSecs, tally, pref, DEFAULT_PREF } from '../public/js/library/plan.mjs';
import { record } from '../public/js/library/stats.mjs';
import { grade } from '../public/js/library/sched.mjs';

const T = (d, h = 10) => new Date(`${d}T${String(h).padStart(2, '0')}:00:00`).getTime();
const days = o => Object.fromEntries(Object.entries(o).map(([d, n]) => [d, { n }]));

test('the goal ring and the streak (today forgiven until it is over)', () => {
  const D = days({ '2026-10-20': 5, '2026-10-21': 30, '2026-10-22': 12, '2026-10-24': 3, '2026-10-25': 8 });
  assert.deepEqual(today(D, T('2026-10-25'), 20), { n: 8, goal: 20, frac: 0.4, done: false });
  assert.equal(today(D, T('2026-10-21'), 20).done, true);
  assert.deepEqual(streak(D, T('2026-10-25')), { days: 2, live: true });
  assert.deepEqual(streak(D, T('2026-10-26', 9)), { days: 2, live: false }, 'not broken till the day is over');
  assert.deepEqual(streak(D, T('2026-10-27')), { days: 0, live: false });
  assert.deepEqual(streak(D, T('2026-10-22')), { days: 3, live: true });
});

test('the heatmap: weeks of 7 days, Monday first, ending today, levels by how much', () => {
  const D = days({ '2026-10-26': 40, '2026-10-20': 10, '2026-10-19': 1 });
  const h = heat(D, T('2026-10-26'), 3);   /* 2026-10-26 is a Monday */
  assert.equal(h.length, 3); assert.equal(h[2][0].d, '2026-10-26'); assert.equal(h[2][1], null, 'no days after today');
  assert.equal(h[1][0].d, '2026-10-19'); assert.equal(h[2][0].level, 4); assert.ok(h[1][1].level >= 1 && h[1][1].level < 4); assert.equal(h[0][0].level, 0);
});

test('sessions: unused, incorrect and flagged; due first, shuffled, 0 to 1; a size', () => {
  const E = Array.from({ length: 12 }, (_, i) => ({ key: `k${i}`, item: { id: `k${i}`, year: 1 + (i % 4), difficulty: 1 + (i % 3) } }));
  const m = { card: {} }, t = T('2026-10-26');
  record(m, E[0], false, t); record(m, E[1], true, t); record(m, E[2], true, t); record(m, E[2], false, t);
  m.card.k3 = { ...m.card.k3, f: 1 };
  assert.deepEqual(which(E, m.card, 'unused').map(e => e.key).slice(0, 3), ['k3', 'k4', 'k5'], 'k3 is flagged but never answered');
  assert.deepEqual(which(E, m.card, 'incorrect').map(e => e.key), ['k0', 'k2'], 'the last answer was wrong');
  assert.deepEqual(which(E, m.card, 'flagged').map(e => e.key), ['k3']);
  m.card.k1 = grade(m.card.k1, 'good', t);
  assert.equal(m.card.k1.last, 1, 'the tally and last survive grading'); assert.equal(m.card.k1.r, 1);
  const due = session(E, m.card, { size: 5 }, t); assert.equal(due.length, 5); assert.ok(!due.some(e => e.key === 'k1'), 'k1 is learnt: not due today');
  const lad = session(E, m.card, { order: 'ladder', size: 8 }, t); assert.deepEqual(lad.map(e => e.item.year), [...lad.map(e => e.item.year)].sort((a, b) => a - b));
  const sh = session(E, m.card, { order: 'shuffle', size: 0 }, t, 0, () => 0.3); assert.equal(sh.length, 12);
  assert.deepEqual(session(E, m.card, { which: 'flagged' }, t).map(e => e.key), ['k3']);
  assert.deepEqual(tally(E, m.card, t), { due: 0, fresh: 11, flagged: 1, incorrect: 2, unused: 9 });
});

test('timed: 90 s a question plus its reading; preferences fall back to the defaults', () => {
  assert.equal(timedSecs({ stem: 'Short question?', options: ['a', 'b'] }), 90);
  assert.equal(timedSecs({ stem: 'w '.repeat(160), options: ['a', 'b', 'c', 'd'] }), 90 + Math.ceil((164 - 60) / 4));
  assert.deepEqual(pref({ goal: 7, size: 40, which: 'x', mode: 'timed' }), { ...DEFAULT_PREF, size: 40, mode: 'timed' });
});
