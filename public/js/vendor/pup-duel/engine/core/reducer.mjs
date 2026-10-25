/* reducer.mjs: CreateGameReducer, the pure (state, action) => state that folds moves, events, undo / redo, a player
   leaving and plugin actions into the game state.
   Ported from boardgame.io src/core/reducer.ts at 5e9a2c9 (MIT, Copyright (c) 2017 The boardgame.io Authors; the
   licence is ../LICENSE). Changed: types removed; the PATCH case (rfc6902 applyPatch, client delta sync) is left out,
   so a PATCH action falls through to the default and returns the state unchanged. */

import * as Actions from './action-types.mjs';
import * as plugins from '../plugins/main.mjs';
import { ProcessGameConfig } from './game.mjs';
import { error } from './logger.mjs';
import { INVALID_MOVE } from './constants.mjs';
import { gameEvent, stripTransients } from './action-creators.mjs';
import { ActionErrorType } from './errors.mjs';
import { RemovePlayer } from './turn-order.mjs';

/* Check if the payload for the passed action contains a playerID. */
const actionHasPlayerID = (action) => action.payload.playerID !== null && action.payload.playerID !== undefined;

/* Returns true if a move can be undone. */
const CanUndoMove = (G, ctx, move) => {
  function HasUndoable(move) {
    return move.undoable !== undefined;
  }

  function IsFunction(undoable) {
    return undoable instanceof Function;
  }

  if (!HasUndoable(move)) {
    return true;
  }

  if (IsFunction(move.undoable)) {
    return move.undoable({ G, ctx });
  }

  return move.undoable;
};

/* Update the undo and redo stacks for a move or event. */
function updateUndoRedoState(state, opts) {
  if (opts.game.disableUndo) return state;

  const undoEntry = {
    G: state.G,
    ctx: state.ctx,
    plugins: state.plugins,
    playerID: opts.action.payload.playerID || state.ctx.currentPlayer,
  };

  if (opts.action.type === 'MAKE_MOVE') {
    undoEntry.moveType = opts.action.payload.type;
  }

  return {
    ...state,
    _undo: [...state._undo, undoEntry],
    // Always reset redo stack when making a move or event
    _redo: [],
  };
}

/* Replace undo / redo history with the current state as the new baseline. */
function rebaseUndoRedoState(state, opts) {
  if (opts.game.disableUndo) {
    return {
      ...state,
      _undo: [],
      _redo: [],
    };
  }

  return {
    ...state,
    _undo: [
      {
        G: state.G,
        ctx: state.ctx,
        plugins: state.plugins,
        playerID: opts.playerID,
      },
    ],
    _redo: [],
  };
}

/* Process state, adding the initial deltalog for this action. */
function initializeDeltalog(state, action, game, move) {
  if (game.disableLog) {
    return { ...state, deltalog: [] };
  }

  // Create a log entry for this action.
  const logEntry = {
    action,
    _stateID: state._stateID,
    turn: state.ctx.turn,
    phase: state.ctx.phase,
  };

  const pluginLogMetadata = state.plugins.log.data.metadata;
  if (pluginLogMetadata !== undefined) {
    logEntry.metadata = pluginLogMetadata;
  }

  if (typeof move === 'object' && move.redact === true) {
    logEntry.redact = true;
  } else if (typeof move === 'object' && move.redact instanceof Function) {
    logEntry.redact = move.redact({ G: state.G, ctx: state.ctx });
  }

  return {
    ...state,
    deltalog: [logEntry],
  };
}

/* Get the event type used in the log for a directly dispatched game event. */
function getLogEventType(eventType) {
  switch (eventType) {
    case 'endTurn':
    case 'pass': {
      return 'endTurn';
    }
    case 'endPhase':
    case 'setPhase': {
      return 'endPhase';
    }
    case 'endStage':
    case 'setStage': {
      return 'endStage';
    }
    case 'endGame': {
      return 'endGame';
    }
  }
}

/* Events whose flow implementation never appends a log entry even though their hooks run: `endGame` is never logged,
   and `setPhase` starting a phase from `ctx.phase === null` returns before `EndPhase` reaches its log entry. Other
   events either produce a canonical entry or run no hooks at all. */
const EVENTS_WITHOUT_LOG_ENTRY = new Set(['endGame', 'setPhase']);

