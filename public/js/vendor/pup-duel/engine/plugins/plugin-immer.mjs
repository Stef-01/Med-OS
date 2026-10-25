/* plugin-immer.mjs: lets moves and hooks change G by mutating it, and passes INVALID_MOVE through.
   Ported from boardgame.io src/plugins/plugin-immer.ts at 5e9a2c9 (MIT, Copyright (c) 2017 The boardgame.io Authors;
   the licence is ../LICENSE). Changed: types removed; immer is replaced by the small produce() below. */

import { INVALID_MOVE } from '../core/constants.mjs';

/* produce(base, recipe), the part of immer's that boardgame.io uses: the recipe mutates a structured clone of base
   (its draft), and what the recipe returns wins unless that is undefined, in which case the draft does. So a move may
   mutate G and return nothing, return the draft, or return a new value; INVALID_MOVE comes back as itself.

   Where it differs from immer 9: the result is not frozen (immer deep-freezes it); nothing is shared with base (immer
   keeps unchanged branches and returns base itself when nothing changed); a recipe that both edits the draft and
   returns a different value gets its return value (immer throws); and base must survive structuredClone, which is
   true of the plain JSON-like data boardgame.io asks G to be (a function or a DOM node in G throws here, a class
   instance comes back a plain object). */
export function produce(base, recipe) {
  const draft = structuredClone(base);
  const result = recipe(draft);
  return result === undefined ? draft : result;
}

/* Plugin that allows using a draft (formerly immer's) to make immutable changes to G by just mutating it. */
const ImmerPlugin = {
  name: 'plugin-immer',

  fnWrap:
    (move) =>
    (context, ...args) => {
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
