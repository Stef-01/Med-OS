// motion.mjs — easing, keyframe tracks and the 7.2 s loop every expression runs on
// Part of the dog kit (public/doberman/): motion.mjs (easing, keyframes, the loop's clock), expressions.mjs (what a
// dog can feel), breeds.mjs (who the dogs are), parts.mjs (how a dog is drawn), rig.mjs (one dog, animated) and
// stage.mjs (the page: the scene, the menu, the embed's messages). docs/doberman/README.md has the map.

// ---- engine (ported from the motion skill's motion.ts) ----
function bezier(x1, y1, x2, y2) {
  var A = function (a, b) { return 1 - 3 * b + 3 * a; };
  var B = function (a, b) { return 3 * b - 6 * a; };
  var C = function (a) { return 3 * a; };
  var calc = function (t, a, b) { return ((A(a, b) * t + B(a, b)) * t + C(a)) * t; };
  var slope = function (t, a, b) { return 3 * A(a, b) * t * t + 2 * B(a, b) * t + C(a); };
  return function (x) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    var t = x;
    for (var i = 0; i < 6; i++) {
      var s = slope(t, x1, x2);
      if (s === 0) break;
      t -= (calc(t, x1, x2) - x) / s;
    }
    return calc(t, y1, y2);
  };
}
var EASE_IN_OUT = bezier(0.77, 0, 0.175, 1);   // things that travel
var EASE_OUT = bezier(0.23, 1, 0.32, 1);       // things that open or arrive
var EASE_IN = bezier(0.55, 0, 1, 0.45);        // things leaving

// Keyframes [ms, value, 'out'?]. Stops at every key: right for ONE move (a blink).
function track(t, keys) {
  if (t <= keys[0][0]) return keys[0][1];
  for (var i = 1; i < keys.length; i++) {
    var k1 = keys[i];
    if (t <= k1[0]) {
      var k0 = keys[i - 1];
      var span = k1[0] - k0[0];
      var p = span > 0 ? (t - k0[0]) / span : 1;
      var e = k1[2] === 'out' ? EASE_OUT(p) : EASE_IN_OUT(p);
      return k0[1] + (k1[1] - k0[1]) * e;
    }
  }
  return keys[keys.length - 1][1];
}

// A monotone cubic through key poses: continuous speed, no overshoot, no dead stops.
function flow(t, k) {
  var n = k.length;
  if (t <= k[0][0]) return k[0][1];
  if (t >= k[n - 1][0]) return k[n - 1][1];
  var i = 0;
  while (k[i + 1][0] < t) i++;
  function slope(j) { return (k[j + 1][1] - k[j][1]) / (k[j + 1][0] - k[j][0]); }
  function tangent(j) {
    if (j === 0 || j === n - 1) return 0;
    var a = slope(j - 1), b = slope(j);
    if (a * b <= 0) return 0;
    var h0 = k[j][0] - k[j - 1][0], h1 = k[j + 1][0] - k[j][0];
    var w0 = 2 * h1 + h0, w1 = h1 + 2 * h0;
    return (w0 + w1) / (w0 / a + w1 / b);
  }
  var h = k[i + 1][0] - k[i][0];
  var s = (t - k[i][0]) / h, s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * k[i][1] +
    (s3 - 2 * s2 + s) * h * tangent(i) +
    (-2 * s3 + 3 * s2) * k[i + 1][1] +
    (s3 - s2) * h * tangent(i + 1);
}

function wave(t, period, phase) { return Math.sin((t / period + (phase || 0)) * Math.PI * 2); }
function bell(p) { return Math.sin(Math.PI * Math.min(1, Math.max(0, p))); }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function seeded(i, salt) {
  var x = Math.sin(i * 12.9898 + (salt || 0) * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

var PERIOD = 7200;            // every loop period below divides it
// A delayed read that wraps the loop seam, so follow-through never jumps at t = 0.
function ago(t, ms) { return ((t - ms) % PERIOD + PERIOD) % PERIOD; }
var B = 2600;                 // a tap's one-shot
var TREAT = 2400;             // a treat, from throw to happy
var CALL = 1700;              // the "call them" perk-up
var SWITCH = 650;             // blend between two expressions
var MOVE = 900;               // a dog walking to its new spot
var GIF_FPS = 25;             // 4 cs per frame: 180 frames for one loop
var STILL = 1e12;             // a clock far past every one-shot: rigs that only pose (thumbnails, GIF frames)

export { bezier, EASE_IN_OUT, EASE_OUT, EASE_IN, track, flow, wave, bell, clamp, seeded, PERIOD, ago, B, TREAT, CALL, SWITCH, MOVE, GIF_FPS, STILL };
