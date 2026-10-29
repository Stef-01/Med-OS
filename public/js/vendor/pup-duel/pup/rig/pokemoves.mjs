// pokemoves.mjs — the Eevee family's own moves (founder 2026-10-29: "pokemon characters are missing impressive
// incredible animations and effects and pokemon moves, 5 creative ones each that model what the video games have").
// Part of the dog kit (docs/doberman/README.md), beside moves.mjs.
//
// POKEMOVES  one-shot moves, each a signature move's shape (moves.mjs: channel keyframes, hops, an optional whole-turn
//            spin, up to three rig accents, 1.2 to 2.5 s) plus `fx`: the move's effect, drawn on its own layers.
//            They are a dog's own, not a piece's: MOVESET says whose (five each), movesFor(dogId) lists them.
// FX         an effect is data: particles, each one SVG shape (flat kit style: a fill and its darker underside) with
//            keyframes [ms, x, y, scale, opacity, rotate?, scaleY?] in the dog's own units (head near (0,-35), the
//            floor at y 68, +x the dog's front; a mirrored dog mirrors its effect). A particle may be copied (n) with
//            a per-copy delay (dt), offset (dx, dy), turn about its origin (dr, at) and jitter (jx, jy); `orb` turns it
//            about `at` over time (deg/ms); `back` draws it behind the dog. Only transform and opacity move, so it
//            stays composited; a held still (reduced motion) shows the move at its `peak`, a static flourish.
//            sample() is the one function of time the rig calls (rig.mjs perform/frame); scripts test it bare.

// the duel's frame (the embed) runs x -148 to 112 and y -169 to 90 in the dog's units: a shape may fade out past it,
// never sit there while solid (packages/pup-duel/test/pokemoves.test.mjs)
export var FX_LIMITS = { particles: 48, keys: 8, x: [-140, 140], y: [-175, 100] };

// ---- shapes (centred on 0,0, about 10 across unless said) ----
var S = {
  star: function (c, d) { return '<path d="M0 -9 L2.6 -3 L9 -2.8 L4 1.6 L5.6 8 L0 4.6 L-5.6 8 L-4 1.6 L-9 -2.8 L-2.6 -3 Z" fill="' + d + '" transform="translate(0.8 1.2)"/><path d="M0 -9 L2.6 -3 L9 -2.8 L4 1.6 L5.6 8 L0 4.6 L-5.6 8 L-4 1.6 L-9 -2.8 L-2.6 -3 Z" fill="' + c + '"/>'; },
  drop: function (c, d) { return '<path d="M0 -8 C3 -3 6 0 6 3.5 A6 6 0 0 1 -6 3.5 C-6 0 -3 -3 0 -8 Z" fill="' + d + '"/><path d="M0 -8 C3 -3 5 0 5 3 A5 5 0 0 1 -5 3 C-5 0 -3 -3 0 -8 Z" fill="' + c + '"/><circle cx="-1.8" cy="2.4" r="1.4" fill="#fff" opacity=".8"/>'; },
  bubble: function (c) { return '<circle r="6" fill="' + c + '" fill-opacity=".35" stroke="' + c + '" stroke-width="1.6"/><circle cx="-2.2" cy="-2.2" r="1.6" fill="#fff"/>'; },
  bolt: function (c, d) { return '<path d="M-2 -12 L6 -12 L1 -2 L7 -2 L-5 13 L-1 1 L-6 1 Z" fill="' + d + '" transform="translate(1 1)"/><path d="M-2 -12 L6 -12 L1 -2 L7 -2 L-5 13 L-1 1 L-6 1 Z" fill="' + c + '"/>'; },
  flame: function (c, d, h) { return '<path d="M0 -12 C5 -6 8 -1 8 3 A8 8 0 0 1 -8 3 C-8 -2 -4 -4 -3 -9 C-1 -6 0 -6 0 -12 Z" fill="' + d + '"/><path d="M0 -6 C3 -2 5 1 5 4 A5 5 0 0 1 -5 4 C-5 1 -2 -1 0 -6 Z" fill="' + c + '"/><path d="M0 0 C1.5 2 2.5 3 2.5 4.5 A2.5 2.5 0 0 1 -2.5 4.5 C-2.5 3 -1 2 0 0 Z" fill="' + h + '"/>'; },
  leaf: function (c, v) { return '<path d="M-10 0 C-5 -7 5 -7 10 0 C5 7 -5 7 -10 0 Z" fill="' + c + '"/><path d="M-9 0 H8" stroke="' + v + '" stroke-width="1.4" stroke-linecap="round"/>'; },
  shard: function (c, d, l) { return '<path d="M0 -12 L5 0 L0 12 L-5 0 Z" fill="' + c + '"/><path d="M0 -12 L5 0 L0 12 Z" fill="' + d + '"/><path d="M-1.5 -6 L0 -9 L1 -5 Z" fill="' + l + '"/>'; },
  flake: function (c) { return '<g stroke="' + c + '" stroke-width="2" stroke-linecap="round"><path d="M0 -8 V8 M-7 -4 L7 4 M-7 4 L7 -4"/><path d="M-2 -6 L0 -4 L2 -6 M-2 6 L0 4 L2 6" fill="none"/></g>'; },
  heart: function (c, d) { return '<path d="M0 8 C-9 2 -9 -6 -4.5 -6.5 C-2 -6.8 0 -4.5 0 -3 C0 -4.5 2 -6.8 4.5 -6.5 C9 -6 9 2 0 8 Z" fill="' + d + '" transform="translate(0.8 1)"/><path d="M0 8 C-9 2 -9 -6 -4.5 -6.5 C-2 -6.8 0 -4.5 0 -3 C0 -4.5 2 -6.8 4.5 -6.5 C9 -6 9 2 0 8 Z" fill="' + c + '"/>'; },
  // rings keep their line as they grow (a ring scaled 15 times would be a 40-unit band): the stroke does not scale
  ring: function (c, w) { return '<circle r="10" fill="none" stroke="' + c + '" stroke-width="' + 1.6 * (w || 2.4) + '" vector-effect="non-scaling-stroke"/>'; },
  ellring: function (c, w) { return '<ellipse rx="12" ry="4" fill="none" stroke="' + c + '" stroke-width="' + 1.6 * (w || 2) + '" vector-effect="non-scaling-stroke"/>'; },
  disc: function (c) { return '<circle r="10" fill="' + c + '"/>'; },
  glow: function (c, a) { a = a || 0.35; return '<circle r="10" fill="' + c + '" fill-opacity="' + (a * 0.35).toFixed(2) + '"/><circle r="7.5" fill="' + c + '" fill-opacity="' + (a * 0.45).toFixed(2) + '"/><circle r="4.5" fill="' + c + '" fill-opacity="' + (a * 0.7).toFixed(2) + '"/>'; },
  beam: function (c, d, l) { return '<rect x="0" y="-6" width="100" height="12" rx="6" fill="' + d + '"/><rect x="0" y="-4" width="100" height="8" rx="4" fill="' + c + '"/><rect x="0" y="-1.2" width="100" height="2.4" rx="1.2" fill="' + l + '"/>'; },
  spark: function (c) { return '<rect x="-1.4" y="-6" width="2.8" height="12" rx="1.4" fill="' + c + '"/><rect x="-6" y="-1.4" width="12" height="2.8" rx="1.4" fill="' + c + '"/>'; },
  streak: function (c) { return '<rect x="-14" y="-1.4" width="28" height="2.8" rx="1.4" fill="' + c + '"/>'; },
  pin: function (c, d) { return '<path d="M-10 -1.6 L8 -1.6 L12 0 L8 1.6 L-10 1.6 Z" fill="' + c + '"/><path d="M-10 0 L12 0 L8 1.6 L-10 1.6 Z" fill="' + d + '"/>'; },
  moon: function (c, d) { return '<path d="M3 -9 A9 9 0 1 0 3 9 A12 12 0 0 1 3 -9 Z" fill="' + d + '" transform="translate(0.8 0.8)"/><path d="M3 -9 A9 9 0 1 0 3 9 A7 7 0 1 1 3 -9 Z" fill="' + c + '"/>'; },
  sun: function (c, d) { var r = ''; for (var i = 0; i < 8; i++) r += '<rect x="-1.8" y="-17" width="3.6" height="6" rx="1.8" fill="' + d + '" transform="rotate(' + i * 45 + ')"/>'; return r + '<circle r="9" fill="' + d + '"/><circle r="7.4" fill="' + c + '"/>'; },
  orb: function (c, d) { return '<circle r="9" fill="' + d + '"/><circle r="6.5" fill="' + c + '"/><circle cx="-2.4" cy="-2.4" r="1.8" fill="#fff" opacity=".5"/>'; },
  cloud: function (c, d) { return '<g fill="' + d + '"><circle cx="-7" cy="1.5" r="6"/><circle cx="0" cy="-1.5" r="8"/><circle cx="8" cy="1.5" r="6"/></g><g fill="' + c + '"><circle cx="-7" cy="0" r="6"/><circle cx="0" cy="-3" r="8"/><circle cx="8" cy="0" r="6"/></g>'; },
  eye: function (c, d) { return '<path d="M-12 0 Q0 -10 12 0 Q0 10 -12 0 Z" fill="' + d + '"/><circle r="4.4" fill="' + c + '"/><circle r="2" fill="' + d + '"/>'; },
  petal: function (c, d) { return '<path d="M0 -7 C5 -4 5 4 0 7 C-5 4 -5 -4 0 -7 Z" fill="' + c + '"/><path d="M0 -7 C5 -4 5 4 0 7 Z" fill="' + d + '"/>'; },
  bow: function (c, d) { return '<path d="M0 0 L-10 -7 L-10 7 Z M0 0 L10 -7 L10 7 Z" fill="' + c + '"/><circle r="3.4" fill="' + d + '"/>'; },
  slash: function (c) { return '<path d="M-14 6 Q0 -10 14 -6 Q0 -4 -14 6 Z" fill="' + c + '"/>'; },
  claw: function (c) { return '<g stroke="' + c + '" stroke-width="3" stroke-linecap="round" fill="none"><path d="M-8 -10 L4 10"/><path d="M-2 -12 L10 8"/><path d="M4 -14 L16 6"/></g>'; },
  wave: function (c) { return '<path d="M-12 0 Q-6 -6 0 0 T12 0" fill="none" stroke="' + c + '" stroke-width="3" stroke-linecap="round"/>'; }
};

