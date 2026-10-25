/* events.mjs: the events API a move or hook gets as `events` (endTurn, endPhase, setStage, ...): calls are queued
   while the game function runs and applied to the state when the plugins flush, unless the call came from a place
   that may not make it.
   Ported from boardgame.io src/plugins/events/events.ts at 5e9a2c9 (MIT, Copyright (c) 2017 The boardgame.io Authors;
   the licence is ../../LICENSE). Changed: types removed; the Errors enum is a plain object. */

import { automaticGameEvent } from '../../core/action-creators.mjs';
import { GameMethod } from '../../core/game-methods.mjs';

const Errors = {
  CalledOutsideHook:
    'Events must be called from moves or the `onBegin`, `onEnd`, and `onMove` hooks.\n' +
    'This error probably means you called an event from other game code, like an `endIf` trigger or one of the `turn.order` methods.',

  EndTurnInOnEnd: '`endTurn` & `pass` are disallowed in `onEnd` hooks — the turn is already ending.',

  TurnEventInPhaseBegin:
    '`endTurn` & `pass` are disallowed in a phase’s `onBegin` hook — no turn has started yet.\n' +
    'Use `turn.order.first` to choose the starting player.',

  MaxTurnEndings:
    'Maximum number of turn endings exceeded for this update.\n' +
    'This likely means game code is triggering an infinite loop.',

  PhaseEventInOnEnd:
    '`setPhase` & `endPhase` are disallowed in a phase’s `onEnd` hook — the phase is already ending.\n' +
    'If you’re trying to dynamically choose the next phase when a phase ends, use the phase’s `next` trigger.',

  StageEventInOnEnd: '`setStage`, `endStage` & `setActivePlayers` are disallowed in `onEnd` hooks.',

  StageEventInPhaseBegin:
    '`setStage`, `endStage` & `setActivePlayers` are disallowed in a phase’s `onBegin` hook.\n' +
    'Use `setActivePlayers` in a `turn.onBegin` hook or declare stages with `turn.activePlayers` instead.',

  StageEventInTurnBegin:
    '`setStage` & `endStage` are disallowed in `turn.onBegin`.\n' +
    'Use `setActivePlayers` or declare stages with `turn.activePlayers` instead.',
};

/* Events: one per action. api() holds one function per flow event (flow.eventNames: endStage, setStage, endTurn,
   pass, endPhase, setPhase, endGame, setActivePlayers, removePlayer), plus _private, this object. */
export class Events {
  constructor(flow, ctx, playerID) {
    this.flow = flow;
    this.playerID = playerID;
    this.dispatch = [];
    this.initialTurn = ctx.turn;
    this.updateTurnContext(ctx, undefined);
    // This is an arbitrarily large upper threshold, which could be made
    // configurable via a game option if the need arises.
    this.maxEndedTurnsPerAction = ctx.numPlayers * 100;
  }

  api() {
    const events = {
      _private: this,
    };
    for (const type of this.flow.eventNames) {
      events[type] = (...args) => {
        this.dispatch.push({
          type,
          args,
          phase: this.currentPhase,
          turn: this.currentTurn,
          calledFrom: this.currentMethod,
          // Used to capture a stack trace in case it is needed later.
          error: new Error('Events Plugin Error'),
        });
      };
    }

    return events;
  }

  isUsed() {
    return this.dispatch.length > 0;
  }

  updateTurnContext(ctx, methodType) {
    this.currentPhase = ctx.phase;
    this.currentTurn = ctx.turn;
    this.currentMethod = methodType;
  }

  unsetCurrentMethod() {
    this.currentMethod = undefined;
  }

  /* Updates ctx with the triggered events. state: the state object { G, ctx, ... }. */
  update(state) {
    const initialState = state;
    const stateWithError = ({ stack }, message) => ({
      ...initialState,
      plugins: {
        ...initialState.plugins,
        events: {
          ...initialState.plugins.events,
          data: { error: message + '\n' + stack },
        },
      },
    });

    EventQueue: for (let i = 0; i < this.dispatch.length; i++) {
      const event = this.dispatch[i];
      const turnHasEnded = event.turn !== state.ctx.turn;

      // This protects against potential infinite loops if specific events are called on hooks.
      // The moment we exceed the defined threshold, we just bail out of all phases.
      const endedTurns = this.currentTurn - this.initialTurn;
      if (endedTurns >= this.maxEndedTurnsPerAction) {
        return stateWithError(event.error, Errors.MaxTurnEndings);
      }

      if (event.calledFrom === undefined) {
        return stateWithError(event.error, Errors.CalledOutsideHook);
      }

      // Stop processing events once the game has finished.
      if (state.ctx.gameover) break EventQueue;

      switch (event.type) {
        case 'endStage':
        case 'setStage':
        case 'setActivePlayers': {
          switch (event.calledFrom) {
            // Disallow all stage events in onEnd and phase.onBegin hooks.
            case GameMethod.TURN_ON_END:
            case GameMethod.PHASE_ON_END: {
              return stateWithError(event.error, Errors.StageEventInOnEnd);
            }
            case GameMethod.PHASE_ON_BEGIN: {
              return stateWithError(event.error, Errors.StageEventInPhaseBegin);
            }
            // Disallow setStage & endStage in turn.onBegin hooks.
            case GameMethod.TURN_ON_BEGIN: {
              if (event.type === 'setActivePlayers') break;
              return stateWithError(event.error, Errors.StageEventInTurnBegin);
            }
          }

          // If the turn already ended, don't try to process stage events.
          if (turnHasEnded) continue EventQueue;
          break;
        }

        case 'endTurn':
        case 'pass': {
          if (event.calledFrom === GameMethod.PHASE_ON_BEGIN) {
            return stateWithError(event.error, Errors.TurnEventInPhaseBegin);
          }

          if (event.calledFrom === GameMethod.TURN_ON_END || event.calledFrom === GameMethod.PHASE_ON_END) {
            return stateWithError(event.error, Errors.EndTurnInOnEnd);
          }

          // If the turn already ended some other way,
          // don't try to end the turn again.
          if (turnHasEnded) continue EventQueue;
          break;
        }

        case 'endPhase':
        case 'setPhase': {
          if (event.calledFrom === GameMethod.PHASE_ON_END) {
            return stateWithError(event.error, Errors.PhaseEventInOnEnd);
          }

          // If the phase already ended some other way,
          // don't try to end the phase again.
          if (event.phase !== state.ctx.phase) continue EventQueue;
          break;
        }
      }

      const action = automaticGameEvent(event.type, event.args, this.playerID);
      state = this.flow.processEvent(state, action);
    }
    return state;
  }
}
