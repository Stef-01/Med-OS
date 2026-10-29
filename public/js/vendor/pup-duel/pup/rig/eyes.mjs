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
  { id: 'lps', name: 'Big glossy' },
  { id: 'classic', name: 'Classic' },
  { id: 'bead', name: 'Bead' },
  { id: 'round', name: 'Round' },
  { id: 'sparkle', name: 'Sparkle' },
  { id: 'button', name: 'Button' },
  { id: 'cat', name: 'Cat' },
  { id: 'star', name: 'Star' },
  { id: 'heart', name: 'Heart' },
  { id: 'anime', name: 'Anime' },
  { id: 'diamond', name: 'Diamond' },
  { id: 'swirl', name: 'Swirl' },
  { id: 'flower', name: 'Flower' },
  { id: 'moon', name: 'Moon' },
  { id: 'twinkle', name: 'Twinkle' },
  { id: 'pixel', name: 'Pixel' },
  { id: 'ring', name: 'Ring' }
];
export const IRISES = [
  { id: '', name: 'Its own', hex: '' },
  { id: 'teal', name: 'Teal', hex: '#2fc4c0', deep: '#0e5e66', light: '#9cf2ea' },
  { id: 'brown', name: 'Brown', hex: '#8a5a2e', deep: '#3e2412', light: '#b07a48' },
  { id: 'amber', name: 'Amber', hex: '#e0a024', deep: '#5e3a06', light: '#f2c260' },
  { id: 'gold', name: 'Gold', hex: '#f2c94c', deep: '#6a4b06', light: '#f8e08a' },
  { id: 'green', name: 'Green', hex: '#4caf50', deep: '#1c4a1f', light: '#7ccf7f' },
  { id: 'blue', name: 'Blue', hex: '#2f8fe0', deep: '#0e3560', light: '#6fb6ef' },
  { id: 'ice', name: 'Ice', hex: '#8fd3f4', deep: '#245a78', light: '#c4ecfb' },
  { id: 'violet', name: 'Violet', hex: '#9b6bdf', deep: '#3b1f66', light: '#bf9cef' },
  { id: 'pink', name: 'Pink', hex: '#ef6fa8', deep: '#6e1e44', light: '#f7a0c8' },
  { id: 'red', name: 'Red', hex: '#e04848', deep: '#5e1414', light: '#f07a7a' },
  { id: 'silver', name: 'Silver', hex: '#b8c4d2', deep: '#4a5668', light: '#e6edf5' },
  { id: 'hazel', name: 'Hazel', hex: '#9a7b3c', deep: '#4a3510', light: '#c4a564' },
  { id: 'mint', name: 'Mint', hex: '#5fd3a0', deep: '#1d6048', light: '#a6efcf' },
  { id: 'coral', name: 'Coral', hex: '#ff7a5c', deep: '#6e2414', light: '#ffb19e' },
  { id: 'navy', name: 'Navy', hex: '#3a5bb8', deep: '#0f1d47', light: '#7c96e0' }
];
/* the style of every face (founder 2026-10-26: "like how littlest pet shop style is ... save old style seperately"):
   lps, big glossy eyes that are mostly iris, a dark liner on the lid and flicked lashes, each dog its own eye colour;
   classic, the style before (git tag dog-style-classic). A look can pick either; LPS is the default */
