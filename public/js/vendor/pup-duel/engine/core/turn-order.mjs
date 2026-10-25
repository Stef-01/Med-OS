/* turn-order.mjs: turn orders, stages, active players, and taking a player who left out of all of them.
   Ported from boardgame.io src/core/turn-order.ts at 5e9a2c9 (MIT, Copyright (c) 2017 The boardgame.io Authors; the
   licence is ../LICENSE). Changed: types removed. */

import * as logging from './logger.mjs';
import * as plugin from '../plugins/main.mjs';
import { supportDeprecatedMoveLimit } from './backwards-compatibility.mjs';

function IsPlayerRemoved(ctx, playerID) {
  return (ctx._removedPlayers || []).includes(playerID);
}

function RemovePlayerFromRecord(record, playerID) {
  if (!record) return record;
  const next = { ...record };
  delete next[playerID];
  return Object.keys(next).length > 0 ? next : null;
}

function RemovePlayerFromActivePlayersArg(arg, playerID) {
  if (!arg) return arg;

  if (Array.isArray(arg)) {
    return arg.filter((id) => id !== playerID);
  }

  const next = { ...arg };

  if (next.value) {
    next.value = { ...next.value };
    delete next.value[playerID];
    if (Object.keys(next.value).length === 0) {
      delete next.value;
    }
  }

  if (next.next) {
    next.next = RemovePlayerFromActivePlayersArg(next.next, playerID);
  }

  return next;
}

/* Take playerID out of the play order and out of every active-player record (current, stacked by revert, and
   queued by next), remembering it in ctx._removedPlayers so later turns and phases skip it too. */
export function RemovePlayer(ctx, playerID) {
  const removedPlayers = (ctx._removedPlayers || []).includes(playerID)
    ? ctx._removedPlayers
    : [...(ctx._removedPlayers || []), playerID];
  const playOrder = ctx.playOrder.filter((id) => id !== playerID);
  let playOrderPos = 0;
  let currentPlayer = ctx.currentPlayer;

  if (playOrder.length === 0) {
    currentPlayer = '';
  } else if (ctx.currentPlayer === playerID) {
    playOrderPos = ctx.playOrderPos > playOrder.length - 1 ? 0 : ctx.playOrderPos;
    currentPlayer = playOrder[playOrderPos];
  } else {
    const currentPlayerPos = playOrder.indexOf(ctx.currentPlayer);
    if (currentPlayerPos === -1) {
      playOrderPos = ctx.playOrderPos > playOrder.length - 1 ? 0 : ctx.playOrderPos;
      currentPlayer = playOrder[playOrderPos];
    } else {
      playOrderPos = currentPlayerPos;
    }
  }

  return {
    ...ctx,
    currentPlayer,
    playOrder,
    playOrderPos,
    activePlayers: RemovePlayerFromRecord(ctx.activePlayers, playerID),
    _activePlayersMinMoves: RemovePlayerFromRecord(ctx._activePlayersMinMoves, playerID),
    _activePlayersMaxMoves: RemovePlayerFromRecord(ctx._activePlayersMaxMoves, playerID),
    _activePlayersNumMoves: RemovePlayerFromRecord(ctx._activePlayersNumMoves, playerID),
    _prevActivePlayers: (ctx._prevActivePlayers || []).map((entry) => ({
      activePlayers: RemovePlayerFromRecord(entry.activePlayers, playerID),
      _activePlayersMinMoves: RemovePlayerFromRecord(entry._activePlayersMinMoves, playerID),
      _activePlayersMaxMoves: RemovePlayerFromRecord(entry._activePlayersMaxMoves, playerID),
      _activePlayersNumMoves: RemovePlayerFromRecord(entry._activePlayersNumMoves, playerID),
    })),
    _nextActivePlayers: RemovePlayerFromActivePlayersArg(ctx._nextActivePlayers, playerID),
    _removedPlayers: removedPlayers,
  };
}

/* Set ctx.activePlayers (and the move limits and counts that go with it) from an active-players argument: an array
   of player IDs, or { currentPlayer, others, all, value, minMoves, maxMoves, revert, next }. */
