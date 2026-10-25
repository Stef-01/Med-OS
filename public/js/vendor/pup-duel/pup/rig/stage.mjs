// stage.mjs — the page: a roster, a camera, the menu, pointer and petting, what a dog wears, the GIF, the embed
// Part of the dog kit (public/doberman/): motion.mjs (easing, keyframes, the loop's clock), expressions.mjs (what a
// dog can feel), breeds.mjs (who the dogs are), parts.mjs (how a dog is drawn), rig.mjs (one dog, animated) and
// stage.mjs (the page: the scene, the menu, the embed's messages). docs/doberman/README.md has the map.
import { EASE_IN_OUT, EASE_OUT, EASE_IN, clamp, PERIOD, B, SWITCH, MOVE, GIF_FPS, STILL } from './motion.mjs';
import { EXPR, EXPR_ORDER } from './expressions.mjs';
import { DOGS, resolve, dogById } from './breeds.mjs';
import { NS, r3, set, tr, reach } from './parts.mjs';
import { hatFit, boxIn, makeDog } from './rig.mjs';

// ---- the scene: a roster, a camera, and dogs that walk to their spots ----
var svg = document.getElementById('scene');
var stageEl = document.getElementById('stage');
var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
var narrowMq = window.matchMedia('(max-width: 640px)');
var clock = 0;

function tween(v) { return { a: v, b: v, s: 0, d: 0, ease: EASE_IN_OUT }; }
function tv(tw, c) {
  if (tw.d <= 0 || c >= tw.s + tw.d) return tw.b;
  return tw.a + (tw.b - tw.a) * tw.ease(clamp((c - tw.s) / tw.d, 0, 1));
}
function retarget(tw, to, d, ease) { tw.a = tv(tw, clock); tw.b = to; tw.s = clock; tw.d = d; tw.ease = ease || EASE_IN_OUT; }

var roster = DOGS.map(resolve).map(function (c) {   // every dog in breeds.mjs, its build and palette filled in
  return { c: c, rig: null, slot: null, state: 'out', tx: tween(0), ty: tween(0), moveStart: -1e12, leaveEnd: 0 };
});
var selected = roster[0];
var cam = [tween(-284), tween(-325), tween(568), tween(355)];

function positions(n) {
  if (n === 1) return [[0, 0]];
  if (n === 2) return [[-160, 0], [160, 0]];
  if (n > 4) {   // a grid, three a row (two on a phone)
    var cols = narrowMq.matches ? 2 : 3, out = [];
    for (var k = 0; k < n; k++) out.push([((k % cols) - (Math.min(cols, n - Math.floor(k / cols) * cols) - 1) / 2) * 300, Math.floor(k / cols) * 330]);
    return out;
  }
  if (n === 4) return narrowMq.matches ? [[-150, 0], [150, 0], [-150, 330], [150, 330]] : [[-450, 0], [-150, 0], [150, 0], [450, 0]];
  return narrowMq.matches ? [[-150, 0], [150, 0], [0, 330]] : [[-300, 0], [0, 0], [300, 0]];
}
function inScene() { return roster.filter(function (r) { return r.state === 'in'; }); }
// The dogs' own bounds (discs, ears, floating accents), with a small margin.
function contentBox(list) {
  var P = positions(list.length);
  var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  P.forEach(function (p) { x0 = Math.min(x0, p[0] - 150); x1 = Math.max(x1, p[0] + 150); y0 = Math.min(y0, p[1] - 310); y1 = Math.max(y1, p[1] + 30); });
  if (document.documentElement.classList.contains('embed')) {   // the mascot: frame the dog itself, not the stage around it
    // room above the head: 132 head units up from the floor point, or more under a tall hat (the wizard's tip, the
    // headwrap's fan): its top pushed in 6 % (Locked in) and lifted by a hop and the hat's spring, so the camera
    // reframes a few percent wider instead of the hat losing its tip to the edge
    var c = list[0] ? list[0].c : null, ht = list[0] && list[0].rig.hatTop || 0;
    var top = c ? Math.min(y0 - 8, -Math.max(c.floorY + 132, ht * 1.06 + 10) * c.scale) : y0 - 8;
    return [x0 + 30, top, x1 - x0 - 60, y1 - top];
  }
  return [x0 - 10, y0 - 10, x1 - x0 + 20, y1 - y0 + 20];
}
// The camera: the content box, widened to the stage's shape.
function cameraFor(list) {
  var c = contentBox(list), w = c[2], h = c[3];
  var A = stageEl.clientWidth / Math.max(1, stageEl.clientHeight) || 1.6;
  if (w / h < A) w = h * A; else h = w / A;
  var cx = c[0] + c[2] / 2, cy = c[1] + c[3] / 2;
  // the mascot frames its dog by height (the head, a tall hat); a long dog (a dachshund) runs past that frame at its
  // tail, so then the frame grows to take the tail in as well, keeping all its room round the head (a brim, wings, a
  // guitar), and the height follows the stage's shape
  var span = document.documentElement.classList.contains('embed') && list.length === 1 && dogSpan(list[0]);
  var long = !!span && (span[0] < cx - w / 2 || span[1] > cx + w / 2);
  if (long) {
    var x0 = Math.min(cx - w / 2, span[0]), x1 = Math.max(cx + w / 2, span[1]);
    w = x1 - x0; h = w / A; cx = (x0 + x1) / 2;
  }
  if (span && list[0].rig) list[0].rig.long = long;   // and the rig gives it no push-in, which would take the tail out again
  return [cx - w / 2, cy - h / 2, w, h];
}
// a dog's own left and right in the scene (parts.mjs reach: the head and its tail at full length and level)
function dogSpan(r) {
  var c = r.c; if (!c.geo) return null;
  var lr = reach(c), s = c.scale, m = c.mirror ? -1 : 1;
  var a = m * 18 * s + m * s * lr[0], b = m * 18 * s + m * s * lr[1];   // the mascot's one dog stands at the origin (positions)
  return [Math.min(a, b), Math.max(a, b)];
}
function live() { return !reduced.matches; }