// ---- the family's colours (each a fill, its underside, a light) ----
var C = {
  water: ['#4fb8f2', '#2a86c8', '#d8f2ff'], elec: ['#ffd83a', '#e0a400', '#fffbe0'], fire: ['#ff7a2e', '#e2401c', '#ffe066'],
  psy: ['#f06ad8', '#a33fb8', '#ffe0f8'], dark: ['#4a3d66', '#241b38', '#f5c93a'], grass: ['#8cd03e', '#4f9a1e', '#e8ffcf'],
  ice: ['#aee8ff', '#5aaee0', '#ffffff'], fairy: ['#ff9ccc', '#e2609e', '#fff0f7'], normal: ['#f4d6a2', '#c89a5a', '#ffffff']
};

// the effects read at a glance on a phone: every thrown or flung shape is half again its drawn size
var BIG = 1.5;

// ---- particle builders (the moves below are written with these; all produce plain data) ----
// one projectile or a stream of n from a to b
function shot(svg, a, b, t0, t1, o) {
  o = o || {};
  var s = (o.s || 1) * BIG, k = [[t0, a[0], a[1], s * 0.6, 0, o.r0 || 0], [t0 + 60, a[0], a[1], s, 1, o.r0 || 0], [t1 - 80, b[0], b[1], s, 1, o.r1 || 0], [t1, b[0], b[1], s * 1.6, 0, o.r1 || 0]];
  return { svg: svg, k: k, n: o.n || 1, dt: o.dt || 0, dx: o.dx || 0, dy: o.dy || 0, jx: o.jx || 0, jy: o.jy || 0, ease: o.ease || 'lin', back: !!o.back };
}
// n copies flung out from `at` to radius R, turned evenly
function burst(svg, at, n, R, t0, t1, o) {
  o = o || {};
  var s = (o.s || 1) * BIG;
  return { svg: svg, at: at, dr: 360 / n, n: n, dt: o.dt || 0, k: [[t0, at[0] + (o.r0 || 4), at[1], s * 0.4, 0], [t0 + 80, at[0] + (o.r0 || 4) + R * 0.2, at[1], s, 1, o.spin ? 0 : 0], [t1, at[0] + R, at[1], s * (o.s1 || 0.5), 0, o.spin || 0]], ease: 'out', back: !!o.back };
}
// a ring growing from `at`
function ring(svg, at, t0, t1, s0, s1, o) {
  o = o || {};
  return { svg: svg, n: o.n || 1, dt: o.dt || 0, k: [[t0, at[0], at[1], s0, 0, 0, o.sy0], [t0 + 90, at[0], at[1], s0 + (s1 - s0) * 0.15, o.op || 1, 0, o.sy0], [t1, at[0], at[1], s1, 0, 0, o.sy1]], ease: 'out', back: !!o.back };
}
// a fall (or rise) of n across [x0, x1]
function fall(svg, x0, x1, y0, y1, n, t0, each, gap, o) {
  o = o || {};
  var dx = n > 1 ? (x1 - x0) / (n - 1) : 0, s = (o.s || 1) * BIG;
  return { svg: svg, n: n, dt: gap, dx: dx, jx: o.jx || 6, jy: o.jy || 10, k: [[t0, x0 + (o.drift || 0) * -1, y0, s, 0, o.r || 0], [t0 + 80, x0 - (o.drift || 0) * 0.9, y0 + (y1 - y0) * 0.08, s, o.op || 1, o.r || 0], [t0 + each, x0 + (o.drift || 0), y1, s * (o.s1 || 1), 0, (o.r || 0) + (o.spin || 0)]], ease: o.ease || 'lin', back: !!o.back };
}
// n circling `at` at radius R
function orbit(svg, at, R, n, t0, t1, degPerMs, o) {
  o = o || {};
  var s = (o.s || 1) * BIG;
  return { svg: svg, at: at, n: n, dr: 360 / n, orb: degPerMs, k: [[t0, at[0] + R * (o.in || 1), at[1], s * 0.3, 0], [t0 + 200, at[0] + R, at[1], s, 1], [t1 - 200, at[0] + R, at[1], s, 1], [t1, at[0] + R * (o.out || 0.2), at[1], s * 0.3, 0]], ease: 'io', back: !!o.back };
}
// a beam from `a` out along +x, grown, held, then thinned away
function beam(svg, a, t0, t1, t2, len, o) {
  o = o || {};
  var r = o.r || 0, w = o.w || 1;
  return { svg: svg, k: [[t0, a[0], a[1], 0.02, 1, r, w * 0.6], [t1, a[0], a[1], len / 100, 1, r, w], [t2 - 160, a[0], a[1], len / 100, 1, r, w * 1.15], [t2, a[0], a[1], len / 100, 0, r, 0.05]], ease: 'out', back: !!o.back };
}
// a whole held shape (a sun, a cloud, a big eye): in, hold, out
function hold(svg, at, t0, t1, s, o) {
  o = o || {};
  return { svg: svg, n: o.n || 1, dx: o.dx || 0, dt: o.dt || 0, k: [[t0, at[0], at[1] + (o.rise || 0), s * 0.3, 0, o.r0 || 0], [t0 + 220, at[0], at[1], s * 1.08, o.op || 1, (o.r0 || 0) * 0.3], [t0 + 340, at[0], at[1], s, o.op || 1, 0], [t1 - 200, at[0], at[1], s, o.op || 1, o.r1 || 0], [t1, at[0], at[1] - (o.lift || 0), s * (o.s1 || 1.2), 0, o.r1 || 0]], ease: 'io', back: !!o.back };
}