export function SetActivePlayers(ctx, arg) {
  let activePlayers = {};
  let _prevActivePlayers = [];
  let _nextActivePlayers = null;
  let _activePlayersMinMoves = {};
  let _activePlayersMaxMoves = {};
  const removedPlayers = new Set(ctx._removedPlayers || []);

  if (Array.isArray(arg)) {
    // support a simple array of player IDs as active players
    const value = {};
    arg
      .filter((v) => !removedPlayers.has(v))
      .forEach((v) => (value[v] = Stage.NULL));
    activePlayers = value;
  } else {
    // process active players argument object

    // stages previously did not enforce minMoves, this behaviour is kept intentionally
    supportDeprecatedMoveLimit(arg);

    if (arg.next) {
      _nextActivePlayers = arg.next;
    }

    if (arg.revert) {
      _prevActivePlayers = [
        ...ctx._prevActivePlayers,
        {
          activePlayers: ctx.activePlayers,
          _activePlayersMinMoves: ctx._activePlayersMinMoves,
          _activePlayersMaxMoves: ctx._activePlayersMaxMoves,
          _activePlayersNumMoves: ctx._activePlayersNumMoves,
        },
      ];
    }

    if (arg.currentPlayer !== undefined && !removedPlayers.has(ctx.currentPlayer)) {
      ApplyActivePlayerArgument(
        activePlayers,
        _activePlayersMinMoves,
        _activePlayersMaxMoves,
        ctx.currentPlayer,
        arg.currentPlayer,
      );
    }

    if (arg.others !== undefined) {
      for (let i = 0; i < ctx.playOrder.length; i++) {
        const id = ctx.playOrder[i];
        if (id !== ctx.currentPlayer && !removedPlayers.has(id)) {
          ApplyActivePlayerArgument(activePlayers, _activePlayersMinMoves, _activePlayersMaxMoves, id, arg.others);
        }
      }
    }

    if (arg.all !== undefined) {
      for (let i = 0; i < ctx.playOrder.length; i++) {
        const id = ctx.playOrder[i];
        if (removedPlayers.has(id)) continue;
        ApplyActivePlayerArgument(activePlayers, _activePlayersMinMoves, _activePlayersMaxMoves, id, arg.all);
      }
    }

    if (arg.value) {
      for (const id in arg.value) {
        if (removedPlayers.has(id)) continue;
        ApplyActivePlayerArgument(activePlayers, _activePlayersMinMoves, _activePlayersMaxMoves, id, arg.value[id]);
      }
    }

    if (arg.minMoves) {
      for (const id in activePlayers) {
        if (_activePlayersMinMoves[id] === undefined) {
          _activePlayersMinMoves[id] = arg.minMoves;
        }
      }
    }

    if (arg.maxMoves) {
      for (const id in activePlayers) {
        if (_activePlayersMaxMoves[id] === undefined) {
          _activePlayersMaxMoves[id] = arg.maxMoves;
        }
      }
    }
  }

  if (Object.keys(activePlayers).length === 0) {
    activePlayers = null;
  }

  if (Object.keys(_activePlayersMinMoves).length === 0) {
    _activePlayersMinMoves = null;
  }

  if (Object.keys(_activePlayersMaxMoves).length === 0) {
    _activePlayersMaxMoves = null;
  }

  const _activePlayersNumMoves = {};
  for (const id in activePlayers) {
    _activePlayersNumMoves[id] = 0;
  }

  return {
    ...ctx,
    activePlayers,
    _activePlayersMinMoves,
    _activePlayersMaxMoves,
    _activePlayersNumMoves,
    _prevActivePlayers,
    _nextActivePlayers,
  };
}

