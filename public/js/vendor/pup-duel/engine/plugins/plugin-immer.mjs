/* plugin-immer.mjs: lets moves and hooks change G by mutating it, and passes INVALID_MOVE through.
   Ported from boardgame.io src/plugins/plugin-immer.ts at 5e9a2c9 (MIT, Copyright (c) 2017 The boardgame.io Authors;
   the licence is ../LICENSE). Changed: types removed; immer is replaced by the small produce() below, over clone(). */

import { INVALID_MOVE, KEEP_G } from '../core/constants.mjs';

/* produce(base, recipe), the part of immer's that boardgame.io uses: the recipe mutates a structured clone of base
   (its draft), and what the recipe returns wins unless that is undefined, in which case the draft does. So a move may
   mutate G and return nothing, return the draft, or return a new value; INVALID_MOVE comes back as itself.

   Where it differs from immer 9: the result is not frozen (immer deep-freezes it); nothing is shared with base (immer
   keeps unchanged branches and returns base itself when nothing changed); a recipe that both edits the draft and
   returns a different value gets its return value (immer throws); and base must survive structuredClone, which is
   true of the plain JSON-like data boardgame.io asks G to be (a function or a DOM node in G throws here, a class
   instance comes back a plain object). */
export function produce(base, recipe) {
  const draft = clone(base);
  const result = recipe(draft);
  return result === undefined ? draft : result;
}

/* structuredClone, fast for the plain data G is: plain objects and arrays are copied here (a shared branch or a cycle
   stays shared, as structuredClone keeps it), anything else (a Date, a Map, a class instance, a function) goes to
   structuredClone itself. structuredClone serialises its whole input, and that was most of the time a duel's fold
   took: 3.5 ms for a 7-round log, now a fraction (the load evals, 2026-10-25) */
function clone(base, seen = new Map()) {
  if (base === null || (typeof base !== 'object' && typeof base !== 'function')) return base;
  if (seen.has(base)) return seen.get(base);
  const proto = Object.getPrototypeOf(base);
  if (Array.isArray(base) && proto === Array.prototype) {
    const out = new Array(base.length);
    seen.set(base, out);
    let n = 0;
    for (let i = 0; i < base.length; i++) if (i in base) { out[i] = clone(base[i], seen); n++; }
    if (Object.keys(base).length !== n) { seen.delete(base); return structuredClone(base); }   // an array with extra keys
    return out;
  }
  if (typeof base === 'object' && (proto === Object.prototype || proto === null) && Object.prototype.toString.call(base) === '[object Object]') {
    const out = {};
    seen.set(base, out);
    for (const k of Object.keys(base)) out[k] = clone(base[k], seen);
    return out;
  }
  const out = structuredClone(base);
  seen.set(base, out);
  return out;
}

/* Plugin that allows using a draft (formerly immer's) to make immutable changes to G by just mutating it. */
const ImmerPlugin = {
  name: 'plugin-immer',

  fnWrap:
    (move) =>
    /* the engine's own do-nothing hook hands G back untouched, as immer would: no draft (constants.mjs KEEP_G) */
    move === KEEP_G ? move : (context, ...args) => {
      let isInvalid = false;
      const newG = produce(context.G, (G) => {
        const result = move({ ...context, G }, ...args);
        if (result === INVALID_MOVE) {
          isInvalid = true;
          return;
        }
        return result;
      });
      if (isInvalid) return INVALID_MOVE;
      return newG;
    },
};

export default ImmerPlugin;
