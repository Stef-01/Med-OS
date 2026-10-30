// parts.mjs — the drawing kit: SVG helpers and the markup of one dog
// Part of the dog kit (public/doberman/): motion.mjs (easing, keyframes, the loop's clock), expressions.mjs (what a
// dog can feel), breeds.mjs (who the dogs are), parts.mjs (how a dog is drawn), rig.mjs (one dog, animated) and
// stage.mjs (the page: the scene, the menu, the embed's messages). docs/doberman/README.md has the map.
import { pupilMarkup, eyeShape, irisOf } from './eyes.mjs';

// ---- drawing helpers ----
var NS = 'http://www.w3.org/2000/svg';
function r3(v) { return Math.round(v * 1000) / 1000; }
function set(node, attr, v) {
  var s = typeof v === 'number' ? String(r3(v)) : v;
  if (node.getAttribute(attr) !== s) node.setAttribute(attr, s);
}
function rot(deg, cx, cy) { return 'rotate(' + r3(deg) + ' ' + cx + ' ' + cy + ')'; }
function tr(x, y) { return 'translate(' + r3(x) + ' ' + r3(y) + ')'; }
function pt(p) { return r3(p[0]) + ' ' + r3(p[1]); }

// A U: rounded top corners of radius r, straight sides, a full half-circle bottom.
function ellPath(cx, cy, rx, ry) {
  return 'M' + r3(cx - rx) + ' ' + cy + ' A' + r3(rx) + ' ' + r3(ry) + ' 0 1 0 ' + r3(cx + rx) + ' ' + cy + ' A' + r3(rx) + ' ' + r3(ry) + ' 0 1 0 ' + r3(cx - rx) + ' ' + cy + ' Z';
}
function uPath(cx, top, w, h, r) {
  var half = w / 2, bot = top + h, L = cx - half, R = cx + half;
  return 'M' + (L + r) + ' ' + top + ' H' + (R - r) + ' A' + r + ' ' + r + ' 0 0 1 ' + R + ' ' + (top + r) +
    ' V' + (bot - half) + ' A' + half + ' ' + half + ' 0 0 1 ' + L + ' ' + (bot - half) +
    ' V' + (top + r) + ' A' + r + ' ' + r + ' 0 0 1 ' + (L + r) + ' ' + top + ' Z';
}

// A head's outline (founder 2026-10-26: "refine so all the faces dont look the same, and overly circular"): the top edge
// is every dog's (100 wide, y -55, so every hat sits the same), the jaw is the breed's. round: the old U, a semicircle;
// square: a broad flat jaw with rounded corners (bulldogs, boxers, mastiffs); wedge: straight cheeks tapering to a
// narrow soft chin (huskies, shibas, foxy dogs); cheeky: full cheeks a touch past the sides, then a round chin (fluffy
// toys). Inside -50..52 at every height, so what fits the old head still fits.
// LPS style (eyes.mjs): each eye a rounder white of its own, set LPS_GAP eye-units out from the middle (the reference's
// eyes are 0.56 of the head apart, each a third of it wide, measured 2026-10-26), its own clip the same shape
var LPS_GAP = 9, LPS_GLASSES = 1.62;
var LPS_EYE_L = '<ellipse cx="-10.7" cy="-30.6" rx="12.4" ry="13.6"/>', LPS_EYE_R = '<ellipse cx="12.7" cy="-30.6" rx="12.4" ry="13.6"/>';

function headOutline(c) {
  var h = c.head.h, r = c.head.r, top = -55, bot = top + h, L = -50, R = 50, jaw = c.head.jaw || 'round';
  var start = 'M' + (L + r) + ' ' + top + ' H' + (R - r) + ' A' + r + ' ' + r + ' 0 0 1 ' + R + ' ' + (top + r);
  var back = ' A' + r + ' ' + r + ' 0 0 1 ' + (L + r) + ' ' + top + ' Z';
  if (jaw === 'square') {
    var rb = 26;
    return start + ' V' + (bot - rb) + ' A' + rb + ' ' + rb + ' 0 0 1 ' + (R - rb) + ' ' + bot + ' H' + (L + rb) + ' A' + rb + ' ' + rb + ' 0 0 1 ' + L + ' ' + (bot - rb) + ' V' + (top + r) + back;
  }
  if (jaw === 'wedge') {
    var y1 = top + h * 0.5, cw = 12;
    return start + ' V' + r3(y1) + ' C' + R + ' ' + r3(y1 + (bot - y1) * 0.55) + ' ' + (cw + 14) + ' ' + bot + ' ' + cw + ' ' + bot +
      ' H' + (-cw) + ' C' + (-cw - 14) + ' ' + bot + ' ' + L + ' ' + r3(y1 + (bot - y1) * 0.55) + ' ' + L + ' ' + r3(y1) + ' V' + (top + r) + back;
  }
  if (jaw === 'cheeky') {
    var y2 = top + h * 0.56;
    return start + ' V' + r3(y2 - 12) + ' C' + (R + 2) + ' ' + r3(y2) + ' ' + (R + 1) + ' ' + r3(bot - 14) + ' ' + (R - 22) + ' ' + r3(bot - 2) +
      ' Q0 ' + (bot + 3) + ' ' + (L + 22) + ' ' + r3(bot - 2) + ' C' + (L - 1) + ' ' + r3(bot - 14) + ' ' + (L - 2) + ' ' + r3(y2) + ' ' + L + ' ' + r3(y2 - 12) + ' V' + (top + r) + back;
  }
  return uPath(0, top, 100, h, r);
}