// a move drawn at its own pace and played at another: every time in it (channels, hops, spin, accents, peak, the
// effect's keyframes and stagger) scaled to `dur`
function retime(mv, dur) {
  var k = dur / mv.dur, T = function (t) { return Math.round(t * k); }, keys = function (ks) { return ks.map(function (q) { return [T(q[0])].concat(q.slice(1)); }); };
  var out = { name: mv.name, type: mv.type, dur: dur, peak: T(mv.peak), act: {}, hops: mv.hops.map(function (h) { return [T(h[0]), T(h[1])]; }),
    accents: mv.accents.map(function (a) { return [a[0], T(a[1])]; }), fx: mv.fx.map(function (p) { var q = Object.assign({}, p, { k: keys(p.k) }); if (p.dt) q.dt = p.dt * k; return q; }) };
  Object.keys(mv.act).forEach(function (ch) { out.act[ch] = keys(mv.act[ch]); });
  if (mv.hopK) out.hopK = mv.hopK;
  if (mv.spin) out.spin = keys(mv.spin);
  return out;
}

var HEAD = [0, -36], MOUTH = [44, -10], FRONT = 30, CHEST = [0, 30], FEET = 66;
function A(c) { return C[c]; }
var W = A('water'), E = A('elec'), F = A('fire'), P = A('psy'), D = A('dark'), G = A('grass'), I = A('ice'), Y = A('fairy'), N = A('normal');

