/* constants.mjs: the value a move returns to refuse itself.
   Ported from boardgame.io src/core/constants.ts at 5e9a2c9 (MIT, Copyright (c) 2017 The boardgame.io Authors; the
   licence is ../LICENSE). Changed: the module syntax, and KEEP_G below. */

/* Moves can return this when they want to indicate that the combination of arguments is illegal and the move ought
   to be discarded. */
export const INVALID_MOVE = 'INVALID_MOVE';

/* Not upstream: the hook the engine fills in when a game gives none (({ G }) => G), one function for all of them, so
   plugin-immer can pass it through without making a draft it hands straight back (immer returns the base itself when
   a recipe changes nothing: the same result, without the clone that was a duel fold's cost; evals 2026-10-25) */
export const KEEP_G = ({ G }) => G;