function relayout(arriving) {
  var list = inScene(), P = positions(list.length), target = cameraFor(list);
  var d = live() && running() ? 1 : 0;
  list.forEach(function (r, i) {
    if (r === arriving) {                       // enter from beyond the frame, already moving
      var fromLeft = roster.indexOf(r) === 0;
      var sx = fromLeft ? target[0] - 190 : target[0] + target[2] + 190;
      r.tx = tween(sx); r.ty = tween(P[i][1]);
      retarget(r.tx, P[i][0], MOVE * d, EASE_OUT); retarget(r.ty, P[i][1], MOVE * d, EASE_OUT);
      r.moveStart = clock;
    } else {
      if (Math.abs(tv(r.tx, clock) - P[i][0]) > 40 || Math.abs(tv(r.ty, clock) - P[i][1]) > 40) r.moveStart = clock;
      retarget(r.tx, P[i][0], MOVE * d); retarget(r.ty, P[i][1], MOVE * d);
    }
  });
  roster.forEach(function (r) {
    if (r.state !== 'leaving') return;
    var cur = tv(r.tx, clock), right = cur > target[0] + target[2] / 2;
    retarget(r.tx, right ? target[0] + target[2] + 220 : target[0] - 220, 700 * d, EASE_IN);
    r.moveStart = clock; r.leaveEnd = clock + 700 * d;
  });
  for (var k = 0; k < 4; k++) retarget(cam[k], target[k], 800 * d);
  if (!d) { draw(16); }
}

function addDog(r) {
  if (r.state === 'in') return;
  var wasLeaving = r.state === 'leaving';   // turn round where it is, don't re-enter from the edge
  if (!r.slot) {
    r.slot = document.createElementNS(NS, 'g');
    r.slot.setAttribute('class', 'slot');
    r.slot.setAttribute('tabindex', '0');
    r.slot.setAttribute('role', 'button');
    r.slot.setAttribute('aria-label', r.c.name + '. Tap to react, press and drag to pet.');
    r.rig = makeDog(r.c, r.slot, 's-' + r.c.id);
    bindSlot(r);
  }
  var next = null;
  for (var i = roster.indexOf(r) + 1; i < roster.length; i++) if (roster[i].slot && roster[i].slot.parentNode) { next = roster[i].slot; break; }
  if (!r.slot.parentNode) svg.insertBefore(r.slot, next);
  r.state = 'in';
  relayout(wasLeaving ? null : r);
  syncDock();
}
function removeDog(r) {
  if (r.state !== 'in' || inScene().length <= 1) return;
  r.state = 'leaving';
  if (selected === r) selected = inScene()[0];
  relayout(null);
  syncDock();
}

