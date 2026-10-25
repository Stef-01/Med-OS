/* index.mjs: the game engine of boardgame.io, as plain ES modules with no dependencies (Node 20+ and any browser
   with structuredClone: Safari 15.4, Chrome 98, Firefox 94).

   Ported from boardgame.io at 5e9a2c9 (MIT, Copyright (c) 2017 The boardgame.io Authors; the licence is ./LICENSE):
   src/core/*.ts into core/, src/plugins/** into plugins/, one .mjs per source file, types removed, logic, names and
   comments kept. 5e9a2c9 is the GitHub source after the published 0.50.2; it adds PLAYER_LEAVE (game.onPlayerLeave,
   ctx._removedPlayers), game.disableLog, the onMove hook's `move`, log entries for directly dispatched endGame and
   setPhase events, and fixes around pass, playOrder strings and log metadata. scripts/engine-goldens.mjs plays a set of
   games through the published 0.50.2 and records its states (test/fixtures/engine-goldens.json); test/engine.test.mjs
   replays them through this port, equal step for step except at those changes, each pinned there.

   What changed in the port: immer is replaced by a small produce() over structuredClone (plugins/plugin-immer.mjs
   says where it differs), lodash.isplainobject by a few lines (plugins/plugin-serializable.mjs), process.env is read
   through globalThis.process so the modules load unbundled in a browser.

   Left out: the PATCH action and its creator (client delta sync over rfc6902, which we do not use); the Master
   (src/master: the server's authority, which also refuses actions the reducer would take: action types other than
   moves, events, undo, redo and plugin actions; `automatic` actions from a client; events not in
   game.flow.enabledEventNames; inactive players; a stale _stateID; undo / redo unless exactly one player can move);
   the client, server, lobby, ai, testing, React and React Native bindings, debug panel, transports and storage;
   plugin-player (boardgame.io/plugins' PluginPlayer, which the core does not use); and types.ts.

   Replaying a log:

     const game = ProcessGameConfig({ setup, moves, phases, turn, endIf, seed });  // fills in defaults (in place)
     const reducer = CreateGameReducer({ game });                    // isClient false: events and triggers run
     let state = InitializeGame({ game, numPlayers: 2, setupData });
     for (const action of actions) state = reducer(state, action);   // makeMove(name, args, playerID), gameEvent(...)

   A refused action leaves state.transients.error = { type: ActionErrorType.*, payload }; the next action drops it.
   An action whose playerID is null or undefined skips the reducer's active-player checks, so a log replayed from a
   server should carry the playerID the server verified on every action. */

export { INVALID_MOVE } from './core/constants.mjs';
export { setLogger } from './core/logger.mjs';
export { ActivePlayers, Stage, TurnOrder } from './core/turn-order.mjs';
export { PlayerView } from './core/player-view.mjs';
export { GameMethod } from './core/game-methods.mjs';
export { ActionErrorType, UpdateErrorType } from './core/errors.mjs';
export { CreateGameReducer, TransientHandlingMiddleware } from './core/reducer.mjs';
export { ProcessGameConfig, IsLongFormMove } from './core/game.mjs';
export { InitializeGame } from './core/initialize.mjs';
export {
  makeMove,
  gameEvent,
  automaticGameEvent,
  sync,
  update,
  reset,
  undo,
  redo,
  plugin,
  playerLeave,
  stripTransients,
} from './core/action-creators.mjs';
export * as ActionCreators from './core/action-creators.mjs';
export * as ActionTypes from './core/action-types.mjs';
