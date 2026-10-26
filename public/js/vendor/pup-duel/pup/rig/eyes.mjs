// eyes.mjs — a dog's eyes: their shape and their colour, chosen in a look (founder 2026-10-26: "make the dogs have
// changeable eyes both shapes and colors"), and its blush, always on, never, or Auto (as the face feels) ("have blush options
// so can have on or off in the loadout").
//
// A look carries { eyes, iris, blush } beside its dog, coat and collar (coats.mjs dress copies them onto the dog);
// an unknown or missing one is the dog's own: the classic pupil, in its ink, blush as the expression has it.
// Every shape is drawn inside the classic pupil's box (11.4 wide, 16 tall, centred on the eye at y -32), because
// rig.mjs clamps a pupil's travel to keep that box inside the white: a new shape can never slide out and leave a
// blank white eye. A coloured iris carries a dark pupil inside it and the same catch-light.
// Part of the dog kit (public/doberman/); docs/doberman/README.md has the map.

export const EYE_SHAPES = [
  { id: '', name: 'Its own' },
  { id: 'classic', name: 'Classic' },
  { id: 'bead', name: 'Bead' },
  { id: 'round', name: 'Round' },
  { id: 'sparkle', name: 'Sparkle' },
  { id: 'button', name: 'Button' },
  { id: 'cat', name: 'Cat' },
  { id: 'star', name: 'Star' }
];
export const IRISES = [
  { id: '', name: 'Its own', hex: '' },
  { id: 'brown', name: 'Brown', hex: '#8a5a2e', deep: '#3e2412', light: '#b07a48' },
  { id: 'amber', name: 'Amber', hex: '#e0a024', deep: '#5e3a06', light: '#f2c260' },
  { id: 'gold', name: 'Gold', hex: '#f2c94c', deep: '#6a4b06', light: '#f8e08a' },
  { id: 'green', name: 'Green', hex: '#4caf50', deep: '#1c4a1f', light: '#7ccf7f' },
  { id: 'blue', name: 'Blue', hex: '#2f8fe0', deep: '#0e3560', light: '#6fb6ef' },
  { id: 'ice', name: 'Ice', hex: '#8fd3f4', deep: '#245a78', light: '#c4ecfb' },
  { id: 'violet', name: 'Violet', hex: '#9b6bdf', deep: '#3b1f66', light: '#bf9cef' },
  { id: 'pink', name: 'Pink', hex: '#ef6fa8', deep: '#6e1e44', light: '#f7a0c8' },
  { id: 'red', name: 'Red', hex: '#e04848', deep: '#5e1414', light: '#f07a7a' }
];
export const BLUSH = [
  { id: '', name: 'Auto' },
  { id: 'on', name: 'Always' },
  { id: 'off', name: 'Never' }
];
export const eyeShape = id => EYE_SHAPES.find(s => s.id === id && id) || EYE_SHAPES[0];
export const irisOf = id => IRISES.find(s => s.id === id && id) || IRISES[0];
export const blushOf = id => BLUSH.find(s => s.id === id && id) || BLUSH[0];

const r = n => Math.round(n * 100) / 100;
function star(cx, cy, R, k) {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? R * k : R;
    d += (i ? 'L' : 'M') + r(cx + rr * Math.cos(a)) + ' ' + r(cy + rr * Math.sin(a));
  }
  return d + 'Z';
}

// the inside of one pupil group, its centre at (cx, -32): `side` -1 for the left eye (its catch-light sits toward
// the nose, as the classic one does), 1 for the right
/* a coloured eye, drawn as an eye is: a dark rim, the colour, a lighter crescent where the light falls, the pupil, and
   the catch-light (the old pill-in-a-pill read as a block of colour). rx, ry: the iris's radii; pk: the pupil's share */