/* Add metadata set by the log plugin to the canonical log entry for an event. If the event never produces an entry of
   its own, add one for the dispatched event, whether or not metadata was set, so the log shape doesn’t depend on what
   a hook happened to do. */
function addLogMetadata(state, action, actionState, game) {
  const metadata = state.plugins.log?.data.metadata;
  const eventType = getLogEventType(action.payload.type);

  if (game.disableLog || eventType === undefined) {
    return state;
  }

  // GAME_EVENT processing initializes deltalog before running the flow.
  const { deltalog } = state;
  const eventEntry = deltalog.findIndex(
    (entry) => entry.action.type === Actions.GAME_EVENT && entry.action.payload.type === eventType,
  );

  if (eventEntry === -1) {
    if (!EVENTS_WITHOUT_LOG_ENTRY.has(action.payload.type)) return state;
    // Recreate the action without credentials so they are never persisted.
    const { type, args, playerID } = action.payload;
    const logEntry = {
      action: gameEvent(type, args, playerID),
      _stateID: actionState._stateID,
      turn: actionState.ctx.turn,
      phase: actionState.ctx.phase,
    };
    if (metadata !== undefined) logEntry.metadata = metadata;
    return { ...state, deltalog: [...deltalog, logEntry] };
  }

  if (metadata === undefined) return state;

  const updatedDeltalog = [...deltalog];
  updatedDeltalog[eventEntry] = {
    ...updatedDeltalog[eventEntry],
    metadata,
  };

  return { ...state, deltalog: updatedDeltalog };
}

/* Remove metadata set during an action that was rejected. */
function clearLogMetadata(state) {
  const logPlugin = state.plugins.log;
  if (logPlugin?.data.metadata === undefined) return state;

  const data = { ...logPlugin.data };
  delete data.metadata;

  return {
    ...state,
    plugins: {
      ...state.plugins,
      log: { ...logPlugin, data },
    },
  };
}

/* Update plugin state after move/event & check if plugins consider the action to be valid.
   state: the current version of state in the reducer; oldState: the state to revert to in case of error.
   Returns [newState] when valid, else [newState, the old state augmented with the plugin's error]. */
function flushAndValidatePlugins(state, oldState, pluginOpts) {
  const [newState, isInvalid] = plugins.FlushAndValidate(state, pluginOpts);
  if (!isInvalid) return [newState];
  return [newState, WithError(clearLogMetadata(oldState), ActionErrorType.PluginActionInvalid, isInvalid)];
}

/* ExtractTransients: split out transients from a state that may carry them. */
function ExtractTransients(transientState) {
  if (!transientState) {
    // We preserve null for the state for legacy callers, but the transient
    // field should be undefined if not present to be consistent with the
    // code path below.
    return [null, undefined];
  }
  const { transients, ...state } = transientState;
  return [state, transients];
}

/* WithError: augment a state with transient error information ({ type, payload }). */
function WithError(state, errorType, payload) {
  const error = {
    type: errorType,
    payload,
  };
  return {
    ...state,
    transients: {
      error,
    },
  };
}

/* Middleware (in the redux middleware shape, store => next => action) for processing the transient state of the
   reducer returned by CreateGameReducer: after an action that left transients, it dispatches stripTransients() and
   hands the transients back on the dispatch's result. This should pretty much be used everywhere you want realistic
   state transitions and error handling. */
export const TransientHandlingMiddleware = (store) => (next) => (action) => {
  const result = next(action);
  switch (action.type) {
    case Actions.STRIP_TRANSIENTS: {
      return result;
    }
    default: {
      const [, transients] = ExtractTransients(store.getState());
      if (transients !== undefined) {
        store.dispatch(stripTransients());
        // Dev Note: If parent middleware needs to correlate the spawned
        // StripTransients action to the triggering action, instrument here.
        //
        // This is a bit tricky; for more details, see:
        //   https://github.com/boardgameio/boardgame.io/pull/940#discussion_r636200648
        return {
          ...result,
          transients,
        };
      }
      return result;
    }
  }
};

/* CreateGameReducer: creates the main game state reducer. isClient: true for a client that only predicts moves
   while a server (the master) runs events and triggers; false (the default) runs everything, as the master does. */