// ---- the moves ----
export var POKEMOVES = {
  // Eevee (Normal): speed, stars and charm
  quickattack: { name: 'Quick Attack', type: 'normal', dur: 1400, peak: 520,
    act: { joy: [[0, 1], [1400, 1]], earBack: [[0, 0.9], [1400, 0.9]], brows: [[0, 0.7], [1400, 0.7]] },
    hops: [[200, 560]], hopK: 0.5, accents: [['puff', 120], ['glint', 600]],
    fx: [fall(S.streak('#ffffff'), -90, -30, -60, -60, 6, 80, 380, 40, { jx: 2, jy: 30, s: 2, drift: 40, ease: 'out' }),
      fall(S.streak(N[1]), -100, -40, -10, -10, 5, 140, 380, 50, { jx: 2, jy: 40, s: 1.6, drift: 40, ease: 'out' }),
      burst(S.star('#ffd83a', '#e0a400'), [FRONT + 40, -20], 6, 40, 560, 1100, { s: 1.4, spin: 180 }),
      burst(S.spark('#ffffff'), [FRONT + 40, -20], 8, 46, 560, 980, { s: 1.6 }),
      ring(S.ring(N[1], 3), [FRONT + 40, -20], 540, 1000, 0.4, 3.4)] },
  swift: { name: 'Swift', type: 'normal', dur: 2200, peak: 1100,
    act: { joy: [[0, 1], [2200, 1]], tilt: [[0, 0], [400, -8], [1800, -8], [2200, 0]], pupil: [[0, 1], [500, 0.8], [2200, 0.8]] },
    hops: [], accents: [['sparkle', 200], ['sparkle', 1500]],
    fx: [orbit(S.star('#ffd83a', '#e0a400'), HEAD, 64, 6, 0, 1200, 0.42, { s: 1.4, out: 1 }),
      shot(S.star('#ffd83a', '#e0a400'), [40, -60], [96, -110], 1100, 1700, { n: 6, dt: 70, dy: 14, s: 1.4, r1: 360 }),
      burst(S.spark('#ffe066'), [96, -80], 6, 30, 1650, 2150, { s: 1 })] },
  tackle: { name: 'Tackle', type: 'normal', dur: 1300, peak: 640,
    act: { brows: [[0, 1], [1300, 1]], earBack: [[0, 1], [1300, 1]], tilt: [[0, 0], [300, 10], [600, -6], [1300, 0]], mouth: [[0, 0.8], [1300, 0.8]] },
    hops: [[260, 620]], hopK: 0.5, accents: [['puff', 640], ['ex', 700]],
    fx: [ring(S.disc('#ffffff'), [FRONT + 50, -10], 600, 820, 0.3, 2.2, { op: 0.9 }),
      burst(S.spark(N[1]), [FRONT + 50, -10], 8, 60, 610, 1050, { s: 1.4 }),
      burst(S.star('#ffd83a', '#e0a400'), [FRONT + 50, -10], 5, 40, 640, 1200, { s: 1, spin: 180 }),
      fall(S.cloud('#eef2f5', '#c3ccd5'), -60, 60, FEET, FEET - 20, 3, 560, 600, 40, { s: 1.2, s1: 1.6, jy: 2 })] },
  lastresort: { name: 'Last Resort', type: 'normal', dur: 2500, peak: 1650,
    act: { brows: [[0, 1], [2500, 1]], shake: [[0, 0], [300, 0.7], [1200, 0.7], [1400, 0], [2500, 0]], earBack: [[0, 0.6], [2500, 0.6]], joy: [[0, 0.5], [1400, 1], [2500, 1]] },
    spin: [[0, 0], [1100, 0], [1600, 1], [2500, 1]], hops: [], accents: [['vein', 300], ['sparkle', 1600], ['glint', 2000]],
    fx: [orbit(S.star('#ffffff', N[1]), [0, 10], 70, 8, 0, 1400, -0.5, { s: 1, in: 1.2, out: 0.1 }),
      ring(S.glow('#fff4d0', 0.5), [0, 0], 1150, 1600, 1, 12, { back: true }),
      ring(S.ring('#ffd83a', 4), [0, 0], 1300, 2000, 1, 13, { n: 3, dt: 140 }),
      burst(S.star('#ffd83a', '#e0a400'), [0, -20], 10, 110, 1350, 2400, { s: 1.4, spin: 360 })] },
  covet: { name: 'Covet', type: 'normal', dur: 2000, peak: 900,
    act: { heartEyes: [[0, 0], [300, 1], [1600, 1], [2000, 0]], blush: [[0, 1], [2000, 1]], cheek: [[0, 0.8], [2000, 0.8]], wiggle: [[0, 0], [300, 1], [1700, 1], [2000, 0]] },
    hops: [[1000, 1300]], hopK: 0.5, accents: [['heart', 200], ['heart', 1200]],
    fx: [fall(S.heart('#ff7aa8', '#e04a80'), -104, 104, -120, -20, 7, 0, 900, 80, { s: 1.2, jy: 20, op: 1, s1: 0.6 }),
      shot(S.bow('#ff7aa8', '#ffd83a'), [96, -40], [30, -20], 900, 1500, { s: 1.4, r0: -30, r1: 360 }),
      burst(S.heart('#ff9ccc', '#e2609e'), [30, -20], 6, 60, 1450, 1950, { s: 0.9 })] },

  // Vaporeon (Water)
  watergun: { name: 'Water Gun', type: 'water', dur: 1600, peak: 760,
    act: { mouth: [[0, 0.3], [250, 1], [1200, 1], [1600, 0.3]], brows: [[0, 0.8], [1600, 0.8]], lidRest: [[0, 0.2], [1600, 0.2]] },
    hops: [], accents: [['tear', 1300]],
    fx: [shot(S.drop(W[0], W[1]), MOUTH, [96, -30], 200, 900, { n: 9, dt: 70, jy: 6, s: 1.3, r0: 90, r1: 90 }),
      ring(S.ring(W[0], 3), [96, -30], 600, 1300, 0.4, 3, { n: 3, dt: 140 }),
      burst(S.drop(W[2], W[0]), [96, -30], 7, 50, 700, 1300, { s: 0.9 })] },
  aquaring: { name: 'Aqua Ring', type: 'water', dur: 2400, peak: 1200,
    act: { lidRest: [[0, 0.6], [2400, 0.6]], joy: [[0, 1], [2400, 1]], cheek: [[0, 0.6], [2400, 0.6]], tilt: [[0, 0], [600, 6], [1800, -6], [2400, 0]] },
    hops: [], accents: [['sparkle', 900], ['sparkle', 1800]],
    fx: [orbit(S.bubble(W[0]), [0, 10], 90, 10, 0, 2300, 0.18, { s: 1.4 }),
      ring(S.ellring(W[0], 2.4), [0, FEET], 100, 1100, 2, 9, { n: 4, dt: 420, op: 0.9, back: true }),
      fall(S.bubble(W[2]), -60, 60, 50, -110, 6, 300, 1000, 200, { s: 1, jx: 10 })] },
  hydropump: { name: 'Hydro Pump', type: 'water', dur: 2200, peak: 1150,
    act: { brows: [[0, 1], [2200, 1]], mouth: [[0, 0.3], [500, 1.2], [1700, 1.2], [2200, 0.3]], earBack: [[0, 0.8], [2200, 0.8]], shake: [[0, 0], [500, 0.4], [1700, 0.4], [1800, 0], [2200, 0]] },
    hops: [], accents: [['puff', 300], ['tear', 1800]],
    fx: [fall(S.drop(W[0], W[1]), -40, 60, -40, -40, 6, 0, 450, 60, { s: 1, drift: 0, jy: 20, op: 0.9, s1: 0.2 }),
      beam(S.beam(W[0], W[1], W[2]), MOUTH, 450, 700, 1800, 140, { w: 2.2, r: -6 }),
      shot(S.bubble(W[2]), MOUTH, [100, -40], 520, 1000, { n: 8, dt: 140, jy: 18, s: 1 }),
      burst(S.drop(W[0], W[1]), [96, -36], 8, 60, 700, 1900, { dt: 0, s: 1.4 })] },
  raindance: retime({ name: 'Rain Dance', type: 'water', dur: 2600, peak: 1300,
    act: { dance: [[0, 1], [2600, 1]], step: [[0, 1], [2600, 1]], joy: [[0, 1], [2600, 1]], lookY: [[0, 0], [400, -3], [2200, -3], [2600, 0]] },
    hops: [], accents: [['note', 400], ['note', 1400]],
    fx: [hold(S.cloud('#9ab4c8', '#6d8aa2'), [-60, -148], 0, 2450, 3, { dx: 120, n: 2, dt: 120, rise: -20, back: true }),
      fall(S.drop(W[0], W[1]), -128, 128, -140, 80, 14, 300, 700, 120, { s: 0.9, drift: -14, jx: 10 }),
      ring(S.ellring(W[0], 2), [-80, FEET + 6], 900, 1500, 0.4, 2.2, { n: 4, dt: 360 })]}, 2500),
  acidarmor: { name: 'Acid Armor', type: 'water', dur: 2400, peak: 1200,
    act: { lidRest: [[0, 0], [600, 0.8], [1800, 0.8], [2400, 0]], cheek: [[0, 0.9], [2400, 0.9]], headY: [[0, 0], [700, 6], [1700, 6], [2400, 0]], wobble: [[0, 0], [400, 1], [1900, 1], [2400, 0]] },
    hops: [], accents: [['tear', 200], ['sparkle', 2000]],
    fx: [hold(S.glow(W[0], 0.4), [0, 10], 200, 2200, 10, { back: false }),
      fall(S.drop(W[0], W[1]), -60, 60, -60, FEET, 8, 300, 900, 120, { s: 1.2, ease: 'in', jy: 20 }),
      ring(S.ellring(W[1], 3), [0, FEET + 4], 700, 1700, 1, 7, { n: 3, dt: 300 }),
      burst(S.spark(W[2]), [0, -10], 6, 90, 1900, 2350)] },

  // Jolteon (Electric)
  thundershock: { name: 'Thunder Shock', type: 'electric', dur: 1500, peak: 620,
    act: { shake: [[0, 0.8], [800, 0.8], [900, 0], [1500, 0]], brows: [[0, 1], [1500, 1]], earBack: [[0, -0.4], [1500, -0.4]] },
    hops: [], accents: [['ex', 100], ['glint', 900]],
    fx: [hold(S.glow(E[0], 0.4), [0, 0], 0, 900, 9, { back: true }),
      burst(S.bolt(E[0], E[1]), [0, -20], 6, 110, 200, 900, { s: 1.6, s1: 1 }),
      shot(S.bolt(E[0], E[1]), [0, -172], [96, -20], 500, 800, { s: 2.2 }),
      burst(S.spark(E[2]), [96, -20], 8, 50, 760, 1300, { s: 1.3 })] },
  pinmissile: { name: 'Pin Missile', type: 'bug', dur: 1700, peak: 760,
    act: { brows: [[0, 1], [1700, 1]], earBack: [[0, 0.5], [1700, 0.5]], tilt: [[0, 0], [300, -6], [1400, -6], [1700, 0]] },
    hops: [[100, 360]], hopK: 0.5, accents: [['puff', 360], ['sparkle', 1300]],
    fx: [shot(S.pin('#ffffff', '#8a96a2'), [20, -60], [100, -100], 350, 760, { n: 5, dt: 90, dy: 26, s: 2.2 }),
      burst(S.spark(E[0]), [100, -40], 5, 34, 760, 1300, { dt: 90, s: 1 }),
      ring(S.ring(E[2], 2.4), [20, -40], 300, 700, 0.4, 3, { n: 2, dt: 150 })] },
  thunderwave: { name: 'Thunder Wave', type: 'electric', dur: 2000, peak: 900,
    act: { shudder: [[0, 0.6], [2000, 0.6]], joy: [[0, 1], [2000, 1]], pupil: [[0, 1], [600, 0.8], [2000, 0.8]] },
    hops: [], accents: [['glint', 300], ['sparkle', 1500]],
    fx: [ring(S.ring(E[0], 3), [0, -10], 200, 1300, 1, 15, { n: 4, dt: 200 }),
      ring(S.ellring(E[1], 2.6), [0, FEET], 200, 1300, 1, 12, { n: 3, dt: 200, back: true }),
      orbit(S.bolt(E[0], E[1]), [0, -20], 95, 6, 400, 1900, 0.1, { s: 1.2, in: 0.2, out: 1.15 })] },
  agility: { name: 'Agility', type: 'psychic', dur: 1800, peak: 1100,
    act: { joy: [[0, 1], [1800, 1]], earBack: [[0, 1], [1800, 1]] },
    spin: [[0, 0], [200, 0], [1000, 2], [1800, 2]], hops: [[1100, 1400]], hopK: 0.5, accents: [['puff', 1400], ['glint', 1500]],
    fx: [fall(S.streak(E[0]), -110, 110, -100, -100, 8, 100, 400, 90, { jy: 60, drift: -30, s: 1.4, ease: 'out' }),
      ring(S.ellring('#ffffff', 3), [0, FEET], 200, 1000, 1, 8, { n: 3, dt: 200, back: true }),
      burst(S.spark(E[2]), [0, -20], 8, 100, 1000, 1600, { s: 1.2 })] },
  discharge: { name: 'Discharge', type: 'electric', dur: 2400, peak: 1300,
    act: { shake: [[0, 0], [400, 0.5], [1200, 0.5], [1300, 0], [2400, 0]], brows: [[0, 1], [2400, 1]], mouth: [[0, 0.4], [1200, 1.2], [2400, 0.6]], earBack: [[0, -0.5], [2400, -0.5]] },
    hops: [], accents: [['ex', 200], ['sparkle', 1500], ['glint', 1800]],
    fx: [orbit(S.spark(E[0]), [0, -10], 70, 8, 0, 1250, 0.6, { s: 1.2, in: 1.4, out: 0.1 }),
      hold(S.glow(E[2], 0.6), [0, 0], 1150, 1700, 12, { back: true }),
      burst(S.bolt(E[0], E[1]), [0, -20], 12, 115, 1250, 2000, { s: 2, s1: 1.2 }),
      ring(S.ring(E[0], 4), [0, 0], 1250, 2100, 2, 18, { n: 2, dt: 200 })] },

  // Flareon (Fire)
  ember: { name: 'Ember', type: 'fire', dur: 1500, peak: 720,
    act: { mouth: [[0, 0.3], [250, 0.9], [1000, 0.9], [1500, 0.3]], brows: [[0, 0.8], [1500, 0.8]] },
    hops: [], accents: [['steam', 1200]],
    fx: [shot(S.flame(F[0], F[1], F[2]), MOUTH, [96, -60], 200, 900, { n: 5, dt: 110, dy: 14, s: 1.3, r0: 90, r1: 90 }),
      burst(S.spark(F[2]), [96, -40], 6, 40, 700, 1400, { dt: 0, s: 1 })] },
  flamethrower: { name: 'Flamethrower', type: 'fire', dur: 2200, peak: 1100,
    act: { mouth: [[0, 0.3], [400, 1.2], [1800, 1.2], [2200, 0.3]], brows: [[0, 1], [2200, 1]], earBack: [[0, 0.7], [2200, 0.7]], shake: [[0, 0], [400, 0.3], [1800, 0.3], [1900, 0], [2200, 0]] },
    hops: [], accents: [['steam', 1900], ['ex', 200]],
    fx: [beam(S.beam(F[0], F[1], F[2]), MOUTH, 350, 650, 1850, 140, { w: 2.4, r: -4 }),
      shot(S.flame(F[0], F[1], F[2]), MOUTH, [100, -40], 400, 760, { n: 12, dt: 110, jy: 22, s: 1.9, r0: 90, r1: 90 }),
      burst(S.flame(F[2], F[0], '#ffffff'), [96, -36], 6, 44, 800, 1900, { s: 1.2 })] },
  firespin: { name: 'Fire Spin', type: 'fire', dur: 2400, peak: 1200,
    act: { joy: [[0, 1], [2400, 1]], brows: [[0, 0.6], [2400, 0.6]], tilt: [[0, 0], [600, -6], [1800, 6], [2400, 0]] },
    hops: [], accents: [['steam', 2000]],
    fx: [orbit(S.flame(F[0], F[1], F[2]), [0, 10], 82, 10, 0, 2300, 0.36, { s: 1.6 }),
      orbit(S.flame(F[2], F[0], '#ffffff'), [0, -30], 70, 6, 200, 2200, -0.5, { s: 1 }),
      ring(S.ellring(F[1], 3), [0, FEET], 100, 2300, 3, 9, { n: 3, dt: 500, back: true })] },
  flareblitz: { name: 'Flare Blitz', type: 'fire', dur: 2200, peak: 1150,
    act: { brows: [[0, 1], [2200, 1]], earBack: [[0, 1], [2200, 1]], shake: [[0, 0.5], [800, 0.5], [900, 0], [2200, 0]], mouth: [[0, 0.8], [2200, 0.8]] },
    hops: [[900, 1250]], hopK: 0.5, accents: [['puff', 1250], ['vein', 300], ['steam', 1700]],
    fx: [hold(S.glow(F[0], 0.45), [0, 10], 0, 1300, 10, { back: true }),
      fall(S.flame(F[0], F[1], F[2]), -80, 80, FEET, -120, 9, 0, 700, 80, { s: 1.6, s1: 0.4 }),
      ring(S.disc(F[2]), [60, -10], 1150, 1450, 0.5, 6, { op: 0.9 }),
      burst(S.flame(F[0], F[1], F[2]), [60, -10], 10, 80, 1150, 1900, { s: 1.8, s1: 0.6 })] },
  sunnyday: { name: 'Sunny Day', type: 'fire', dur: 2400, peak: 1300,
    act: { joy: [[0, 1], [2400, 1]], lidRest: [[0, 0], [600, 0.7], [2000, 0.7], [2400, 0]], cheek: [[0, 1], [2400, 1]], lookY: [[0, 0], [500, -4], [2000, -4], [2400, 0]] },
    hops: [], accents: [['sparkle', 900], ['glint', 1600]],
    fx: [hold(S.sun('#ffe066', '#ffb100'), [-104, -148], 0, 2300, 3.2, { rise: 40, r0: -90, r1: 40 }),
      ring(S.glow('#ffe9a0', 0.4), [-104, -148], 300, 2200, 2, 14, { n: 2, dt: 500, back: true }),
      fall(S.spark('#ffd83a'), -118, 118, -132, 40, 8, 500, 900, 140, { s: 1, jx: 20 })] },

  // Espeon (Psychic)
  psychic: { name: 'Psychic', type: 'psychic', dur: 2300, peak: 1200,
    act: { pupil: [[0, 1], [400, 0.6], [1900, 0.6], [2300, 1]], brows: [[0, 1], [2300, 1]], lidRest: [[0, 0.3], [2300, 0.3]], tilt: [[0, 0], [500, -8], [1800, -8], [2300, 0]] },
    hops: [], accents: [['glint', 300], ['sparkle', 1900]],
    fx: [hold(S.glow(P[0], 0.35), [1, -54], 0, 2200, 2.4),
      ring(S.ring(P[0], 3), [1, -54], 200, 1600, 0.3, 16, { n: 5, dt: 220 }),
      ring(S.ring(P[1], 2), [1, -54], 300, 1700, 0.3, 12, { n: 4, dt: 220 }),
      orbit(S.eye(P[0], P[1]), [0, -40], 105, 4, 600, 2200, 0.12, { s: 1.2, in: 0.2 })] },
  confusion: { name: 'Confusion', type: 'psychic', dur: 2000, peak: 1000,
    act: { derp: [[0, 0], [400, 1], [1600, 1], [2000, 0]], wobble: [[0, 0], [300, 1], [1700, 1], [2000, 0]], pupil: [[0, 1], [2000, 1]] },
    hops: [], accents: [['q', 300], ['q', 1100]],
    fx: [orbit(S.star(P[2], P[0]), [0, -100], 30, 5, 0, 1900, 0.7, { s: 1, in: 0.1, out: 1 }),
      orbit(S.spark(P[0]), [0, -100], 44, 4, 100, 1900, -0.5, { s: 1 }),
      ring(S.ellring(P[0], 2.4), [0, -96], 100, 1900, 3, 4, { n: 3, dt: 500 })] },
  morningsun: { name: 'Morning Sun', type: 'normal', dur: 2400, peak: 1300,
    act: { lidRest: [[0, 0], [500, 0.9], [1900, 0.9], [2400, 0]], cheek: [[0, 1], [2400, 1]], lookY: [[0, 0], [400, -4], [2000, -4], [2400, 0]], joy: [[0, 1], [2400, 1]] },
    hops: [], accents: [['sparkle', 800], ['sparkle', 1800]],
    fx: [hold(S.sun('#ffe9a0', '#ffc94a'), [0, -152], 0, 2300, 2.6, { rise: 80, r1: 60 }),
      hold(S.glow('#fff4d0', 0.5), [0, 0], 300, 2300, 11, { back: true }),
      fall(S.spark('#ffe066'), -90, 90, -148, 20, 7, 600, 1000, 150, { s: 1.2, jx: 10, ease: 'out' }),
      fall(S.spark('#ffffff'), -70, 70, 60, -124, 6, 900, 1100, 150, { s: 0.8 })] },
  futuresight: retime({ name: 'Future Sight', type: 'psychic', dur: 2600, peak: 1700,
    act: { lidRest: [[0, 0], [300, 1], [1200, 1], [1400, 0], [2600, 0]], brows: [[0, 0.8], [2600, 0.8]], pupil: [[0, 1], [1400, 0.6], [2600, 0.6]] },
    hops: [[1500, 1800]], hopK: 0.5, accents: [['glint', 1400], ['sparkle', 2100]],
    fx: [ring(S.ring(P[0], 2.6), [1, -54], 100, 1200, 6, 0.2, { n: 3, dt: 200 }),
      hold(S.orb(P[0], P[1]), [60, -132], 1100, 1700, 2.4, { rise: -40 }),
      shot(S.orb(P[2], P[0]), [60, -132], [60, 50], 1550, 1900, { s: 2.2 }),
      ring(S.disc(P[2]), [60, 50], 1850, 2150, 0.5, 7, { op: 0.9 }),
      burst(S.star(P[0], P[1]), [60, 50], 8, 45, 1850, 2500, { s: 1.3 })]}, 2500),
  psybeam: { name: 'Psybeam', type: 'psychic', dur: 1900, peak: 900,
    act: { brows: [[0, 1], [1900, 1]], pupil: [[0, 1], [300, 0.7], [1900, 0.7]], tilt: [[0, 0], [300, -6], [1500, -6], [1900, 0]] },
    hops: [], accents: [['glint', 200]],
    fx: [beam(S.beam('#ffffff', P[0], P[2]), [1, -54], 250, 500, 1500, 140, { w: 1.6, r: -10 }),
      shot(S.ring('#ff6ad8', 3), [1, -54], [96, -88], 250, 750, { n: 6, dt: 150, s: 1.2 }),
      shot(S.ring('#7ad8ff', 3), [1, -54], [96, -88], 320, 820, { n: 5, dt: 150, s: 1 }),
      shot(S.ring('#ffd83a', 3), [1, -54], [96, -88], 390, 890, { n: 5, dt: 150, s: 0.8 })] },

  // Umbreon (Dark)
  darkpulse: { name: 'Dark Pulse', type: 'dark', dur: 2100, peak: 1000,
    act: { brows: [[0, 1], [2100, 1]], slant: [[0, 0.6], [2100, 0.6]], redEye: [[0, 0], [500, 1], [1700, 1], [2100, 0]], earBack: [[0, 0.5], [2100, 0.5]] },
    hops: [], accents: [['glint', 400]],
    fx: [      ring(S.ring(D[0], 6), [0, -10], 500, 1600, 1, 16, { n: 4, dt: 180 }),
      ring(S.ring(D[2], 2), [0, -10], 560, 1650, 1, 15, { n: 4, dt: 180 }),
      burst(S.orb(D[0], D[1]), [0, -10], 10, 170, 600, 1500, { s: 1.2 })] },
  moonlight: retime({ name: 'Moonlight', type: 'fairy', dur: 2600, peak: 1400,
    act: { lidRest: [[0, 0], [600, 0.8], [2000, 0.8], [2600, 0]], lookY: [[0, 0], [500, -4], [2100, -4], [2600, 0]], cheek: [[0, 0.6], [2600, 0.6]] },
    hops: [], accents: [['sparkle', 1000], ['sparkle', 2000]],
    fx: [hold(S.moon('#fff4c0', '#f5c93a'), [-100, -152], 0, 2500, 2.6, { rise: 60, r0: -40 }),
      hold(S.glow('#fff4c0', 0.9), [0, 10], 500, 2500, 10, { back: true }),
      fall(S.spark('#fff4c0'), -120, 120, -150, -150, 8, 300, 900, 160, { s: 0.8, jy: 15, op: 1, drift: 0 }),
      fall(S.spark(D[2]), -50, 50, -132, 60, 6, 800, 1100, 160, { s: 1.1, ease: 'out' })]}, 2500),
  faintattack: { name: 'Faint Attack', type: 'dark', dur: 1800, peak: 1000,
    act: { slant: [[0, 0.7], [1800, 0.7]], mouthTilt: [[0, 0], [300, -10], [1500, -10], [1800, 0]], brows: [[0, 0.8], [1800, 0.8]] },
    spin: [[0, 0], [300, 0], [800, 1], [1800, 1]], hops: [], accents: [['puff', 300], ['glint', 950]],
    fx: [fall(S.cloud(D[0], D[1]), -60, 60, 40, -60, 4, 200, 700, 60, { s: 2, s1: 2.6 }),
      fall(S.claw('#ff4b6a'), 107, 107, -80, -40, 1, 900, 500, 1, { s: 2.2 }),
      burst(S.spark(D[2]), [96, -60], 6, 50, 950, 1500, { s: 1.2 })] },
  meanlook: { name: 'Mean Look', type: 'normal', dur: 2200, peak: 1200,
    act: { brows: [[0, 1], [2200, 1]], slant: [[0, 1], [2200, 1]], redEye: [[0, 0], [400, 1], [1900, 1], [2200, 0]], pupil: [[0, 1], [300, 0.5], [2200, 0.5]] },
    hops: [], accents: [['vein', 400]],
    fx: [hold(S.glow('#120f16', 0.45), [0, -30], 0, 2100, 11, { back: true }),
      hold(S.eye('#ff4b4b', '#120f16'), [-90, -140], 300, 2000, 2, { dx: 180, n: 2, dt: 100 }),
      ring(S.ring('#ff4b4b', 2), [0, -30], 400, 1600, 14, 2, { n: 3, dt: 300 })] },
  snarl: { name: 'Snarl', type: 'dark', dur: 1700, peak: 800,
    act: { teeth: [[0, 0], [300, 1], [1300, 1], [1700, 0]], mouth: [[0, 0.3], [300, 0.8], [1300, 0.8], [1700, 0.3]], brows: [[0, 1], [1700, 1]], shake: [[0, 0], [300, 0.4], [1200, 0.4], [1300, 0], [1700, 0]] },
    hops: [], accents: [['vein', 200], ['ex', 600]],
    fx: [shot(S.wave(D[0]), MOUTH, [96, -20], 250, 800, { n: 5, dt: 120, s: 1.6, jy: 12 }),
      shot(S.wave(D[2]), MOUTH, [96, -20], 310, 860, { n: 4, dt: 120, s: 1.2, jy: 12 }),
      ring(S.ring(D[0], 4), MOUTH, 250, 1300, 1, 9, { n: 3, dt: 200 })] },

  // Leafeon (Grass)
  razorleaf: { name: 'Razor Leaf', type: 'grass', dur: 1700, peak: 800,
    act: { brows: [[0, 0.8], [1700, 0.8]], tilt: [[0, 0], [300, -10], [600, 10], [900, 0], [1700, 0]] },
    hops: [], accents: [['sparkle', 1300]],
    fx: [orbit(S.leaf(G[0], G[1]), HEAD, 60, 6, 0, 700, 0.6, { s: 1.4, out: 1 }),
      shot(S.leaf(G[0], G[1]), [20, -70], [100, -50], 500, 1000, { n: 8, dt: 60, jy: 30, s: 1.5, r1: 720 }),
      burst(S.slash('#ffffff'), [96, -50], 3, 10, 950, 1400, { s: 2.2 })] },
  leafblade: { name: 'Leaf Blade', type: 'grass', dur: 1600, peak: 760,
    act: { brows: [[0, 1], [1600, 1]], earBack: [[0, 0.8], [1600, 0.8]], tilt: [[0, 0], [300, 12], [600, -12], [1600, 0]] },
    hops: [[300, 650]], hopK: 0.5, accents: [['glint', 200], ['puff', 650]],
    fx: [hold(S.leaf(G[0], G[1]), [1, -110], 0, 600, 3, { r0: -90, r1: 0 }),
      shot(S.slash(G[0]), [-40, -120], [96, 0], 600, 900, { s: 5, r0: 30, r1: 40 }),
      shot(S.slash(G[2]), [-20, -110], [96, 10], 640, 920, { s: 3.6, r0: 30, r1: 40 }),
      burst(S.leaf(G[0], G[1]), [90, -20], 8, 50, 800, 1500, { s: 1.2, spin: 360 })] },
  synthesis: { name: 'Synthesis', type: 'grass', dur: 2400, peak: 1300,
    act: { lidRest: [[0, 0], [400, 0.9], [2000, 0.9], [2400, 0]], cheek: [[0, 1], [2400, 1]], joy: [[0, 1], [2400, 1]] },
    hops: [], accents: [['sparkle', 900], ['sparkle', 1900]],
    fx: [fall(S.spark('#ffe066'), -114, 114, -168, 10, 8, 0, 900, 120, { s: 1.2, ease: 'in' }),
      hold(S.glow(G[0], 0.45), [0, 10], 500, 2300, 10, { back: true }),
      fall(S.glow(G[2], 0.8), -80, 80, FEET, -150, 8, 700, 1200, 120, { s: 0.6, s1: 0.3 })] },
  grassyterrain: { name: 'Grassy Terrain', type: 'grass', dur: 2500, peak: 1300,
    act: { dance: [[0, 1], [2500, 1]], joy: [[0, 1], [2500, 1]], cheek: [[0, 0.6], [2500, 0.6]] },
    hops: [], accents: [['note', 600], ['sparkle', 1600]],
    fx: [hold('<path d="M-30 4 Q-25 -10 -22 4 Q-16 -14 -12 4 Q-6 -8 -2 4 Q4 -16 8 4 Q14 -10 18 4 Q24 -12 30 4 Z" fill="' + G[0] + '"/><path d="M-30 4 H30" stroke="' + G[1] + '" stroke-width="3"/>', [0, FEET + 2], 0, 2400, 6, { rise: 30, back: true }),
      fall(S.petal('#ffffff', '#ffd83a'), -120, 120, FEET, FEET - 20, 6, 300, 1900, 80, { s: 1.4, jy: 4, op: 1 }),
      fall(S.leaf(G[0], G[1]), -120, 120, FEET, -150, 8, 500, 1300, 120, { s: 1, spin: 240 })] },
  solarbeam: retime({ name: 'Solar Beam', type: 'grass', dur: 2800, peak: 1900,
    act: { lidRest: [[0, 0], [300, 0.7], [1400, 0.7], [1500, 0], [2800, 0]], brows: [[0, 1], [2800, 1]], mouth: [[0, 0.3], [1400, 0.3], [1500, 1.1], [2400, 1.1], [2800, 0.3]], shake: [[0, 0], [1500, 0.3], [2400, 0.3], [2500, 0], [2800, 0]] },
    hops: [], accents: [['sparkle', 400], ['glint', 1400]],
    fx: [fall(S.spark('#ffe066'), -128, 128, -164, -20, 8, 0, 800, 90, { s: 1.2, ease: 'in', drift: 0 }),
      hold(S.glow('#fff4a0', 0.9), MOUTH, 300, 1500, 4.5),
      beam(S.beam('#fff6c0', '#ffd83a', '#ffffff'), MOUTH, 1450, 1650, 2500, 150, { w: 4, r: -4 }),
      burst(S.spark('#ffffff'), [100, -26], 8, 40, 1600, 2600, { s: 1.4 })]}, 2500),

  // Glaceon (Ice)
  iceshard: { name: 'Ice Shard', type: 'ice', dur: 1500, peak: 700,
    act: { brows: [[0, 0.8], [1500, 0.8]], earBack: [[0, 0.5], [1500, 0.5]] },
    hops: [[100, 340]], hopK: 0.5, accents: [['glint', 700]],
    fx: [shot(S.shard(I[0], I[1], I[2]), [20, -60], [100, -40], 300, 650, { n: 4, dt: 60, dy: 16, s: 1.6, r0: 90, r1: 90 }),
      burst(S.shard(I[2], I[0], '#ffffff'), [96, -24], 6, 50, 600, 1200, { s: 0.9 }),
      ring(S.ring(I[1], 3), [96, -24], 600, 1100, 0.4, 3)] },
  blizzard: retime({ name: 'Blizzard', type: 'ice', dur: 2600, peak: 1300,
    act: { shudder: [[0, 0.8], [2600, 0.8]], lidRest: [[0, 0.4], [2600, 0.4]], earBack: [[0, 0.8], [2600, 0.8]] },
    hops: [], accents: [['puff', 300], ['glint', 1500]],
    fx: [fall(S.flake('#ffffff'), -100, 120, -160, 60, 16, 100, 900, 100, { drift: -20, spin: 180, s: 2, jx: 10 }),
      fall(S.flake(I[1]), -110, 105, -152, 60, 10, 200, 800, 160, { drift: -25, spin: -180, s: 1.6 }),
      fall(S.streak('#ffffff'), -100, 95, -132, 40, 6, 200, 500, 300, { drift: -30, s: 1.4 })]}, 2500),
  icywind: { name: 'Icy Wind', type: 'ice', dur: 1900, peak: 900,
    act: { mouth: [[0, 0.3], [300, 0.7], [1500, 0.7], [1900, 0.3]], mouthW: [[0, 1], [300, 0.5], [1500, 0.5], [1900, 1]], brows: [[0, 0.6], [1900, 0.6]] },
    hops: [], accents: [['steam', 300]],
    fx: [shot(S.wave(I[0]), MOUTH, [100, -40], 200, 900, { n: 6, dt: 120, jy: 26, s: 1.8 }),
      shot(S.flake('#ffffff'), MOUTH, [100, -60], 250, 950, { n: 8, dt: 100, jy: 34, s: 1.2, r1: 360 }),
      fall(S.shard(I[0], I[1], I[2]), 70, 110, FEET - 10, FEET - 10, 3, 900, 900, 80, { s: 1.4, jy: 2, ease: 'out' })] },
  hail: { name: 'Hail', type: 'ice', dur: 2400, peak: 1300,
    act: { lookY: [[0, 0], [300, -4], [2000, -4], [2400, 0]], tilt: [[0, 0], [400, 8], [2000, 8], [2400, 0]], shudder: [[0, 0.3], [2400, 0.3]] },
    hops: [], accents: [['ex', 300], ['glint', 1800]],
    fx: [hold(S.cloud('#d4e4ee', '#9ab4c8'), [-50, -148], 0, 2300, 3, { dx: 110, n: 2, dt: 80, rise: -20, back: true }),
      fall(S.shard(I[0], I[1], '#ffffff'), -120, 120, -150, FEET, 12, 300, 600, 120, { s: 1.3, jx: 10, ease: 'in', spin: 90 }),
      fall(S.spark('#ffffff'), -120, 120, FEET, FEET - 14, 12, 880, 260, 120, { s: 0.8, jx: 10, jy: 2 })] },
  freezedry: { name: 'Freeze-Dry', type: 'ice', dur: 2200, peak: 1300,
    act: { pupil: [[0, 1], [500, 0.7], [2200, 0.7]], brows: [[0, 0.8], [2200, 0.8]], cheek: [[0, 0.5], [2200, 0.5]] },
    hops: [], accents: [['glint', 1300], ['sparkle', 1700]],
    fx: [orbit(S.flake(I[0]), [80, -40], 45, 8, 0, 1100, -0.5, { s: 1.4, in: 1.6, out: 0.1 }),
      hold(S.shard(I[0], I[1], I[2]), [80, -40], 1000, 2100, 5, { r0: -30 }),
      burst(S.spark('#ffffff'), [80, -40], 8, 70, 1150, 1800),
      ring(S.ring(I[1], 3), [80, -40], 1050, 1700, 1, 8)] },

  // Sylveon (Fairy)
  fairywind: { name: 'Fairy Wind', type: 'fairy', dur: 2000, peak: 900,
    act: { joy: [[0, 1], [2000, 1]], tilt: [[0, 0], [400, -8], [1200, 8], [2000, 0]], cheek: [[0, 0.7], [2000, 0.7]] },
    hops: [], accents: [['sparkle', 300], ['heart', 1400]],
    fx: [shot(S.wave(Y[0]), [20, -30], [100, -80], 200, 1000, { n: 5, dt: 140, jy: 30, s: 1.8 }),
      shot(S.petal(Y[0], Y[1]), [20, -30], [100, -100], 250, 1100, { n: 8, dt: 100, jy: 40, s: 1.3, r1: 540 }),
      shot(S.spark(Y[2]), [20, -40], [100, -60], 300, 1100, { n: 6, dt: 110, jy: 40, s: 1 })] },
  moonblast: retime({ name: 'Moonblast', type: 'fairy', dur: 2600, peak: 1500,
    act: { lookY: [[0, 0], [300, -4], [1300, -4], [1500, 0], [2600, 0]], brows: [[0, 0.8], [2600, 0.8]], joy: [[0, 1], [2600, 1]] },
    hops: [], accents: [['sparkle', 300], ['glint', 1500]],
    fx: [hold(S.moon('#fff0f7', Y[0]), [-100, -152], 0, 1400, 3, { rise: 40 }),
      hold(S.orb('#fff0f7', Y[0]), [10, -124], 600, 1500, 4.2, {}),
      shot(S.orb('#ffffff', Y[1]), [10, -124], [96, -20], 1400, 1700, { s: 3 }),
      ring(S.disc(Y[2]), [96, -20], 1650, 1950, 0.6, 8, { op: 0.9 }),
      burst(S.heart(Y[0], Y[1]), [96, -20], 8, 45, 1650, 2400, { s: 1.2 })]}, 2500),
  drainingkiss: { name: 'Draining Kiss', type: 'fairy', dur: 2200, peak: 1250,
    act: { heartEyes: [[0, 0], [300, 1], [1700, 1], [2200, 0]], mouthW: [[0, 1], [200, 0.5], [800, 0.5], [1000, 1], [2200, 1]], blush: [[0, 1], [2200, 1]], cheek: [[0, 1], [2200, 1]] },
    hops: [[1500, 1800]], hopK: 0.5, accents: [['heart', 200], ['sparkle', 1700]],
    fx: [shot(S.heart('#ff5a8a', '#d0306a'), MOUTH, [96, -60], 250, 800, { s: 2.6 }),
      burst(S.heart(Y[0], Y[1]), [96, -60], 6, 50, 780, 1200, { s: 1 }),
      shot(S.glow(Y[0], 0.8), [96, -60], [0, -20], 1100, 1700, { n: 6, dt: 70, jy: 20, s: 0.7 }),
      ring(S.ring(Y[0], 3), [0, 0], 1600, 2100, 1, 10)] },
  mistyterrain: retime({ name: 'Misty Terrain', type: 'fairy', dur: 2600, peak: 1300,
    act: { joy: [[0, 1], [2600, 1]], lidRest: [[0, 0.3], [2600, 0.3]], wiggle: [[0, 0], [600, 1], [2000, 1], [2600, 0]] },
    hops: [], accents: [['sparkle', 800], ['heart', 1800]],
    fx: [fall(S.cloud('#ffe0f0', '#f6c0dc'), -110, 110, FEET + 10, FEET, 5, 0, 2500, 60, { s: 3, jy: 3, op: 0.9, back: true }),
      fall(S.cloud('#fff0f7', '#ffd0e6'), -100, 100, FEET - 6, FEET - 20, 4, 200, 2300, 80, { s: 2.4, jy: 3, op: 0.85 }),
      fall(S.spark(Y[0]), -120, 120, FEET - 10, -150, 8, 400, 1400, 160, { s: 1 })]}, 2500),
  babydolleyes: { name: 'Baby-Doll Eyes', type: 'fairy', dur: 1800, peak: 900,
    act: { pupil: [[0, 1], [300, 1.4], [1500, 1.4], [1800, 1]], heartEyes: [[0, 0], [700, 0], [900, 1], [1300, 1], [1500, 0], [1800, 0]], tilt: [[0, 0], [300, 12], [1500, 12], [1800, 0]], blush: [[0, 1], [1800, 1]] },
    hops: [], accents: [['heart', 900], ['sparkle', 300], ['sparkle', 1200]],
    fx: [burst(S.spark('#ffffff'), [-10, -36], 4, 30, 200, 700, { s: 1.4 }),
      burst(S.spark('#ffffff'), [14, -36], 4, 30, 260, 760, { s: 1.4 }),
      fall(S.heart(Y[0], Y[1]), -50, 50, -90, -144, 5, 700, 900, 80, { s: 1.3, ease: 'out' }),
      ring(S.ring(Y[0], 2.4), [0, -36], 800, 1500, 2, 10, { n: 2, dt: 200 })] }
};