// An upright ear in two parts: a base that turns at its root, and a tip hinged 24 units up
// that folds over like a page (its height flips through zero), so an ear goes up and down
// without ever swapping drawings. The tip overlaps the base by 2 units, so the hinge has no seam.
var EAR_UP = { L: { x: -29, y: -47 }, R: { x: 31, y: -47 } };
var EAR_FLOP = { L: { x: -37, y: -47 }, R: { x: 39, y: -47 } };
var HEART = '<rect x="-5" y="-5" width="10" height="10" rx="2.4" transform="translate(0 -2.4) rotate(45)" fill="#ff4b4b"/>' +
            '<circle cx="-3.4" cy="-6" r="4.9" fill="#ff4b4b"/><circle cx="3.4" cy="-6" r="4.9" fill="#ff4b4b"/>';

// "Deal with it" shades, on a 5-unit pixel grid, sized to cover both eyes.
var SHADES = (function () {
  var k = '#15131c', w = '#ffffff';
  var cells = [[-27, -48, 56, 5, k], [-25, -43, 25, 10, k], [-21, -33, 17, 5, k], [-17, -28, 9, 5, k],
               [2, -43, 25, 10, k], [6, -33, 17, 5, k], [10, -28, 9, 5, k], [0, -43, 2, 5, k],
               [-21, -43, 5, 5, w], [-16, -38, 5, 5, w], [6, -43, 5, 5, w], [11, -38, 5, 5, w]];
  return '<g data-p="shades" opacity="0">' + cells.map(function (q) {
    return '<rect x="' + q[0] + '" y="' + q[1] + '" width="' + q[2] + '" height="' + q[3] + '" rx="0.8" fill="' + q[4] + '"/>';
  }).join('') + '</g>';
})();

// ---- the kits a breed picks from (breeds.mjs) ----
/* an up ear (the 'up' engine: EAR_UP, rig.mjs turns it at the root and folds its tip): `base` draws the part below the
   hinge (o: the ear's front, i: its inner), `out` and `in` the tip above it, in the tip's own space (the hinge at 0, its
   foot 2 units under it so the fold has no seam). An ear with no tip ('round') draws all of itself in its base */
var UP_EARS = {
  // a doberman's tall pointed ear; the round crease at the hinge reads as folded, not cut flat, when the tip goes over
  dober: {
    base: function (o, i) { return '<path d="M-14 10 L-9.66 -24 L9.66 -24 L14 10 Z" fill="' + o + '"/><circle cx="0" cy="-24" r="9.66" fill="' + o + '"/>' +
      '<path d="M-7 4 L-4.05 -24 L4.05 -24 L7 4 Z" fill="' + i + '"/>'; },
    out: 'M-9.92 2 L-6.6 -24 C-5.54 -32.3 5.54 -32.3 6.6 -24 L9.92 2 Z', in: 'M-4.26 2 L-3 -10 C-2.42 -15.5 2.42 -15.5 3 -10 L4.26 2 Z' },
  // a Pomeranian's small rounded ear, one piece
  round: {
    base: function (o, i) { return '<path d="M-16 10 L-11 -14 Q-6 -34 0 -34 Q6 -34 11 -14 L16 10 Z" fill="' + o + '"/>' +
      '<path d="M-6.5 -4 L-5 -13 Q-3 -24 0 -24 Q3 -24 5 -13 L6.5 -4 Z" fill="' + i + '"/>'; }, out: '', in: '' },
  // a husky's or a shiba's: a thick triangle on a broad root, its point softened
  prick: {
    base: function (o, i) { return '<path d="M-17 10 L-10 -24 L10 -24 L17 10 Z" fill="' + o + '"/><path d="M-9 6 L-5.2 -24 L5.2 -24 L9 6 Z" fill="' + i + '"/>'; },
    out: 'M-10.4 2 L-1.8 -21 Q0 -24.5 1.8 -21 L10.4 2 Z', in: 'M-5.4 2 L-1 -12 Q0 -14 1 -12 L5.4 2 Z' },
  // a corgi's: the prick ear, broader and taller
  bat: {
    base: function (o, i) { return '<path d="M-19 10 L-12 -24 L12 -24 L19 10 Z" fill="' + o + '"/><path d="M-10 7 L-6.5 -24 L6.5 -24 L10 7 Z" fill="' + i + '"/>'; },
    out: 'M-12.4 2 L-2.2 -27 Q0 -31 2.2 -27 L12.4 2 Z', in: 'M-6.6 2 L-1.2 -18 Q0 -20.5 1.2 -18 L6.6 2 Z' },
  // a terrier's button ear: a short root and a short flap that folds over it (breeds.mjs holds it folded)
  button: {
    base: function (o, i) { return '<path d="M-14 10 L-11 -24 L11 -24 L14 10 Z" fill="' + o + '"/><circle cx="0" cy="-24" r="11" fill="' + o + '"/>' +
      '<path d="M-7 6 L-5 -24 L5 -24 L7 6 Z" fill="' + i + '"/>'; },
    out: 'M-11.4 2 L-2 -16 Q0 -19 2 -16 L11.4 2 Z', in: 'M-5.5 2 L-1 -9 Q0 -10.5 1 -9 L5.5 2 Z' },
  // a French bulldog's bat ear: broad from the root, short, its top a wide round arch (its sides run on through the
  // hinge without a bend)
  frenchie: {
    base: function (o, i) { return '<path d="M-23 10 L-21 -24 L21 -24 L23 10 Z" fill="' + o + '"/><path d="M-12 6 L-10.6 -24 L10.6 -24 L12 6 Z" fill="' + i + '"/>'; },
    out: 'M-21.2 2 C-20.3 -13 -11 -29 0 -29 C11 -29 20.3 -13 21.2 2 Z',
    in: 'M-10.7 2 C-10.2 -7 -6 -17 0 -17 C6 -17 10.2 -7 10.7 2 Z' },
  // a Chihuahua's: a huge leaf on a broad root, its sides bowed, its point softened
  chi: {
    base: function (o, i) { return '<path d="M-21 10 L-14.5 -24 L14.5 -24 L21 10 Z" fill="' + o + '"/><path d="M-11 6 L-8 -24 L8 -24 L11 6 Z" fill="' + i + '"/>'; },
    out: 'M-14.8 2 C-12 -12 -6 -28 -1.8 -34.5 Q0 -37 1.8 -34.5 C6 -28 12 -12 14.8 2 Z',
    in: 'M-8.2 2 C-6.6 -9 -3.4 -19 -1.1 -23.5 Q0 -25 1.1 -23.5 C3.4 -19 6.6 -9 8.2 2 Z' }
};
/* a hanging ear (the 'flop' engine: EAR_FLOP, rig.mjs swings it), w wide and h long from 7 above its root: an outline
   path (for a clip, when markings sit on it) and the markup that draws it */
