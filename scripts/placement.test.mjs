/* Your placement (founder 2026-10-28): the disciplines chosen in Settings, and the duel's My placement deck */
import test from 'node:test';
import assert from 'node:assert/strict';
import { oscePlacement, placementSpecs, placementName } from '../public/js/osce/core.mjs';
import { placePack } from '../public/js/library/mix.mjs';

test('placement: only known disciplines, in the table order, with their specialties and short names', () => {
  const mem = { placement: ['paeds', 'nope', 'og'] };
  assert.deepEqual(oscePlacement(mem), ['paeds', 'og']);
  assert.ok(placementSpecs(mem).includes('Obstetrics') && placementSpecs(mem).includes('Neonatology'));
  assert.equal(placementName(mem), 'Paeds + O&G');
  assert.deepEqual(oscePlacement({}), []); assert.deepEqual(placementSpecs(null), []);
});

test('placement: the duel gets a My placement deck of the bank questions in it, first, and nothing without one', () => {
  const pack = { questions: [{ id: 'a', topic: 'Paediatrics', deck: 'bank' }, { id: 'b', topic: 'Cardiology', deck: 'bank' }, { id: 'c', topic: 'Obstetrics', deck: 'mine' }], decks: [{ id: 'bank', label: 'The bank' }] };
  const p = placePack(pack, ['Paediatrics', 'Obstetrics'], 'Paeds + O&G');
  assert.deepEqual(p.questions.filter(q => q.deck === 'place').map(q => q.id), ['pl-a']);
  assert.equal(p.decks[0].id, 'place'); assert.match(p.decks[0].label, /My placement: Paeds \+ O&G/);
  assert.equal(placePack(pack, []), pack); assert.equal(placePack(pack, ['Urology']), pack);
});

import { applyPlacement } from '../public/js/osce/core.mjs';
import { placeFirst, inPlace } from '../public/js/library/plan.mjs';
import { SPEC, shardsOf } from '../public/js/study-kit/sync.mjs';

test('placement: Fast Run takes a new placement once (set here or synced), keeps a later pick, and clears with it', () => {
  const mem = { placement: ['og'] };
  assert.equal(applyPlacement(mem), true);
  assert.ok(mem.run.specs.includes('Obstetrics') && mem.run.placeFor === 'og' && Array.isArray(mem.run.origin));
  mem.run.specs = ['Cardiology'];   /* picked in Fast Run afterwards */
  assert.equal(applyPlacement(mem), false); assert.deepEqual(mem.run.specs, ['Cardiology']);
  mem.placement = ['paeds', 'og']; applyPlacement(mem);
  assert.ok(mem.run.specs.includes('Paediatrics') && !mem.run.specs.includes('Cardiology'));
  mem.placement = []; assert.equal(applyPlacement(mem), true); assert.deepEqual(mem.run.specs, []);
  assert.equal(applyPlacement({}), false, 'no placement, never one: nothing changes');
});

test('placement: Study puts your rotation first, stably, and Rotation is exactly its questions', () => {
  const e = ['Cardiology', 'Obstetrics', 'Neurology', 'Paediatrics'].map((topic, i) => ({ key: `k${i}`, item: { topic } }));
  const specs = ['Paediatrics', 'Obstetrics'];
  assert.deepEqual(placeFirst(e, specs).map(x => x.key), ['k1', 'k3', 'k0', 'k2']);
  assert.equal(placeFirst(e, []), e);
  assert.deepEqual(inPlace(e, specs).map(x => x.key), ['k1', 'k3']);
});

test('placement: travels between your devices on your own account, never on the shared record', () => {
  const mem = { placement: ['og'] };
  assert.deepEqual(shardsOf(SPEC.osce, mem, true)['k/placement'], ['og']);
  assert.equal(shardsOf(SPEC.osce, mem, false)['k/placement'], undefined);
});