// an effect never outlives its move (the rig drops it at the end): a track that would run on is drawn in to finish with it
Object.keys(POKEMOVES).forEach(function (id) {
  var mv = POKEMOVES[id];
  mv.fx.forEach(function (p) {
    var k0 = p.k[0][0], end = p.k[p.k.length - 1][0] + (p.dt || 0) * ((p.n || 1) - 1);
    if (end <= mv.dur) return;
    var f = (mv.dur - k0) / (end - k0);
    p.k = p.k.map(function (q) { return [Math.floor(k0 + (q[0] - k0) * f)].concat(q.slice(1)); });
    if (p.dt) p.dt *= f;
  });
});

// whose moves: five each, in the games' order of learning
export var MOVESET = {
  eevee: ['quickattack', 'swift', 'tackle', 'covet', 'lastresort'],
  vaporeon: ['watergun', 'aquaring', 'hydropump', 'raindance', 'acidarmor'],
  jolteon: ['thundershock', 'pinmissile', 'thunderwave', 'agility', 'discharge'],
  flareon: ['ember', 'flamethrower', 'firespin', 'flareblitz', 'sunnyday'],
  espeon: ['confusion', 'psybeam', 'psychic', 'morningsun', 'futuresight'],
  umbreon: ['snarl', 'faintattack', 'meanlook', 'darkpulse', 'moonlight'],
  leafeon: ['razorleaf', 'leafblade', 'synthesis', 'grassyterrain', 'solarbeam'],
  glaceon: ['iceshard', 'icywind', 'hail', 'blizzard', 'freezedry'],
  sylveon: ['fairywind', 'babydolleyes', 'drainingkiss', 'mistyterrain', 'moonblast']
};
export function movesFor(dogId) { return Object.prototype.hasOwnProperty.call(MOVESET, dogId) ? MOVESET[dogId].slice() : []; }

