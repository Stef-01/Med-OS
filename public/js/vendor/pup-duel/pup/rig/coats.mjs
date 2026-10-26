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
import { eyeShape, irisOf, blushOf } from './eyes.mjs';

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
    { id: 'yellow', name: 'Yellow', from: 'honey' },
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
  bernese: [{ id: 'tri', name: 'Tricolour', from: 'heidi' }],
  // ---- the second eighteen breeds ----
  german: [
    { id: 'tan', name: 'Black and tan', from: 'max' },
    { id: 'black', name: 'Black', from: 'nova' },
    { id: 'sable', name: 'Sable', pal: { coat: '#b88a56', sh: '#9f7444', tan: '#d8b07a', tanSh: '#c69b64', feature: '#4a3420', nose: '#1e1816', noseHi: '#4a403d',
      mask: '#4f4440', patch: '#6a5848', ear: '#5a4c44', earIn: '#d8b07a', brow: '#d8b07a', tail: '#5a4c44', tailIn: '#7a6858',
      foot: '#d8b07a', footFar: '#c69b64' } },
    { id: 'white', name: 'White', pal: { coat: '#f5f1ea', sh: '#e3ddd2', tan: '#fbf8f3', tanSh: '#ece6dc', feature: '#7a6e62', nose: '#2a2420', noseHi: '#5a504a',
      mask: '#ece6dc', patch: '#ebe5da', ear: '#f5f1ea', earIn: '#f2cfc6', brow: '#fbf8f3', tail: '#ebe5da', tailIn: '#f8f5ef',
      foot: '#fbf8f3', footFar: '#ece6dc' } }
  ],
  rottweiler: [
    { id: 'rust', name: 'Black and rust', from: 'bruno' },
    { id: 'tan', name: 'Black and tan', pal: { coat: '#4a4250', sh: '#3c3542', tan: '#dc9a58', tanSh: '#c78446', feature: '#efb67a', nose: '#1a1517', noseHi: '#4a4248',
      ear: '#3c3542', brow: '#e2a462', tail: '#433b48', foot: '#dc9a58', footFar: '#c78446' } },
    { id: 'mahogany', name: 'Black and mahogany', pal: { coat: '#4a4250', sh: '#3c3542', tan: '#9a4a28', tanSh: '#843e20', feature: '#c97a52', nose: '#1a1517', noseHi: '#4a4248',
      ear: '#3c3542', brow: '#a8552e', tail: '#433b48', foot: '#9a4a28', footFar: '#843e20' } }
  ],
  boxer: [
    { id: 'fawn', name: 'Fawn', from: 'rocky' },
    { id: 'brindle', name: 'Brindle', pal: { coat: '#9a6236', sh: '#84522c', tan: '#fbf4ea', tanSh: '#ebdfd0', feature: '#3a200e', nose: '#1a1414', noseHi: '#4a3e3e',
      muzzle: '#3e3334', blaze: '#fbf4ea', bib: '#fbf4ea', bibSh: '#e6d8c6', brow: '#b47a4a', ear: '#7a4a28', tail: '#8c5830', foot: '#fbf4ea', footFar: '#ebdfd0' } },
    { id: 'white', name: 'White', pal: { coat: '#f6f1ea', sh: '#e4ddd2', tan: '#fdfaf5', tanSh: '#ede7dd', feature: '#7a6a5e', nose: '#3a2c2a', noseHi: '#6a5a56',
      muzzle: '#efd8d0', blaze: '#fdfaf5', bib: '#fdfaf5', bibSh: '#e8e0d4', brow: '#ede6dc', ear: '#ebe2d6', tail: '#ebe4da', foot: '#fdfaf5', footFar: '#ede7dd' } }
  ],
  bulldog: [
    { id: 'fawn', name: 'Fawn and white', from: 'winston' },
    { id: 'red', name: 'Red and white', pal: { coat: '#b8643a', sh: '#9e5430', tan: '#fbf6ef', tanSh: '#ede3d6', feature: '#5a2a12', nose: '#2a1c18', noseHi: '#5a4840',
      muzzle: '#fbf6ef', blaze: '#fbf6ef', wrinkle: '#8e4a28', ear: '#8e4a28', brow: '#d48a5a', body: '#ebe1d2', tail: '#e8d9c6', foot: '#fbf6ef', footFar: '#ede3d6' } },
    { id: 'brindle', name: 'Brindle and white', pal: { coat: '#86603e', sh: '#704e32', tan: '#fbf6ef', tanSh: '#ede3d6', feature: '#3a2412', nose: '#1e1614', noseHi: '#4a3e3a',
      muzzle: '#fbf6ef', blaze: '#fbf6ef', wrinkle: '#5e4028', ear: '#5e4028', brow: '#a8805a', body: '#ebe1d2', tail: '#e8d9c6', foot: '#fbf6ef', footFar: '#ede3d6' } },
    { id: 'white', name: 'White', pal: { coat: '#f4ede4', sh: '#e2d9cc', tan: '#fdfaf5', tanSh: '#eee6da', feature: '#7a6a5a', nose: '#2a1c18', noseHi: '#5a4840',
      muzzle: '#fdfaf5', blaze: '#fdfaf5', wrinkle: '#d6c6b2', ear: '#e8c8b8', brow: '#ece2d4', body: '#ebe1d2', tail: '#e8d9c6', foot: '#fdfaf5', footFar: '#eee6da' } }
  ],
  cavalier: [
    { id: 'blenheim', name: 'Blenheim', from: 'archie' },
    { id: 'ruby', name: 'Ruby', pal: { coat: '#b05a2c', sh: '#964a24', tan: '#c9733e', tanSh: '#b4632f', feature: '#4a200c', nose: '#2a1c18', noseHi: '#5a4840',
      patch: '#b05a2c', lidL: '#b05a2c', lidR: '#b05a2c', ear: '#934822', brow: '#cf7c48', tail: '#a4532a', tailIn: '#c9733e',
      foot: '#c9733e', footFar: '#b4632f' } },
    { id: 'blacktan', name: 'Black and tan', pal: { coat: '#4a4352', sh: '#3c3644', tan: '#d08a4c', tanSh: '#ba763e', feature: '#e8a466', nose: '#1a1519', noseHi: '#554b59',
      patch: '#4a4352', lidL: '#4a4352', lidR: '#4a4352', ear: '#3c3644', brow: '#d08a4c', tail: '#45404d', tailIn: '#5a5363',
      foot: '#d08a4c', footFar: '#ba763e' } },
    { id: 'tri', name: 'Tricolour', pal: { coat: '#fbf6ef', sh: '#ebe2d6', tan: '#ffffff', tanSh: '#efe8de', feature: '#2e2a32', nose: '#1e1a1c', noseHi: '#4a4448',
      patch: '#45404d', lidL: '#45404d', lidR: '#45404d', ear: '#3c3644', brow: '#d08a4c', tail: '#45404d', tailIn: '#5a5363',
      foot: '#ffffff', footFar: '#efe8de' } }
  ],
  shihtzu: [
    { id: 'gold', name: 'Gold and white', from: 'mei' },
    { id: 'black', name: 'Black and white', pal: { coat: '#4c4654', sh: '#3e3946', tan: '#fdf8f0', tanSh: '#efe5d6', feature: '#a59cae', nose: '#16131a', noseHi: '#47414e',
      blaze: '#fdf8f0', beard: '#fdf8f0', ear: '#3e3946', brow: '#6a6374', tail: '#4c4654', tailIn: '#fdf8f0', foot: '#fdf8f0', footFar: '#efe5d6' } },
    { id: 'liver', name: 'Liver and white', pal: { coat: '#8a5038', sh: '#74422e', tan: '#fdf8f0', tanSh: '#efe5d6', feature: '#3a1a0e', nose: '#5a2e22', noseHi: '#86584a',
      blaze: '#fdf8f0', beard: '#fdf8f0', ear: '#74422e', brow: '#a8705a', tail: '#8a5038', tailIn: '#fdf8f0', foot: '#fdf8f0', footFar: '#efe5d6' } },
    { id: 'silver', name: 'Silver and white', pal: { coat: '#b4b6c0', sh: '#9ea1ac', tan: '#fdfcfa', tanSh: '#eceef2', feature: '#4a4c58', nose: '#1e1e24', noseHi: '#4a4a54',
      blaze: '#fdfcfa', beard: '#fdfcfa', ear: '#9ea1ac', brow: '#d0d2d8', tail: '#b4b6c0', tailIn: '#fdfcfa', foot: '#fdfcfa', footFar: '#eceef2' } }
  ],
  yorkie: [
    { id: 'blue', name: 'Blue and tan', from: 'pixie' },
    { id: 'black', name: 'Black and tan', pal: { coat: '#d39a54', sh: '#bd8442', tan: '#e8be86', tanSh: '#d8a86c', feature: '#7a4a1e', nose: '#1d1714', noseHi: '#4a3f3a',
      body: '#48434f', tail: '#433e4a', ear: '#c88e48', earIn: '#efc59a', brow: '#e8be86', foot: '#d39a54', footFar: '#bd8442' } },
    { id: 'gold', name: 'Gold', pal: { coat: '#e2b46e', sh: '#cc9c58', tan: '#f2d4a0', tanSh: '#e4c088', feature: '#8a5a26', nose: '#1d1714', noseHi: '#4a3f3a',
      body: '#d6a862', tail: '#cfa05a', ear: '#d8a862', earIn: '#f6d6ae', brow: '#f2d4a0', foot: '#e2b46e', footFar: '#cc9c58' } }
  ],
  aussie: [
    { id: 'bluemerle', name: 'Blue merle', from: 'ziggy' },
    { id: 'redmerle', name: 'Red merle', pal: { coat: '#cfa088', sh: '#b98a72', tan: '#ffffff', tanSh: '#efe6e0', feature: '#5a2c18', nose: '#5a3020', noseHi: '#86584a',
      patch: '#9a5034', rust: '#c47640', blaze: '#ffffff', bib: '#ffffff', bibSh: '#ece2da', lidL: '#9a5034', earL: '#9a5034', earR: '#cfa088',
      earIn: '#f0c8c0', brow: '#c47640', tail: '#b98a72', foot: '#ffffff', footFar: '#efe6e0' } },
    { id: 'blacktri', name: 'Black tricolour', pal: { coat: '#4a4654', sh: '#3c3946', tan: '#ffffff', tanSh: '#e6e8ee', feature: '#22202a', nose: '#16141a', noseHi: '#45424e',
      patch: '#4a4654', rust: '#c47640', blaze: '#ffffff', bib: '#ffffff', bibSh: '#dfe2ea', lidL: '#4a4654', earL: '#3c3946', earR: '#3c3946',
      earIn: '#d8b8c0', brow: '#c47640', tail: '#3c3946', foot: '#ffffff', footFar: '#e6e8ee' } },
    { id: 'redtri', name: 'Red tricolour', pal: { coat: '#9c5634', sh: '#84482a', tan: '#ffffff', tanSh: '#efe6de', feature: '#4a200e', nose: '#4a2618', noseHi: '#76483a',
      patch: '#9c5634', rust: '#d8955a', blaze: '#ffffff', bib: '#ffffff', bibSh: '#ece2d8', lidL: '#9c5634', earL: '#84482a', earR: '#84482a',
      earIn: '#e8c0b0', brow: '#d8955a', tail: '#84482a', foot: '#ffffff', footFar: '#efe6de' } }
  ],
  whippet: [
    { id: 'fawn', name: 'Fawn', from: 'flash' },
    { id: 'blue', name: 'Blue', pal: { coat: '#8e98ab', sh: '#7a8498', tan: '#a8b0c0', tanSh: '#97a0b2', feature: '#3c4254', nose: '#2a2c36', noseHi: '#565a66',
      blaze: '#f4f5f8', ear: '#737d92', brow: '#a8b0c0', tail: '#848ea2', foot: '#f4f5f8', footFar: '#e2e5ec' } },
    { id: 'black', name: 'Black', pal: { coat: '#4c4756', sh: '#3e3a47', tan: '#5e5868', tanSh: '#524c5c', feature: '#9a92a5', nose: '#16131a', noseHi: '#47414e',
      blaze: '#f4f2f6', ear: '#3e3a47', brow: '#5e5868', tail: '#45404d', foot: '#f4f2f6', footFar: '#e2dfe6' } },
    { id: 'cream', name: 'Cream', pal: { coat: '#efd6b2', sh: '#dfc296', tan: '#f8e8d0', tanSh: '#ecd6b6', feature: '#8a6a44', nose: '#3a2a22', noseHi: '#66544a',
      blaze: '#fdf8f0', ear: '#d8b88c', brow: '#f8e8d0', tail: '#e2c69c', foot: '#fdf8f0', footFar: '#efe6d8' } }
  ],
  basset: [
    { id: 'red', name: 'Red and white', from: 'barney' },
    { id: 'tri', name: 'Tricolour', pal: { coat: '#c98a48', sh: '#b2763a', tan: '#fbf7f1', tanSh: '#ece4d8', feature: '#6e3c17', nose: '#2a1d18', noseHi: '#5a463c',
      body: '#f6f1ea', blaze: '#fbf7f1', patch: '#3a3236', ear: '#a9622c', brow: '#e8ad6e', tail: '#3a3236', foot: '#ffffff', footFar: '#ece6dc' } },
    { id: 'lemon', name: 'Lemon and white', pal: { coat: '#e6c07a', sh: '#d2a960', tan: '#fbf7f1', tanSh: '#ece4d8', feature: '#8a6a3a', nose: '#3a2a22', noseHi: '#66544a',
      body: '#f6f1ea', blaze: '#fbf7f1', patch: '#ddb468', ear: '#d0a058', brow: '#f2d8a4', tail: '#ddb468', foot: '#ffffff', footFar: '#ece6dc' } }
  ],
  dane: [
    { id: 'fawn', name: 'Fawn', from: 'moose' },
    { id: 'harlequin', name: 'Harlequin', pal: { coat: '#f7f6f4', sh: '#e4e2de', tan: '#ffffff', tanSh: '#ececea', feature: '#3a3a44', nose: '#1c1c22', noseHi: '#4a4a55',
      mask: '#3a3640', harl: '#3a3640', harlB: '#3a3640', ear: '#3a3640', brow: '#dcdade', tail: '#e4e2de',
      foot: '#ffffff', footFar: '#ececea' } },
    { id: 'blue', name: 'Blue', pal: { coat: '#7f889c', sh: '#6c7589', tan: '#8f98aa', tanSh: '#7f889c', feature: '#323848', nose: '#262a36', noseHi: '#545a6c',
      mask: '#5e6678', harl: '#7f889c', harlB: '#6c7589', ear: '#5e6678', brow: '#959eb0', tail: '#6c7589',
      foot: '#8f98aa', footFar: '#7f889c' } },
    { id: 'black', name: 'Black', pal: { coat: '#4c4756', sh: '#3e3a47', tan: '#5e5868', tanSh: '#524c5c', feature: '#9a92a5', nose: '#16131a', noseHi: '#47414e',
      mask: '#3e3a47', harl: '#4c4756', harlB: '#3e3a47', ear: '#3e3a47', brow: '#5e5868', tail: '#45404e',
      foot: '#5e5868', footFar: '#524c5c' } }
  ],
  stbernard: [
    { id: 'red', name: 'Red and white', from: 'barry' },
    { id: 'brindle', name: 'Brindle and white', pal: { coat: '#8a5634', sh: '#74462a', tan: '#fbf6ef', tanSh: '#ece2d4', feature: '#2a160c', nose: '#1e1616', noseHi: '#4a3e3c',
      mask: '#4a2a1a', lidL: '#4a2a1a', lidR: '#4a2a1a', blaze: '#fbf6ef', bib: '#fbf6ef', bibSh: '#e8ddcc', patch: '#8a5634', body: '#ece3d6', ear: '#6a3e24',
      brow: '#b07a52', tail: '#8a5634', tailIn: '#a8704a', foot: '#fbf6ef', footFar: '#ece2d4' } },
    { id: 'orange', name: 'Orange and white', pal: { coat: '#d67e3c', sh: '#bd6a30', tan: '#fbf6ef', tanSh: '#ece2d4', feature: '#3a1a0a', nose: '#1e1616', noseHi: '#4a3e3c',
      mask: '#8a4420', lidL: '#8a4420', lidR: '#8a4420', blaze: '#fbf6ef', bib: '#fbf6ef', bibSh: '#e8ddcc', patch: '#d67e3c', body: '#ece3d6', ear: '#b0602a',
      brow: '#eaa266', tail: '#d67e3c', tailIn: '#eaa266', foot: '#fbf6ef', footFar: '#ece2d4' } }
  ],
  chow: [
    { id: 'red', name: 'Red', from: 'leo' },
    { id: 'black', name: 'Black', pal: { coat: '#4c4654', sh: '#3e3946', tan: '#5a5363', tanSh: '#4e4857', feature: '#9a92a5', nose: '#16131a', noseHi: '#47414e',
      mane: '#534c5c', maneSh: '#38333f', ear: '#3e3946', earIn: '#5a5363', brow: '#5a5363', tail: '#534c5c', tailIn: '#665e70', foot: '#4c4654', footFar: '#3e3946' } },
    { id: 'blue', name: 'Blue', pal: { coat: '#7f889c', sh: '#6c7589', tan: '#8f98aa', tanSh: '#7f889c', feature: '#323848', nose: '#262a36', noseHi: '#545a6c',
      mane: '#8790a4', maneSh: '#626b80', ear: '#6c7589', earIn: '#8f98aa', brow: '#8f98aa', tail: '#8790a4', tailIn: '#9ca4b6', foot: '#7f889c', footFar: '#6c7589' } },
    { id: 'cream', name: 'Cream', pal: { coat: '#edd5ac', sh: '#dcbf92', tan: '#f6e4c4', tanSh: '#ead2ac', feature: '#8a6a40', nose: '#2b1a10', noseHi: '#5a4030',
      mane: '#f2dcb6', maneSh: '#d8b888', ear: '#dcbf92', earIn: '#f6e4c4', brow: '#f6e4c4', tail: '#f2dcb6', tailIn: '#faecd2', foot: '#edd5ac', footFar: '#dcbf92' } },
    { id: 'cinnamon', name: 'Cinnamon', pal: { coat: '#b98a62', sh: '#a27652', tan: '#cfa27a', tanSh: '#bc8e68', feature: '#4a2e18', nose: '#3a2418', noseHi: '#6a4e40',
      mane: '#c2946c', maneSh: '#966a48', ear: '#a27652', earIn: '#cfa27a', brow: '#cfa27a', tail: '#c2946c', tailIn: '#d6ae88', foot: '#b98a62', footFar: '#a27652' } }
  ],
  schnauzer: [
    { id: 'salt', name: 'Salt and pepper', from: 'otto' },
    { id: 'black', name: 'Black', pal: { coat: '#4c4756', sh: '#3e3a47', tan: '#5a5464', tanSh: '#4e4858', feature: '#9a92a5', nose: '#16131a', noseHi: '#47414e',
      beard: '#615a6c', brow: '#655e70', ear: '#3e3a47', earBack: '#34303c', earIn: '#6a6374', tail: '#45404e', foot: '#5a5464', footFar: '#4e4858' } },
    { id: 'silver', name: 'Black and silver', pal: { coat: '#4c4756', sh: '#3e3a47', tan: '#cfd1d8', tanSh: '#bcbfc8', feature: '#22202a', nose: '#16131a', noseHi: '#47414e',
      beard: '#e4e6eb', brow: '#e4e6eb', ear: '#3e3a47', earBack: '#34303c', earIn: '#8a8494', tail: '#45404e', foot: '#cfd1d8', footFar: '#bcbfc8' } },
    { id: 'white', name: 'White', pal: { coat: '#f3f2ef', sh: '#e1dfda', tan: '#fbfaf8', tanSh: '#ebe9e4', feature: '#77746e', nose: '#1e1e22', noseHi: '#4a4a50',
      beard: '#ffffff', brow: '#ffffff', ear: '#e1dfda', earBack: '#d2cfc8', earIn: '#f2d4d0', tail: '#e8e6e2', foot: '#fbfaf8', footFar: '#ebe9e4' } }
  ],
  /* a Weimaraner comes in grey: silver, mouse or blue */
  weimaraner: [
    { id: 'silver', name: 'Silver grey', from: 'ghost' },
    { id: 'mouse', name: 'Mouse grey', pal: { coat: '#9b928e', sh: '#867d79', tan: '#b4aca8', tanSh: '#a29a96', feature: '#4e4642', nose: '#7e6664', noseHi: '#9c8682',
      ear: '#847b77', brow: '#b4aca8', tail: '#8e8581', foot: '#aca4a0', footFar: '#9b928e' } },
    { id: 'blue', name: 'Blue', pal: { coat: '#838b9c', sh: '#707888', tan: '#9aa1b0', tanSh: '#8a91a0', feature: '#3c4250', nose: '#4e5260', noseHi: '#6e7280',
      ear: '#6e7686', brow: '#9aa1b0', tail: '#7a8292', foot: '#929aa8', footFar: '#838b9c' } }
  ],
  heeler: [
    { id: 'blue', name: 'Blue', from: 'digger' },
    { id: 'red', name: 'Red', from: 'rusty' }
  ],
  cavoodle: [
    { id: 'apricot', name: 'Apricot', from: 'coco' },
    { id: 'chocolate', name: 'Chocolate', from: 'milo' },
    { id: 'red', name: 'Ruby red', pal: { coat: '#b95c34', sh: '#a04c2a', tan: '#cd7546', tanSh: '#b9643a', feature: '#4a1e0c', nose: '#2a1812', noseHi: '#5a4036',
      mane: '#c2663c', maneSh: '#93441f', fluff: '#d6825a', ear: '#a54f2a', brow: '#d6825a', tail: '#a54f2a', foot: '#c2663c', footFar: '#ad5832' } },
    { id: 'black', name: 'Black', pal: { coat: '#4c4756', sh: '#3e3a47', tan: '#5e5868', tanSh: '#524c5c', feature: '#9a92a5', nose: '#16131a', noseHi: '#47414e',
      mane: '#56505f', maneSh: '#38343f', fluff: '#6a6374', ear: '#45404e', brow: '#6a6374', tail: '#45404e', foot: '#56505f', footFar: '#4a4553' } },
    { id: 'cream', name: 'Cream', pal: { coat: '#f0d8b4', sh: '#e0c29a', tan: '#f8e6cc', tanSh: '#ecd4b2', feature: '#9a7650', nose: '#2b1a12', noseHi: '#5c3f30',
      mane: '#f4dfbe', maneSh: '#dcbe92', fluff: '#fbecd6', ear: '#e6cca6', brow: '#fbecd6', tail: '#e6cca6', foot: '#f4dfbe', footFar: '#e6cca6' } }
  ],
  staffy: [
    { id: 'red', name: 'Red', from: 'ruby' },
    { id: 'blue', name: 'Blue', pal: { coat: '#7f889c', sh: '#6c7589', tan: '#939cae', tanSh: '#838ca0', feature: '#323848', nose: '#262a36', noseHi: '#545a6c',
      blaze: '#f6f6f8', ear: '#646d82', brow: '#939cae', tail: '#6c7589', foot: '#f6f6f8', footFar: '#e4e6ec' } },
    { id: 'brindle', name: 'Brindle', pal: { coat: '#765a48', sh: '#644a3a', tan: '#8c6e5a', tanSh: '#7a5e4c', feature: '#2e1e14', nose: '#1a1414', noseHi: '#4a3e3a',
      blaze: '#f8f4ee', ear: '#5a4232', brow: '#937462', tail: '#644a3a', foot: '#f8f4ee', footFar: '#e8e0d6' } },
    { id: 'black', name: 'Black and white', pal: { coat: '#4c4756', sh: '#3e3a47', tan: '#5e5868', tanSh: '#524c5c', feature: '#9a92a5', nose: '#16131a', noseHi: '#47414e',
      blaze: '#f8f6fa', ear: '#3e3a47', brow: '#5e5868', tail: '#45404e', foot: '#f8f6fa', footFar: '#e6e3ea' } }
  ]
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
/* a gift dog (the Eevee family) is one character, not a coat on its breed: it keeps its own colours only */
export const coatsFor = id => (byId(id) ? (byId(id).gift ? COATS[byId(id).breed].filter(k => k.from === id) : COATS[byId(id).breed]) : []);
export const ownCoat = id => (coatsFor(id).find(k => k.from === id) || {}).id || '';
export const ownCollar = id => { const d = byId(id), hex = d && d.pal.collar; return (COLLARS.find(k => k.hex === hex) || {}).id || ''; };

