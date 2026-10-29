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
