// moves.mjs — signature moves: what a chosen wardrobe piece lets its dog do (founder 2026-10-25: "more features for
// certain accessories to have unique dances or actions or effects"; plan: packages/pup-duel/docs/signature-moves-plan.md).
// Part of the dog kit (docs/doberman/README.md).
//
// MOVES   one-shot dances, each the shape of an expression's burst (expressions.mjs): channel keyframes over the move
//         (act), hops ([start, end] in ms), an optional whole-turn spin, and up to three accents from rig.mjs ACCENT,
//         plus its length (dur, 800 to 3000 ms). rig.perform plays one over whatever the dog feels, the same way a tap
//         plays a burst, so nothing about the frame loop changes. A message names a move; it never carries code.
//         Hops are at half height (hopK), never ride a spin and never come with the chest out (it lifts the head too), and none is longer than about half a second: a tall piece (the balloon) stays in
//         the frame through every move on every dog (scripts/doberman/fit-audit.mjs SIG=1).
// AURA    the slow ambient accent a legendary piece keeps up while worn: one element, a long period, so it reads as
//         a shimmer, never as noise.
// PARTS   an item's own moving shapes (<g data-fx="name">), driven by the loop's clock (so they pause with it, show in a
//         GIF and a still, and hold under reduced motion): one transform per part per frame, nothing else.

export var MOVES = {
  spellcast: { name: 'Spellcast', dur: 1800,
    act: { joy: [[0, 1], [1800, 1]], brows: [[0, 0.8], [1800, 0.8]], tilt: [[0, 0], [400, -8], [900, 8], [1400, 0], [1800, 0]], pupil: [[0, 1], [600, 0.65], [1800, 0.65]] },
    hops: [[900, 1150]], hopK: 0.5, accents: [['sparkle', 300], ['sparkle', 700], ['glint', 1000]] },
  royalwave: { name: 'Royal nod', dur: 2000,
    act: { tilt: [[0, 0], [500, -11], [1500, -11], [2000, 0]], lidRest: [[0, 0.4], [2000, 0.4]], chest: [[0, 1], [2000, 1]], cheek: [[0, 0.5], [2000, 0.5]] },
    hops: [], accents: [['glint', 200], ['sparkle', 600], ['glint', 1200]] },
  liftoff: { name: 'Lift-off', dur: 1600,
    act: { shake: [[0, 0.6], [400, 0], [1600, 0]], joy: [[0, 1], [1600, 1]], earBack: [[0, 0.8], [1600, 0.8]] },
    hops: [[150, 700], [800, 1350]], hopK: 0.5, accents: [['puff', 120], ['puff', 780], ['sparkle', 1300]] },
  glide: { name: 'Glide', dur: 2400,
    act: { joy: [[0, 1], [2400, 1]], earBack: [[0, 1], [2400, 1]] },
    spin: [[0, 0], [300, 0], [1500, 1], [2400, 1]], hops: [[1550, 1850]], hopK: 0.5, accents: [['sparkle', 400], ['sparkle', 1100]] },
  dealwithit: { name: 'Deal with it', dur: 1400,
    act: { tilt: [[0, 0], [300, -12], [1100, -12], [1400, 0]], mouthTilt: [[0, 0], [300, -10], [1100, -10], [1400, 0]], browTilt: [[0, 0.5], [1400, 0.5]] },
    hops: [], accents: [['glint', 350]] },
  iced: { name: 'Ice spin', dur: 1800,
    act: { joy: [[0, 1], [1800, 1]], cheek: [[0, 0.6], [1800, 0.6]] },
    spin: [[0, 0], [200, 0], [900, 1], [1800, 1]], hops: [[950, 1250]], hopK: 0.5, accents: [['glint', 900], ['glint', 1150], ['sparkle', 1400]] },
  shred: { name: 'Shred', dur: 2200,
    act: { dance: [[0, 1], [2200, 1]], step: [[0, 1], [2200, 1]], joy: [[0, 1], [2200, 1]], mouth: [[0, 0.6], [2200, 0.6]] },
    hops: [], accents: [['note', 200], ['note', 900], ['note', 1600]] },
  llamarama: { name: 'Llama-rama', dur: 1800,
    act: { joy: [[0, 1], [1800, 1]], tongue: [[0, 0.8], [1800, 0.8]] },
    hops: [[100, 350], [500, 750], [900, 1150]], hopK: 0.5, accents: [['note', 150], ['heart', 1100]] },
  heroland: { name: 'Hero landing', dur: 1600,
    act: { brows: [[0, 0.6], [1600, 0.6]], earBack: [[0, 0.5], [1600, 0.5]] },
    hops: [[100, 520]], hopK: 0.5, accents: [['puff', 540], ['sparkle', 620]] },
  bearhug: { name: 'Bear hug', dur: 1800,
    act: { blush: [[0, 1], [1800, 1]], cheek: [[0, 1], [1800, 1]], wiggle: [[0, 0], [300, 1], [1500, 1], [1800, 0]], heartEyes: [[0, 0], [400, 1], [1500, 1], [1800, 0]] },
    hops: [], accents: [['heart', 200], ['heart', 700], ['heart', 1200]] },
  drift: { name: 'Float', dur: 2600,
    act: { joy: [[0, 1], [2600, 1]], lookY: [[0, 0], [600, -3], [2000, -3], [2600, 0]] },
    hops: [[200, 700], [900, 1400]], hopK: 0.5, accents: [['heart', 1500]] }
};
// the aura types a piece may keep up, and their period (ms): slower than any expression's loop
export var AURA = { glint: 5200, sparkle: 6400, heart: 7000 };

// item parts: a pure function of the loop's clock to one transform (about the part's own box centre)
export var PARTS = {
  flicker: function (t) { var k = 0.86 + 0.14 * Math.abs(Math.sin(t / 37) * Math.cos(t / 53)); return 'scale(1 ' + k.toFixed(3) + ')'; },
  bob: function (t) { return 'translate(0 ' + (1.6 * Math.sin(t / 520)).toFixed(2) + ')'; },
  sway: function (t) { return 'rotate(' + (4 * Math.sin(t / 700)).toFixed(2) + ')'; }
};
PARTS.flicker.at = 'top';   // a flame grows from its nozzle
PARTS.sway.at = 'br';       // a balloon swings from where its string is held
export var LIMITS = { accents: 3, parts: 2, minDur: 800, maxDur: 3000 };
// the moment a held still shows (reduced motion): after a spin has come round, else half way, inside the full blend
export function peakOf(mv) {
  var at = mv.spin ? mv.spin[mv.spin.length - 2][0] : mv.dur / 2;
  return Math.max(150, Math.min(at, mv.dur - 600));
}