var FLOP_EARS = {
  pill: function (w, h) {
    var r = w / 2;
    return { d: 'M' + (-r) + ' ' + (-7 + r) + ' A' + r + ' ' + r + ' 0 0 1 ' + r + ' ' + (-7 + r) + ' V' + (h - 7 - r) + ' A' + r + ' ' + r + ' 0 0 1 ' + (-r) + ' ' + (h - 7 - r) + ' Z',
      draw: function (f) { return '<rect x="' + (-w / 2) + '" y="-7" width="' + w + '" height="' + h + '" rx="' + w / 2 + '" fill="' + f + '"/>'; } };
  },
  // a retriever's: soft and wide, flaring to a feathered edge in two scallops
  feather: function (w, h) {
    var r = w / 2, b = h - 7;
    var d = 'M' + (-r) + ' ' + (-7 + r) + ' A' + r + ' ' + r + ' 0 0 1 ' + r + ' ' + (-7 + r) + ' L' + (r + 2.5) + ' ' + r3(b - 7) +
      ' Q' + (r + 2) + ' ' + b + ' ' + r3(w / 6 + 1) + ' ' + r3(b - 2) + ' Q0 ' + (b + 3) + ' ' + r3(-w / 6 - 1) + ' ' + r3(b - 2) +
      ' Q' + (-r - 2) + ' ' + b + ' ' + (-r - 2.5) + ' ' + r3(b - 7) + ' Z';
    return { d: d, draw: function (f) { return '<path d="' + d + '" fill="' + f + '"/>'; } };
  },
  // a dachshund's or a hound's: long, narrow at the root, rounder at the end
  long: function (w, h) {
    var t = w * 0.4, r = w / 2, b = h - 7;
    var d = 'M' + r3(-t) + ' ' + r3(-7 + t) + ' A' + r3(t) + ' ' + r3(t) + ' 0 0 1 ' + r3(t) + ' ' + r3(-7 + t) + ' L' + r + ' ' + (b - r) +
      ' A' + r + ' ' + r + ' 0 0 1 ' + (-r) + ' ' + (b - r) + ' Z';
    return { d: d, draw: function (f) { return '<path d="' + d + '" fill="' + f + '"/>'; } };
  },
  // a pug's rose ear: a small soft flap
  rose: function (w, h) {
    var r = w / 2;
    var d = 'M' + (-r) + ' -5 Q0 -10 ' + r + ' -5 Q' + r + ' ' + r3(h * 0.6) + ' 0 ' + (h - 6) + ' Q' + (-r) + ' ' + r3(h * 0.6) + ' ' + (-r) + ' -5 Z';
    return { d: d, draw: function (f) { return '<path d="' + d + '" fill="' + f + '"/>'; } };
  },
  // a rottweiler's or a boxer's: a triangle on a broad root, hanging to a rounded point
  tri: function (w, h) {
    var r = w / 2, b = h - 7, t = r3(w * 0.16);
    var d = 'M' + (-r) + ' -3 Q0 -11 ' + r + ' -3 L' + t + ' ' + r3(b - 4) + ' Q0 ' + (b + 1) + ' ' + (-t) + ' ' + r3(b - 4) + ' Z';
    return { d: d, draw: function (f) { return '<path d="' + d + '" fill="' + f + '"/>'; } };
  },
  // a spaniel's or a shih tzu's: long silky hair, narrow at the root, its sides in soft waves down to a scalloped end
  silk: function (w, h) {
    var t = w * 0.4, r = w / 2, b = h - 7;
    var d = 'M' + r3(-t) + ' ' + r3(-7 + t) + ' A' + r3(t) + ' ' + r3(t) + ' 0 0 1 ' + r3(t) + ' ' + r3(-7 + t) +
      ' Q' + r3(r + 1) + ' ' + r3(b * 0.3) + ' ' + r3(r - 1) + ' ' + r3(b * 0.5) + ' Q' + r3(r + 4) + ' ' + r3(b * 0.72) + ' ' + r3(r + 2) + ' ' + r3(b - 5) +
      ' Q' + r + ' ' + (b + 2) + ' ' + r3(w / 6) + ' ' + (b - 1) + ' Q0 ' + (b + 4) + ' ' + r3(-w / 6) + ' ' + (b - 1) +
      ' Q' + (-r) + ' ' + (b + 2) + ' ' + r3(-r - 2) + ' ' + r3(b - 5) + ' Q' + r3(-r - 4) + ' ' + r3(b * 0.72) + ' ' + r3(-r + 1) + ' ' + r3(b * 0.5) +
      ' Q' + r3(-r - 1) + ' ' + r3(b * 0.3) + ' ' + r3(-t) + ' ' + r3(-7 + t) + ' Z';
    return { d: d, draw: function (f) { return '<path d="' + d + '" fill="' + f + '"/>'; } };
  },
  // a poodle's: a pendant of curls, puffs in pairs down from a small one at the root to a round one at the end
  puff: function (w, h) {
    var Q = [[0, -7 + w * 0.36, w * 0.36], [-w * 0.2, -7 + h * 0.4, w * 0.36], [w * 0.2, -7 + h * 0.4, w * 0.36],
      [-w * 0.22, -7 + h * 0.62, w * 0.38], [w * 0.22, -7 + h * 0.62, w * 0.38], [0, h - 7 - w * 0.4, w * 0.4]];
    var d = Q.map(function (q) { return ellPath(r3(q[0]), r3(q[1]), q[2], q[2]); }).join(' ');
    return { d: d, draw: function (f) { return Q.map(function (q) { return '<circle cx="' + r3(q[0]) + '" cy="' + r3(q[1]) + '" r="' + r3(q[2]) + '" fill="' + f + '"/>'; }).join(''); } };
  }
};
/* a breed's markings (breeds.mjs `marks`): SVG with {role} for a palette colour (or a function of the build's geometry
   returning it), clipped to the part it sits on, so a patch never spills past an outline */
