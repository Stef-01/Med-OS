// rig.mjs — one dog, animated: its accents, its fit for what it wears, and the frame that moves it
// Part of the dog kit (public/doberman/): motion.mjs (easing, keyframes, the loop's clock), expressions.mjs (what a
// dog can feel), breeds.mjs (who the dogs are), parts.mjs (how a dog is drawn), rig.mjs (one dog, animated) and
// stage.mjs (the page: the scene, the menu, the embed's messages). docs/doberman/README.md has the map.
import { EASE_IN_OUT, EASE_OUT, track, flow, wave, bell, clamp, seeded, PERIOD, ago, B, TREAT, CALL, SWITCH, MOVE } from './motion.mjs';
import { EXPR, DEF, PET, CALLED, TREAT_KEYS, TREAT_HOPS, MOVE_HOPS } from './expressions.mjs';
import { NS, r3, set, rot, tr, pt, ellPath, uPath, scl, EAR_UP, EAR_FLOP, HEART, dogMarkup, reach } from './parts.mjs';

// the Learn mascot's frame (index.html marks <html class="embed"> before its first paint): the rig trims a zoom-in
// there so a tall hat or wide back piece keeps its room
const EMBED = typeof document !== 'undefined' && document.documentElement.classList.contains('embed');

var ACCENT = {
  heart:   { head: false, upright: false, dur: 1150, svg: HEART },
  z:       { head: false, upright: true, dur: 2000,
             svg: '<path d="M-5 -5 H5 L-5 5 H5" fill="none" stroke="#1899d6" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>' },
  q:       { head: false, upright: true, dur: 1350,
             svg: '<path d="M-4.5 -5.5 Q-4.5 -10.5 0 -10.5 Q4.5 -10.5 4.5 -6 Q4.5 -2.5 0 -0.5 V1.5" fill="none" stroke="#ff9600" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="0" cy="7" r="2.3" fill="#ff9600"/>' },
  ex:      { head: false, upright: true, dur: 1100,
             svg: '<rect x="-2.1" y="-11" width="4.2" height="12" rx="2.1" fill="#ff4b4b"/><circle cx="0" cy="6" r="2.4" fill="#ff4b4b"/>' },
  sparkle: { head: false, upright: false, dur: 1100,
             svg: '<rect x="-1.8" y="-7" width="3.6" height="14" rx="1.8" fill="#ffb100"/><rect x="-7" y="-1.8" width="14" height="3.6" rx="1.8" fill="#ffb100"/>' },
  tear:    { head: true, upright: false, dur: 1700,
             svg: '<circle cx="0" cy="3" r="3.6" fill="#84d8ff"/><path d="M-3.1 1.6 L0 -5.2 L3.1 1.6 Z" fill="#84d8ff" stroke="#84d8ff" stroke-width="1.4" stroke-linejoin="round"/>' },
  puff:    { head: true, upright: false, dur: 900,   // a cloud over its own underside: it reads on a white card and a dark one
             svg: '<circle cx="0" cy="1.3" r="4" fill="#c3ccd5"/><circle cx="5" cy="-0.7" r="3" fill="#c3ccd5"/>' +
                  '<circle cx="0" cy="0" r="4" fill="#eef2f5"/><circle cx="5" cy="-2" r="3" fill="#eef2f5"/>' },
  tear2:   { head: true, upright: false, dur: 1700,
             svg: '<circle cx="0" cy="3" r="3.6" fill="#84d8ff"/><path d="M-3.1 1.6 L0 -5.2 L3.1 1.6 Z" fill="#84d8ff" stroke="#84d8ff" stroke-width="1.4" stroke-linejoin="round"/>' },
  note:    { head: false, upright: true, dur: 1500,
             svg: '<circle cx="-2.4" cy="4.4" r="3.8" fill="#ce82ff"/><rect x="0.2" y="-9.5" width="2.8" height="14" rx="1.4" fill="#ce82ff"/><path d="M1.6 -9.2 Q8.5 -7.4 6.8 -1.6" fill="none" stroke="#ce82ff" stroke-width="2.8" stroke-linecap="round"/>' },
  vein:    { head: true, upright: false, dur: 1800,
             svg: '<path d="M-6.5 -2 Q-2 -2 -2 -6.5 M2 -6.5 Q2 -2 6.5 -2 M6.5 2 Q2 2 2 6.5 M-2 6.5 Q-2 2 -6.5 2" fill="none" stroke="#ff4b4b" stroke-width="2.8" stroke-linecap="round"/>' },
  steam:   { head: true, upright: false, dur: 1300,  // the puff's two tones
             svg: '<circle cx="0" cy="1.3" r="4.2" fill="#c3ccd5"/><circle cx="-3.5" cy="-2.7" r="3" fill="#c3ccd5"/><circle cx="3" cy="-4.9" r="2.4" fill="#c3ccd5"/>' +
                  '<circle cx="0" cy="0" r="4.2" fill="#eef2f5"/><circle cx="-3.5" cy="-4" r="3" fill="#eef2f5"/><circle cx="3" cy="-6.2" r="2.4" fill="#eef2f5"/>' },
  glint:   { head: true, upright: false, dur: 700,
             svg: '<rect x="-1.4" y="-6" width="2.8" height="12" rx="1.4" fill="#ffffff"/><rect x="-6" y="-1.4" width="12" height="2.8" rx="1.4" fill="#ffffff"/>' }
};

// A hat's flat base on a domed head (a Pomeranian's corner radius is 40-46 against a doberman's 22-30): the rounder
// the head, the lower and narrower the hat sits, so its band rests on the dome instead of hovering at its corners.
// Tuned with scripts/doberman/fit-audit.mjs (hat contact over the middle 60 % of the head).
function hatFit(c) {
  var k = Math.max(0, c.head.r - 26);
  return { y: Math.round(k * 17) / 100, s: Math.round(1000 - k * 5.5) / 1000 };
}
/* A worn hat rides the head on a soft spring: it lifts a touch as a hop leaves the ground and settles back, so it
   sits on the head instead of being painted on it (secondary motion; glasses get a quarter of it). The spring (hatS)
   is soft and damped to settle in one slow bob (a 350 ms period, ζ ≈ 0.7), driven by the head's acceleration
   smoothed over a frame or two (a finite difference spikes as a hop starts), and what is drawn (hatY, + down)
   saturates softly and one-sidedly: a hat lifts off a head (up to 2.6) but presses into it only a hair of fur (0.5),
   so a hard hop never sinks it or slams it into a wall (the ±5 clamp this replaced swung end to end in 64 ms on a
   hyped hop). Pure: scripts/mascot.test.js runs it; scripts/doberman/switch-audit.mjs watches it in the rig. */