/* a DOGS entry in a look's coat, collar, eyes and blush, for resolve(): an unknown coat or collar leaves the dog's own */
export function dress(d, look) {
  const k = look && coatsFor(d.id).find(c => c.id === look.coat && c.from !== d.id);
  const col = look && COLLARS.find(c => c.id === look.collar);
  /* the eyes and the blush (eyes.mjs): a shape, an iris and a blush the kit knows, else the dog's own */
  const face = {}, sh = look && eyeShape(look.eyes), ir = look && irisOf(look.iris), bl = look && blushOf(look.blush);
  if (sh && sh.id) { face.eyes = sh.id; face.sclera = sh.id !== 'bead'; }   /* a chosen shape decides the white; Its own keeps the dog's */
  if (ir && ir.id) { face.iris = ir.id; face.irisDeep = ir.deep; }
  if (bl && bl.id) face.blushMode = bl.id;
  if (!k && !col) return Object.keys(face).length ? { ...d, ...face } : d;
  const pal = k ? { ...Object.fromEntries(Object.entries(d.pal).filter(([r]) => OWN.has(r))), ...k.pal } : { ...d.pal };
  if (col) { pal.collar = col.hex; if (col.id === 'gold') Object.assign(pal, TAG_ON_GOLD); }
  return { ...d, ...face, pal };
}
