/* plugin-log.mjs: gives moves and hooks `log.setMetadata(x)`, which lands on the action's log entry.
   Ported from boardgame.io src/plugins/plugin-log.ts at 5e9a2c9 (MIT, Copyright (c) 2017 The boardgame.io Authors;
   the licence is ../LICENSE). Changed: types removed. */

/* Plugin that makes it possible to add metadata to log entries. Metadata set during a move, or during hooks
   triggered by a directly dispatched game event, is attached to that action's log entry. */
const LogPlugin = {
  name: 'log',

  flush: () => ({}),

  api: ({ data }) => {
    return {
      setMetadata: (metadata) => {
        data.metadata = metadata;
      },
    };
  },

  setup: () => ({}),
};

export default LogPlugin;