function hatSpring(s, headY, dt) {
  var kk = Math.min(dt, 48) / 16, vy = s.pHY == null ? 0 : (headY - s.pHY) / kk, ay = vy - (s.pVY || 0);
  s.pHY = headY; s.pVY = vy;
  s.aY = (s.aY || 0) + (ay - (s.aY || 0)) * Math.min(1, 0.5 * kk);
  s.hatV = (s.hatV || 0) + (-0.08 * (s.hatS || 0) - 0.4 * (s.hatV || 0) - 0.3 * s.aY) * kk;
  s.hatS = Math.max(-12, Math.min(12, (s.hatS || 0) + s.hatV * kk));
  s.hatY = s.hatS > 0 ? 0.5 * Math.tanh(s.hatS / 0.5) : 2.6 * Math.tanh(s.hatS / 2.6);
  return s;
}
// an element's box in another element's user space (each corner carried through the CTMs); null when not drawn
function boxIn(el, space) {
  var b, M;
  try { b = el.getBBox(); M = space.getCTM().inverse().multiply(el.getCTM()); } catch (err) { return null; }
  if (!b || !(b.width > 0 || b.height > 0)) return null;
  var xs = [], ys = [];
  [[b.x, b.y], [b.x + b.width, b.y], [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]].forEach(function (q) {
    xs.push(M.a * q[0] + M.c * q[1] + M.e); ys.push(M.b * q[0] + M.d * q[1] + M.f);
  });
  return { x0: Math.min.apply(null, xs), x1: Math.max.apply(null, xs), y0: Math.min.apply(null, ys), y1: Math.max.apply(null, ys) };
}

// A sum of hops (they may overlap): crouch, stretch, a parabola, squash, one small rebound.
function hopSum(t, list, H) {
  var lift = 0, d = 0;
  for (var i = 0; i < list.length; i++) {
    var a = list[i][0], b = list[i][1];
    if (t < a - 120 || t > b + 260) continue;
    var mid = (a + b) / 2;
    d += flow(t, [[a - 120, 1], [a, 0.93], [a + 60, 1.07], [mid, 1], [b - 50, 1.05], [b, 1],
                  [b + 55, 0.86], [b + 135, 1.04], [b + 200, 0.99], [b + 260, 1]]) - 1;
    var p = (t - a) / (b - a);
    if (p > 0 && p < 1) lift += H * 4 * p * (1 - p);
  }
  return { lift: lift, d: d };
}

// A loop's hops, read across the seam: a hop that starts before 0 or recovers after 7.2 s still counts.
function hopLoop(t, list, H) {
  var a = hopSum(t, list, H), b = hopSum(t + PERIOD, list, H), c = hopSum(t - PERIOD, list, H);
  return { lift: a.lift + b.lift + c.lift, d: a.d + b.d + c.d };
}