// ---- pointer: eyes follow it; a press and drag pets; a still press is a tap ----
var pointer = { on: false, x: 0, y: 0, last: -1e12 };
function toWorld(ev) {
  var m = svg.getScreenCTM();
  if (!m) return null;
  var p = svg.createSVGPoint(); p.x = ev.clientX; p.y = ev.clientY;
  return p.matrixTransform(m.inverse());
}
svg.addEventListener('pointermove', function (ev) {
  var w = toWorld(ev); if (!w) return;
  pointer.on = true; pointer.x = w.x; pointer.y = w.y; pointer.last = clock;
});
svg.addEventListener('pointerleave', function () { pointer.on = false; });
function lookAt(fx, fy) {
  var m = svg.getScreenCTM(); if (!m) return;
  var p = svg.createSVGPoint(); p.x = fx; p.y = fy; var w = p.matrixTransform(m.inverse());
  pointer.on = true; pointer.x = w.x; pointer.y = w.y; pointer.last = clock;
}
// wear: the parent sends each slot's markup (its catalogue, public/js/study-kit/mascot.mjs); a change gets a little shake
function wear(r, m, fresh) {
  var changed = false;
  ['Head', 'Face', 'Neck', 'Back'].forEach(function (k) {
    var g = r.slot && r.slot.querySelector('[data-p="wear' + k + '"]'), v = typeof m[k.toLowerCase()] === 'string' ? m[k.toLowerCase()] : '';
    if (g && g.getAttribute('data-v') !== v) {
      g.innerHTML = v; g.setAttribute('data-v', v); changed = changed || !!v;
      // a piece put on pops on (frame: popK), unless the dog is dressing as it loads, or no frames are running to
      // finish the pop (reduced motion, a hidden page): one frame drawn mid-pop would leave it half size
      if (v && !fresh && running() && live()) (r.rig.popAt || (r.rig.popAt = {}))[k] = clock;
    }
  });
  // the head piece's ears: '' they pass behind it, 'over' they come through holes in it (drawn again over the brim,
  // outside the head), 'hide' fabric covers the pricked or round ears, 'hood' covers floppy ones too
  var ears = m.head && typeof m.ears === 'string' ? m.ears : '', q = function (n) { return r.slot && r.slot.querySelector('[data-p="' + n + '"]'); };
  var up = ears === 'hide' || ears === 'hood' ? 'none' : 'inline';
  ['earsBack', 'earTips'].forEach(function (n) { var el = q(n); if (el) el.setAttribute('display', up); });
  if (q('earsFront')) q('earsFront').setAttribute('display', ears === 'hood' ? 'none' : 'inline');
  if (q('earsOver')) q('earsOver').setAttribute('display', ears === 'over' ? 'inline' : 'none');
  // a pair with dark or solid lenses (lens 'shade') covers the eyes, so they are not drawn under it: no white shows
  // between the lenses, round a heart or between a star's points (the rig keeps them while the pair pops on)
  r.rig.shade = !!m.face && m.lens === 'shade';
  // a hood on a Pomeranian: the fur is squashed inside it, so the hood grows to the mane's width and the mane is
  // trimmed to the hood's sides (fluff below the hood stays); any other head piece leaves the mane alone
  var ruff = q('ruff'), rc = q('ruffClip'), hw = q('wearHead'), b = null;
  if (ruff && rc) {
    if (ears === 'hood' && hw && hw.firstChild) { try { b = hw.getBBox(); } catch (err) { b = null; } }
    if (b && b.width > 20) {
      var pm = r.c.mane, w4 = b.width / 4;
      r.rig.hoodFit = { s: r3((2 * (pm.rx + pm.sc) - 8) / b.width), y: 0 };
      rc.setAttribute('d', 'M' + r3(b.x) + ' 400 V' + r3(b.y + w4) + ' Q' + r3(b.x) + ' ' + r3(b.y) + ' ' + r3(b.x + w4) + ' ' + r3(b.y) +
        ' H' + r3(b.x + 3 * w4) + ' Q' + r3(b.x + b.width) + ' ' + r3(b.y) + ' ' + r3(b.x + b.width) + ' ' + r3(b.y + w4) + ' V400 Z');
      ruff.setAttribute('clip-path', 'url(#' + rc.parentNode.id + ')');
    } else { r.rig.hoodFit = null; ruff.removeAttribute('clip-path'); }
  }
  // the worn hat's top, in head units above the floor point (the embed's camera makes room for it)
  var ht = 0, shapes = null;
  if (hw && hw.firstChild) {
    var hb2 = null; try { hb2 = hw.getBBox(); } catch (err) { hb2 = null; }
    var HF0 = r.rig.hoodFit || hatFit(r.c);
    if (hb2 && hb2.height > 0) {
      ht = r3(r.c.floorY - (-55 + (hb2.y + 55) * HF0.s + HF0.y));
      // each shape of the hat boxed in head space (its fit applied): what the pops above the head keep clear of
      var hx = function (x) { return r3(1 + (x - 1) * HF0.s); }, hy = function (y) { return r3(-55 + (y + 55) * HF0.s + HF0.y); };
      shapes = [];
      for (var k = 0; k < hw.children.length; k++) {
        var sb = boxIn(hw.children[k], hw);
        if (sb) shapes.push({ x0: hx(sb.x0), x1: hx(sb.x1), y0: hy(sb.y0), y1: hy(sb.y1) });
      }
    }
  }
  r.rig.hatShapes = shapes; r.rig.wearGen = (r.rig.wearGen || 0) + 1;   // a pop already up re-clears for it
  if (ht !== (r.rig.hatTop || 0)) { r.rig.hatTop = ht; if (EMBED && r.state === 'in') relayout(null); }
  var bk = q('wearBack'), bb = null;
  if (bk && bk.firstChild) { try { bb = bk.getBBox(); } catch (err) { bb = null; } }
  r.rig.backWide = !!(bb && bb.x + bb.width - r.c.geo.fx > 100);
  r.rig.backC = bb ? [r3(bb.x + bb.width / 2), r3(bb.y + bb.height / 2)] : null;   // the back piece pops on about its middle
  var arms = q('armClip');
  if (arms && q('wearFace')) q('wearFace').querySelectorAll('[data-arm]').forEach(function (a) { a.setAttribute('mask', 'url(#' + arms.parentNode.id + ')'); });
  if (q('tag')) q('tag').setAttribute('display', m.neck ? 'none' : 'inline');   // a worn neck piece replaces the collar's own tag
  if (changed && !fresh) r.rig.excite(clock);
}

