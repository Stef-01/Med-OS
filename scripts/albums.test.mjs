/* albums.test.mjs - the pack covers and their stars (public/js/osce/albums.mjs) */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STARS, starOf, coverFor, albumHtml, finished, FINISH, STYLES } from '../public/js/osce/albums.mjs';
import { DOGS } from '../public/js/vendor/pup-duel/pup/rig/breeds.mjs';
import { GIFTS } from '../public/js/vendor/pup-duel/pup/rig/gifts.mjs';
import { ITEMS } from '../public/js/vendor/pup-duel/pup/wardrobe.mjs';

const picks = JSON.parse(readFileSync(new URL('../public/playlists/picks.json', import.meta.url), 'utf8')).packs;

test('every MDosce pick has a star: a gift dog of the kit, its gift known, its cover style drawn in osce.css', () => {
  const css = readFileSync(new URL('../public/css/osce.css', import.meta.url), 'utf8');
  for (const p of picks) {
    const st = STARS[p.id];
    assert.ok(st, `${p.id} has no star`);
    const dog = DOGS.find(d => d.id === st.dog);
    assert.ok(dog, `${st.dog} is not a dog of the kit`);
    assert.equal(dog.gift, st.gift, `${st.dog} is not gated on ${st.gift}`);
    assert.ok(GIFTS[st.gift], `${st.gift} is not a gift`);
    assert.match(css, new RegExp(`\\.os-alb--${st.style}\\b`));
    assert.equal(starOf({ ...p, id: `pick:${p.id}`, pick: true }), st);
  }
});

test('a community cover is steady for one playlist, varied across many, and never a gift dog or an exclusive piece', () => {
  const p = { id: 'abc', cover: 7, title: 'Renal', owner_name: 'Lee' };
  assert.deepEqual(coverFor(p), coverFor({ ...p }));
  const styles = new Set(), dogs = new Set();
  for (let i = 0; i < 60; i++) {
    const c = coverFor({ id: `p${i}`, cover: i, title: 'T' });
    styles.add(c.style); dogs.add(c.dog);
    assert.ok(STYLES.includes(c.style));
    const d = DOGS.find(x => x.id === c.dog); assert.ok(d && !d.gift, c.dog);
    for (const id of Object.values(c.wear)) { const it = ITEMS.find(x => x.id === id); assert.ok(it && !it.exclusive, id); }
  }
  assert.ok(styles.size >= 5 && dogs.size >= 10);
  assert.equal(starOf(p), null);
});

test('a cover escapes its words, and a row thumbnail has none', () => {
  const h = albumHtml({ id: 'x', title: '<img onerror=1>', owner_name: 'A&B' });
  assert.ok(!h.includes('<img'));
  assert.match(h, /&lt;img/);
  assert.ok(!albumHtml({ id: 'x', title: 'T' }, 's').includes('os-alb-tx'));
  assert.ok(albumHtml({ id: 'x', title: 'T' }, 'l').includes('os-alb-rec'));
});

test('finishing a pack: enough rounds of it, most of them right', () => {
  assert.equal(finished({ rounds: FINISH.rounds, right: Math.ceil(FINISH.share * FINISH.rounds) }, 10), true);
  assert.equal(finished({ rounds: FINISH.rounds, right: Math.ceil(FINISH.share * FINISH.rounds) - 1 }, 10), false);
  assert.equal(finished({ rounds: FINISH.rounds - 1, right: FINISH.rounds - 1 }, 10), false);
  assert.equal(finished({ rounds: 3, right: 3 }, 3), true);   /* a pack shorter than the rounds asked for */
  assert.equal(finished(null, 8), false);
});