// ---- one rig, driven by a look and an expression ----
function makeDog(c, slot, P) {
  slot.innerHTML = dogMarkup(c, P);
  function q(name) { return slot.querySelector('[data-p="' + name + '"]'); }
  var e = {};
  ['disc', 'dog', 'floor', 'body', 'tail', 'leg0', 'leg1', 'leg2', 'collar', 'tag', 'head', 'earL', 'earR', 'tipL', 'tipR',
   'tipOutL', 'tipOutR', 'tipInL', 'tipInR', 'earsBack', 'earsFront', 'earTips', 'feat', 'browL', 'browR', 'pupilL', 'pupilR',
   'heyeL', 'heyeR', 'lidL', 'lidR', 'cheekL', 'cheekR', 'shutL', 'shutR', 'snout', 'blush', 'mouth', 'tongue', 'bone',
   'accHead', 'acc', 'white', 'shades', 'teeth', 'wearHead', 'wearFace', 'wearNeck', 'wearBack', 'earsOver', 'armClip', 'armEars', 'armEarL', 'armEarR', 'ruff', 'ruffClip',
   'tailIn', 'tailDots'].forEach(function (k) { e[k] = q(k); });
  e.heyeL = e.heyeL.firstChild; e.heyeR = e.heyeR.firstChild;
  // the eye as a whole: the whites, each eye's clip (its pupil and its heart), the lids and the cheeks that squint into
  // it, the strokes of a closed eye; all left out under solid lenses (below)
  e.eyeParts = [e.white, e.pupilL.parentNode, e.pupilR.parentNode, e.lidL.parentNode, e.lidR.parentNode, e.shutL, e.shutR];
  var g = c.geo, m = c.mirror ? -1 : 1, F = hatFit(c), span = reach(c);
  var rig = {
    cfg: c, slot: slot, exprId: c.expr, E: EXPR[c.expr], Pv: EXPR[c.expr], swStart: -1e12,
    burstStart: -1e12, BE: EXPR[c.expr], treatStart: -1e12, callStart: -1e12,
    pet: 0, petting: false, petHeartAt: 0, gaze: { on: false, last: -1e12, x: 0, y: 0, yaw: 0 }, gazeW: 0,
    fsL: 0, fsR: 0
  };

  // Floating accents: one element per loop accent of each expression (made on first use),
  // and a small pool for one-shots (taps, treats, petting).
  var loopEls = {};
  function makeAccent(type) {
    var el = document.createElementNS(NS, 'g');
    el.setAttribute('opacity', '0');
    el.innerHTML = ACCENT[type].svg;
    el._type = type;
    (ACCENT[type].head ? e.accHead : e.acc).appendChild(el);
    return el;
  }
  function loopAccents(E) {
    if (!loopEls[E.name]) loopEls[E.name] = E.accents.map(function (a) { return makeAccent(a[0]); });
    return loopEls[E.name];
  }
  var shots = [];
  function shot(type, at) {
    for (var i = 0; i < shots.length; i++) {
      if (shots[i].type === type && shots[i].start + ACCENT[type].dur < at - 50) { shots[i].start = at; return; }
    }
    if (shots.length < 14) shots.push({ type: type, start: at, el: makeAccent(type), i: shots.length + 7 });
  }

  // the pops' and floats' half width and height, unscaled (placeAccent keeps them clear of a hat and the ears)
  var POP = { ex: [2.4, 11], q: [4.5, 10.5], sparkle: [7, 7], heart: [8.3, 8], z: [6.7, 6.7], note: [7.5, 9.5], steam: [6.6, 8.6] };
  var FLOATS = { heart: 1, z: 1, note: 1, steam: 1 };
  var POPON = [[0, 0.55], [150, 1.1], [240, 0.97], [320, 1]];   // a piece put on: small, a touch over, settled (popK)
  // the ears as they are drawn this frame, boxed in head space (once a frame, and only while a pop is up)
  function earBoxes() {
    if (rig.ebAt === rig.frames) return rig.eb;
    rig.ebAt = rig.frames; rig.eb = [];
    [e.earL, e.earR, e.tipL, e.tipR].forEach(function (el) { var b = el && !el.closest('[display="none"]') && boxIn(el, e.head); if (b) rig.eb.push(b); });
    return rig.eb;
  }
  // the frame's left and right edges in the dog's own space (rig.view from draw, the dog's scale from frame), less a
  // pop's half width; none mid-spin, when the dog is edge on
  function viewX(w) {
    var v = rig.view, k = rig.kx, o = rig.spinX || 0;
    if (!v || !k || Math.abs(k) < 0.3 * rig.ky) return null;
    var a = (v[0] - o) / k, b = (v[1] - o) / k;
    return [Math.min(a, b) + w, Math.max(a, b) - w];
  }
  function placeAccent(el, type, p, i, fade) {
    if (!(p > 0 && p < 1) || fade <= 0) { set(el, 'opacity', 0); return; }
    var x, y, s, r = 0, o, s1 = seeded(i, 1), s3 = seeded(i, 3);
    var inOut = p < 0.12 ? p / 0.12 : p > 0.8 ? (1 - p) / 0.2 : 1;
    if (type === 'heart') {
      x = 44 + 16 * s1 + 6 * wave(p * 1150, 1200, seeded(i, 2)) + 10 * p;
      y = -62 - 6 * s3 - 38 * EASE_OUT(p);
      s = (0.55 + 0.35 * seeded(i, 4)) * (0.5 + 0.5 * EASE_OUT(Math.min(1, p * 3)));
      r = -12 + 24 * seeded(i, 5) + 8 * wave(p * 1150, 1200, 0.3);
      o = bell(p) > 0.5 ? 1 : bell(p) * 2;
    } else if (type === 'z') {
      x = 30 + 10 * s1 + 22 * p + 4 * wave(p * 2000, 900);
      y = -62 - 50 * p;
      s = 0.55 + 0.6 * p;
      r = -15 + 10 * wave(p * 2000, 1100);
      o = p < 0.2 ? p / 0.2 : p > 0.75 ? (1 - p) / 0.25 : 1;
    } else if (type === 'q') {
      x = 40 + 6 * s1;
      y = -80 - 5 * EASE_OUT(Math.min(1, p * 4)) + 1.5 * wave(p * 1350, 700);
      s = 0.6 + 0.45 * EASE_OUT(Math.min(1, p * 5));
      r = 10 * wave(p * 1350, 900);
      o = inOut;
    } else if (type === 'ex') {
      x = 38 + 10 * s1;
      y = -84 - 4 * EASE_OUT(Math.min(1, p * 5));
      s = 0.6 + 0.5 * EASE_OUT(Math.min(1, p * 6));
      r = 9 * wave(p * 1100, 180) * (1 - p);
      o = inOut;
    } else if (type === 'sparkle') {
      var a = Math.PI * (0.1 + 0.8 * s1);
      x = 68 * Math.cos(a); y = -18 - 70 * Math.sin(a);
      s = 0.95 * bell(p);                       // tiny sparkles may start from nothing
      r = 45 + 120 * p;
      o = bell(p) > 0.3 ? 1 : bell(p) / 0.3;
    } else if (type === 'tear') {
      var x0 = 1 - 21 * c.eye;
      x = x0 - 3 * p; y = -18 + 30 * p * p;      // falls, speeding up
      s = 0.5 + 0.5 * EASE_OUT(Math.min(1, p * 3));
      o = p < 0.1 ? p / 0.1 : p > 0.8 ? (1 - p) / 0.2 : 1;
    } else if (type === 'tear2') {               // the other eye
      x = 1 + 21 * c.eye + 3 * p; y = -18 + 30 * p * p;
      s = 0.5 + 0.5 * EASE_OUT(Math.min(1, p * 3));
      o = p < 0.1 ? p / 0.1 : p > 0.8 ? (1 - p) / 0.2 : 1;
    } else if (type === 'note') {
      x = 40 + 18 * s1 + 8 * wave(p * 1500, 1000, seeded(i, 2)) + 6 * p;
      y = -60 - 8 * s3 - 42 * EASE_OUT(p);
      s = (0.6 + 0.3 * seeded(i, 4)) * (0.5 + 0.5 * EASE_OUT(Math.min(1, p * 3)));
      r = -15 + 30 * seeded(i, 5) + 12 * wave(p * 1500, 800);
      o = bell(p) > 0.5 ? 1 : bell(p) * 2;
    } else if (type === 'vein') {                // the cross-popping vein, throbbing on the brow
      x = 30; y = -44;
      s = 0.7 + 0.25 * EASE_OUT(Math.min(1, p * 5)) + 0.12 * wave(p * 1800, 300);
      o = inOut;
    } else if (type === 'steam') {               // out of the ears, both sides
      var side = i % 2 ? 1 : -1;
      x = side * (34 + 6 * p); y = -50 - 26 * EASE_OUT(p);
      s = 0.5 + 0.8 * EASE_OUT(p);
      o = bell(p);
    } else if (type === 'glint') {               // a shine off the jawline
      x = 30; y = 26;
      s = 0.9 * bell(p); r = 45 + 90 * p;
      o = bell(p) > 0.3 ? 1 : bell(p) / 0.3;
    } else {                                     // puff: a huff from the nose
      x = 12 + 22 * EASE_OUT(p); y = -14 - 8 * EASE_OUT(p);
      s = 0.4 + 0.9 * EASE_OUT(p);
      o = bell(p);
    }
    // A pop above the head (a "!", a "?", a sparkle) keeps clear of what is up there and rides the head. It is placed
    // in head space, slid sideways out of every shape of a worn hat (a brim, a horn, a crown: rig.hatShapes, from
    // wear) and of the ears as they are now, never over the top (the embed's frame ends just above a hat), so it
    // neither lands on them nor reads as part of a hat. A "!" or "?" goes out on its own side unless only the other
    // fits the frame; the side is chosen once per pop, so it never hops across. Then the head's hop and tilt carry it
    // out of head space, upright (a tap's leap does not lift an ear into it, a curious tilt does not swing a hat
    // under it), and the frame's edge stops it.
    // A float (a heart, a Z, a note, steam) is let go: it leaves from beside the head clear of the hat and the ears
    // (steam: of the hat; it comes out of the ears) by an offset fixed when it appears, at its full size, and then
    // flies its own path instead of sliding along what it passes.
    var POPK = POP[type];
    if (POPK) {
      var H = rig.headAt, fl = !!FLOATS[type], th = r * Math.PI / 180 - (H ? H[2] : 0), ca = Math.abs(Math.cos(th)), sa = Math.abs(Math.sin(th));
      var sz = fl ? Math.max(s, 0.9) : s, pw = 2 + (POPK[0] * ca + POPK[1] * sa) * sz, ph = 2 + (POPK[0] * sa + POPK[1] * ca) * sz;   // its extent in head space
      var boxes = (rig.hatShapes || []).concat(type === 'steam' ? [] : earBoxes()), py = y;
      var up = fl ? 12 : 0;   // a float rises: it clears the first stretch of its way up as well as where it appears
      var hit = function (hx) {
        for (var k = 0; k < boxes.length; k++) { var B = boxes[k]; if (hx > B.x0 - pw && hx < B.x1 + pw && py > B.y0 - ph && py - up < B.y1 + ph) return B; }
        return null;
      };
      var clear = function (hx, side) { for (var k = 0, B; k < 8 && (B = hit(hx)); k++) hx = side > 0 ? B.x1 + pw : B.x0 - pw; return hx; };
      var cs = H ? Math.cos(H[2]) : 1, sn = H ? Math.sin(H[2]) : 0;
      var toDog = function (hx) { if (!H) return [hx, py]; var ry = py - H[3]; return [hx * cs - ry * sn + H[0], H[3] + hx * sn + ry * cs + H[1]]; };
      var V = viewX(pw), fits = function (hx) { var d = toDog(hx)[0]; return !V || (d >= V[0] + 10 && d <= V[1] - 10); };   // with room to tilt on
      var choose = function (hx) {
        var B0 = hit(hx), out = hx >= 0 ? 1 : -1;
        return !B0 ? out : type === 'sparkle' ? (hx - B0.x0 < B0.x1 - hx ? -1 : 1) : fits(clear(hx, out)) || !fits(clear(hx, -out)) ? out : -out;
      };
      if (!(p >= (el._p || 0)) || el._gen !== rig.wearGen) { el._side = 0; el._off = null; }   // a new pop (the loop's next), or new clothes
      el._p = p; el._gen = rig.wearGen;
      if (fl) {
        if (!el._off) {
          var hx0 = x, dX = 0, dY = 0;
          if (H) { dX = x - H[0]; dY = y - H[1] - H[3]; hx0 = dX * cs + dY * sn; py = -dX * sn + dY * cs + H[3]; }   // into head space
          var mv = clear(hx0, choose(hx0)) - hx0;
          el._off = [mv * cs, mv * sn];
        }
        x += el._off[0]; y += el._off[1];
      } else {
        if (!el._side) el._side = choose(x);
        var D = toDog(clear(x, el._side));
        x = V ? clamp(D[0], V[0], V[1]) : D[0]; y = D[1];
      }
    }
    var flip = ACCENT[type].upright && m < 0 ? ' scale(-1 1)' : '';   // letters read the right way round
    set(el, 'transform', tr(x, y) + ' rotate(' + r3(r) + ') scale(' + r3(s) + ')' + flip);
    set(el, 'opacity', clamp(o * fade, 0, 1));
  }

  rig.setExpr = function (id, clock) {
    if (id === rig.exprId) return;
    var now = rig.E;
    rig.Pv = now; rig.E = EXPR[id]; rig.exprId = id; rig.swStart = clock;
  };
  rig.excite = function (clock) {
    if (clock - rig.burstStart >= B) {
      rig.burstStart = clock; rig.BE = rig.E;
      rig.E.burst.accents.forEach(function (a) { shot(a[0], clock + a[1]); });
    } else {
      shot('heart', clock);              // tapping again mid-burst: one more heart, no restart
    }
  };
  rig.treat = function (clock) {
    if (clock - rig.treatStart < TREAT) return false;
    rig.treatStart = clock;
    shot('heart', clock + 1400); shot('heart', clock + 1750);
    return true;
  };
  rig.call = function (clock) { rig.callStart = clock; shot('ex', clock + 80); };

  rig.frame = function (t, clock, dt, moveB) {
    var E = rig.E, Pv = rig.Pv;
    var sw = EASE_IN_OUT(clamp((clock - rig.swStart) / SWITCH, 0, 1));
    var b = clock - rig.burstStart, BE = rig.BE;
    var eB = b >= 0 && b < B ? flow(b, [[0, 0], [150, 1], [B - 600, 1], [B, 0]]) : 0;
    var tb = clock - rig.treatStart;
    var eT = tb >= 0 && tb < TREAT ? flow(tb, [[0, 0], [120, 1], [TREAT - 400, 1], [TREAT, 0]]) : 0;
    var cb = clock - rig.callStart;
    var eC = cb >= 0 && cb < CALL ? flow(cb, [[0, 0], [150, 1], [CALL - 500, 1], [CALL, 0]]) : 0;
    var k = 1 - Math.exp(-dt / (rig.petting ? 220 : 600));
    rig.pet += ((rig.petting ? 1 : 0) - rig.pet) * k;
    var pet = rig.pet;
    var gazeOn = rig.gaze.on && clock - rig.gaze.last < 2500;
    rig.gazeW += ((gazeOn ? 1 : 0) - rig.gazeW) * (1 - Math.exp(-dt / 250));

    function val(X, name) { var keys = X.act[name]; return keys ? flow(t, keys) : (name === 'tside' ? c.tongueSide : DEF[name]); }
    function base(name) { var v = val(E, name); return sw < 1 ? val(Pv, name) + (v - val(Pv, name)) * sw : v; }
    function over(name, v) {
      if (eB > 0 && BE.burst.act[name]) v += (flow(b, BE.burst.act[name]) - v) * eB;
      if (eT > 0 && TREAT_KEYS[name]) v += (flow(tb, TREAT_KEYS[name]) - v) * eT;
      if (eC > 0 && CALLED[name] !== undefined) v += (CALLED[name] - v) * eC;
      if (pet > 0.001 && PET[name] !== undefined) v += (PET[name] - v) * pet;
      return v;
    }
    function ch(name) { return over(name, base(name)); }

    function hops(dt2) {
      var keep = 1 - Math.max(eB, eT);          // a tap's or treat's hops replace the loop's, never stack
      var H = c.hopH;
      var hn = hopLoop(ago(t, dt2), E.hops, H * E.hopK), hp = sw < 1 ? hopLoop(ago(t, dt2), Pv.hops, H * Pv.hopK) : hn;
      var lift = (hp.lift + (hn.lift - hp.lift) * sw) * keep, d = (hp.d + (hn.d - hp.d) * sw) * keep;
      if (eB > 0) { var hb = hopSum(b - dt2, BE.burst.hops, H); lift += hb.lift; d += hb.d; }
      if (eT > 0) { var ht = hopSum(tb - dt2, TREAT_HOPS, Math.max(H, 9)); lift += ht.lift; d += ht.d; }
      if (moveB >= 0 && moveB < MOVE + 300) { var hm = hopSum(moveB - dt2, MOVE_HOPS, 6); lift += hm.lift; d += hm.d; }
      return { lift: lift, sy: 1 + d };
    }

    var joy = clamp(ch('joy'), 0, 1);
    var notice = clamp(ch('notice'), 0, 1);
    var shift = ch('shift');
    var hop = hops(0), hopLate = hops(45), hopEars = hops(110);
    var boop = b >= 0 && b < 260 ? flow(b, [[0, 0], [60, -0.06], [170, 0.02], [260, 0]]) : 0;
    hop.sy += boop;

    var fast = PERIOD / c.wag.fast, tailAmp = ch('tailAmp');
    function wag(tt) { return tailAmp * ((1 - joy) * c.wag.slow * wave(tt, PERIOD / 8) + joy * c.wag.amp * wave(tt, fast)); }
    var w0 = wag(t), w1 = wag(t - 70), w2 = wag(t - 140);

    // Body: breathing, weight, a hip wiggle, a puffed chest, the hips swinging against the tail.
    var chest = ch('chest');
    var breath = 1 + 0.012 * wave(t, 3600) + 0.01 * joy * wave(t, 1200);
    var dance = ch('dance'), shake = ch('shake');
    var sy = breath * hop.sy * (1 + 0.03 * chest) + ch('shudder') * 0.028 * wave(t, 150);   // sobs, giggles, trembling
    var sx = (1 / Math.pow(sy, 0.6)) * (1 + 0.035 * chest);
    var hipX = shift - 0.05 * w0 + 3.2 * ch('wiggle') * wave(t, 600) + shake * 1.6 * wave(t, 60) + dance * 3.5 * wave(t, 900, 0.25);
    set(e.body, 'transform', tr(g.fx + hipX, g.fy - hop.lift) + ' scale(' + r3(sx) + ' ' + r3(sy) + ') ' +
      tr(-g.fx, -g.fy) + ' ' + rot(0.03 * w0, g.fx, g.fy));
    // a piece just put on pops on: a quick overshoot about its anchor (the hat's brim, the eyes, the collar, the back
    // piece's middle), 320 ms from when wear() saw it change
    function popK(k) {
      var a = rig.popAt && rig.popAt[k], u = a == null ? -1 : clock - a;
      if (u < 0 || u >= 320) { if (rig.popAt) rig.popAt[k] = null; return 1; }
      return r3(flow(u, POPON));
    }
    var kH = popK('Head'), kF = popK('Face'), kN = popK('Neck'), kB = popK('Back');
    // back bling is rigid (wings, a guitar, a pack): it keeps a fifth of the body's squash in width, not all of it,
    // so a landing does not stretch a wide piece out of the frame
    if (e.wearBack && e.wearBack.firstChild) set(e.wearBack, 'transform', tr(g.fx, g.fy) + ' scale(' + r3(Math.pow(sx, -0.8)) + ' 1) ' + tr(-g.fx, -g.fy) +
      (kB !== 1 && rig.backC ? ' ' + scl(kB, rig.backC[0], rig.backC[1]) : ''));

    // Tail: a three-link chain drawn as one smooth thick curve.
    var curl = ch('tailCurl') + (c.tail.curl || 0);            // a husky's or a pug's curls over its back
    var a1 = -50 + (c.tail.rest || 0) + ch('tailRest') + w0 + 2.2 * wave(t, 3600);   // a terrier's carried high
    var a2 = a1 + curl + 0.42 * (w1 - w0) + 1.8 * wave(t, 3600, 0.2);
    var a3 = a2 + curl + 0.55 * (w2 - w1) + 1.6 * wave(t, 2400, 0.4);
    function step(q0, a, l) { var r = a * Math.PI / 180; return [q0[0] + l * Math.sin(r), q0[1] - l * Math.cos(r)]; }
    var P0 = g.tail, P1 = step(P0, a1, c.tail.len[0]), P2 = step(P1, a2, c.tail.len[1]), P3 = step(P2, a3, c.tail.len[2]);
    var M12 = [(P1[0] + P2[0]) / 2, (P1[1] + P2[1]) / 2];
    var tailD = 'M' + pt(P0) + ' Q' + pt(P1) + ' ' + pt(M12) + ' Q' + pt(P2) + ' ' + pt(P3);
    set(e.tail, 'd', tailD);
    if (e.tailIn) set(e.tailIn, 'd', tailD);
    if (e.tailDots) set(e.tailDots, 'd', tailD);

    var stepK = ch('step');                       // feet that tap or step to a beat
    set(e.leg0, 'transform', rot(-shift * 0.5 + 1.4 * wave(t, 2400) + stepK * 7 * wave(t, 900), g.legs[0], 26));
    set(e.leg1, 'transform', rot(-shift * 0.5 - 1.2 * wave(t, 1800, 0.35) + stepK * 7 * wave(t, 900, 0.5), g.legs[1], 26));
    set(e.leg2, 'transform', rot(-shift * 0.5 + 1.1 * wave(t, 2400, 0.6) + stepK * 7 * wave(t, 900, 0.25), g.legs[2], 26));

    // Head: rides the squash a beat late; its own tilt and carriage, a wobble, counter-motion.
    var headY = -hopLate.lift + (1 - hopLate.sy) * 52 - 1.2 * (wave(t, 3600) + 1) / 2 + ch('headY');
    var shiftLate = E.act.shift ? flow(ago(t, 120), E.act.shift) : 0;
    var tilt = ch('tilt') + 1.8 * wave(t, 3600, 0.3) - 0.35 * shiftLate + 8 * ch('wobble') * wave(t, 450) + dance * 8 * wave(t, 900);
    var headX = hipX * 0.7 + shake * 1.1 * wave(t, 60, 0.3);
    set(e.head, 'transform', tr(headX, headY) + ' ' + rot(tilt, 0, g.hb - 10));
    rig.headAt = [headX, headY, tilt * Math.PI / 180, g.hb - 10];   // the pops above the head ride it (placeAccent)
    // a worn hat rides the head on a soft spring (hatSpring); with nothing on, it rests
    if (e.wearHead && e.wearHead.firstChild) hatSpring(rig, headY, dt); else { rig.hatY = rig.hatS = rig.hatV = rig.aY = 0; rig.pHY = null; rig.pVY = 0; }   // a hat put on later starts at rest
    set(e.collar, 'transform', tr(hipX * 0.75, headY * 0.85 - 0.15 * hop.lift));
    if (e.wearNeck) { if (rig.neckT == null) rig.neckT = e.wearNeck.getAttribute('transform') || ''; set(e.wearNeck, 'transform', rig.neckT + (kN !== 1 ? ' ' + scl(kN, 0, 0) : '')); }
    set(e.tag, 'transform', rot(-0.3 * w1 + 3 * wave(t - 120, 1440) + 40 * (hopEars.sy - hop.sy), -4, g.hb + 4));

    // The turn, without a second drawing: each part slides by its depth. The pointer pulls it a little.
    var yaw = c.yaw0 * (1 - notice) + rig.gaze.yaw * rig.gazeW * (1 - eT);
    set(e.feat, 'transform', tr(yaw * 10, 0));
    // the hat: the spring above, the head's turn (a hat sits between the face's depth and the head's outline), and
    // this dog's fit (hatFit); glasses take a quarter of the spring and ride the features' yaw in their own group
    var HF = rig.hoodFit || F, hatT = tr(yaw * 4, rig.hatY + HF.y) + ' ' + rot(-0.6 * rig.hatY, 1, -55) + ' ' + scl(HF.s, 1, -55) + (kH !== 1 ? ' ' + scl(kH, 1, -55) : '');
    set(e.wearHead, 'transform', hatT);
    if (rig.hoodFit && e.ruffClip) set(e.ruffClip, 'transform', hatT);   // the mane's trim rides the hood
    /* worn glasses: on a "deal with it" (the shades channel) they get a push up the nose instead of a second pair */
    var faceOn = !!(e.wearFace && e.wearFace.firstChild), push = faceOn ? -3.5 * Math.sin(Math.PI * clamp(ch('shades'), 0, 1)) : 0;   /* a nudge: the lenses stay over the eyes */
    if (e.wearFace) set(e.wearFace, 'transform', tr(0, rig.hatY * 0.25 + push) + (kF !== 1 ? ' ' + scl(kF, 1, -30) : ''));
    // under solid lenses the eyes are not drawn (stage.mjs wear: rig.shade); a pair popping on takes them at 0.97 of its
    // size, on its way up to the overshoot (POPON never falls below 0.97 after that), so the change is inside the motion
    var eyesOut = faceOn && rig.shade && kF >= 0.97 ? 'none' : 'inline';
    e.eyeParts.forEach(function (el) { set(el, 'display', eyesOut); });
    // the head's outline seen from inside the glasses (the inverse of the face's yaw, this dog's eye scale, a mirror
    // and the push above), so the arms clip to where the head is now, not where it was drawn
    if (faceOn && e.armClip) set(e.armClip, 'transform', (kF !== 1 ? scl(r3(1 / kF), 1, -30) + ' ' : '') + tr(0, -(rig.hatY * 0.25 + push)) + (c.mirror ? ' matrix(-1 0 0 1 2 0)' : '') +
      ' translate(1 -17.4) scale(' + r3(1 / c.eye) + ') translate(-1 17.4) ' + tr(-yaw * 10, 0));
    set(e.snout, 'transform', tr(yaw * 13, 0));
    set(e.earsBack, 'transform', tr(-yaw * 9, 0));
    set(e.earTips, 'transform', tr(-yaw * 9, 0));
    set(e.earsFront, 'transform', tr(-yaw * 5, 0));
    if (faceOn && e.armEars) set(e.armEars, 'transform', tr(-yaw * 5, 0));   // the arms' mask keeps its ears where the ears are

    // Ears: perk on a look, press back when shy, flick, flop a beat behind each hop.
    var perk = 0.25 + 0.75 * notice, back = ch('earBack');
    var flick = 2.4 * wave(t, 2400, 0.1) + 1.2 * wave(t, 1800, 0.3);
    var flop = 1.7 * (hopEars.lift - hopLate.lift) + 26 * (hopLate.sy - hopEars.sy) + dance * 5 * wave(t, 450, 0.15);
    var lagT = E.act.tilt ? 0.35 * (flow(ago(t, 110), E.act.tilt) - flow(t, E.act.tilt)) : 0;
    var foldBase = base('fold');
    ['L', 'R'].forEach(function (side, i) {
      var sgn = side === 'L' ? -1 : 1, node = e['ear' + side];
      if (c.ears[i] === 'up') {
        var u = (c.earAt && c.earAt.up && c.earAt.up[side]) || EAR_UP[side];
        var ang = sgn * (13 - 7 * (1 - perk) + 22 * back) - flick * (sgn < 0 ? 1 : 0.8) - sgn * flop - lagT;
        var earT = tr(u.x, u.y) + ' ' + rot(ang, 0, 0) + (c.earScale ? ' scale(' + c.earScale + ')' : '');
        set(node, 'transform', earT);
        var fold = 0;
        if (c.foldable) {
          var idle = c.foldIdle ? flow(t, c.foldIdle[side]) : 0;
          fold = clamp(over('fold', clamp(idle + foldBase + base('fold' + side), 0, 1)), 0, 1);
        }
        var key = 'fs' + side;
        rig[key] += (fold - rig[key]) * (1 - Math.exp(-dt / 90));   // the tip lags its own fold, then settles
        var cf = Math.cos(fold * Math.PI);
        var tipR = -sgn * 12 * fold - sgn * 40 * (fold - rig[key]) + 0.8 * sgn * flop;
        set(e['tip' + side], 'transform', earT + ' translate(0 -24) rotate(' + r3(tipR) + ') scale(1 ' + r3(cf) + ')');
        set(e['tipOut' + side], 'fill', cf >= 0 ? c.pal['ear' + side] : c.pal['earBack' + side]);   // the back of the ear shows once it's over
        set(e['tipIn' + side], 'opacity', cf > 0 ? 1 : 0);                  // swaps only when the tip is edge-on
      } else {
        var f = (c.earAt && c.earAt.flop && c.earAt.flop[side]) || EAR_FLOP[side];
        var flopT = tr(f.x, f.y) + ' ' + rot(-sgn * (24 - 8 * perk + 10 * back - c.flopGain * flop) + 0.6 * flick - lagT, 0, 0);
        set(node, 'transform', flopT);
        if (faceOn && e['armEar' + side]) set(e['armEar' + side], 'transform', flopT);
      }
    });

    // Brows: the breed's tan marks. Lift on a look; inner ends up when worried, down when cross.
    var brow = ch('brows'), browTilt = ch('browTilt'), skew = ch('browSkew');
    var browY = -3.2 * brow - 0.6 * (wave(t, 2400, 0.7) + 1) / 2 - 2.2 * (hop.sy - 1) * 10;
    set(e.browL, 'transform', tr(0, browY - 2.4 * skew) + ' ' + rot(-7 * brow - 14 * browTilt, -10.7, c.brow.y + 3));
    set(e.browR, 'transform', tr(0, browY + 2.4 * skew) + ' ' + rot(7 * brow + 14 * browTilt, 12.7, c.brow.y + 3));

    // Pupils: lead the turn, glance, follow the pointer or a falling treat, cross, sink in a squint.
    var cheekK = clamp(ch('cheek'), 0, 1), derp = ch('derp'), he = clamp(ch('heartEyes'), 0, 1);
    var lookX = ch('lookX'), lookY = ch('lookY');
    var gw = rig.gazeW * (1 - eT);
    lookX += (rig.gaze.x - lookX) * gw; lookY += (rig.gaze.y - lookY) * gw;
    var boneX = 0, boneY = 0, boneOn = 0, boneS = 1, boneR = 0;
    if (tb >= 0 && tb < TREAT) {
      var mouthX = 1.5 + yaw * 13, mouthY = -1;
      if (tb < 650) {                                   // falling: gravity, spinning, eyes on it
        var fp = tb / 650;
        boneX = 8 - hipX * 0.7 + (mouthX - 8 + hipX * 0.7) * fp;
        boneY = -250 - headY + (mouthY + 250 + headY) * fp * fp;   // from beyond the top edge, already falling
        boneR = 360 * fp; boneOn = 1; boneS = 0.85 + 0.15 * fp;     // one whole turn, so the catch lands level
        var w = 1 - Math.max(0, (tb - 520) / 130);
        lookX += (clamp((boneX - 1) / 12, -4, 4) - lookX) * w * eT;
        lookY += (clamp((boneY + 32) / 14, -4.5, 4) - lookY) * w * eT;
      } else {                                          // caught: chomped away in three bites
        boneX = mouthX; boneY = mouthY; boneR = 0;
        boneS = flow(tb, [[650, 1], [850, 0.75], [1050, 0.5], [1250, 0.28], [1350, 0.2]]);
        boneOn = tb < 1250 ? 1 : Math.max(0, 1 - (tb - 1250) / 100);
      }
    }
    set(e.bone, 'opacity', boneOn);
    if (boneOn > 0) set(e.bone, 'transform', tr(boneX, boneY) + ' rotate(' + r3(boneR) + ') scale(' + r3(boneS) + ')');
    lookY += 7 * cheekK - 1.2 * joy + 1.1 * wave(t, 3600, 0.5);
    lookX += yaw * 8 + 1.4 * wave(t, 2400, 0.15) * notice;
    // a pinpoint pupil (surprised, furious, locked in) still reads as a pupil: below 0.8 the eye read as blank white
    var ps = Math.max(0.8, c.pupil * ch('pupil')) * clamp(1 - 1.6 * he, 0, 1);   // hearts in, pupils out: never both small mid-blend
    // Each pupil stays inside its own eye. The offsets add up (the expression's glance, the pointer, the head's yaw,
    // the idle wander, a derp), and unclamped they slid a pupil out of its clip and left a blank white eye (RCA
    // 2026-10-23, scripts/doberman-eyes audit). The bounds keep at least 80% of the pupil inside the white; the left
    // pupil starts 3.4 units toward the nose (the three-quarter view), so its room is uneven. A squint lets it sink
    // under the rising cheek, which covers it anyway.
    var down = 9.5;   // not lower under a squint either: the cheek would hide the pupil and leave a white crescent
    var dxL = clamp(lookX + 3.2 * derp, -11, 4.6), dyL = clamp(lookY - 1.5 * derp, -8, down);
    var dxR = clamp(lookX - 3.2 * derp, -7.4, 8.6), dyR = clamp(lookY + 1.5 * derp, -8, down);
    set(e.pupilL, 'transform', tr(-7.3 + dxL, -32 + dyL) + ' scale(' + r3(ps) + ') ' + tr(7.3, 32));
    set(e.pupilR, 'transform', tr(12.1 + dxR, -32 + dyR) + ' scale(' + r3(ps) + ') ' + tr(-12.1, 32));
    set(e.heyeL, 'opacity', he > 0.01 ? 1 : 0);
    set(e.heyeR, 'opacity', he > 0.01 ? 1 : 0);
    var hs = clamp(he * 1.8, 0, 1) * (1 + 0.06 * wave(t, 600));
    set(e.heyeL, 'transform', tr(-9.7 + lookX * 0.5, -30 + lookY * 0.4) + ' scale(' + r3(hs) + ')');
    set(e.heyeR, 'transform', tr(11.7 + lookX * 0.5, -30 + lookY * 0.4) + ' scale(' + r3(hs) + ')');

    // Lids from above, with a slant for worry or temper; cheeks rise into a happy squint.
    var blink = clamp(track(t, E.lid), 0, 1);
    if (sw < 1) blink = clamp(track(t, Pv.lid), 0, 1) * (1 - sw) + blink * sw;
    var lid = clamp(Math.max(blink, ch('lidRest')), 0, 1);
    var slant = ch('slant'), edge = -46.5 + lid * 30.5;
    set(e.lidL, 'height', 29.5 + lid * 30.5);
    set(e.lidR, 'height', 29.5 + lid * 30.5);
    set(e.lidL, 'transform', rot(-14 * slant, -10.7, edge));
    set(e.lidR, 'transform', rot(14 * slant, 12.7, edge));
    var cheekY = -1.2 - 21 * cheekK - 4 * lid;
    set(e.cheekL, 'cy', cheekY);
    set(e.cheekR, 'cy', cheekY);
    var shut = clamp((lid - 0.72) / 0.22, 0, 1);
    set(e.shutL, 'opacity', shut);
    set(e.shutR, 'opacity', shut);

    set(e.blush, 'opacity', clamp(ch('blush'), 0, 1));

    // Red eyes blend the white toward pink (a blend, never a swap).
    var red = clamp(ch('redEye'), 0, 1);
    set(e.white, 'fill', 'rgb(255,' + Math.round(255 - 56 * red) + ',' + Math.round(255 - 56 * red) + ')');
    // Shades drop in from above the head and settle with a small bounce.
    // A dog already wearing glasses keeps its own (faceOn, above): no second pair stacked over them.
    var shv = faceOn ? 0 : ch('shades');
    set(e.shades, 'opacity', clamp(shv / 0.12, 0, 1));
    if (shv > 0) set(e.shades, 'transform', tr(0, -110 * (1 - shv)));

    // Mouth: one D shape. Taller is a pant or a yawn, narrower an "o", flipped a pout.
    var mouth = clamp(ch('mouth') + ch('pant') * joy * (0.6 + 0.12 * wave(t, 600)), -0.6, 1.4);
    var mouthW = ch('mouthW'), mx = ch('mouthX'), mt = ch('mouthTilt');
    set(e.mouth, 'transform', tr(1.5 + mx, -7) + ' rotate(' + r3(mt) + ') scale(' + r3(mouthW) + ' ' + r3(mouth) + ') ' + tr(-1.5, 7));
    set(e.teeth, 'transform', tr(0, -7) + ' scale(1 ' + r3(clamp(ch('teeth'), 0, 1)) + ') ' + tr(0, 7));
    var tongue = clamp(ch('tongue'), 0, 1) * clamp(mouth / 0.3, 0, 1), side = clamp(ch('tside'), 0, 1);
    set(e.tongue, 'transform', tr(1.5 + 6.5 * side + mx, -5) + ' rotate(' + r3(4 * wave(t, 600, 0.25) * tongue + 26 * side + 0.6 * tilt * side + mt) + ') scale(1 ' +
      r3(0.12 * clamp(mouth / 0.3, 0, 1) + 0.88 * tongue) + ') ' + tr(-1.5, 5));

    var spin = eB > 0 && BE.burst.spin ? flow(b, BE.burst.spin) : 0;   // ends on a whole turn, so it never unwinds
    var z = ch('zoom'), cs = Math.cos(spin * Math.PI * 2);
    if (EMBED && rig.hatTop) z = Math.min(z, 1.06);   // the embed's headroom covers a tall hat pushed in this far (contentBox)
    if (EMBED && (rig.backWide || rig.long)) z = Math.min(z, 1);   // wings or a guitar out past the head, or a long dog's tail (stage.mjs dogSpan), leave no room for a push-in
    // a whole turn (Dancing's tap) mirrors the mascot about the middle of its frame, so what fits on one side fits on the
    // other at the half turn (a long dog's tail, a hanging ear, a brim); among other dogs on the page, about its own
    // middle (reach). Otherwise the pivot is the head, where a push-in centres
    var pv = !spin ? 0 : EMBED && rig.view ? (rig.view[0] + rig.view[1]) / 2 / (m * c.scale * z) : (span[0] + span[1]) / 2;
    set(e.dog, 'transform', tr(m * 18 * c.scale + m * c.scale * z * pv, 0) + ' scale(' + r3(m * c.scale * z * cs) + ' ' + r3(c.scale * z) + ') ' + tr(-pv, -g.fy));
    rig.kx = m * c.scale * z * cs; rig.ky = c.scale * z; rig.frames = (rig.frames || 0) + 1;   // for the pops (viewX, earBoxes)
    rig.spinX = m * c.scale * z * pv * (1 - cs);   // and how far that pivot moves the dog's own space across the frame
    var shd = 1 - hop.lift / 32;
    set(e.floor, 'transform', tr(g.fx + hipX * 0.5, g.fy) + ' scale(' + r3(shd) + ' ' + r3(0.75 + 0.25 * shd) + ') ' + tr(-g.fx, -g.fy));

    // Accents: the loop's own (fading across an expression switch), then the one-shots.
    var now = loopAccents(E);
    E.accents.forEach(function (a, i) { placeAccent(now[i], a[0], ((t - a[1]) % PERIOD + PERIOD) % PERIOD / a[2], i, sw); });
    if (Pv !== E) {
      var was = loopAccents(Pv);
      Pv.accents.forEach(function (a, i) { placeAccent(was[i], a[0], ((t - a[1]) % PERIOD + PERIOD) % PERIOD / a[2], i, 1 - sw); });
    }
    if (rig.petting && pet > 0.5 && clock - rig.petHeartAt > 650) { rig.petHeartAt = clock; shot('heart', clock); }
    for (var j = 0; j < shots.length; j++) {
      var sh = shots[j];
      placeAccent(sh.el, sh.type, (clock - sh.start) / ACCENT[sh.type].dur, sh.i, 1);
    }
  };
  return rig;
}

export { ACCENT, hatFit, hatSpring, boxIn, hopSum, hopLoop, makeDog };
