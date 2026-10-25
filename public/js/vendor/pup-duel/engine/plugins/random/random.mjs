/* random.mjs: the Random API (dice, numbers, shuffles) a move or hook gets as `random`, drawing from a seeded PRNG
   whose state lives in the game state, so the same log always rolls the same dice.
   Ported from boardgame.io src/plugins/random/random.ts at 5e9a2c9 (MIT, Copyright (c) 2017 The boardgame.io Authors;
   the licence is ../../LICENSE). Changed: types removed. */

import { alea } from './random.alea.mjs';

/* Random: calls that require a pseudorandom number generator. Uses a seed from the plugin state ({ seed,
   prngstate? }), and also persists the PRNG state there so that moves can stay pure. */
export class Random {
  /* Generates a new seed from the current date / time. */
  static seed() {
    return Date.now().toString(36).slice(-10);
  }

  /* state: the plugin's state to initialize from. */
  constructor(state) {
    // If we are on the client, the seed is not present.
    // Just use a temporary seed to execute the move without
    // crashing it. The move state itself is discarded,
    // so the actual value doesn't matter.
    this.state = state || { seed: '0' };
    this.used = false;
  }

  isUsed() {
    return this.used;
  }

  getState() {
    return this.state;
  }

  /* Generate a random number. */
  _random() {
    this.used = true;

    const R = this.state;

    const seed = R.prngstate ? '' : R.seed;
    const rand = alea(seed, R.prngstate);

    const number = rand();

    this.state = {
      ...R,
      prngstate: rand.state(),
    };

    return number;
  }

  api() {
    const random = this._random.bind(this);

    const SpotValue = {
      D4: 4,
      D6: 6,
      D8: 8,
      D10: 10,
      D12: 12,
      D20: 20,
    };

    // Generate functions for predefined dice values D4 - D20.
    const predefined = {};
    for (const key in SpotValue) {
      const spotvalue = SpotValue[key];
      predefined[key] = (diceCount) => {
        return diceCount === undefined
          ? Math.floor(random() * spotvalue) + 1
          : Array.from({ length: diceCount }).map(() => Math.floor(random() * spotvalue) + 1);
      };
    }

    function Die(spotvalue = 6, diceCount) {
      return diceCount === undefined
        ? Math.floor(random() * spotvalue) + 1
        : Array.from({ length: diceCount }).map(() => Math.floor(random() * spotvalue) + 1);
    }

    return {
      /* Similar to Die below, but with fixed spot values. Supports passing a diceCount: if not defined, defaults to 1
         and returns the value directly; if defined, returns an array containing the random dice values.

         D4: (diceCount) => value
         D6: (diceCount) => value
         D8: (diceCount) => value
         D10: (diceCount) => value
         D12: (diceCount) => value
         D20: (diceCount) => value */
      ...predefined,

      /* Roll a die of specified spot value (default 6). diceCount: the number of dice to throw; if not defined,
         defaults to 1 and returns the value directly, if defined, returns an array containing the random dice values. */
      Die,

      /* Generate a random number between 0 and 1. */
      Number: () => {
        return random();
      },

      /* Shuffle an array. Does not mutate the input, but returns the shuffled array. */
      Shuffle: (deck) => {
        const clone = [...deck];
        let sourceIndex = deck.length;
        let destinationIndex = 0;
        const shuffled = Array.from({ length: sourceIndex });

        while (sourceIndex) {
          const randomIndex = Math.trunc(sourceIndex * random());
          shuffled[destinationIndex++] = clone[randomIndex];
          clone[randomIndex] = clone[--sourceIndex];
        }

        return shuffled;
      },

      _private: this,
    };
  }
}