/* Update activePlayers, setting it to previous, next or null values when it becomes empty. */
export function UpdateActivePlayersOnceEmpty(ctx) {
  let {
    activePlayers,
    _activePlayersMinMoves,
    _activePlayersMaxMoves,
    _activePlayersNumMoves,
    _prevActivePlayers,
    _nextActivePlayers,
  } = ctx;

  if (activePlayers && Object.keys(activePlayers).length === 0) {
    if (_nextActivePlayers) {
      ctx = SetActivePlayers(ctx, _nextActivePlayers);
      ({
        activePlayers,
        _activePlayersMinMoves,
        _activePlayersMaxMoves,
        _activePlayersNumMoves,
        _prevActivePlayers,
      } = ctx);
    } else if (_prevActivePlayers.length > 0) {
      const lastIndex = _prevActivePlayers.length - 1;
      ({
        activePlayers,
        _activePlayersMinMoves,
        _activePlayersMaxMoves,
        _activePlayersNumMoves,
      } = _prevActivePlayers[lastIndex]);
      _prevActivePlayers = _prevActivePlayers.slice(0, lastIndex);
    } else {
      activePlayers = null;
      _activePlayersMinMoves = null;
      _activePlayersMaxMoves = null;
    }
  }

  return {
    ...ctx,
    activePlayers,
    _activePlayersMinMoves,
    _activePlayersMaxMoves,
    _activePlayersNumMoves,
    _prevActivePlayers,
  };
}

/* Apply an active player argument (a stage name, Stage.NULL, or { stage, minMoves, maxMoves }) to playerID, writing
   into the three records passed in. */
function ApplyActivePlayerArgument(activePlayers, _activePlayersMinMoves, _activePlayersMaxMoves, playerID, arg) {
  if (typeof arg !== 'object' || arg === Stage.NULL) {
    arg = { stage: arg };
  }

  if (arg.stage !== undefined) {
    // stages previously did not enforce minMoves, this behaviour is kept intentionally
    supportDeprecatedMoveLimit(arg);

    activePlayers[playerID] = arg.stage;
    if (arg.minMoves) _activePlayersMinMoves[playerID] = arg.minMoves;
    if (arg.maxMoves) _activePlayersMaxMoves[playerID] = arg.maxMoves;
  }
}

/* Converts a playOrderPos index into its value in playOrder. */
function getCurrentPlayer(playOrder, playOrderPos) {
  // convert to string in case playOrder is set to number[]
  return playOrder[playOrderPos] + '';
}

/* Called at the start of a turn to initialize turn order state.

   TODO (upstream): This is called inside StartTurn, which is called from both UpdateTurn and StartPhase (so it's
   called at the beginning of a new phase as well as between turns). We should probably split it into two. */
export function InitTurnOrderState(state, turn) {
  let { G, ctx } = state;
  const { numPlayers } = ctx;
  const pluginAPIs = plugin.GetAPIs(state);
  const context = { ...pluginAPIs, G, ctx };
  const order = turn.order;

  let playOrder = Array.from({ length: numPlayers }).map((_, i) => i + '');
  if (order.playOrder !== undefined) {
    playOrder = order.playOrder(context);
  }
  playOrder = playOrder
    .map((playerID) => playerID + '')
    .filter((playerID) => !IsPlayerRemoved(ctx, playerID));

  let playOrderPos = order.first(context);
  const posType = typeof playOrderPos;
  if (posType !== 'number') {
    logging.error(
      `invalid value returned by turn.order.first — expected number got ${posType} “${playOrderPos}”.`,
    );
  }
  if (playOrder.length > 0 && playOrderPos > playOrder.length - 1) {
    playOrderPos = 0;
  }
  const currentPlayer = playOrder.length > 0 ? getCurrentPlayer(playOrder, playOrderPos) : '';

  ctx = { ...ctx, currentPlayer, playOrderPos, playOrder };
  ctx = SetActivePlayers(ctx, turn.activePlayers || {});

  return ctx;
}

/* Called at the end of each turn to update the turn order state.
   currentPlayer: who held the turn; turn: the phase's turn config; endTurnArg: an optional argument to endTurn that
   may name the next player ({ next }) or take the current one out of the play order ({ remove }). */