function bindSlot(r) {
  var press = null;
  r.slot.addEventListener('pointerdown', function (ev) {
    press = { x: ev.clientX, y: ev.clientY, moved: false };
    try { r.slot.setPointerCapture(ev.pointerId); } catch (err) { /* capture is optional */ }
  });
  r.slot.addEventListener('pointermove', function (ev) {
    if (!press) return;
    if (!press.moved && Math.hypot(ev.clientX - press.x, ev.clientY - press.y) > 6) press.moved = true;
    if (press.moved) r.rig.petting = true;
  });
  function end(tap) {
    if (press && !press.moved && tap) { select(r); r.rig.excite(clock); kick(); }
    press = null; r.rig.petting = false;
  }
  r.slot.addEventListener('pointerup', function () { end(true); });
  r.slot.addEventListener('pointercancel', function () { end(false); });
  r.slot.addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); select(r); r.rig.excite(clock); kick(); }
  });
}

// ---- the bottom menu ----
var dogsEl = document.getElementById('dogs'), chipsEl = document.getElementById('chips'), exprLabel = document.getElementById('exprLabel');
roster.forEach(function (r) {
  var wrap = document.createElement('div');
  wrap.className = 'avatar-wrap';
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'avatar';
  var thumb = document.createElementNS(NS, 'svg');
  var s = r.c.scale, m = r.c.mirror ? -1 : 1, hx = m * 18 * s, hy = -r.c.floorY * s;
  thumb.setAttribute('viewBox', [hx - 64 * s, hy - 92 * s, 128 * s, 128 * s].map(r3).join(' '));
  thumb.setAttribute('aria-hidden', 'true');
  thumb.style.background = r.c.pal.disc;
  var tg = document.createElementNS(NS, 'g');
  thumb.appendChild(tg);
  var trig = makeDog(r.c, tg, 'th-' + r.c.id);
  tg.querySelector('[data-p="disc"]').setAttribute('r', '0');
  trig.setExpr('curious', -1e12);          // a neutral, attentive face for the menu
  trig.frame(0, STILL, 16);
  var who = document.createElement('span');
  who.className = 'who';
  who.innerHTML = '<b></b><span></span>';
  who.firstChild.textContent = r.c.name;
  btn.appendChild(thumb); btn.appendChild(who);
  btn.addEventListener('click', function () { if (r.state !== 'in') addDog(r); select(r); });
  var rm = document.createElement('button');
  rm.type = 'button'; rm.className = 'remove'; rm.textContent = '×';
  rm.setAttribute('aria-label', 'Take ' + r.c.name + ' out of the scene');
  rm.addEventListener('click', function (ev) { ev.stopPropagation(); removeDog(r); });
  wrap.appendChild(btn); wrap.appendChild(rm);
  dogsEl.appendChild(wrap);
  r.ui = { btn: btn, sub: who.lastChild, rm: rm };
});
EXPR_ORDER.forEach(function (id) {
  var chip = document.createElement('button');
  chip.type = 'button'; chip.className = 'chip'; chip.textContent = EXPR[id].name; chip.dataset.expr = id;
  chip.addEventListener('click', function () {
    if (!selected || selected.state !== 'in') return;
    selected.rig.setExpr(id, live() && running() ? clock : -1e12);
    kick(); syncDock();
  });
  chipsEl.appendChild(chip);
});
function select(r) { selected = r; syncDock(); }
function syncDock() {
  var n = inScene().length;
  roster.forEach(function (r) {
    var isIn = r.state === 'in';
    r.ui.btn.classList.toggle('out', !isIn);
    r.ui.btn.classList.toggle('selected', isIn && r === selected);
    r.ui.btn.setAttribute('aria-pressed', String(isIn && r === selected));
    r.ui.btn.setAttribute('aria-label', isIn ? 'Select ' + r.c.name : 'Add ' + r.c.name + ' to the scene');
    r.ui.sub.textContent = isIn ? EXPR[r.rig.exprId].name : '+ Add';
    r.ui.rm.hidden = !isIn || n <= 1;
  });
  exprLabel.innerHTML = 'Expression · <b></b>';
  exprLabel.lastChild.textContent = selected ? selected.c.name : '';
  [].forEach.call(chipsEl.children, function (chip) {
    chip.setAttribute('aria-pressed', String(!!selected && selected.rig && selected.rig.exprId === chip.dataset.expr));
  });
}

