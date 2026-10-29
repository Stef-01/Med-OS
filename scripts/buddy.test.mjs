/* the Study buddy's rules (public/js/osce/buddy.mjs): Optimus's Learn mascot, in MDosce */
import test from 'node:test';
import assert from 'node:assert/strict';
import { reactionFor, aidFor, aidLine, fieldOf, POOLS } from '../public/js/osce/buddy.mjs';

test('buddy: a run climbs, a miss is sad, the first right after a miss is a comeback', () => {
  const r = { streak: 0, misses: 0 }, f = () => 0;
  assert.equal(reactionFor(r, true, f).mood, 'right');
  reactionFor(r, true, f);
  assert.equal(reactionFor(r, true, f).mood, 'run');
  reactionFor(r, true, f);
  assert.deepEqual(reactionFor(r, true, f), { mood: 'party', expr: POOLS.party[0], streak: 5 });
  assert.equal(reactionFor(r, false, f).mood, 'wrong');
  assert.equal(reactionFor(r, true, f).mood, 'comeback');
  reactionFor(r, false, f); reactionFor(r, false, f);
  assert.equal(reactionFor(r, false, f).mood, 'low');
});

test('buddy: a miss gets the memory aid for its field, and only content', () => {
  assert.equal(fieldOf('A 4-year-old boy has a barking cough'), 'paeds');
  assert.equal(fieldOf('postpartum haemorrhage after delivery'), 'obs');
  const aid = aidFor('A 45-year-old man has central chest pain', undefined, () => 0);
  assert.ok(aid && aid.name, 'pain finds an aid');
  assert.match(aidLine(aid), new RegExp(`^${aid.name}: `));
  assert.equal(aidLine(null), '');
  assert.equal(aidFor('zzz qqq', undefined, () => 0), null, 'nothing fits: no aid, no filler');
});
