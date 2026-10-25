/* player-view.mjs: a ready-made game.playerView that hides secrets from the players who should not see them.
   Ported from boardgame.io src/core/player-view.ts at 5e9a2c9 (MIT, Copyright (c) 2017 The boardgame.io Authors; the
   licence is ../LICENSE). Changed: types removed. */

/* PlayerView reducers. */
export const PlayerView = {
  /* STRIP_SECRETS: reducer which removes a key named `secret` and removes all the keys in `players`, except for the
     one corresponding to the current playerID. */
  STRIP_SECRETS: ({ G, playerID }) => {
    const r = { ...G };

    if (r.secret !== undefined) {
      delete r.secret;
    }

    if (r.players) {
      r.players = playerID
        ? {
            [playerID]: r.players[playerID],
          }
        : {};
    }

    return r;
  },
};