document.getElementById('treat').addEventListener('click', function () {
  if (selected && selected.state === 'in') { selected.rig.treat(clock); kick(); }
});
document.getElementById('call').addEventListener('click', function () {
  inScene().forEach(function (r, i) { r.rig.call(clock + i * 110); });
  kick();
});

// ---- the clock: one loop for everyone, paused when it can't be seen ----
var toggleEl = document.getElementById('toggle');
var wanted = !reduced.matches;     // reduced motion holds frame 0, which reads on its own
var visible = true, raf = 0, last = 0, lively = 0;

function draw(dt) {
  var t = clock % PERIOD;
  var vb = cam.map(function (tw) { return tv(tw, clock); });
  set(svg, 'viewBox', vb.map(r3).join(' '));
  roster.forEach(function (r) {
    if (!r.slot || !r.slot.parentNode) return;
    if (r.state === 'leaving' && clock >= r.leaveEnd) { svg.removeChild(r.slot); r.state = 'out'; syncDock(); return; }
    var x = tv(r.tx, clock), y = tv(r.ty, clock);
    set(r.slot, 'transform', tr(x, y));
    var c = r.c, s = c.scale, m = c.mirror ? -1 : 1, hx = x + m * 18 * s, hy = y - c.floorY * s;
    var ux = (pointer.x - hx) / s * m, uy = (pointer.y - hy) / s;
    r.rig.gaze.on = pointer.on; r.rig.gaze.last = pointer.last;
    r.rig.gaze.x = clamp(ux / 14, -4.5, 4.5); r.rig.gaze.y = clamp(uy / 16, -3.5, 4);
    r.rig.gaze.yaw = clamp(ux / 260, -0.22, 0.22);
    r.rig.view = [vb[0] - hx, vb[0] + vb[2] - hx];   // the frame's edges from the dog's origin (its pops stay inside)
    r.rig.frame(t, clock, dt, clock - r.moveStart);
  });
}
function running() { return wanted && visible && !document.hidden; }
function tick(now) {
  if (!running()) { raf = 0; return; }
  var dt = last ? Math.min(now - last, 64) : 16;
  // embed mode (the Learn mascot): a slow, quiet idle at a third of the speed; full speed for a while after a reaction
  if (EMBED && now > lively) dt *= 0.25;   // Duo 'mostly stands still': the idle is a breath, not a dance
  clock += dt; last = now;
  draw(dt);
  raf = requestAnimationFrame(tick);
}
function kick() { if (!running()) draw(16); }
function sync() {
  if (running()) {
    if (!raf) { last = 0; raf = requestAnimationFrame(tick); }
  } else if (raf) {
    cancelAnimationFrame(raf);
    raf = 0;
  }
  toggleEl.textContent = wanted ? 'Pause' : 'Play';
}
toggleEl.addEventListener('click', function () { wanted = !wanted; sync(); });
document.addEventListener('visibilitychange', sync);
if (reduced.addEventListener) reduced.addEventListener('change', function () { wanted = !reduced.matches; sync(); });
if (window.IntersectionObserver) {
  new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; sync(); }, { threshold: 0.05 }).observe(svg);
}
window.addEventListener('resize', function () { relayout(null); });
if (narrowMq.addEventListener) narrowMq.addEventListener('change', function () { relayout(null); });

