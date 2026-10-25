/* plugin-random.mjs: gives moves and hooks `random`, seeded from game.seed, its PRNG state flushed into
   plugins.random.data after each action (and hidden from players by playerView).
   Ported from boardgame.io src/plugins/plugin-random.ts at 5e9a2c9 (MIT, Copyright (c) 2017 The boardgame.io Authors;
   the licence is ../LICENSE). Changed: types removed. */

import { Random } from './random/random.mjs';

const RandomPlugin = {
  name: 'random',

  noClient: ({ api }) => {
    return api._private.isUsed();
  },

  flush: ({ api }) => {
    return api._private.getState();
  },

  api: ({ data }) => {
    const random = new Random(data);
    return random.api();
  },

  setup: ({ game }) => {
    let { seed } = game;
    if (seed === undefined) {
      seed = Random.seed();
    }
    return { seed };
  },

  playerView: () => undefined,
};

export default RandomPlugin;
