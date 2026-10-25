/* constants.mjs: the value a move returns to refuse itself.
   Ported from boardgame.io src/core/constants.ts at 5e9a2c9 (MIT, Copyright (c) 2017 The boardgame.io Authors; the
   licence is ../LICENSE). Changed: nothing but the module syntax. */

/* Moves can return this when they want to indicate that the combination of arguments is illegal and the move ought
   to be discarded. */
export const INVALID_MOVE = 'INVALID_MOVE';