function paint(svg, c) {
  var s = typeof svg === 'function' ? svg(c.geo, c) : svg;
  return s.replace(/\{([A-Za-z]+)\}/g, function (all, k) { return c.pal[k] || all; });
}
// Neglect, in the dogs' flat style: a dull grey wash, mud blotches and a few matted knots (dark tangled tufts). The rig
// fades the group in from mood.mjs's dirt; a played game takes it away.
var MUD = '#6b4a2e', MUD2 = '#54391f', KNOT = '#3d342c';
function GRIME_BODY(bL, w, h) {
  var x = function (f) { return r3(bL + w * f); }, out = '<rect x="' + (bL - 4) + '" y="-24" width="' + (w + 8) + '" height="' + (h + 8) + '" fill="#7d7a74" opacity="0.32"/>';
  [[0.18, 14, 9, 6], [0.42, 30, 11, 7], [0.7, 8, 8, 5.5], [0.85, 36, 10, 6], [0.3, 46, 7, 4.5]].forEach(function (b, i) {
    out += '<ellipse cx="' + x(b[0]) + '" cy="' + b[1] + '" rx="' + b[2] + '" ry="' + b[3] + '" fill="' + (i % 2 ? MUD2 : MUD) + '" opacity="0.85"/>';
  });
  [[0.12, -10], [0.36, -14], [0.58, -12], [0.8, -8]].forEach(function (k) {
    var cx = bL + w * k[0], cy = k[1];
    out += '<path d="M' + r3(cx - 6) + ' ' + cy + ' q3 -6 6 0 q3 6 6 0 M' + r3(cx - 4) + ' ' + (cy + 4) + ' q2 -4 4 0 q2 4 4 0" fill="none" stroke="' + KNOT + '" stroke-width="2" stroke-linecap="round"/>';
  });
  return out;
}
var GRIME_HEAD = '<rect x="-60" y="-60" width="122" height="120" fill="#7d7a74" opacity="0.3"/>' +
  '<ellipse cx="-32" cy="-44" rx="12" ry="7" fill="' + MUD + '" opacity="0.85"/><ellipse cx="36" cy="10" rx="11" ry="7" fill="' + MUD2 + '" opacity="0.85"/>' +
  '<ellipse cx="24" cy="-50" rx="7" ry="4.6" fill="' + MUD2 + '" opacity="0.85"/><ellipse cx="-38" cy="18" rx="8" ry="5" fill="' + MUD + '" opacity="0.8"/>' +
  '<circle cx="-14" cy="-50" r="2.6" fill="' + MUD + '"/><circle cx="44" cy="-22" r="2.2" fill="' + MUD2 + '"/>' +
  '<path d="M-44 -10 q3 -7 7 0 q3 7 7 0 M40 -32 q3 -7 7 0 q3 7 7 0 M-8 -54 q3 -6 7 0 q3 6 7 0 M-46 30 q3 -6 6 0 q3 6 6 0" fill="none" stroke="' + KNOT + '" stroke-width="2.6" stroke-linecap="round"/>';

function marksOn(c, on) { return (c.marks || []).filter(function (m) { return m.on === on; }).map(function (m) { return paint(m.svg, c); }).join(''); }
function clipped(id, outline, inner) { return inner ? '<clipPath id="' + id + '">' + outline + '</clipPath><g clip-path="url(#' + id + ')">' + inner + '</g>' : ''; }

// A Pomeranian's mane: big soft scallops round the head in two tones (a shadow ring set low, the coat ring over it),
// so it reads as fur with depth, not a flat disc. The bib: cream cheeks and chest over the lower head, under the face
// (`bib: 'chest'`: the chest alone, a ruff under the chin).
function MANE(p, c) {
  var m = c.mane, sh = '', hi = '';
  for (var i = 0; i < m.n; i++) {
    var a = (i / m.n) * Math.PI * 2 + 0.2;
    sh += '<circle cx="' + r3(1 + Math.cos(a) * m.rx) + '" cy="' + r3(-6 + Math.sin(a) * m.ry) + '" r="' + m.sc + '" fill="' + p.maneSh + '"/>';
    hi += '<circle cx="' + r3(1 + Math.cos(a + Math.PI / m.n) * (m.rx - 6)) + '" cy="' + r3(-10 + Math.sin(a + Math.PI / m.n) * (m.ry - 6)) + '" r="' + (m.sc - 1) + '" fill="' + p.mane + '"/>';
  }
  return '<g data-p="ruff">' + sh + '<ellipse cx="1" cy="-6" rx="' + m.rx + '" ry="' + m.ry + '" fill="' + p.maneSh + '"/>' + hi +
    '<ellipse cx="1" cy="-10" rx="' + (m.rx - 6) + '" ry="' + (m.ry - 6) + '" fill="' + p.mane + '"/></g>';
}
function BIB(p, c) {
  var hb = -55 + c.head.h, k = '', chest = c.bib === 'chest';
  var Q = chest ? [[-14, hb + 2, 11], [16, hb + 2, 11], [1, hb + 8, 12]]
    : [[-30, hb - 10, 11], [32, hb - 10, 11], [-16, hb + 2, 12], [18, hb + 2, 12], [1, hb + 8, 12]];
  Q.forEach(function (q) { k += '<circle cx="' + q[0] + '" cy="' + (q[1] + 2) + '" r="' + (q[2] + 1) + '" fill="' + p.bibSh + '"/>'; });
  Q.forEach(function (q) { k += '<circle cx="' + q[0] + '" cy="' + (q[1] - 1) + '" r="' + q[2] + '" fill="' + p.bib + '"/>'; });
  return '<g data-p="bib">' + k + (chest ? '' : '<ellipse cx="1" cy="' + (hb - 6) + '" rx="28" ry="13" fill="' + p.bib + '"/>') + '</g>';
}

