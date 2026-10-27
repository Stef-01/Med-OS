/* lib/mcq-rebalance.mjs: a rewrite of the wrong options is kept only with the key intact and the cue gone */
import test from 'node:test';
import assert from 'node:assert/strict';
import { rebalanced, needsRebalance, examSchema } from './lib/mcq-rebalance.mjs';

const q = { id: 'hy-x', stem: 'A stonemason cutting engineered stone inhales fine dust. Which inhaled agent drives the pulmonary fibrosis of silicosis?', options: ['Crystalline silica', 'Asbestos fibres', 'Coal dust', 'Beryllium'], answer: 0,
  why: 'Engineered stone contains over 90% crystalline silica, which drives nodular fibrosis.', notes: [null, 'Asbestos causes asbestosis.', 'Coal dust causes pneumoconiosis.', 'Beryllium causes berylliosis.'], cat: 'physio' };

test('rebalanced: the wrong options lengthened, the key word for word, the cue gone', () => {
  assert.equal(needsRebalance(q), true);
  const r = rebalanced(q, ['Crystalline silica', 'Asbestos fibres inhaled over many years', 'Coal dust inhaled over decades', 'Beryllium dust and fumes']);
  assert.deepEqual(r.why, []); assert.equal(needsRebalance(r.q), false); assert.equal(r.q.options[0], 'Crystalline silica');
});

test('rebalanced refuses a changed key, the cue kept, a lost option or a duplicate', () => {
  assert.match(rebalanced(q, ['Silica', 'Asbestos fibres inhaled over many years', 'Coal dust', 'Beryllium']).why.join(), /correct option was changed/);
  assert.match(rebalanced(q, ['Crystalline silica', 'Asbestos', 'Coal', 'Beryllium']).why.join(), /longest/);
  assert.match(rebalanced(q, ['Crystalline silica', 'Asbestos fibres inhaled over many years', 'Coal dust']).why.join(), /number of options/);
  assert.match(rebalanced(q, ['Crystalline silica', 'Asbestos fibres inhaled over many years', 'Asbestos fibres inhaled over many years', 'Beryllium']).why.join(), /same/);
});

test('a shortened key must be shorter, and is the examiner\'s to confirm', () => {
  const long = { ...q, options: ['Crystalline silica dust released when the stone is cut dry', 'Asbestos fibres', 'Coal dust', 'Beryllium'] };
  assert.deepEqual(rebalanced(long, ['Crystalline silica dust', 'Asbestos fibres from old lagging', 'Coal dust from mining', 'Beryllium from alloy work'], true).why, []);
  assert.match(rebalanced(long, ['Crystalline silica dust released when the stone is cut dry, wet or polished', 'Asbestos', 'Coal', 'Beryllium'], true).why.join(), /not shortened/);
  assert.equal(examSchema(5).properties.answers.items.properties.answer.maximum, 4);
});
