/* initialize.mjs: InitializeGame, the state a match starts from (setup run, the first phase and turn begun).
   Ported from boardgame.io src/core/initialize.ts at 5e9a2c9 (MIT, Copyright (c) 2017 The boardgame.io Authors; the
   licence is ../LICENSE). Changed: types removed. */

import { ProcessGameConfig } from './game.mjs';
import * as plugins from '../plugins/main.mjs';

/* Creates the initial game state. numPlayers defaults to 2; setupData is handed to game.setup. */
export function InitializeGame({ game, numPlayers, setupData }) {
  game = ProcessGameConfig(game);

  if (!numPlayers) {
    numPlayers = 2;
  }

  const ctx = game.flow.ctx(numPlayers);

  let state = {
    // User managed state.
    G: {},
    // Framework managed state.
    ctx,
    // Plugin related state.
    plugins: {},
  };

  // Run plugins over initial state.
  state = plugins.Setup(state, { game });
  state = plugins.Enhance(state, { game, playerID: undefined });

  const pluginAPIs = plugins.GetAPIs(state);
  state.G = game.setup({ ...pluginAPIs, ctx: state.ctx }, setupData);

  let initial = {
    ...state,

    // List of {G, ctx} pairs that can be undone.
    _undo: [],
    // List of {G, ctx} pairs that can be redone.
    _redo: [],
    // A monotonically non-decreasing ID to ensure that
    // state updates are only allowed from clients that
    // are at the same version that the server.
    _stateID: 0,
  };

  initial = game.flow.init(initial);
  [initial] = plugins.FlushAndValidate(initial, { game });

  // Initialize undo stack.
  if (!game.disableUndo) {
    initial._undo = [
      {
        G: initial.G,
        ctx: initial.ctx,
        plugins: initial.plugins,
      },
    ];
  }

  return initial;
}