// ---- the one function of time: copy i of particle p at t ms into the move, or null when it is not showing ----
var EASE = {
  lin: function (u) { return u; }, out: function (u) { return 1 - (1 - u) * (1 - u); },
  in: function (u) { return u * u; }, io: function (u) { return u * u * (3 - 2 * u); }
};
function jit(i, s) { var v = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453; return (v - Math.floor(v)) * 2 - 1; }
export function sample(p, i, t) {
  var k = p.k, ti = t - (p.dt || 0) * i;
  if (ti < k[0][0] || ti > k[k.length - 1][0]) return null;
  var j = 0;
  while (j < k.length - 2 && ti > k[j + 1][0]) j++;
  var a = k[j], b = k[j + 1], span = b[0] - a[0], u = span > 0 ? (EASE[p.ease] || EASE.out)((ti - a[0]) / span) : 1;
  function L(n, d) { var x = a[n] == null ? d : a[n], y = b[n] == null ? d : b[n]; return x + (y - x) * u; }
  var s = L(3, 1), sy = a[6] == null && b[6] == null ? s : L(6, s);
  return { x: L(1, 0) + (p.dx || 0) * i + (p.jx || 0) * jit(i, 1), y: L(2, 0) + (p.dy || 0) * i + (p.jy || 0) * jit(i, 2),
    sx: s, sy: sy, r: L(5, 0), o: Math.max(0, Math.min(1, L(4, 1))), turn: (p.dr || 0) * i + (p.orb || 0) * (ti - k[0][0]) };
}
export function transformOf(p, q) {
  var at = p.at || [0, 0], f = function (v) { return Math.round(v * 100) / 100; };
  return (q.turn ? 'rotate(' + f(q.turn) + ' ' + f(at[0]) + ' ' + f(at[1]) + ') ' : '') + 'translate(' + f(q.x) + ' ' + f(q.y) + ')' +
    (q.r ? ' rotate(' + f(q.r) + ')' : '') + ' scale(' + f(q.sx) + ' ' + f(q.sy) + ')';
}

/* the move a dog shows off with (a duel's walk-on, its win, an emote): a dog with moves of its own plays one of them,
   picked by `r` in [0, 1) (Math.random by default), else the first signature move its pieces give it (moves.mjs), else '' */
export function showMove(dogId, wearMoves, r) {
  var own = movesFor(dogId);
  if (own.length) return own[Math.min(own.length - 1, Math.floor((r == null ? Math.random() : r) * own.length))];
  return (wearMoves && wearMoves[0]) || '';
}
