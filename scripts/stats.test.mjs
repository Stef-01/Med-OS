/* your gaps and the month's Wrapped (public/js/library/stats.mjs), and difficulty beside year (public/js/mcq/year.mjs) */
import test from 'node:test';
import assert from 'node:assert/strict';
import { record, summary, wrapped, dueWrap, vibeOf, dayOf, monthOf, MIN_WRAP } from '../public/js/library/stats.mjs';
import { diffOf, guessDiff, ladder, DIFFICULTY } from '../public/js/mcq/year.mjs';
import { grade } from '../public/js/library/sched.mjs';
import { checkUpload } from '../public/js/library/item.mjs';
import { chatPrompt } from '../public/js/library/prompt.mjs';
import { slidesOf, shareText } from '../public/js/osce/wrapped-view.mjs';

const T = (d, h = 10) => new Date(`${d}T${String(h).padStart(2, '0')}:00:00`).getTime();
const it = (id, topic, cat, year, difficulty = 2) => ({ key: id, item: { id, topic, cat, year, difficulty } });
const mem0 = () => ({ card: {}, day: { d: '', n: 0 } });

test('difficulty: read as written, guessed from the reasoning, in the prompt and uploads, and 0 to 1 goes Easy to Hard in each year', () => {
  for (const [v, d] of [[1, 1], ['Hard', 3], ['medium', 2], ['2', 2], ['difficult', 3], ['x', 0], [4, 0]]) assert.equal(diffOf(v), d, String(v));
  assert.equal(guessDiff({ stem: 'Which nerve supplies deltoid?', options: ['a', 'b', 'c', 'd'] }), 1);
  assert.equal(guessDiff({ stem: 'w '.repeat(100), ask: 'Which is NOT a cause?', options: ['a', 'b', 'c', 'd', 'e'] }), 3);
  assert.ok(chatPrompt().includes('"difficulty"') && Object.values(DIFFICULTY).every(d => chatPrompt().includes(d.label)));
  const q = { stem: 'A 67-year-old man has 2 hours of central crushing chest pain radiating to the left arm. ECG: ST elevation in II, III, aVF.', ask: 'Which artery is most likely occluded?', options: ['RCA', 'LAD', 'Circumflex', 'Left main'], answer: 'A', explanation: 'Inferior.', specialty: 'Cardiology', kind: 'anatomy', year: 2 };
  const r = checkUpload(JSON.stringify([{ ...q, difficulty: 'Hard' }, { ...q, stem: `${q.stem} Again.` }]), { by: 'S', now: T('2026-10-01') });
  assert.deepEqual(r.ready.map(x => x.difficulty), [3, guessDiff(r.ready[1])]);
  assert.ok(r.rows[1].problems.some(p => p.check === 'difficulty' && p.severity === 'minor'));
  const l = ladder([{ year: 2, difficulty: 3, id: 'a' }, { year: 1, difficulty: 3, id: 'b' }, { year: 2, difficulty: 1, id: 'c' }, { year: 1, difficulty: 1, id: 'd' }]);
  assert.deepEqual(l.map(x => x.id), ['d', 'b', 'c', 'a']);
});

test('record: every answer tallies its card (kept through grading) and its day', () => {
  const m = mem0(), x = it('q1', 'Cardiology', 'anatomy', 1);
  record(m, x, true, T('2026-10-03', 23)); record(m, x, false, T('2026-10-03', 23));
  assert.deepEqual([m.card.q1.r, m.card.q1.w], [1, 1]);
  m.card.q1 = grade(m.card.q1, 'good', T('2026-10-03'));
  assert.deepEqual([m.card.q1.r, m.card.q1.w, m.card.q1.reps], [1, 1, 1], 'the tally survives a grade');
  const d = m.days['2026-10-03'];
  assert.deepEqual([d.n, d.r, d.s.Cardiology, d.y[1], d.k.anatomy, d.h[23]], [2, 1, [2, 1], [2, 1], [2, 1], 2]);
});

