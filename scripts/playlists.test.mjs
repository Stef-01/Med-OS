/* Playlists (2026-10-26): the community library's pure part (public/js/library/playlists.mjs) and the shape of its
   migration (supabase/migrations/0011_playlists.sql) */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { cover, toDuel, count, publishError, sortOf, SORTS, LIMITS } from '../public/js/library/playlists.mjs';

const item = (id, o = {}) => ({ id, stem: 'A 4-year-old has a barking cough and stridor at night. Most likely?', ask: '', options: ['Croup', 'Asthma', 'Epiglottitis', 'Bronchiolitis'], answer: 0, explanation: 'Barking cough is croup.', why: ['Yes', 'No', 'No', 'No'], topic: 'Paediatrics', cat: 'clinical', provenance: { kind: 'user' }, ...o });

test('playlists: a cover is the same for the same seed and differs from its neighbours', () => {
  assert.deepEqual(cover(42), cover(42));
  assert.notEqual(cover(1).a, cover(2).a);
  assert.match(cover(7).css, /^linear-gradient\(135deg, hsl\(\d+ 62% 46%\), hsl\(\d+ 70% 32%\)\)$/);
  assert.equal(cover('nope').css, cover(0).css, 'a bad seed is seed 0');
});

test('playlists: questions become duel questions, a student\'s, in no deck of the bank\'s', () => {
  const qs = toDuel([item('u-aaaaaa1'), item('u-aaaaaa2', { ask: 'What next?' }), { stem: 'no options' }, null]);
  assert.equal(qs.length, 2, 'what cannot be played is left out');
  assert.equal(qs[0].source, 'user'); assert.equal(qs[0].deck, undefined); assert.equal(qs[0].id, 'lib-u-aaaaaa1');
  assert.match(qs[1].stem, /What next\?$/); assert.equal(qs[0].topic, 'Paediatrics'); assert.equal(qs[0].cat, 'clinical');
  assert.deepEqual(toDuel(undefined), []);
});

test('playlists: what may be published, said the way the server says it', () => {
  assert.equal(publishError('  Paeds airway ', 'Croup and friends'), '');
  assert.match(publishError('   ', ''), /Name/);
  assert.match(publishError('x'.repeat(LIMITS.title + 1), ''), /at most 60/);
  assert.match(publishError('Fine', 'y'.repeat(LIMITS.blurb + 1)), /at most 200/);
  assert.match(publishError('<b>bold</b>', ''), /Plain text/);
});

test('playlists: counts and orders', () => {
  assert.deepEqual([0, 7, 999, 1000, 1250, 12400, -3, 'x'].map(count), ['0', '7', '999', '1k', '1.3k', '12k', '0', '0']);
  assert.deepEqual(SORTS.map(s => s.id), ['trending', 'new', 'top', 'faves', 'mine']);
  assert.equal(sortOf('top'), 'top'); assert.equal(sortOf('__proto__'), 'trending');
});

test('playlists: the migration keeps every table closed and every way in token-checked, and the ban holds', () => {
  const sql = fs.readFileSync(new URL('../supabase/migrations/0011_playlists.sql', import.meta.url), 'utf8');
  for (const t of ['lib_playlists', 'lib_playlist_favs', 'lib_playlist_plays', 'lib_playlist_reports']) assert.match(sql, new RegExp(`alter table public\\.${t} enable row level security`), t);
  assert.doesNotMatch(sql, /create policy/i, 'no policy: the public key reads nothing directly');
  for (const fn of ['pl_publish', 'pl_unpublish', 'pl_list', 'pl_get', 'pl_fav', 'pl_play', 'pl_report']) {
    const body = sql.slice(sql.indexOf(`function public.${fn}(`), sql.indexOf('end $$;', sql.indexOf(`function public.${fn}(`)));
    assert.match(body, /public\.pup_me\(p_token\)/, `${fn} checks the token`);
    assert.match(sql, new RegExp(`grant execute on function public\\.${fn}\\(`), `${fn} is granted`);
  }
  assert.match(sql, /revoke all on function public\.pl_card/, 'the card builder is not callable from outside');
  assert.match(sql, /\\m\(ndis\|grants\?\)\\M/, 'NDIS and grants are refused on publish');
  assert.match(sql, /\) >= 3;/, 'three reports hide a playlist');
});