export function UpdateTurnOrderState(state, currentPlayer, turn, endTurnArg) {
  const order = turn.order;

  let { G, ctx } = state;
  let playOrderPos = ctx.playOrderPos;
  let endPhase = false;

  if (endTurnArg && endTurnArg !== true) {
    if (typeof endTurnArg !== 'object') {
      logging.error(`invalid argument to endTurn: ${endTurnArg}`);
    }

    Object.keys(endTurnArg).forEach((arg) => {
      switch (arg) {
        case 'remove': {
          currentPlayer = getCurrentPlayer(ctx.playOrder, playOrderPos);
          break;
        }
        case 'next': {
          playOrderPos = ctx.playOrder.indexOf(endTurnArg.next);
          currentPlayer = endTurnArg.next;
          break;
        }
        default: {
          logging.error(`invalid argument to endTurn: ${arg}`);
        }
      }
    });
  } else {
    const pluginAPIs = plugin.GetAPIs(state);
    const context = { ...pluginAPIs, G, ctx };
    const t = order.next(context);
    const type = typeof t;
    if (t !== undefined && type !== 'number') {
      logging.error(
        `invalid value returned by turn.order.next — expected number or undefined got ${type} “${t}”.`,
      );
    }

    if (t === undefined) {
      endPhase = true;
    } else {
      playOrderPos = t;
      currentPlayer = getCurrentPlayer(ctx.playOrder, playOrderPos);
    }
  }

  ctx = {
    ...ctx,
    playOrderPos,
    currentPlayer,
  };

  return { endPhase, ctx };
}

/* Set of different turn orders possible in a phase. These are meant to be passed to the `turn` setting in the flow
   objects.

   Each object defines the first player when the phase / game begins, and also a function `next` to determine who the
   next player is when the turn ends.

   The phase ends if next() returns undefined. */
export const TurnOrder = {
  /* DEFAULT: the default round-robin turn order. */
  DEFAULT: {
    first: ({ ctx }) => (ctx.turn === 0 ? ctx.playOrderPos : (ctx.playOrderPos + 1) % ctx.playOrder.length),
    next: ({ ctx }) => (ctx.playOrderPos + 1) % ctx.playOrder.length,
  },

  /* RESET: similar to DEFAULT, but starts from 0 each time. */
  RESET: {
    first: () => 0,
    next: ({ ctx }) => (ctx.playOrderPos + 1) % ctx.playOrder.length,
  },

  /* CONTINUE: similar to DEFAULT, but starts with the player who ended the last phase. */
  CONTINUE: {
    first: ({ ctx }) => ctx.playOrderPos,
    next: ({ ctx }) => (ctx.playOrderPos + 1) % ctx.playOrder.length,
  },

  /* ONCE: another round-robin turn order, but goes around just once. The phase ends after all players have played. */
  ONCE: {
    first: () => 0,
    next: ({ ctx }) => {
      if (ctx.playOrderPos < ctx.playOrder.length - 1) {
        return ctx.playOrderPos + 1;
      }
    },
  },

  /* CUSTOM: identical to DEFAULT, but also sets playOrder at the beginning of the phase.
     playOrder: the play order, an array of player IDs. */
  CUSTOM: (playOrder) => ({
    playOrder: () => playOrder,
    first: () => 0,
    next: ({ ctx }) => (ctx.playOrderPos + 1) % ctx.playOrder.length,
  }),

  /* CUSTOM_FROM: identical to DEFAULT, but also sets playOrder at the beginning of the phase to a value specified by
     a field in G. playOrderField: the field in G. */
  CUSTOM_FROM: (playOrderField) => ({
    playOrder: ({ G }) => G[playOrderField],
    first: () => 0,
    next: ({ ctx }) => (ctx.playOrderPos + 1) % ctx.playOrder.length,
  }),
};

export const Stage = {
  NULL: null,
};

export const ActivePlayers = {
  /* ALL: the turn stays with one player, but any player can play (in any order) until the phase ends. */
  ALL: { all: Stage.NULL },

  /* ALL_ONCE: the turn stays with one player, but any player can play (once, and in any order). This is typically
     used in a phase where you want to elicit a response from every player in the game. */
  ALL_ONCE: { all: Stage.NULL, minMoves: 1, maxMoves: 1 },

  /* OTHERS: the turn stays with one player, and every *other* player can play (in any order) until the phase ends. */
  OTHERS: { others: Stage.NULL },

  /* OTHERS_ONCE: the turn stays with one player, and every *other* player can play (once, and in any order). This is
     typically used in a phase where you want to elicit a response from every *other* player in the game. */
  OTHERS_ONCE: { others: Stage.NULL, minMoves: 1, maxMoves: 1 },
};
