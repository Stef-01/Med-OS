/* action-types.mjs: the type of every action the reducer takes.
   Ported from boardgame.io src/core/action-types.ts at 5e9a2c9 (MIT, Copyright (c) 2017 The boardgame.io Authors;
   the licence is ../LICENSE). Changed: PATCH is left out (client delta sync over rfc6902, which this port does not
   do; a PATCH action now falls through the reducer unchanged). */

export const MAKE_MOVE = 'MAKE_MOVE';
export const GAME_EVENT = 'GAME_EVENT';
export const REDO = 'REDO';
export const RESET = 'RESET';
export const SYNC = 'SYNC';
export const UNDO = 'UNDO';
export const UPDATE = 'UPDATE';
export const PLUGIN = 'PLUGIN';
export const PLAYER_LEAVE = 'PLAYER_LEAVE';
export const STRIP_TRANSIENTS = 'STRIP_TRANSIENTS';
