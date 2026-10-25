/* backwards-compatibility.mjs: the old moveLimit option, read as minMoves/maxMoves.
   Ported from boardgame.io src/core/backwards-compatibility.ts at 5e9a2c9 (MIT, Copyright (c) 2017 The boardgame.io
   Authors; the licence is ../LICENSE). Changed: types removed. */

/* Adjust the given options (mutated in place) to use the new minMoves/maxMoves if a legacy moveLimit was given.
   enforceMinMoves: use moveLimit to set both minMoves and maxMoves (turns did; stages never enforced minMoves). */
export function supportDeprecatedMoveLimit(options, enforceMinMoves = false) {
  if (options.moveLimit) {
    if (enforceMinMoves) {
      options.minMoves = options.moveLimit;
    }
    options.maxMoves = options.moveLimit;
    delete options.moveLimit;
  }
}
