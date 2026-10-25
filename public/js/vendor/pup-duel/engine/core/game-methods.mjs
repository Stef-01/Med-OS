/* game-methods.mjs: which kind of game function is running, so plugins (the events plugin above all) know whether
   a call came from a move or from a hook.
   Ported from boardgame.io src/core/game-methods.ts at 5e9a2c9 (MIT, Copyright (c) 2017 The boardgame.io Authors;
   the licence is ../LICENSE). Changed: the TypeScript string enum is a plain object (what tsc emits for it). */

export const GameMethod = {
  MOVE: 'MOVE',
  GAME_ON_END: 'GAME_ON_END',
  GAME_ON_PLAYER_LEAVE: 'GAME_ON_PLAYER_LEAVE',
  PHASE_ON_BEGIN: 'PHASE_ON_BEGIN',
  PHASE_ON_END: 'PHASE_ON_END',
  TURN_ON_BEGIN: 'TURN_ON_BEGIN',
  TURN_ON_MOVE: 'TURN_ON_MOVE',
  TURN_ON_END: 'TURN_ON_END',
};
