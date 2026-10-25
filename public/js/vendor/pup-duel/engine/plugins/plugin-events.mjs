/* plugin-events.mjs: gives moves and hooks `events`, tells it which game function is calling, and applies the queued
   events (or declares the action invalid) when the plugins flush.
   Ported from boardgame.io src/plugins/plugin-events.ts at 5e9a2c9 (MIT, Copyright (c) 2017 The boardgame.io Authors;
   the licence is ../LICENSE). Changed: types removed (with them the EventsAPI type export). */

import { Events } from './events/events.mjs';

const EventsPlugin = {
  name: 'events',

  noClient: ({ api }) => api._private.isUsed(),

  isInvalid: ({ data }) => data.error || false,

  // Update the events plugin’s internal turn context each time a move
  // or hook is called. This allows events called after turn or phase
  // endings to dispatch the current turn and phase correctly.
  fnWrap:
    (method, methodType) =>
    (context, ...args) => {
      const api = context.events;
      if (api) api._private.updateTurnContext(context.ctx, methodType);
      const G = method(context, ...args);
      if (api) api._private.unsetCurrentMethod();
      return G;
    },

  dangerouslyFlushRawState: ({ state, api }) => api._private.update(state),

  api: ({ game, ctx, playerID }) => new Events(game.flow, ctx, playerID).api(),
};

export default EventsPlugin;