// ---- GIF: render one loop of the scene as it is set up, encode it here, offer it to save ----
// Flat art needs no dithering: a 256-colour palette from the scene's own pixels, mapped per
// 15-bit colour, then plain GIF LZW. One loop, so the GIF repeats without a seam.
var LZW_TABLE = new Int32Array(1 << 20), LZW_USED = new Int32Array(4096);
function lzw(ix, buf) {
  var p = 0, clear = 256, eoi = 257, next = 258, size = 9, cur = 0, shift = 0, nUsed = 0;
  buf[p++] = 8;
  var sub = p++;
  function byte(v) { buf[p++] = v; if (p === sub + 256) { buf[sub] = 255; sub = p++; } }
  function emit(code) { cur |= code << shift; shift += size; while (shift >= 8) { byte(cur & 255); cur >>>= 8; shift -= 8; } }
  function reset() { for (var i = 0; i < nUsed; i++) LZW_TABLE[LZW_USED[i]] = 0; nUsed = 0; next = 258; size = 9; }
  emit(clear);
  var prefix = ix[0];
  for (var i = 1, n = ix.length; i < n; i++) {
    var k = ix[i], key = (prefix << 8) | k, code = LZW_TABLE[key];
    if (code) { prefix = code - 1; continue; }
    emit(prefix);
    if (next === 4096) { emit(clear); reset(); }
    else { if (next >= (1 << size)) size++; LZW_TABLE[key] = next + 1; LZW_USED[nUsed++] = key; next++; }
    prefix = k;
  }
  emit(prefix); emit(eoi);
  if (shift > 0) byte(cur & 255);
  if (sub + 1 === p) buf[sub] = 0; else { buf[sub] = p - sub - 1; buf[p++] = 0; }
  reset();
  return p;
}
function u16(v) { return [v & 255, (v >> 8) & 255]; }

// The GIF crops to the dogs, not the stage: no empty bands, and one dog makes a tall GIF.
function sceneSnapshot(W, H) {
  var vb = contentBox(inScene());
  var xs = document.createElementNS(NS, 'svg');
  xs.setAttribute('xmlns', NS);
  xs.setAttribute('viewBox', vb.map(r3).join(' '));
  xs.setAttribute('width', W); xs.setAttribute('height', H);
  var bg = document.createElementNS(NS, 'rect');
  bg.setAttribute('x', vb[0] - 10); bg.setAttribute('y', vb[1] - 10); bg.setAttribute('width', vb[2] + 20); bg.setAttribute('height', vb[3] + 20);
  bg.setAttribute('fill', getComputedStyle(stageEl).backgroundColor || '#f5fbff');
  xs.appendChild(bg);
  var list = inScene(), P = positions(list.length);
  var rigs = list.map(function (r, i) {
    var gg = document.createElementNS(NS, 'g');
    gg.setAttribute('transform', tr(P[i][0], P[i][1]));
    xs.appendChild(gg);
    var x = makeDog(r.c, gg, 'x' + i + '-' + r.c.id);
    x.setExpr(r.rig.exprId, -1e12);
    return x;
  });
  return { svg: xs, rigs: rigs, vb: vb, names: list.map(function (r) { return r.c.name.toLowerCase(); }) };
}

var busy = false, lastGif = null;
var gifBtn = document.getElementById('gif'), statusEl = document.getElementById('status');
var exportEl = document.getElementById('export'), previewEl = document.getElementById('gifPreview');
var noteEl = document.getElementById('exportNote'), againEl = document.getElementById('saveAgain');
var downloadsP = (window.claude && typeof window.claude.use === 'function')
  ? window.claude.use('downloads').catch(function () { return null; }) : Promise.resolve(null);

