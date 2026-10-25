/* action-creators.mjs: the actions a client (or a replayed log) hands the reducer.
   Ported from boardgame.io src/core/action-creators.ts at 5e9a2c9 (MIT, Copyright (c) 2017 The boardgame.io
   Authors; the licence is ../LICENSE). Changed: types removed; patch() is left out with the PATCH action. */

import * as Actions from './action-types.mjs';

/* Generate a move to be dispatched to the game move reducer.
   type: the move's name; args: its arguments (an array, or one value); playerID: the player making the move;
   credentials: optional, checked by a server, never by the reducer. */
export const makeMove = (type, args, playerID, credentials) => ({
  type: Actions.MAKE_MOVE,
  payload: { type, args, playerID, credentials },
});

/* Generate a game event to be dispatched to the flow reducer (endTurn, endPhase, setStage, ...). */
export const gameEvent = (type, args, playerID, credentials) => ({
  type: Actions.GAME_EVENT,
  payload: { type, args, playerID, credentials },
});

/* Generate an automatic game event that is a side-effect of a move (the events plugin makes these; a server refuses
   one from a client). */
export const automaticGameEvent = (type, args, playerID, credentials) => ({
  type: Actions.GAME_EVENT,
  payload: { type, args, playerID, credentials },
  automatic: true,
});

export const sync = (info) => ({
  type: Actions.SYNC,
  state: info.state,
  log: info.log,
  initialState: info.initialState,
  clientOnly: true,
});

/* Used to update the store's state in response to an action coming from another player.
   state: the state to restore; deltalog: a log delta. */
export const update = (state, deltalog) => ({
  type: Actions.UPDATE,
  state,
  deltalog,
  clientOnly: true,
});

/* Used to reset the game state to the given initial state. */
export const reset = (state) => ({
  type: Actions.RESET,
  state,
  clientOnly: true,
});

/* Used to undo the last move (playerID: who asks; credentials optional). */
export const undo = (playerID, credentials) => ({
  type: Actions.UNDO,
  payload: { type: null, args: null, playerID, credentials },
});

/* Used to redo the last undone move. */
export const redo = (playerID, credentials) => ({
  type: Actions.REDO,
  payload: { type: null, args: null, playerID, credentials },
});

/* Allows plugins to define their own actions and intercept them. */
export const plugin = (type, args, playerID, credentials) => ({
  type: Actions.PLUGIN,
  payload: { type, args, playerID, credentials },
});

/* A player leaves the match: game.onPlayerLeave runs and the player is taken out of the turn order. */
export const playerLeave = (playerID) => ({
  type: Actions.PLAYER_LEAVE,
  payload: { playerID },
});

/* Private action used to strip transient metadata (e.g. errors) from the game state. */
export const stripTransients = () => ({
  type: Actions.STRIP_TRANSIENTS,
});
