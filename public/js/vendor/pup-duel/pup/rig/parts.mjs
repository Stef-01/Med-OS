// parts.mjs — the drawing kit: SVG helpers and the markup of one dog
// Part of the dog kit (public/doberman/): motion.mjs (easing, keyframes, the loop's clock), expressions.mjs (what a
// dog can feel), breeds.mjs (who the dogs are), parts.mjs (how a dog is drawn), rig.mjs (one dog, animated) and
// stage.mjs (the page: the scene, the menu, the embed's messages). docs/doberman/README.md has the map.

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
    out: 'M-11.4 2 L-2 -16 Q0 -19 2 -16 L11.4 2 Z', in: 'M-5.5 2 L-1 -9 Q0 -10.5 1 -9 L5.5 2 Z' }
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
  }
};
/* a breed's markings (breeds.mjs `marks`): SVG with {role} for a palette colour (or a function of the build's geometry
   returning it), clipped to the part it sits on, so a patch never spills past an outline */
function paint(svg, c) {
  var s = typeof svg === 'function' ? svg(c.geo, c) : svg;
  return s.replace(/\{([A-Za-z]+)\}/g, function (all, k) { return c.pal[k] || all; });
}
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
  var p = c.pal, s = c.scale, m = c.mirror ? -1 : 1;
  var hb = -55 + c.head.h;                       // head bottom
  var bR = 36, bL = bR - c.body.w;               // body edges
  var fx = (bL + bR) / 2, fy = c.floorY;          // floor point under the body
  var LEGS = c.body.legs || [23, 56, 89], TAIL = c.tail.at || [12, 12];   // from the body's back end
  c.geo = { hb: hb, bL: bL, bR: bR, fx: fx, fy: fy, legs: LEGS.map(function (x) { return bL + x; }), tail: [bL + TAIL[0], TAIL[1]] };
  c.neckOn = c.neckOn || (c.mane || c.bib ? 'head' : 'collar');   // neckwear on the collar, or over a mane or a ruff
  var legs = c.geo.legs.map(function (x, i) {
    var foot = i === 0 ? p.footFar : p.foot;     // the far leg is one step darker
    return '<g data-p="leg' + i + '">' +
      '<rect x="' + (x - c.leg / 2) + '" y="24" width="' + c.leg + '" height="' + (fy - 24) + '" rx="' + c.leg / 2 + '" fill="' + p.leg + '"/>' +
      '<rect x="' + (x - c.leg / 2) + '" y="' + (fy - 16) + '" width="' + c.leg + '" height="16" rx="' + c.leg / 2 + '" fill="' + foot + '"/></g>';
  }).join('');
  var back = '', front = '', tips = '', under = '';   // under: each hanging ear's outline, for the glasses' arms to tuck beneath
  ['L', 'R'].forEach(function (side, i) {
    var o = p['ear' + side], inner = p['earIn' + side];
    if (c.ears[i] === 'up') {
      var U = UP_EARS[c.earShape || 'dober'];
      back += '<g data-p="ear' + side + '">' + U.base(o, inner) + '</g>';
      tips += '<g data-p="tip' + side + '"><path data-p="tipOut' + side + '" d="' + (U.out || 'M0 0') + '" fill="' + (U.out ? o : 'none') + '"/>' +
        '<path data-p="tipIn' + side + '" d="' + (U.in || 'M0 0') + '"' + (U.in ? ' fill="' + inner + '"' : '') + '/></g>';
    } else {
      var F = FLOP_EARS[c.flop.shape || 'pill'](c.flop.w, c.flop.h);
      front += '<g data-p="ear' + side + '">' + F.draw(o) + clipped(P + '-ear' + side, '<path d="' + F.d + '"/>', marksOn(c, 'ear' + side)) + '</g>';
      under += '<path data-p="armEar' + side + '" d="' + F.d + '" fill="#000"/>';
    }
  });
  var headPath = uPath(0, -55, 100, c.head.h, c.head.r), muzzlePath = uPath(1, -17, c.muzzle.w, c.muzzle.h, c.muzzle.r || 10);
  var bodyRect = '<rect x="' + bL + '" y="-20" width="' + c.body.w + '" height="' + c.body.h + '" rx="' + r3(c.body.h * 0.476) + '"';
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
        clipped(P + '-body', bodyRect + '/>', marksOn(c, 'body')) +
        (c.tail.over ? tail : '') +   // a tail that curls over the back lies on it
        legs +
      '</g>' +
      '<g data-p="collar">' +
        '<circle cx="-2" cy="' + (hb - 45) + '" r="51" fill="' + p.collar + '"/>' +
        '<g data-p="tag">' +
          '<rect x="-5.5" y="' + (hb + 3) + '" width="3" height="6" rx="1.5" fill="' + p.tagSh + '"/>' +
          '<circle cx="-4" cy="' + (hb + 14) + '" r="7" fill="' + p.tag + '"/>' +
          '<circle cx="-4" cy="' + (hb + 14) + '" r="2.6" fill="' + p.tagSh + '"/>' +
        '</g>' +
        (c.neckOn === 'collar' ? '<g data-p="wearNeck" transform="translate(0 ' + (hb - 2) + ')"></g>' : '') +   // on the collar's crescent under the chin (hb-8 hid a chain behind it)
      '</g>' +
      '<g data-p="head">' +
        (c.mane ? MANE(p, c) : '') +
        '<g data-p="earsBack" id="' + P + '-eb">' + back + '</g>' +
        '<path d="' + headPath + '" fill="' + p.coat + '"/>' +
        clipped(P + '-head', '<path d="' + headPath + '"/>', marksOn(c, 'head')) +
        (c.bib ? BIB(p, c) : '') +
        '<g data-p="earsFront">' + front + '</g>' +
        '<g data-p="earTips" id="' + P + '-et">' + tips + '</g>' +
        '<g data-p="feat">' +
          '<rect data-p="browL" x="' + (-10.7 - c.brow.w / 2) + '" y="' + c.brow.y + '" width="' + c.brow.w + '" height="' + c.brow.h + '" rx="' + c.brow.h / 2 + '" fill="' + p.brow + '"/>' +
          '<rect data-p="browR" x="' + (12.7 - c.brow.w / 2) + '" y="' + c.brow.y + '" width="' + c.brow.w + '" height="' + c.brow.h + '" rx="' + c.brow.h / 2 + '" fill="' + p.brow + '"/>' +
          '<g transform="translate(1 -17.4) scale(' + c.eye + ') translate(-1 17.4)">' +
            '<clipPath id="' + P + '-eyeL"><path d="M1 -17.4 V-33.3 A11.7 11.7 0 0 0 -22.4 -33.3 V-25.4 A8 8 0 0 0 -14.4 -17.4 Z"/></clipPath>' +
            '<clipPath id="' + P + '-eyeR"><path d="M1 -17.4 V-33.3 A11.7 11.7 0 0 1 24.4 -33.3 V-25.4 A8 8 0 0 1 16.4 -17.4 Z"/></clipPath>' +
            '<clipPath id="' + P + '-lidL"><rect x="-23.7" y="-46.5" width="25.3" height="30.5"/></clipPath>' +
            '<clipPath id="' + P + '-lidR"><rect x="0.4" y="-46.5" width="25.3" height="30.5"/></clipPath>' +
            // both whites as ONE outline: two clip edges meeting at the centre line leave a hairline
            '<path data-p="white" d="M1 -17.4 H-14.4 A8 8 0 0 1 -22.4 -25.4 V-33.3 A11.7 11.7 0 0 1 1 -33.3 A11.7 11.7 0 0 1 24.4 -33.3 V-25.4 A8 8 0 0 1 16.4 -17.4 Z" fill="#ffffff"/>' +
            '<g clip-path="url(#' + P + '-eyeL)"><g data-p="pupilL">' +
              '<rect x="-13" y="-40" width="11.4" height="16" rx="5.7" fill="' + p.ink + '"/><circle cx="-9.6" cy="-35.8" r="2.2" fill="#fff"/></g>' +
              '<g data-p="heyeL">' + heye + '</g></g>' +
            '<g clip-path="url(#' + P + '-eyeR)"><g data-p="pupilR">' +
              '<rect x="6.4" y="-40" width="11.4" height="16" rx="5.7" fill="' + p.ink + '"/><circle cx="9.8" cy="-35.8" r="2.2" fill="#fff"/></g>' +
              '<g data-p="heyeR">' + heye + '</g></g>' +
            // the lids, and the cheeks that rise into a squint, wear the face round each eye (a patch over one: its colour)
            '<g clip-path="url(#' + P + '-lidL)">' +
              '<rect data-p="lidL" x="-30" y="-76" width="38" height="29.5" fill="' + p.lidL + '"/>' +
              '<circle data-p="cheekL" cx="-10.7" cy="-1.2" r="15" fill="' + p.lidL + '"/></g>' +
            '<g clip-path="url(#' + P + '-lidR)">' +
              '<rect data-p="lidR" x="-6" y="-76" width="38" height="29.5" fill="' + p.lidR + '"/>' +
              '<circle data-p="cheekR" cx="12.7" cy="-1.2" r="15" fill="' + p.lidR + '"/></g>' +
            '<path data-p="shutL" d="M-19.5 -29 Q-10.7 -38 -1.9 -29" fill="none" stroke="' + p.feature + '" stroke-width="3.2" stroke-linecap="round" opacity="0"/>' +
            '<path data-p="shutR" d="M3.9 -29 Q12.7 -38 21.5 -29" fill="none" stroke="' + p.feature + '" stroke-width="3.2" stroke-linecap="round" opacity="0"/>' +
            SHADES +
            // glasses ride the eyes: this group's per-dog scale and the features' yaw; a mirrored dog wears them unmirrored
            (c.mirror ? '<g transform="matrix(-1 0 0 1 2 0)"><g data-p="wearFace"></g></g>' : '<g data-p="wearFace"></g>') +
          '</g>' +
        '</g>' +
        '<g data-p="snout">' +
          '<path d="' + muzzlePath + '" fill="' + p.muzzle + '"/>' +
          clipped(P + '-muzzle', '<path d="' + muzzlePath + '"/>', marksOn(c, 'muzzle')) + marksOn(c, 'snout') +
          '<g data-p="blush" opacity="0"><rect x="-27" y="-8" width="11" height="6" rx="3" fill="' + p.blush + '"/>' +
            '<rect x="18" y="-8" width="11" height="6" rx="3" fill="' + p.blush + '"/></g>' +
          '<g data-p="mouth"><path d="M-8.5 -7 H11.5 A10 13 0 0 1 -8.5 -7 Z" fill="' + p.mouth + '"/>' +
            '<rect data-p="teeth" x="-6.5" y="-7" width="16" height="4" rx="1.6" fill="#ffffff"/></g>' +
          '<g data-p="tongue">' +
            '<rect x="-4.5" y="-5" width="12" height="19" rx="6" fill="' + p.tongue + '"/>' +
            '<rect x="0.2" y="-3" width="2.6" height="10.5" rx="1.3" fill="' + p.tongueSh + '"/></g>' +
          '<rect x="-8" y="-22" width="19" height="12.5" rx="6.25" fill="' + p.nose + '"/>' +
          '<rect x="-4.2" y="-19.8" width="6.5" height="2.8" rx="1.4" fill="' + p.noseHi + '"/>' +
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

export { NS, r3, set, rot, tr, pt, ellPath, uPath, scl, EAR_UP, EAR_FLOP, UP_EARS, FLOP_EARS, HEART, SHADES, MANE, BIB, dogMarkup };
