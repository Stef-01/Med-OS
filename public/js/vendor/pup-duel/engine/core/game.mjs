/* game.mjs: ProcessGameConfig, which fills a game config's defaults, builds its flow and wraps its moves in the
   plugins.
   Ported from boardgame.io src/core/game.ts at 5e9a2c9 (MIT, Copyright (c) 2017 The boardgame.io Authors; the
   licence is ../LICENSE). Changed: types removed. */

import * as plugins from '../plugins/main.mjs';
import { KEEP_G } from './constants.mjs';
import { Flow } from './flow.mjs';
import * as logging from './logger.mjs';
import { GameMethod } from './game-methods.mjs';

function IsProcessed(game) {
  return game.processMove !== undefined;
}

/* Helper to generate the game move reducer. The returned game has processMove(state, action.payload), which runs
   the move named by action.type with action.args (an array of arguments).

   The game config is mutated (its defaults are written into it); a processed game passes through unchanged. */
export function ProcessGameConfig(game) {
  // The Game() function has already been called on this
  // config object, so just pass it through.
  if (IsProcessed(game)) {
    return game;
  }

  if (game.name === undefined) game.name = 'default';
  if (game.deltaState === undefined) game.deltaState = false;
  if (game.disableUndo === undefined) game.disableUndo = false;
  if (game.setup === undefined) game.setup = () => ({});
  if (game.moves === undefined) game.moves = {};
  if (game.onPlayerLeave === undefined) game.onPlayerLeave = KEEP_G;
  if (game.playerView === undefined) game.playerView = ({ G }) => G;
  if (game.plugins === undefined) game.plugins = [];

  game.plugins.forEach((plugin) => {
    if (plugin.name === undefined) {
      throw new Error('Plugin missing name attribute');
    }
    if (plugin.name.includes(' ')) {
      throw new Error(plugin.name + ': Plugin name must not include spaces');
    }
  });

  if (game.name.includes(' ')) {
    throw new Error(game.name + ': Game name must not include spaces');
  }

  const flow = Flow(game);

  return {
    ...game,

    flow,

    moveNames: flow.moveNames,

    pluginNames: game.plugins.map((p) => p.name),

    processMove: (state, action) => {
      let moveFn = flow.getMove(state.ctx, action.type, action.playerID);

      if (IsLongFormMove(moveFn)) {
        moveFn = moveFn.move;
      }

      if (moveFn instanceof Function) {
        const fn = plugins.FnWrap(moveFn, GameMethod.MOVE, game.plugins);
        let args = [];
        if (action.args !== undefined) {
          args = Array.isArray(action.args) ? action.args : [action.args];
        }
        const context = {
          ...plugins.GetAPIs(state),
          G: state.G,
          ctx: state.ctx,
          playerID: action.playerID,
        };
        return fn(context, ...args);
      }

      logging.error(`invalid move object: ${action.type}`);

      return state.G;
    },

    processPlayerLeave: (state, playerID) => {
      const fn = plugins.FnWrap(game.onPlayerLeave, GameMethod.GAME_ON_PLAYER_LEAVE, game.plugins);
      const context = {
        ...plugins.GetAPIs(state),
        G: state.G,
        ctx: state.ctx,
        playerID,
      };
      return fn(context);
    },
  };
}

/* A long-form move is { move, undoable, redact, client, noLimit, ignoreStaleStateID } rather than a bare function. */
export function IsLongFormMove(move) {
  return move instanceof Object && move.move !== undefined;
}