export function CreateGameReducer({ game, isClient }) {
  game = ProcessGameConfig(game);

  /* GameReducer: the reducer that maintains the overall game state.
     stateWithTransients: the state before the action (any transients on it are dropped); action: the action. */
  return (stateWithTransients = null, action) => {
    let [state /*, transients */] = ExtractTransients(stateWithTransients);
    switch (action.type) {
      case Actions.STRIP_TRANSIENTS: {
        // This action indicates that transient metadata in the state has been
        // consumed and should now be stripped from the state..
        return state;
      }

      case Actions.GAME_EVENT: {
        const oldState = (state = { ...state, deltalog: [] });

        // Process game events only on the server.
        // These events like `endTurn` typically
        // contain code that may rely on secret state
        // and cannot be computed on the client.
        if (isClient) {
          return state;
        }

        // Disallow events once the game is over.
        if (state.ctx.gameover !== undefined) {
          error(`cannot call event after game end`);
          return WithError(state, ActionErrorType.GameOver);
        }

        // Ignore the event if the player isn't active.
        if (actionHasPlayerID(action) && !game.flow.isPlayerActive(state.G, state.ctx, action.payload.playerID)) {
          error(`disallowed event: ${action.payload.type}`);
          return WithError(state, ActionErrorType.InactivePlayer);
        }

        // Execute plugins.
        state = plugins.Enhance(state, {
          game,
          isClient: false,
          playerID: action.payload.playerID,
        });

        // Process event.
        let newState = game.flow.processEvent(state, action);
        newState = addLogMetadata(newState, action, oldState, game);

        // Execute plugins.
        let stateWithError;
        [newState, stateWithError] = flushAndValidatePlugins(newState, oldState, {
          game,
          isClient: false,
        });
        if (stateWithError) return stateWithError;

        // Update undo / redo state.
        newState = updateUndoRedoState(newState, { game, action });

        return { ...newState, _stateID: state._stateID + 1 };
      }

      case Actions.MAKE_MOVE: {
        const oldState = (state = { ...state, deltalog: [] });

        // Check whether the move is allowed at this time.
        const move = game.flow.getMove(state.ctx, action.payload.type, action.payload.playerID || state.ctx.currentPlayer);
        if (move === null) {
          error(`disallowed move: ${action.payload.type}`);
          return WithError(state, ActionErrorType.UnavailableMove);
        }

        // Don't run move on client if move says so.
        if (isClient && move.client === false) {
          return state;
        }

        // Disallow moves once the game is over.
        if (state.ctx.gameover !== undefined) {
          error(`cannot make move after game end`);
          return WithError(state, ActionErrorType.GameOver);
        }

        // Ignore the move if the player isn't active.
        if (actionHasPlayerID(action) && !game.flow.isPlayerActive(state.G, state.ctx, action.payload.playerID)) {
          error(`disallowed move: ${action.payload.type}`);
          return WithError(state, ActionErrorType.InactivePlayer);
        }

        // Execute plugins.
        state = plugins.Enhance(state, {
          game,
          isClient,
          playerID: action.payload.playerID,
        });

        // Process the move.
        const G = game.processMove(state, action.payload);

        // The game declared the move as invalid.
        if (G === INVALID_MOVE) {
          error(`invalid move: ${action.payload.type} args: ${action.payload.args}`);
          // TODO(#723): Marshal a nice error payload with the processed move.
          return WithError(state, ActionErrorType.InvalidMove);
        }

        const newState = { ...state, G };

        // Some plugin indicated that it is not suitable to be
        // materialized on the client (and must wait for the server
        // response instead).
        if (isClient && plugins.NoClient(newState, { game })) {
          return state;
        }

        state = newState;

        // If we're on the client, just process the move
        // and no triggers in multiplayer mode.
        // These will be processed on the server, which
        // will send back a state update.
        if (isClient) {
          let stateWithError;
          [state, stateWithError] = flushAndValidatePlugins(state, oldState, {
            game,
            isClient: true,
          });
          if (stateWithError) return stateWithError;
          return {
            ...state,
            _stateID: state._stateID + 1,
          };
        }

        // On the server, construct the deltalog.
        state = initializeDeltalog(state, action, game, move);

        // Allow the flow reducer to process any triggers that happen after moves.
        state = game.flow.processMove(state, action.payload);
        let stateWithError;
        [state, stateWithError] = flushAndValidatePlugins(state, oldState, {
          game,
        });
        if (stateWithError) return stateWithError;

        // Update undo / redo state.
        state = updateUndoRedoState(state, { game, action });

        return {
          ...state,
          _stateID: state._stateID + 1,
        };
      }

      case Actions.PLAYER_LEAVE: {
        const oldState = (state = { ...state, deltalog: [] });
        const { playerID } = action.payload;

        if (typeof playerID !== 'string') {
          error(`invalid playerID: ${playerID}`);
          return WithError(state, ActionErrorType.ActionInvalid);
        }

        if (state.ctx.gameover !== undefined) {
          error(`cannot leave after game end`);
          return WithError(state, ActionErrorType.GameOver);
        }

        state = plugins.Enhance(state, {
          game,
          isClient: false,
          playerID,
        });

        const G = game.processPlayerLeave(state, playerID);
        state = initializeDeltalog({ ...state, G }, action, game);

        let stateWithError;
        [state, stateWithError] = flushAndValidatePlugins(state, oldState, {
          game,
          isClient: false,
        });
        if (stateWithError) return stateWithError;

        state = {
          ...state,
          ctx: RemovePlayer(state.ctx, playerID),
        };

        if (state.ctx.gameover === undefined && state.ctx.playOrder.length === 0) {
          error(`cannot remove final player before game end`);
          return WithError(oldState, ActionErrorType.ActionInvalid);
        }

        state = rebaseUndoRedoState(state, { game, playerID });

        return {
          ...state,
          _stateID: state._stateID + 1,
        };
      }

      case Actions.RESET:
      case Actions.UPDATE:
      case Actions.SYNC: {
        return action.state;
      }

      case Actions.UNDO: {
        state = { ...state, deltalog: [] };

        if (game.disableUndo) {
          error('Undo is not enabled');
          return WithError(state, ActionErrorType.ActionDisabled);
        }

        const { G, ctx, _undo, _redo, _stateID } = state;

        if (_undo.length < 2) {
          error(`No moves to undo`);
          return WithError(state, ActionErrorType.ActionInvalid);
        }

        const last = _undo.at(-1);
        const restore = _undo.at(-2);

        // Only allow players to undo their own moves.
        if (actionHasPlayerID(action) && action.payload.playerID !== last.playerID) {
          error(`Cannot undo other players' moves`);
          return WithError(state, ActionErrorType.ActionInvalid);
        }

        // If undoing a move, check it is undoable.
        if (last.moveType) {
          const lastMove = game.flow.getMove(restore.ctx, last.moveType, last.playerID);
          if (!CanUndoMove(G, ctx, lastMove)) {
            error(`Move cannot be undone`);
            return WithError(state, ActionErrorType.ActionInvalid);
          }
        }

        state = initializeDeltalog(state, action, game);

        return {
          ...state,
          G: restore.G,
          ctx: restore.ctx,
          plugins: restore.plugins,
          _stateID: _stateID + 1,
          _undo: _undo.slice(0, -1),
          _redo: [last, ..._redo],
        };
      }

      case Actions.REDO: {
        state = { ...state, deltalog: [] };

        if (game.disableUndo) {
          error('Redo is not enabled');
          return WithError(state, ActionErrorType.ActionDisabled);
        }

        const { _undo, _redo, _stateID } = state;

        if (_redo.length === 0) {
          error(`No moves to redo`);
          return WithError(state, ActionErrorType.ActionInvalid);
        }

        const first = _redo[0];

        // Only allow players to redo their own undos.
        if (actionHasPlayerID(action) && action.payload.playerID !== first.playerID) {
          error(`Cannot redo other players' moves`);
          return WithError(state, ActionErrorType.ActionInvalid);
        }

        state = initializeDeltalog(state, action, game);

        return {
          ...state,
          G: first.G,
          ctx: first.ctx,
          plugins: first.plugins,
          _stateID: _stateID + 1,
          _undo: [..._undo, first],
          _redo: _redo.slice(1),
        };
      }

      case Actions.PLUGIN: {
        // TODO(#723): Expose error semantics to plugin processing.
        return plugins.ProcessAction(state, action, { game });
      }

      default: {
        return state;
      }
    }
  };
}