function irisEye(cx, cy, rx, ry, iris, ink, pk = 0.55) {
  return `<ellipse cx="${r(cx)}" cy="${r(cy)}" rx="${rx}" ry="${ry}" fill="${iris.deep}"/>` +
    `<ellipse cx="${r(cx)}" cy="${r(cy + 0.5)}" rx="${r(rx - 1.1)}" ry="${r(ry - 1.1)}" fill="${iris.hex}"/>` +
    `<ellipse cx="${r(cx)}" cy="${r(cy + ry * 0.38)}" rx="${r((rx - 1.1) * 0.72)}" ry="${r((ry - 1.1) * 0.42)}" fill="${iris.light || iris.hex}"/>` +
    `<ellipse cx="${r(cx)}" cy="${r(cy + 0.3)}" rx="${r(rx * pk)}" ry="${r(ry * pk)}" fill="${ink}"/>`;
}

// the inside of one pupil group, its centre at (cx, -32): `side` -1 for the left eye, 1 for the right
export function pupilMarkup(shape, iris, ink, cx, side) {
  const cy = -32, col = iris.hex, hi = (x, y, rr) => `<circle cx="${r(x)}" cy="${r(y)}" r="${rr}" fill="#fff"/>`;
  const hx = cx - 2.3;   // the classic catch-light: 2.3 left of centre, both eyes
  switch (shape.id) {
    case 'bead':   // no white (rig.mjs: c.sclera false): a glossy dark bead with a catch-light, a spitz's or a teddy's
      return (col ? irisEye(cx, cy + 1, 5.2, 6.4, iris, ink, 0.5) : `<ellipse cx="${r(cx)}" cy="${cy + 1}" rx="5.2" ry="6.4" fill="${ink}"/>`) + hi(cx - 1.8, cy - 1.6, 1.7);
    case 'round':
      return (col ? irisEye(cx, cy, 5.7, 5.7, iris, ink, 0.5) : `<circle cx="${r(cx)}" cy="${cy}" r="5.7" fill="${ink}"/>`) + hi(hx, cy - 2.6, 1.9) + hi(cx + 2.4, cy + 2.4, 0.9);
    case 'sparkle':
      return (col ? irisEye(cx, cy, 5.7, 8, iris, ink, 0.5) : `<rect x="${r(cx - 5.7)}" y="-40" width="11.4" height="16" rx="5.7" fill="${ink}"/>`) +
        hi(hx, -35.6, 2.7) + hi(cx + 2.2, -27.4, 1.3) + hi(cx + 2.6, -36.8, 0.8);
    case 'button':
      return (col ? irisEye(cx, cy, 4.6, 4.6, iris, ink, 0.5) : `<circle cx="${r(cx)}" cy="${cy}" r="4.4" fill="${ink}"/>`) + hi(cx - 1.5, cy - 1.6, 1.2);
    case 'cat':
      return (col ? irisEye(cx, cy, 5.7, 8, iris, ink, 0) : `<ellipse cx="${r(cx)}" cy="${cy}" rx="5.7" ry="8" fill="#d9b23a"/>`) +
        `<path d="M${r(cx)} -39.4 Q${r(cx + 2.3)} ${cy} ${r(cx)} -24.6 Q${r(cx - 2.3)} ${cy} ${r(cx)} -39.4Z" fill="${ink}"/>` + hi(hx + 0.4, -35.4, 1.3);
    case 'star':
      return (col ? irisEye(cx, cy, 5.7, 5.7, iris, ink, 0) : '') +
        `<path d="${star(cx, cy + 0.4, col ? 4.2 : 6.2, 0.45)}" fill="${ink}"/>` + hi(hx + 0.6, cy - 2.4, 1.1);
    default:   // classic and Its own: the tall pill; coloured, a tall iris
      return (col ? irisEye(cx, cy, 5.7, 8, iris, ink, 0.52) : `<rect x="${r(cx - 5.7)}" y="-40" width="11.4" height="16" rx="5.7" fill="${ink}"/>`) +
        hi(hx, -35.8, 2.2);
  }
}
