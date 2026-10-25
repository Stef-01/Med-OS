/* random.alea.mjs: the Alea PRNG (seedable, and its state can be saved and restored), which the random plugin keeps
   in plugins.random.data.prngstate so moves stay pure.
   Ported from boardgame.io src/plugins/random/random.alea.ts at 5e9a2c9 (MIT, Copyright (c) 2017 The boardgame.io
   Authors; the licence is ../../LICENSE), itself an inlined version of Alea from https://github.com/davidbau/seedrandom
   under the notice below. Changed: types removed; numeric separators written out. */

/*
 * Copyright 2015 David Bau.
 *
 * Permission is hereby granted, free of charge,
 * to any person obtaining a copy of this software
 * and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the
 * Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall
 * be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 */

class Alea {
  constructor(seed) {
    const mash = Mash();

    // Apply the seeding algorithm from Baagoe.
    this.c = 1;
    this.s0 = mash(' ');
    this.s1 = mash(' ');
    this.s2 = mash(' ');
    this.s0 -= mash(seed);
    if (this.s0 < 0) {
      this.s0 += 1;
    }
    this.s1 -= mash(seed);
    if (this.s1 < 0) {
      this.s1 += 1;
    }
    this.s2 -= mash(seed);
    if (this.s2 < 0) {
      this.s2 += 1;
    }
  }

  next() {
    const t = 2091639 * this.s0 + this.c * 2.3283064365386963e-10; // 2^-32
    this.s0 = this.s1;
    this.s1 = this.s2;
    return (this.s2 = t - (this.c = Math.trunc(t)));
  }
}

function Mash() {
  let n = 0xefc8249d;

  const mash = function (data) {
    const str = data.toString();
    for (let i = 0; i < str.length; i++) {
      n += str.charCodeAt(i);
      let h = 0.02519603282416938 * n;
      n = h >>> 0;
      h -= n;
      h *= n;
      n = h >>> 0;
      h -= n;
      n += h * 0x100000000; // 2^32
    }
    return (n >>> 0) * 2.3283064365386963e-10; // 2^-32
  };

  return mash;
}

function copy(f, t) {
  t.c = f.c;
  t.s0 = f.s0;
  t.s1 = f.s1;
  t.s2 = f.s2;
  return t;
}

/* alea(seed, state?): a function returning numbers in [0, 1), seeded from seed, or resumed from a saved state (then
   the seed is ignored); prng.state() saves { c, s0, s1, s2 }. */
export function alea(seed, state) {
  const xg = new Alea(seed);
  const prng = xg.next.bind(xg);
  if (state) copy(state, xg);
  prng.state = () => copy(xg, {});
  return prng;
}
