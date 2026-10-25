// coats.mjs — what a player may change about a dog without drawing a new one: its coat and its collar. The duel's
// dressing room lists them, a look stores their ids ({ dog, coat, collar, wear }), and the rig draws them
// (stage.mjs: the embed's `coat` and `collar`, and the `skin` message).
// Part of the dog kit (public/doberman/); docs/doberman/README.md has the map.
//
// A COAT is one of a breed's real colours, as a palette over the roles that make the fur: every role but the dog's
// eyes, mouth, collar and stage (OWN, below), so a coat leaves nothing of the old one behind (Scout's tan eye patch
// goes with his tan). A coat taken `from` a dog is that dog's own fur, so each dog's colours are one of its breed's
// coats and a dog in its own coat is drawn exactly as breeds.mjs has it. The rest are drawn here, to the same rules:
// a base and its shade per shape, light from the top left, and readable on the hosts' dark navy.
// A COLLAR is a colour for the collar (its tag stays gold, except on gold).
import { DOGS } from './breeds.mjs';

/* the roles that stay the dog's own whatever it wears */
const OWN = new Set(['ink', 'mouth', 'tongue', 'tongueSh', 'collar', 'tag', 'tagSh', 'disc', 'floor', 'blush']);
const fur = pal => Object.fromEntries(Object.entries(pal).filter(([k]) => !OWN.has(k)));
/* a swatch: the coat and the colour that tells this coat from its neighbours (spots, patches, a mask, a blaze) */
const SECOND = ['spot', 'patch', 'mask', 'blaze', 'urajiro'];