async function makeGif(onProgress) {
  var vb = contentBox(inScene()), fit = 720 / Math.max(vb[2], vb[3]);
  var W = Math.round(vb[2] * fit), H = Math.round(vb[3] * fit);
  var snap = sceneSnapshot(W, H);
  var canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  var ctx = canvas.getContext('2d', { willReadFrequently: true });
  var ser = new XMLSerializer();
  var step = 1000 / GIF_FPS, N = Math.round(PERIOD / step);
  function pose(t) { snap.rigs.forEach(function (x) { x.frame(t, STILL, step); }); }
  async function grab(t) {
    pose(t);
    var img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(ser.serializeToString(snap.svg));
    if (img.decode) await img.decode(); else await new Promise(function (ok, no) { img.onload = ok; img.onerror = no; });
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(img, 0, 0, W, H);
    return ctx.getImageData(0, 0, W, H).data;
  }
  // 1. palette: the most-used 15-bit colours across six moments of the loop
  var cnt = new Uint32Array(32768), sr = new Float64Array(32768), sg = new Float64Array(32768), sb = new Float64Array(32768);
  for (var s = 0; s < 6; s++) {
    var d = await grab(s * PERIOD / 6);
    for (var i = 0; i < d.length; i += 4) {
      var key = ((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3);
      cnt[key]++; sr[key] += d[i]; sg[key] += d[i + 1]; sb[key] += d[i + 2];
    }
    onProgress(0.04 * (s + 1) / 6);
  }
  var keys = [];
  for (var k2 = 0; k2 < 32768; k2++) if (cnt[k2]) keys.push(k2);
  keys.sort(function (a, b) { return cnt[b] - cnt[a]; });
  keys = keys.slice(0, 256);
  var pal = new Uint8Array(768);
  keys.forEach(function (kk, j) { pal[j * 3] = sr[kk] / cnt[kk]; pal[j * 3 + 1] = sg[kk] / cnt[kk]; pal[j * 3 + 2] = sb[kk] / cnt[kk]; });
  var map = new Int16Array(32768).fill(-1);
  function nearest(key) {
    var r = (key >> 10) * 8 + 4, gg = ((key >> 5) & 31) * 8 + 4, bb = (key & 31) * 8 + 4, best = 0, bd = 1e9;
    for (var j = 0; j < keys.length; j++) {
      var dr = pal[j * 3] - r, dg = pal[j * 3 + 1] - gg, db = pal[j * 3 + 2] - bb, dd = dr * dr * 2 + dg * dg * 4 + db * db * 3;
      if (dd < bd) { bd = dd; best = j; }
    }
    return best;
  }
  // 2. header, palette, loop forever
  var chunks = [];
  chunks.push(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61].concat(u16(W), u16(H), [0xf7, 0, 0])));
  chunks.push(pal);
  chunks.push(new Uint8Array([0x21, 0xff, 0x0b, 0x4e, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50, 0x45, 0x32, 0x2e, 0x30, 0x03, 0x01, 0, 0, 0]));
  // 3. frames: a pre-roll first, so the follow-through state at frame 0 matches the end of the loop
  for (var pr = 0; pr < N; pr++) pose(pr * step);
  var ix = new Uint8Array(W * H), buf = new Uint8Array(W * H * 2 + 2048);
  var delay = Math.round(100 / GIF_FPS);
  for (var f = 0; f < N; f++) {
    var px = await grab(f * step);
    for (var q2 = 0, o = 0; q2 < px.length; q2 += 4, o++) {
      var kk2 = ((px[q2] >> 3) << 10) | ((px[q2 + 1] >> 3) << 5) | (px[q2 + 2] >> 3), v = map[kk2];
      if (v < 0) { v = nearest(kk2); map[kk2] = v; }
      ix[o] = v;
    }
    chunks.push(new Uint8Array([0x21, 0xf9, 0x04, 0x04].concat(u16(delay), [0, 0])));
    chunks.push(new Uint8Array([0x2c, 0, 0, 0, 0].concat(u16(W), u16(H), [0])));
    var len = lzw(ix, buf);
    chunks.push(buf.slice(0, len));
    onProgress(0.04 + 0.96 * (f + 1) / N);
    if (f % 3 === 2) await new Promise(function (ok) { setTimeout(ok, 0); });
  }
  chunks.push(new Uint8Array([0x3b]));
  return { blob: new Blob(chunks, { type: 'image/gif' }), name: snap.names.join('-') + '.gif' };
}

async function offer(gif) {
  var dl = await downloadsP;
  if (!dl && !window.claude) {                 // served as its own page (the optimus site): a plain download works
    var a = document.createElement('a');
    a.href = URL.createObjectURL(gif.blob); a.download = gif.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 30000);
    statusEl.textContent = 'Saved ' + gif.name + ' to your downloads.';
    againEl.hidden = false;
    return;
  }
  if (!dl) {
    noteEl.textContent = 'Saving straight from this page isn’t available here. Right-click or long-press the GIF to save it.';
    againEl.hidden = true;
    return;
  }
  againEl.hidden = false;
  try {
    await dl.save({ filename: gif.name, data: gif.blob });
    statusEl.textContent = 'Saved ' + gif.name + '.';
  } catch (err) {
    var code = err && err.code;
    statusEl.textContent = code === 'declined' ? 'Not saved. Press “Save this GIF” to try again.'
      : code === 'rate_limited' ? 'A save is already open. Finish that one, then try again.'
      : code === 'too_large' ? 'That GIF is too big to save here. Try it with fewer dogs.'
      : 'Saving isn’t available here. Right-click or long-press the GIF to save it.';
    if (code !== 'declined' && code !== 'rate_limited') againEl.hidden = true;
  }
}