function scl(k, x, y) { return k === 1 ? '' : 'translate(' + x + ' ' + y + ') scale(' + k + ') translate(' + (-x) + ' ' + (-y) + ')'; }
function dogMarkup(c, P) {
  var lps = c.style === 'lps', gap = lps ? LPS_GAP : 0, p = c.pal, s = c.scale, m = c.mirror ? -1 : 1;
  var hb = -55 + c.head.h;                       // head bottom
  var bR = 36, bL = bR - c.body.w;               // body edges
  var fx = (bL + bR) / 2, fy = c.floorY;          // floor point under the body
  var LEGS = c.body.legs || [23, 56, 89], TAIL = c.tail.at || [12, 12];   // from the body's back end
  c.geo = { hb: hb, bL: bL, bR: bR, fx: fx, fy: fy, legs: LEGS.map(function (x) { return bL + x; }), tail: [bL + TAIL[0], TAIL[1]] };
  var behind = marksOn(c, 'behind');
  c.neckOn = c.neckOn || (c.mane || c.bib || behind ? 'head' : 'collar');   // neckwear on the collar, or over a mane, a bib or what is drawn behind the head (an Eevee's ruff covers the collar band)
  var legs = c.geo.legs.map(function (x, i) {
    var foot = i === 0 ? p.footFar : p.foot;     // the far leg is one step darker
    return '<g data-p="leg' + i + '">' +
      '<rect x="' + (x - c.leg / 2) + '" y="24" width="' + c.leg + '" height="' + (fy - 24) + '" rx="' + c.leg / 2 + '" fill="' + p.body + '"/>' +
      '<rect x="' + (x - c.leg / 2) + '" y="' + (fy - 16) + '" width="' + c.leg + '" height="16" rx="' + c.leg / 2 + '" fill="' + foot + '"/></g>';
  }).join('');
  var back = '', front = '', tips = '', under = '';   // under: each hanging ear's outline, for the glasses' arms to tuck beneath
  ['L', 'R'].forEach(function (side, i) {
    var o = p['ear' + side], inner = p['earIn' + side];
    if (c.ears[i] === 'up') {
      var U = UP_EARS[c.earShape || 'dober'];
      back += '<g data-p="ear' + side + '">' + U.base(o, inner) + '</g>';
      tips += '<g data-p="tip' + side + '"><path data-p="tipOut' + side + '" d="' + (U.out || 'M0 0') + '" fill="' + (U.out ? o : 'none') + '"/>' +
        '<path data-p="tipIn' + side + '" d="' + (U.in || 'M0 0') + '"' + (U.in ? ' fill="' + inner + '"' : '') + '/>' +
        (U.out ? clipped(P + '-tipm' + side, '<path d="' + U.out + '"/>', marksOn(c, 'ear' + side)) : '') + '</g>';   // an upright ear's marks ride its tip (a band, a leaf)
    } else {
      var F = FLOP_EARS[c.flop.shape || 'pill'](c.flop.w, c.flop.h);
      front += '<g data-p="ear' + side + '">' + F.draw(o) + clipped(P + '-ear' + side, '<path d="' + F.d + '"/>', marksOn(c, 'ear' + side)) + '</g>';
      under += '<path data-p="armEar' + side + '" d="' + F.d + '" fill="#000"/>';
    }
  });
  var headPath = headOutline(c), muzzlePath = uPath(1, -17, c.muzzle.w, c.muzzle.h, c.muzzle.r || 10);
  // a snout mark above the muzzle's top (y -17: the bridge of the nose, a pug's or a frenchie's brow wrinkle) lies over
  // the eyes but under the glasses worn on them, unscaled by the eyes' group; the rest of it lies on the snout, over
  // everything there. rig.mjs moves the bridge with the snout's turn
  var snoutMarks = marksOn(c, 'snout'), bridge = snoutMarks ? '<g data-p="bridge" transform="translate(1 -17.4) scale(' + r3(1 / c.eye) + ') translate(-1 17.4)">' +
    clipped(P + '-bridge', '<rect x="-80" y="-100" width="160" height="83"/>', snoutMarks) + '</g>' : '';
  var bodyRect = '<rect x="' + bL + '" y="-20" width="' + c.body.w + '" height="' + c.body.h + '" rx="' + r3(c.body.h * 0.476) + '"', bodyMarks = marksOn(c, 'body');
  function tailLine(k, col, w, more) { return '<path data-p="' + k + '" d="M0 0" fill="none" stroke="' + col + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round"' + (more || '') + '/>'; }
  // the tail, and a plume's lighter core or a spotted tail's spots (round dashes along the same line)
  var tail = tailLine('tail', p.tail, c.tail.w) + (c.tail.inner ? tailLine('tailIn', p.tailIn || p.tan, c.tail.inner) : '') +
    (c.tail.dots ? tailLine('tailDots', p.tailDots || p.spot, c.tail.dots, ' stroke-dasharray="0 ' + r3(c.tail.dots * 2.2) + '"') : '');
  var bone = '<g data-p="bone" opacity="0"><rect x="-11" y="-3.2" width="22" height="6.4" rx="3.2" fill="#fff1c9"/>' +
    '<circle cx="-11" cy="-3.2" r="4" fill="#fff1c9"/><circle cx="-11" cy="3.2" r="4" fill="#fff1c9"/>' +
    '<circle cx="11" cy="-3.2" r="4" fill="#fff1c9"/><circle cx="11" cy="3.2" r="4" fill="#fff1c9"/></g>';
  var heye = '<g opacity="0"><g transform="scale(1.15)">' + HEART + '</g></g>';
  return '' +
    '<circle class="disc" data-p="disc" cx="0" cy="-125" r="140" fill="' + p.disc + '"/>' +
    '<g data-p="dog" style="--dob-coat:' + p.coat + ';--dob-sh:' + p.sh + ';--dob-tan:' + p.tan + '" transform="' + tr(m * 18 * s, -fy * s) + ' scale(' + m * s + ' ' + s + ')">' +
      '<rect data-p="floor" x="' + (fx - 75) + '" y="' + (fy - 5) + '" width="150" height="10" rx="5" fill="' + p.floor + '"/>' +
      '<g data-p="body">' +
        // back bling rides the body behind everything (wings, packs, capes peek out round the head and body)
        '<g data-p="wearBack"></g>' +
        (c.tail.over ? '' : tail) +
        bodyRect + ' fill="' + p.body + '"/>' +
        '<clipPath id="' + P + '-body">' + bodyRect + '/></clipPath>' +
        (bodyMarks ? '<g clip-path="url(#' + P + '-body)">' + bodyMarks + '</g>' : '') +
        // neglect (mood.mjs): the fur dulled, mud on the coat and matted knots, faded in by the rig (rig.setMood)
        '<g data-p="grimeB" opacity="0" clip-path="url(#' + P + '-body)">' + GRIME_BODY(bL, c.body.w, c.body.h) + '</g>' +
        // what lies on the body (a cape's near side: a back piece's [data-on], stage.mjs moves it here) over the coat and
        // its marks, trimmed to the body's outline and fitted to its build (drape); under a curled tail and the legs
        '<g data-p="wearOn" clip-path="url(#' + P + '-body)"><g data-p="wearOnPop"><g data-p="wearOnFit" transform="' + drape(c).on + '"></g></g></g>' +
        (c.tail.over ? tail : '') +   // a tail that curls over the back lies on it
        legs +
      '</g>' +
      '<g data-p="collar">' +
        '<circle cx="-2" cy="' + (hb - 45 + collarCut(hb)) + '" r="' + (51 - collarCut(hb)) + '" fill="' + p.collar + '"/>' +   // its crescent under the chin; its top stays inside a short head
        '<g data-p="tag">' +
          '<rect x="-5.5" y="' + (hb + 3) + '" width="3" height="6" rx="1.5" fill="' + p.tagSh + '"/>' +
          '<circle cx="-4" cy="' + (hb + 14) + '" r="7" fill="' + p.tag + '"/>' +
          '<circle cx="-4" cy="' + (hb + 14) + '" r="2.6" fill="' + p.tagSh + '"/>' +
        '</g>' +
        (c.neckOn === 'collar' ? '<g data-p="wearNeck" transform="translate(0 ' + (hb - 2) + ')"></g>' : '') +   // on the collar's crescent under the chin (hb-8 hid a chain behind it)
      '</g>' +
      '<g data-p="head">' +
        (c.mane ? MANE(p, c) : '') +
        (behind ? '<clipPath id="' + P + '-behindTrim"><rect x="-400" y="-400" width="800" height="' + (398 + hb) + '"/></clipPath><g data-p="behind">' + behind + '</g>' : '') +   // unclipped, behind the head: a ruff, a frill, a spiky collar (the Eevee family)
        '<g data-p="earsBack" id="' + P + '-eb">' + back + '</g>' +
        '<path d="' + headPath + '" fill="' + p.coat + '"/>' +
        clipped(P + '-head', '<path d="' + headPath + '"/>', marksOn(c, 'head')) +
        '<g data-p="grimeH" opacity="0">' + clipped(P + '-headg', '<path d="' + headPath + '"/>', GRIME_HEAD) + '</g>' +
        (c.bib ? BIB(p, c) : '') +
        '<g data-p="earsFront">' + front + '</g>' +
        '<g data-p="earTips" id="' + P + '-et">' + tips + '</g>' +
        marksOn(c, 'crest') +    // unclipped, over the head and ears: a tuft, a fin, a headpiece, a bow
        ''+
        '<g data-p="feat">' +
          '<rect data-p="browL"' + (lps ? ' display="none"' : '') + ' x="' + (-10.7 - c.brow.w / 2) + '" y="' + c.brow.y + '" width="' + c.brow.w + '" height="' + c.brow.h + '" rx="' + c.brow.h / 2 + '" fill="' + p.brow + '"/>' +
          '<rect data-p="browR"' + (lps ? ' display="none"' : '') + ' x="' + (12.7 - c.brow.w / 2) + '" y="' + c.brow.y + '" width="' + c.brow.w + '" height="' + c.brow.h + '" rx="' + c.brow.h / 2 + '" fill="' + p.brow + '"/>' +
          '<g transform="translate(0 ' + (lps ? 3 : 0) + ')">' +   // LPS: the eyes a little lower, mid-face
          '<g transform="translate(1 -17.4) scale(' + c.eye + ') translate(-1 17.4)">' +
            (lps ? '<clipPath id="' + P + '-eyeL">' + LPS_EYE_L + '</clipPath><clipPath id="' + P + '-eyeR">' + LPS_EYE_R + '</clipPath>' :
            '<clipPath id="' + P + '-eyeL"><path d="M1 -17.4 V-33.3 A11.7 11.7 0 0 0 -22.4 -33.3 V-25.4 A8 8 0 0 0 -14.4 -17.4 Z"/></clipPath>' +
            '<clipPath id="' + P + '-eyeR"><path d="M1 -17.4 V-33.3 A11.7 11.7 0 0 1 24.4 -33.3 V-25.4 A8 8 0 0 1 16.4 -17.4 Z"/></clipPath>') +
            '<clipPath id="' + P + '-lidL"><rect x="-23.7" y="-46.5" width="25.3" height="30.5"/></clipPath>' +
            '<clipPath id="' + P + '-lidR"><rect x="0.4" y="-46.5" width="25.3" height="30.5"/></clipPath>' +
            // both whites as ONE outline: two clip edges meeting at the centre line leave a hairline
            (lps ? '<g data-p="white" fill="#ffffff"><g transform="translate(' + (-gap) + ' 0)">' + LPS_EYE_L + '</g><g transform="translate(' + gap + ' 0)">' + LPS_EYE_R + '</g></g>' :
            '<path data-p="white" d="M1 -17.4 H-14.4 A8 8 0 0 1 -22.4 -25.4 V-33.3 A11.7 11.7 0 0 1 1 -33.3 A11.7 11.7 0 0 1 24.4 -33.3 V-25.4 A8 8 0 0 1 16.4 -17.4 Z" fill="#ffffff"/>') +
            '<g transform="translate(' + (-gap) + ' 0)">' +   // LPS: the left eye, all of it, set out from the middle
            '<g clip-path="url(#' + P + '-eyeL)"><g data-p="pupilL">' +
              pupilMarkup(eyeShape(c.eyes), irisOf(c.iris), p.ink, -7.3, -1, p.lidL) + '</g>' +
              '<g data-p="heyeL">' + heye + '</g></g>' +
            '</g><g transform="translate(' + gap + ' 0)">' +
            '<g clip-path="url(#' + P + '-eyeR)"><g data-p="pupilR">' +
              pupilMarkup(eyeShape(c.eyes), irisOf(c.iris), p.ink, 12.1, 1, p.lidR) + '</g>' +
              '<g data-p="heyeR">' + heye + '</g></g>' + '</g>' +
            // the lids, and the cheeks that rise into a squint, wear the face round each eye (a patch over one: its colour)
            '<g transform="translate(' + (-gap) + ' 0)"><g clip-path="url(#' + P + '-lidL)">' +
              '<rect data-p="lidL" x="-30" y="-76" width="38" height="29.5" fill="' + p.lidL + '"/>' +
              '<circle data-p="cheekL" cx="-10.7" cy="-1.2" r="15" fill="' + p.lidL + '"/></g></g>' +
            '<g transform="translate(' + gap + ' 0)"><g clip-path="url(#' + P + '-lidR)">' +
              '<rect data-p="lidR" x="-6" y="-76" width="38" height="29.5" fill="' + p.lidR + '"/>' +
              '<circle data-p="cheekR" cx="12.7" cy="-1.2" r="15" fill="' + p.lidR + '"/></g></g>' +
            '<path data-p="shutL" transform="translate(' + (-gap) + ' 0)" d="M-19.5 -29 Q-10.7 -38 -1.9 -29" fill="none" stroke="' + p.feature + '" stroke-width="3.2" stroke-linecap="round" opacity="0"/>' +
            '<path data-p="shutR" transform="translate(' + gap + ' 0)" d="M3.9 -29 Q12.7 -38 21.5 -29" fill="none" stroke="' + p.feature + '" stroke-width="3.2" stroke-linecap="round" opacity="0"/>' +
            // LPS style (eyes.mjs): a dark liner hugging the top of each eye and two flicked lashes at its outer corner
            (lps ? '<g transform="translate(' + (-gap) + ' 0)"><g data-p="lashL"><path d="M-17 -51.6 Q-11 -55 -4.6 -52.2" fill="none" stroke="' + p.ink + '" stroke-width="2" stroke-linecap="round"/><path d="M-21.6 -31.6 C-21 -41 -15 -45.2 -10.2 -45.2 C-7 -45.2 -4.6 -44 -3.2 -42.4" fill="none" stroke="' + p.ink + '" stroke-width="3" stroke-linecap="round"/>' +
                     '<path d="M-21.4 -33 Q-25.4 -34.6 -27.6 -37.8 M-20.2 -37 Q-23.4 -40.4 -24.6 -44" fill="none" stroke="' + p.ink + '" stroke-width="2.2" stroke-linecap="round"/></g></g>' +
                   '<g transform="translate(' + gap + ' 0)"><g data-p="lashR"><path d="M19 -51.6 Q13 -55 6.6 -52.2" fill="none" stroke="' + p.ink + '" stroke-width="2" stroke-linecap="round"/><path d="M23.6 -31.6 C23 -41 17 -45.2 12.2 -45.2 C9 -45.2 6.6 -44 5.2 -42.4" fill="none" stroke="' + p.ink + '" stroke-width="3" stroke-linecap="round"/>' +
                     '<path d="M23.4 -33 Q27.4 -34.6 29.6 -37.8 M22.2 -37 Q25.4 -40.4 26.6 -44" fill="none" stroke="' + p.ink + '" stroke-width="2.2" stroke-linecap="round"/></g></g>' : '') +
            bridge +
            SHADES +
            // glasses ride the eyes: this group's per-dog scale and the features' yaw; a mirrored dog wears them unmirrored
            (c.glasses ? '<g transform="translate(1 -17.4) scale(' + c.glasses + ') translate(-1 17.4)">' : '<g>') +   // a big-eyed breed's glasses drawn back toward its head's width (build.glasses; rig.mjs armClip undoes it)
            (lps ? '<g transform="translate(1 0) scale(' + LPS_GLASSES + ' 1) translate(-1 0)">' : '<g>') +   // LPS: glasses spread to the set-apart eyes
            (c.mirror ? '<g transform="matrix(-1 0 0 1 2 0)"><g data-p="wearFace"></g></g>' : '<g data-p="wearFace"></g>') + '</g></g>' +
          '</g></g>' +
        '</g>' +
        '<g data-p="snout">' +
          '<path d="' + muzzlePath + '" fill="' + p.muzzle + '"/>' +
          clipped(P + '-muzzle', '<path d="' + muzzlePath + '"/>', marksOn(c, 'muzzle')) + clipped(P + '-snout', '<rect x="-80" y="-17" width="160" height="120"/>', snoutMarks) +
          '<g data-p="blush" opacity="0"><rect x="-27" y="-8" width="11" height="6" rx="3" fill="' + p.blush + '"/>' +
            '<rect x="18" y="-8" width="11" height="6" rx="3" fill="' + p.blush + '"/></g>' +
          '<g data-p="mouth"><path d="M-8.5 -7 H11.5 A10 13 0 0 1 -8.5 -7 Z" fill="' + p.mouth + '"/>' +
            '<rect data-p="teeth" x="-6.5" y="-7" width="16" height="4" rx="1.6" fill="#ffffff"/></g>' +
          '<g data-p="tongue">' +
            '<rect x="-4.5" y="-5" width="12" height="19" rx="6" fill="' + p.tongue + '"/>' +
            '<rect x="0.2" y="-3" width="2.6" height="10.5" rx="1.3" fill="' + p.tongueSh + '"/></g>' +
          (lps ? // LPS: a small button nose and a closed little smile under it (the reference has no open mouth at rest)
            '<path d="M-4.6 -20 Q1.5 -23 7.6 -20 Q8.6 -15 1.5 -12.6 Q-5.6 -15 -4.6 -20 Z" fill="' + p.nose + '"/><ellipse cx="-0.4" cy="-19" rx="2.2" ry="1.2" fill="' + p.noseHi + '"/>' +
            '<path d="M1.5 -12.6 V-10 M-6 -10.6 Q-2.4 -6.6 1.5 -10 Q5.4 -6.6 9 -10.6" fill="none" stroke="' + p.ink + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' :
          '<rect x="-8" y="-22" width="19" height="12.5" rx="6.25" fill="' + p.nose + '"/>' +
          '<rect x="-4.2" y="-19.8" width="6.5" height="2.8" rx="1.4" fill="' + p.noseHi + '"/>') +
        '</g>' +
        bone +
        (c.neckOn === 'head' ? '<g data-p="wearNeck" transform="translate(0 ' + (hb - 4) + ')"></g>' : '') +
        '<g data-p="wearHead"></g>' +
        // a hat with ear holes: the ears' parts outside the head drawn again over the brim
        '<clipPath id="' + P + '-outHead"><path clip-rule="evenodd" d="M-320 -420 H320 V320 H-320 Z ' + headPath + '"/></clipPath>' +
        '<g data-p="earsOver" display="none" clip-path="url(#' + P + '-outHead)"><use href="#' + P + '-eb"/><use href="#' + P + '-et"/></g>' +
        // glasses' arms ([data-arm]) end at the head's outline (a mane's: halfway into it, where fur hides them) and tuck
        // under a hanging ear, as they would: a mask in the head's space, carried into the glasses' own space each frame,
        // its ears moved with the real ones
        (c.mane ? '<clipPath id="' + P + '-ruff"><path data-p="ruffClip" d="M-400 -400 H400 V400 H-400 Z"/></clipPath>' : '') +
        '<mask id="' + P + '-arms" maskUnits="userSpaceOnUse" x="-400" y="-400" width="800" height="800"><g data-p="armClip">' +
          '<path d="' + (c.mane ? ellPath(1, -6, c.mane.rx + c.mane.sc / 2, c.mane.ry + c.mane.sc / 2) : headPath) + '" fill="#fff"/>' +
          (under ? '<g data-p="armEars">' + under + '</g>' : '') + '</g></mask>' +
        '<g data-p="accHead"></g>' +
      '</g>' +
      '<g data-p="acc"></g>' +
    '</g>';
}

/* a dog's own left and right, in its own units (before its scale and mirror), from its build (dogMarkup's geo): the head
   (100 wide) and the tail at full length and level (Sleepy lays it flat, Hyped streams it out, Sad lets a curl hang
   straight), on a body stretched 9 % about its middle and swayed 5 units at the hips (a hop's landing squashes it to
   0.8 and stretches it 14 % for a frame or two; frame-audit.mjs holds the result). The stage widens a long dog's frame
   to it; the rig turns a spinning dog about its middle */
function reach(c) {
  var g = c.geo, tip = g.tail[0] - c.tail.len.reduce(function (a, b) { return a + b; }, 0) - c.tail.w / 2;
  return [Math.min(-56, tip - 0.09 * (g.fx - tip) - 5), 56];
}

/* a back piece's fabric is drawn on the doberman's body (its rump at x -72, its top at -20, 83 tall, the floor at 80)
   and fitted to this dog's, from the rump: what lies on the body ([data-on], the wearOn layer) takes the body's height,
   so a hem keeps its line on the flank; what hangs from the rump ([data-rump]: a cape's free end) takes the legs' share
   of the drop, so it ends as far off the floor in proportion (on a dachshund, never through it). Neither is stretched
   along the body: a longer dog shows more of the fabric's front, which a shorter one keeps under its head */
var DRAPE = { bL: -72, h: 83, fy: 80 };
function drape(c) {
  var g = c.geo, at = 'translate(' + r3(g.bL - DRAPE.bL) + ' -20) scale(1 ';
  return { on: at + r3(c.body.h / DRAPE.h) + ') translate(0 20)', rump: at + r3((g.fy + 20) / (DRAPE.fy + 20)) + ') translate(0 20)' };
}

/* how much smaller the collar's disc runs so its top (hb - 96) stays under the head's top (-55) on a short head */
function collarCut(hb) { return Math.max(0, (46 - hb) / 2); }

export { NS, r3, set, rot, tr, pt, ellPath, uPath, scl, EAR_UP, EAR_FLOP, UP_EARS, FLOP_EARS, HEART, SHADES, MANE, BIB, dogMarkup, reach, drape };