test('summary: gaps are the weakest specialty and kind with enough answers; untouched specialties; by year and difficulty', () => {
  const es = [it('a', 'Cardiology', 'anatomy', 1, 1), it('b', 'Cardiology', 'anatomy', 1, 3), it('c', 'Renal', 'clinical', 3, 2), it('d', 'Psychiatry', 'clinical', 3, 2)];
  const cards = { a: { r: 1, w: 3 }, b: { r: 0, w: 2 }, c: { r: 5, w: 0 } };
  const s = summary(es, cards);
  assert.deepEqual([s.total.n, s.total.r, s.total.acc, s.total.seen, s.total.items], [11, 6, 55, 3, 4]);
  assert.deepEqual(s.gaps.map(g => [g.label, g.acc]), [['Cardiology › Anatomy', 17]]);
  assert.deepEqual(s.strong.map(g => g.label), ['Renal › Clinical']);
  assert.deepEqual(s.untouched.map(g => g.label), ['Psychiatry']);
  assert.deepEqual(s.years.map(y => [y.label, y.acc]), [['Year 1', 17], ['Year 3', 100]]);
  assert.deepEqual(s.diffs.map(y => [y.label, y.n]), [['Easy', 4], ['Medium', 5], ['Hard', 2]]);
  assert.deepEqual(summary(es, { a: { r: 0, w: 2 } }).gaps, [], 'two answers are not enough to call a gap');
});

test('wrapped: the month in numbers, the streak, top, glow-up and nemesis, the persona; nothing for a quiet month', () => {
  const m = mem0();
  const days = ['2026-09-28', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-07', '2026-10-08'];
  for (const d of days) for (let i = 0; i < 6; i++) {
    const card = i % 2 ? it(`c${i}`, 'Cardiology', 'clinical', 3) : it(`r${i}`, 'Renal', 'physio', i === 4 ? 4 : 2);
    record(m, card, card.item.topic === 'Renal' ? i !== 4 : i === 1, T(d, 23));
  }
  const w = wrapped(m, '2026-10');
  assert.deepEqual([w.n, w.days, w.streak, w.peak, w.vibe.id, w.maxYear], [30, 5, 3, 23, 'owl', 4]);
  assert.equal(w.glow.id, 'Renal'); assert.equal(w.nemesis.id, 'Cardiology'); assert.ok(w.nemesis.acc < w.glow.acc);
  assert.equal(wrapped(m, '2026-09'), null, `fewer than ${MIN_WRAP} answers: no story`);
  assert.equal(dueWrap(m, T('2026-10-20')), '', 'a month is wrapped once it is over');
  assert.equal(dueWrap(m, T('2026-11-01')), '2026-10');
  assert.equal(dueWrap({ ...m, wrap: { seen: ['2026-10'] } }, T('2026-11-02')), '', 'shown once');
  const sl = slidesOf(w);
  assert.equal(sl[0][1], 'October, wrapped'); assert.equal(sl.at(-1)[3], 'final');
  assert.ok(sl.some(s => s[3] === 'nemesis') && sl.some(s => s[1] === 'Night Owl') && sl.some(s => s[1] === 'Year 4'));
  assert.match(shareText(w), /30 questions · \d+% right · 3-day streak/);
  for (const [h, id] of [[23, 'owl'], [2, 'owl'], [6, 'lark'], [9, 'morning'], [14, 'day'], [19, 'evening']]) assert.equal(vibeOf(h).id, id);
  assert.equal(dayOf(T('2026-10-05', 1)), '2026-10-05'); assert.equal(monthOf(T('2026-12-31', 22)), '2026-12');
});
test('summary: with answers spread thin, the gap is the specialty', () => {
  const es = [it('a', 'Cardiology', 'anatomy', 1), it('b', 'Cardiology', 'clinical', 3), it('c', 'Cardiology', 'physio', 2)];
  const s = summary(es, { a: { r: 0, w: 1 }, b: { r: 0, w: 1 }, c: { r: 1, w: 1 } });
  assert.deepEqual(s.gaps.map(g => [g.id, g.acc]), [['Cardiology', 25]]);
});