gifBtn.addEventListener('click', async function () {
  if (busy) return;
  busy = true; gifBtn.disabled = true;
  statusEl.textContent = 'Drawing the GIF… 0%';
  try {
    var gif = await makeGif(function (p) { statusEl.textContent = 'Drawing the GIF… ' + Math.round(p * 100) + '%'; });
    lastGif = gif;
    previewEl.src = await new Promise(function (ok) { var fr = new FileReader(); fr.onload = function () { ok(fr.result); }; fr.readAsDataURL(gif.blob); });
    exportEl.hidden = false;
    noteEl.textContent = gif.name + ', ' + (gif.blob.size / 1048576).toFixed(1) + ' MB, one 7.2-second loop that repeats forever.';
    statusEl.textContent = 'GIF ready.';
    await offer(gif);
  } catch (err) {
    statusEl.textContent = 'The GIF couldn’t be drawn in this browser. Try again, or try another browser.';
  } finally {
    busy = false; gifBtn.disabled = false;
  }
});
againEl.addEventListener('click', function () { if (lastGif) offer(lastGif); });

// ---- start: Duke alone, zoomed in (embed mode: the dog the parent asked for) ----
var Q = new URLSearchParams(location.search), EMBED = Q.get('embed') === '1';
var first = EMBED ? roster.findIndex(function (r) { return r.c.id === dogById(Q.get('dog')).id; }) : 0;   // an unknown dog: the registry's default
if (EMBED) document.documentElement.classList.add('embed');
addDog(roster[first]);
if (EMBED) roster[first].rig.setExpr(EXPR[Q.get('expr')] ? Q.get('expr') : 'happy', clock);
var startCam = cameraFor(inScene());
for (var ci = 0; ci < 4; ci++) cam[ci] = tween(startCam[ci]);
roster[first].tx = tween(0); roster[first].ty = tween(0); roster[first].moveStart = -1e12;
syncDock();
// Test hook: scripts/doberman/*.mjs drive the clock and the scene through this (it changes nothing on its own).
window.__dob = {
  roster: roster, add: function (i) { addDog(roster[i]); }, remove: function (i) { removeDog(roster[i]); },
  expr: function (i, id) { roster[i].rig.setExpr(id, clock); }, stop: function () { wanted = false; sync(); },
  at: function (c) { clock = c; draw(1000 / 60); }, tap: function (i) { roster[i].rig.excite(clock); },
  treat: function (i) { roster[i].rig.treat(clock); }, call: function () { inScene().forEach(function (r, i) { r.rig.call(clock + i * 110); }); },
  makeGif: makeGif, clock: function () { return clock; }, look: function (x, y) { lookAt(x, y); },
  wear: function (i, m) { wear(roster[i], m, true); }   // scripts/doberman/fit-audit.mjs dresses a dog without postMessage
};
if (EMBED) window.addEventListener('message', function (e) {
  var m = e.data || {}, r = roster[first].rig;
  if (e.origin !== location.origin || typeof m.dob !== 'string') return;
  if (m.dob === 'look') { if (typeof m.x === 'number' && typeof m.y === 'number') lookAt(m.x, m.y); return; }   // eyes only: the idle stays slow
  // a piece put on (not the outfit it loads in): full speed for the hop it makes and the piece's pop, which at the
  // idle's quarter speed played in slow motion
  if (m.dob === 'wear') { if (!m.fresh) lively = Math.max(lively, performance.now() + 1500); wear(roster[first], m, !!m.fresh); if (!running()) draw(16); return; }
  lively = performance.now() + (m.id === 'happy' || m.id === 'proud' || m.id === 'sleepy' ? 900 : 4200);
  if (m.dob === 'expr' && EXPR[m.id] && m.id !== r.exprId) r.setExpr(m.id, clock - 420);   // a verdict lands at once: 230 ms of the blend left
  else if (m.dob === 'tap') r.excite(clock);
  else if (m.dob === 'treat') r.treat(clock);
  if (!running()) { clock += SWITCH + B; draw(16); }   // reduced motion: show the new pose as a still
});
draw(16);   // frame 0 must be a good drawing
sync();