export const STYLES = [{ id: '', name: 'Big glossy (default)' }, { id: 'classic', name: 'Classic' }];
export const DEFAULT_STYLE = 'lps';
/* an LPS dog's own eye colour when its look picks none: one of six, by its id, so a room of dogs is not one colour */
export const LPS_EYES = ['teal', 'brown', 'amber', 'blue', 'green', 'violet'];
export const lpsIris = id => LPS_EYES[[...String(id || '')].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 7) % LPS_EYES.length];
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
    case 'lps':   // the LPS eye: an iris that fills most of the white, a big dark pupil, a lighter lower half, two catch-lights
      return irisEye(cx, cy + 1, 9.8, 11.6, col ? iris : IRISES.find(k => k.id === 'teal'), ink, 0.5) +
        `<ellipse cx="${r(cx)}" cy="${r(cy - 3.6)}" rx="3" ry="2.2" fill="${(col ? iris : IRISES.find(k => k.id === 'teal')).deep}"/>` +
        hi(cx - 3.8, cy - 4, 3.3) + hi(cx + 3.6, cy + 5.2, 1.7) + hi(cx + 4.8, cy - 2.4, 1);
    case 'heart': {   // a heart for a pupil, in the eye's colour (or ink), a catch-light on its left lobe
      const h = col ? iris.hex : ink, d = `M${r(cx)} ${r(cy + 6)} C${r(cx - 9)} ${r(cy - 1)} ${r(cx - 6)} ${r(cy - 9)} ${r(cx)} ${r(cy - 4)} C${r(cx + 6)} ${r(cy - 9)} ${r(cx + 9)} ${r(cy - 1)} ${r(cx)} ${r(cy + 6)} Z`;
      return (col ? `<path d="${d}" fill="${iris.deep}" transform="translate(0 0.8)"/>` : '') + `<path d="${d}" fill="${h}"/>` + hi(cx - 3.2, cy - 3.4, 1.6);
    }
    case 'anime':   // tall and bright: an iris in bands, a big pupil, three catch-lights
      return irisEye(cx, cy, 5.7, 8.2, col ? iris : IRISES.find(k => k.id === 'blue'), ink, 0.5) +
        `<ellipse cx="${r(cx)}" cy="${r(cy - 4.6)}" rx="4.4" ry="1.8" fill="${(col ? iris : IRISES.find(k => k.id === 'blue')).deep}"/>` +
        hi(cx - 2.4, cy - 3.8, 2.6) + hi(cx + 2.4, cy + 3.2, 1.4) + hi(cx + 2.8, cy - 4.4, 0.9);
    case 'diamond':   // a gem for a pupil
      return (col ? irisEye(cx, cy, 5.7, 7.6, iris, ink, 0) : '') +
        `<path d="M${r(cx)} ${r(cy - 6)} L${r(cx + 4.2)} ${r(cy)} L${r(cx)} ${r(cy + 6)} L${r(cx - 4.2)} ${r(cy)} Z" fill="${ink}"/>` + `<path d="M${r(cx)} ${r(cy - 6)} L${r(cx + 4.2)} ${r(cy)} L${r(cx)} ${r(cy)} Z" fill="#fff"/>`;
    case 'swirl':   // dizzy: a spiral where the pupil was
      return `<path d="M${r(cx)} ${r(cy)} m-0.6 0 a0.6 0.6 0 1 1 1.2 0 a1.8 1.8 0 1 1 -3.6 0 a3 3 0 1 1 6 0 a4.2 4.2 0 1 1 -8.4 0 a5.4 5.4 0 1 1 10.8 0" fill="none" stroke="${col ? iris.deep : ink}" stroke-width="1.8" stroke-linecap="round"/>`;
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
    case 'flower':   // five round petals for a pupil (the eye's deep colour, or ink) round a light heart
      return (col ? irisEye(cx, cy, 5.7, 7.6, iris, ink, 0) : '') +
        [0, 72, 144, 216, 288].map(a => `<circle cx="${r(cx + 2.9 * Math.sin(a * Math.PI / 180))}" cy="${r(cy - 2.9 * Math.cos(a * Math.PI / 180))}" r="2.5" fill="${col ? iris.deep : ink}"/>`).join('') +
        `<circle cx="${r(cx)}" cy="${cy}" r="1.9" fill="${col ? iris.light : '#fff'}"/>`;
    case 'moon':   // a crescent for a pupil
      return (col ? irisEye(cx, cy, 5.7, 7.6, iris, ink, 0) : '') +
        `<path d="M${r(cx + 1.6)} ${r(cy - 5.6)} A5.6 5.6 0 1 0 ${r(cx + 1.6)} ${r(cy + 5.6)} A2.2 5.6 0 0 1 ${r(cx + 1.6)} ${r(cy - 5.6)} Z" fill="${ink}"/>` + hi(cx - 2.6, cy - 2.4, 1.2);
    case 'twinkle':   // a four-point glint for a pupil
      return (col ? irisEye(cx, cy, 5.7, 7.6, iris, ink, 0) : '') +
        `<path d="M${r(cx)} ${r(cy - 7)} Q${r(cx + 1)} ${r(cy - 1)} ${r(cx + 5.2)} ${r(cy)} Q${r(cx + 1)} ${r(cy + 1)} ${r(cx)} ${r(cy + 7)} Q${r(cx - 1)} ${r(cy + 1)} ${r(cx - 5.2)} ${r(cy)} Q${r(cx - 1)} ${r(cy - 1)} ${r(cx)} ${r(cy - 7)} Z" fill="${ink}"/>` + hi(cx + 2.6, cy - 3.6, 1.1);
    case 'pixel': {   // a square pupil and a square catch-light: an eight-bit dog
      const k = col ? 2.4 : 4.6;
      return (col ? `<rect x="${r(cx - 5.4)}" y="${r(cy - 5.4)}" width="10.8" height="10.8" rx="1" fill="${iris.deep}"/><rect x="${r(cx - 4.2)}" y="${r(cy - 4.2)}" width="8.4" height="8.4" rx="0.6" fill="${iris.hex}"/>` : '') +
        `<rect x="${r(cx - k)}" y="${r(cy - k)}" width="${2 * k}" height="${2 * k}" rx="0.6" fill="${ink}"/><rect x="${r(cx - 3.6)}" y="${r(cy - 3.6)}" width="2.4" height="2.4" fill="#fff"/>`;
    }
    case 'ring':   // a hollow ring: the colour (or the white) shows through the pupil
      return `<circle cx="${r(cx)}" cy="${cy}" r="4.4" fill="${col ? iris.hex : '#fff'}" stroke="${col ? iris.deep : ink}" stroke-width="2.6"/>` + hi(cx - 1.6, cy - 1.6, 1.2);
    default:   // classic and Its own: the tall pill; coloured, a tall iris
      return (col ? irisEye(cx, cy, 5.7, 8, iris, ink, 0.52) : `<rect x="${r(cx - 5.7)}" y="-40" width="11.4" height="16" rx="5.7" fill="${ink}"/>`) +
        hi(hx, -35.8, 2.2);
  }
}