const SPEC = {
  doberman: [
    { id: 'black', name: 'Black and tan', from: 'duke' },
    { id: 'red', name: 'Red and tan', from: 'rosie' },
    { id: 'blue', name: 'Blue and tan', from: 'pip' },
    { id: 'fawn', name: 'Fawn and tan', pal: { coat: '#a3857a', sh: '#8a6d63', tan: '#eeb274', tanSh: '#d89a5c', feature: '#5c433b',
      nose: '#5c433b', noseHi: '#7e645b' } }
  ],
  pomeranian: [
    { id: 'orange', name: 'Orange', from: 'mochi' },
    { id: 'cream', name: 'Cream', from: 'biscuit' },
    { id: 'black', name: 'Black and tan', from: 'pepper' },
    { id: 'white', name: 'White', pal: { coat: '#f1eee8', sh: '#ddd8ce', tan: '#ffffff', tanSh: '#ece8e1', feature: '#8c8174', nose: '#2b2622',
      noseHi: '#5a524c', mane: '#faf8f4', maneSh: '#e2ddd3', bib: '#ffffff', bibSh: '#ebe6dd', earIn: '#f6cfc6', tail: '#faf8f4' } }
  ],
  golden: [
    { id: 'golden', name: 'Golden', from: 'sunny' },
    { id: 'cream', name: 'Cream', pal: { coat: '#f3d39c', sh: '#e0b97c', tan: '#fdecc9', tanSh: '#f2d7a6', feature: '#a87538', nose: '#3a2416',
      noseHi: '#6b4a33', ear: '#e3b574', tail: '#ecc98c', tailIn: '#fae3b6', bib: '#fae3b6', bibSh: '#eecf98', foot: '#f7dfae',
      footFar: '#ecce98', brow: '#fae4bb' } },
    { id: 'red', name: 'Red', pal: { coat: '#d4802f', sh: '#b66823', tan: '#efb066', tanSh: '#df984d', feature: '#7a3d10', nose: '#3a2416',
      noseHi: '#6b4a33', ear: '#b4651f', tail: '#cb782c', tailIn: '#eba45a', bib: '#e9a356', bibSh: '#d88b40', foot: '#e69e53',
      footFar: '#d58c43', brow: '#eeac61' } }
  ],
  jack: [
    { id: 'tan', name: 'Tan and white', from: 'scout' },
    { id: 'black', name: 'Black and white', pal: { coat: '#f6f2ea', sh: '#e2dacd', tan: '#ffffff', tanSh: '#eee8de', feature: '#6a5a52',
      nose: '#2a201c', noseHi: '#5a4a40', patch: '#3f3640', saddle: '#3f3640', ear: '#3f3640', earBack: '#2e2730', earIn: '#8a6e6e',
      lidL: '#3f3640', brow: '#d39a5e', foot: '#ffffff', footFar: '#eee8de' } },
    { id: 'lemon', name: 'Lemon and white', pal: { coat: '#f6f2ea', sh: '#e2dacd', tan: '#ffffff', tanSh: '#eee8de', feature: '#8a6a4a',
      nose: '#2a201c', noseHi: '#5a4a40', patch: '#e6bb6c', saddle: '#e6bb6c', ear: '#e6bb6c', earBack: '#d0a052', earIn: '#f4d9a8',
      lidL: '#e6bb6c', brow: '#f5dba8', foot: '#ffffff', footFar: '#eee8de' } }
  ],
  corgi: [
    { id: 'red', name: 'Red', from: 'waffles' },
    { id: 'fawn', name: 'Fawn', pal: { coat: '#eaae66', sh: '#d4944c', tan: '#fff6ea', tanSh: '#f0e2cd', feature: '#94582a', nose: '#2b170b',
      noseHi: '#5e3a22', blaze: '#fff6ea', earIn: '#ffe0c4', brow: '#f7cb8e', tail: '#e6a85f' } },
    { id: 'tri', name: 'Tricolour', pal: { coat: '#4a4352', sh: '#3b3542', tan: '#fff6ea', tanSh: '#f0e2cd', feature: '#e9a25a', nose: '#1b1820',
      noseHi: '#57505f', blaze: '#fff6ea', earIn: '#d99560', brow: '#e3924a', tail: '#453f4d' } }
  ],
  dachshund: [
    { id: 'red', name: 'Red', from: 'noodle' },
    { id: 'black', name: 'Black and tan', pal: { coat: '#4b4250', sh: '#3c3442', tan: '#d98b4a', tanSh: '#c27538', feature: '#e8a466',
      nose: '#1a1519', noseHi: '#554b59', ear: '#3c3442', brow: '#d98b4a', foot: '#d98b4a', footFar: '#c27538' } },
    { id: 'chocolate', name: 'Chocolate', pal: { coat: '#6e4433', sh: '#5a3627', tan: '#d7955c', tanSh: '#c07e47', feature: '#2e1810',
      nose: '#4a2a1e', noseHi: '#6e4636', ear: '#5a3627', brow: '#d7955c', foot: '#d7955c', footFar: '#c07e47' } },
    { id: 'cream', name: 'Cream', pal: { coat: '#eac28c', sh: '#d8aa6e', tan: '#f6dcb4', tanSh: '#ebc893', feature: '#8e5f32', nose: '#3a2416',
      noseHi: '#6b4a33', ear: '#d6a062', brow: '#f6dcb4', foot: '#e5bb82', footFar: '#d8aa6e' } }
  ],
  husky: [
    { id: 'grey', name: 'Grey and white', from: 'koda' },
    { id: 'black', name: 'Black and white', pal: { coat: '#474a59', sh: '#383a47', tan: '#ffffff', tanSh: '#e2e8f0', feature: '#262833',
      nose: '#15171c', noseHi: '#42454f', mask: '#f4f7fb', brow: '#ffffff', earIn: '#e8d2d6', foot: '#ffffff', footFar: '#e2e8f0',
      tail: '#3f4250', tailIn: '#f4f7fb', bib: '#f4f7fb', bibSh: '#dde4ee' } },
    { id: 'copper', name: 'Copper and white', pal: { coat: '#b9714a', sh: '#9c5b37', tan: '#ffffff', tanSh: '#efe4da', feature: '#6a3519',
      nose: '#5a3020', noseHi: '#7e4a36', mask: '#fbf4ee', brow: '#ffffff', earIn: '#f4d4c8', foot: '#ffffff', footFar: '#efe4da',
      tail: '#a8653f', tailIn: '#fbf4ee', bib: '#fbf4ee', bibSh: '#efe2d6' } }
  ],
  pug: [
    { id: 'fawn', name: 'Fawn', from: 'pudding' },
    { id: 'apricot', name: 'Apricot', pal: { coat: '#e6ae72', sh: '#d09558', tan: '#3d322e', tanSh: '#2e2522', feature: '#7a5030', nose: '#141010',
      noseHi: '#4a3d38', ear: '#3a2f2b', brow: '#d29a5e', wrinkle: '#3d322e', wrinkleSoft: '#c08850', foot: '#dea468', footFar: '#d09558',
      tail: '#c2864e', tailIn: '#e6b27c' } },
    { id: 'black', name: 'Black', pal: { coat: '#474149', sh: '#38333a', tan: '#2a252b', tanSh: '#1f1b20', feature: '#8a8290', nose: '#141114',
      noseHi: '#57505a', ear: '#2a252b', brow: '#5c5560', wrinkle: '#2a252b', wrinkleSoft: '#5c5560', foot: '#423c44', footFar: '#38333a',
      tail: '#3c363e', tailIn: '#5a535c' } }
  ],
  dalmatian: [
    { id: 'black', name: 'Black spots', from: 'domino' },
    { id: 'liver', name: 'Liver spots', pal: { coat: '#f7f7f5', sh: '#e4e4e0', tan: '#ffffff', tanSh: '#ececea', feature: '#6e4436', nose: '#7a4030',
      noseHi: '#a0624a', spot: '#8c4d33', earL: '#8c4d33', earR: '#f0f0ee', brow: '#dcd6d2', tail: '#e4e4e0', tailDots: '#8c4d33',
      foot: '#ffffff', footFar: '#ececea' } },
    { id: 'lemon', name: 'Lemon spots', pal: { coat: '#f7f7f5', sh: '#e4e4e0', tan: '#ffffff', tanSh: '#ececea', feature: '#8a6a3a', nose: '#3a2a22',
      noseHi: '#66544a', spot: '#e3b15a', earL: '#e3b15a', earR: '#f0f0ee', brow: '#e6dcc8', tail: '#e4e4e0', tailDots: '#e3b15a',
      foot: '#ffffff', footFar: '#ececea' } }
  ],
  shiba: [
    { id: 'red', name: 'Red', from: 'kiko' },
    { id: 'black', name: 'Black and tan', pal: { coat: '#4b4252', sh: '#3c3443', tan: '#fbebd3', tanSh: '#f0d8b6', feature: '#e3a35e', nose: '#1a1519',
      noseHi: '#554b5c', urajiro: '#fbebd3', brow: '#e3a35e', earIn: '#e8c49a', tail: '#463e4c', tailIn: '#fbebd3', bib: '#fbebd3',
      bibSh: '#efd6b2', foot: '#fbebd3', footFar: '#f0d8b6' } },
    { id: 'sesame', name: 'Sesame', pal: { coat: '#b06c3a', sh: '#94582c', tan: '#fbebd3', tanSh: '#f0d8b6', feature: '#5e2f10', nose: '#2b170a',
      noseHi: '#5e3a22', urajiro: '#fbebd3', brow: '#fbebd3', earIn: '#fbebd3', tail: '#a46434', tailIn: '#fbebd3', bib: '#fbebd3',
      bibSh: '#efd6b2', foot: '#fbebd3', footFar: '#f0d8b6' } },
    { id: 'cream', name: 'Cream', pal: { coat: '#efd8b2', sh: '#dfc394', tan: '#fffaf0', tanSh: '#f4e8d4', feature: '#9a7a50', nose: '#2b170a',
      noseHi: '#5e3a22', urajiro: '#fffaf0', brow: '#fffaf0', earIn: '#fffaf0', tail: '#e7cc9e', tailIn: '#fffaf0', bib: '#fffaf0',
      bibSh: '#f2e4cc', foot: '#fffaf0', footFar: '#f4e8d4' } }
  ],
  beagle: [
    { id: 'tri', name: 'Tricolour', from: 'bagel' },
    { id: 'lemon', name: 'Lemon and white', pal: { coat: '#e9c27a', sh: '#d6ab5f', tan: '#fbf7f1', tanSh: '#ece4d8', feature: '#8a6a3a', nose: '#3a2a22',
      noseHi: '#66544a', body: '#f6f1ea', blaze: '#fbf7f1', saddle: '#e3b867', ear: '#d9aa5a', brow: '#f4d9a3', tail: '#e2b86c', tailDots: '#ffffff',
      foot: '#ffffff', footFar: '#ece6dc' } },
    { id: 'red', name: 'Red and white', pal: { coat: '#b8602e', sh: '#9e4f24', tan: '#fbf7f1', tanSh: '#ece4d8', feature: '#5e2a10', nose: '#2a1d18',
      noseHi: '#5a463c', body: '#f6f1ea', blaze: '#fbf7f1', saddle: '#a8562a', ear: '#8f4520', brow: '#d88a52', tail: '#ad5a2c', tailDots: '#ffffff',
      foot: '#ffffff', footFar: '#ece6dc' } }
  ],
  frenchie: [
    { id: 'blue', name: 'Blue', from: 'gaston' },
    { id: 'fawn', name: 'Fawn', pal: { coat: '#d9a873', sh: '#c4915c', tan: '#5a4436', tanSh: '#4d3a2e', feature: '#6e4a2c', nose: '#2a1d18', noseHi: '#5a463c',
      earIn: '#f2b8a8', brow: '#e8c093', blaze: '#fbf5ec', wrinkle: '#a8784a', foot: '#dfb07c', footFar: '#cf9e6a' } },
    { id: 'cream', name: 'Cream', pal: { coat: '#f0dcc0', sh: '#e0c7a5', tan: '#d7bb98', tanSh: '#c9ab86', feature: '#9a7650', nose: '#2b211c', noseHi: '#5a4a40',
      earIn: '#f5c4b8', brow: '#f6e8d4', blaze: '#fffaf2', wrinkle: '#c9a87e', foot: '#f2e0c6', footFar: '#e4cfb2' } },
    { id: 'brindle', name: 'Brindle', pal: { coat: '#5c4e47', sh: '#4c403a', tan: '#332a27', tanSh: '#2a2220', feature: '#a08878', nose: '#161213', noseHi: '#4a3f3c',
      earIn: '#d8a8a0', brow: '#716159', blaze: '#f4efe8', wrinkle: '#3a302c', foot: '#61534c', footFar: '#534640' } }
  ],
  collie: [
    { id: 'black', name: 'Black and white', from: 'dash' },
    { id: 'red', name: 'Red and white', pal: { coat: '#a8603c', sh: '#8f4f30', tan: '#ffffff', tanSh: '#efe6de', feature: '#5a2c16', nose: '#4a2618', noseHi: '#76483a',
      blaze: '#ffffff', bib: '#ffffff', bibSh: '#ece2d8', brow: '#c07a52', earIn: '#e8c0b0', foot: '#ffffff', footFar: '#efe6de', tail: '#9a5734' } },
    { id: 'blue', name: 'Blue and white', pal: { coat: '#7f8aa3', sh: '#6c778f', tan: '#ffffff', tanSh: '#e4e8f0', feature: '#3c4458', nose: '#1d1f28', noseHi: '#4a4e5e',
      blaze: '#ffffff', bib: '#ffffff', bibSh: '#dfe3eb', brow: '#97a1b6', earIn: '#e0c4cc', foot: '#ffffff', footFar: '#e4e8f0', tail: '#75809a' } }
  ],
  lab: [
    { id: 'chocolate', name: 'Chocolate', from: 'fudge' },
    { id: 'yellow', name: 'Yellow', pal: { coat: '#efc27c', sh: '#ddab62', tan: '#f6d498', tanSh: '#ebc283', feature: '#9a6a30', nose: '#3a2416', noseHi: '#6b4a33',
      ear: '#dba45c', brow: '#f8d9a6', tail: '#e5b56e', foot: '#f2c986', footFar: '#e2b673' } },
    { id: 'black', name: 'Black', pal: { coat: '#4a4552', sh: '#3c3843', tan: '#55505e', tanSh: '#4a4552', feature: '#8f8899', nose: '#1a181e', noseHi: '#46424e',
      ear: '#3c3843', brow: '#5e5968', tail: '#45404d', foot: '#524c5a', footFar: '#46414e' } }
  ],
  samoyed: [
    { id: 'white', name: 'White', from: 'nimbus' },
    { id: 'biscuit', name: 'Biscuit', pal: { coat: '#f6ead6', sh: '#e4d3b6', tan: '#fffaf1', tanSh: '#f1e6d3', feature: '#7d6a52', nose: '#2a2220', noseHi: '#56493f',
      mane: '#fbf2e2', maneSh: '#e6d4b4', bib: '#fffaf1', bibSh: '#efe2cc', earIn: '#f4cfc4', brow: '#efe2cd', tail: '#f3e6cf', tailIn: '#fffaf1',
      foot: '#fffaf1', footFar: '#f0e5d2', lip: '#3c3632' } }
  ],
  chihuahua: [
    { id: 'fawn', name: 'Fawn', from: 'churro' },
    { id: 'black', name: 'Black and tan', pal: { coat: '#4b4250', sh: '#3c3442', tan: '#d98b4a', tanSh: '#c27538', feature: '#e8a466', nose: '#1a1519', noseHi: '#554b59',
      earIn: '#e6a0a0', brow: '#d98b4a', tail: '#463e4c', foot: '#d98b4a', footFar: '#c27538' } },
    { id: 'cream', name: 'Cream', pal: { coat: '#f3dfbf', sh: '#e3c9a1', tan: '#fff6e8', tanSh: '#f3e3c9', feature: '#9a7650', nose: '#2b1a10', noseHi: '#5a4030',
      earIn: '#ffc4bc', brow: '#fbeedb', tail: '#ecd3ad', foot: '#fff6e8', footFar: '#f3e3c9' } },
    { id: 'chocolate', name: 'Chocolate', pal: { coat: '#7a4c35', sh: '#663e2a', tan: '#c99266', tanSh: '#b47e54', feature: '#3a1f12', nose: '#4a2a1e', noseHi: '#6e4636',
      earIn: '#e8a89c', brow: '#c99266', tail: '#714631', foot: '#c99266', footFar: '#b47e54' } }
  ],
  poodle: [
    { id: 'apricot', name: 'Apricot', from: 'lulu' },
    { id: 'white', name: 'White', pal: { coat: '#f3f1ee', sh: '#e2ded8', tan: '#f7f5f2', tanSh: '#e9e5df', feature: '#8a8178', nose: '#2b2622', noseHi: '#5a524c',
      mane: '#ffffff', maneSh: '#dcd7cf', ear: '#ffffff', brow: '#ffffff', tail: '#e2ded8', tailDots: '#ffffff', foot: '#ffffff', footFar: '#ece8e2' } },
    { id: 'black', name: 'Black', pal: { coat: '#4b4552', sh: '#3e3946', tan: '#544e5c', tanSh: '#48424f', feature: '#a59cae', nose: '#16131a', noseHi: '#47414e',
      mane: '#5a5363', maneSh: '#3a3542', ear: '#5a5363', brow: '#5a5363', tail: '#3e3946', tailDots: '#5a5363', foot: '#5a5363', footFar: '#4c4655' } },
    { id: 'silver', name: 'Silver', pal: { coat: '#b9bcc6', sh: '#a3a7b3', tan: '#c4c7d0', tanSh: '#b2b6c1', feature: '#5a5e6c', nose: '#22232b', noseHi: '#4e505c',
      mane: '#cfd2da', maneSh: '#9fa3b0', ear: '#cfd2da', brow: '#cfd2da', tail: '#a3a7b3', tailDots: '#cfd2da', foot: '#cfd2da', footFar: '#bfc3cc' } }
  ],
  /* a Bernese comes in one coat, the tricolour */
  bernese: [{ id: 'tri', name: 'Tricolour', from: 'heidi' }]
};

const byId = id => DOGS.find(d => d.id === id);
const coat = k => { const pal = k.from ? fur(byId(k.from).pal) : k.pal; return { id: k.id, name: k.name, from: k.from || '', pal, swatch: [pal.coat, SECOND.map(r => pal[r]).find(Boolean) || pal.tan] }; };

/* every breed's coats, in the order a dressing room lists them; a breed this file does not know yet gets each of its
   dogs' own fur, so a new dog in breeds.mjs always has its own coat */
export const COATS = {};
for (const d of DOGS) {
  if (!COATS[d.breed]) COATS[d.breed] = (SPEC[d.breed] || []).map(coat);
  if (!COATS[d.breed].some(k => k.from === d.id)) COATS[d.breed].push(coat({ id: d.id, name: d.name, from: d.id }));
}

/* the collar colours (Duolingo's brights) */
export const COLLARS = [
  { id: 'red', name: 'Red', hex: '#ff4b4b' }, { id: 'orange', name: 'Orange', hex: '#ff9600' }, { id: 'gold', name: 'Gold', hex: '#ffc800' },
  { id: 'green', name: 'Green', hex: '#58cc02' }, { id: 'teal', name: 'Teal', hex: '#2ec4a6' }, { id: 'blue', name: 'Blue', hex: '#1cb0f6' },
  { id: 'purple', name: 'Purple', hex: '#ce82ff' }, { id: 'pink', name: 'Pink', hex: '#ff7eb6' }
];
const TAG_ON_GOLD = { tag: '#ffffff', tagSh: '#e6e2da' };

/* a dog's coats, its own colours and collar: what a dressing room offers and what it shows as chosen */
export const coatsFor = id => (byId(id) ? COATS[byId(id).breed] : []);
export const ownCoat = id => (coatsFor(id).find(k => k.from === id) || {}).id || '';
export const ownCollar = id => { const d = byId(id), hex = d && d.pal.collar; return (COLLARS.find(k => k.hex === hex) || {}).id || ''; };

/* a DOGS entry in a look's coat and collar, for resolve(): an unknown coat or collar leaves the dog's own */
export function dress(d, look) {
  const k = look && coatsFor(d.id).find(c => c.id === look.coat && c.from !== d.id);
  const col = look && COLLARS.find(c => c.id === look.collar);
  if (!k && !col) return d;
  const pal = k ? { ...Object.fromEntries(Object.entries(d.pal).filter(([r]) => OWN.has(r))), ...k.pal } : { ...d.pal };
  if (col) { pal.collar = col.hex; if (col.id === 'gold') Object.assign(pal, TAG_ON_GOLD); }
  return { ...d, pal };
}
