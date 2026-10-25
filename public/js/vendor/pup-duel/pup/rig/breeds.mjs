// breeds.mjs — who the dogs are: the one registry every part of the system reads (the rig draws it, the Learn menus,
// the duel and the push notifications name it, scripts/doberman/icons.mjs paints its faces).
// Part of the dog kit (public/doberman/): motion.mjs (easing, keyframes, the loop's clock), expressions.mjs (what a
// dog can feel), breeds.mjs (who the dogs are), parts.mjs (how a dog is drawn), rig.mjs (one dog, animated) and
// stage.mjs (the page: the scene, the menu, the embed's messages). docs/doberman/README.md has the map.
//
// A BREED is a build: the head (always 100 wide, so every hat, pair of glasses and neck piece fits it as drawn), its
// muzzle, eyes and brow marks, the ears (an engine: 'up' turns at the root with a tip that can fold, 'flop' hangs and
// swings; a shape from parts.mjs), the body and legs, the tail (a three-link chain: length, width, curl), coat markings
// (`marks`: SVG clipped to the part they sit on), and how it moves (wag, hop, ear bounce, the turn it rests in).
// A DOG is a breed with a name, a palette and whatever makes it itself (Rosie's ears never stood up; Pip's fold and
// flip on their own beat): its keys replace the breed's (one level: a dog's `head` replaces the breed's whole `head`).
//
// Adding a dog: one entry in DOGS. A new breed: one entry in BREEDS (and a shape in parts.mjs if none fits). Then
// `node scripts/doberman/icons.mjs` paints its face, and the audits (scripts/doberman/fit-audit.mjs, switch-audit.mjs,
// pop-audit.mjs) dress it in everything the shop sells.

/* every colour a part may ask for. A dog's palette names its own; the rest follow from these (resolve, below) */
const PAL0 = { mouth: '#b03a3a', tongue: '#ff7a8c', tongueSh: '#e45c70', tag: '#ffc800', tagSh: '#e5a800', blush: '#ff8a8a' };

const flat = v => [[0, v], [7200, v]];   /* a value held through the whole 7.2 s loop */

export const BREEDS = {
  doberman: {
    name: 'Doberman',
    build: { head: { h: 103, r: 22 }, muzzle: { w: 58, h: 44 }, eye: 1, pupil: 1, brow: { w: 12, h: 5.5, y: -53 },
      ears: ['up', 'up'], earShape: 'dober', foldable: false, body: { w: 108, h: 83 }, leg: 14, floorY: 80,
      tail: { len: [17, 15, 13], w: 12.5 }, wag: { slow: 14, fast: 28, amp: 34 }, hopH: 11, flopGain: 1, yaw0: 0.34, tongueSide: 0 }
  },
  // Pomeranians (founder 2026-10-23, from a reference sketch): a round head framed by a two-tone mane, small rounded
  // ears with a pink inner, a cream bib from the cheeks down the chest, a plume tail.
  pomeranian: {
    name: 'Pomeranian',
    build: { head: { h: 92, r: 42 }, muzzle: { w: 44, h: 34 }, eye: 1.1, pupil: 0.95, brow: { w: 9, h: 4.5, y: -52 },
      ears: ['up', 'up'], earShape: 'round', earScale: 0.8, foldable: false, mane: { rx: 58, ry: 46, n: 14, sc: 16 }, bib: true,
      body: { w: 98, h: 80 }, leg: 12, floorY: 70, tail: { len: [13, 12, 10], w: 24 }, wag: { slow: 20, fast: 34, amp: 40 },
      hopH: 13, flopGain: 1.5, yaw0: -0.3, tongueSide: 0 }
  },
  golden: {
    name: 'Golden Retriever', short: 'Golden',   // `short`: for a tile (the menus' dog picker); the name for everything else
    build: { head: { h: 104, r: 34 }, muzzle: { w: 56, h: 44 }, eye: 1.04, pupil: 1, brow: { w: 11, h: 5, y: -52.5 },
      ears: ['flop', 'flop'], flop: { w: 30, h: 46, shape: 'feather' }, earAt: { flop: { L: { x: -40, y: -45 }, R: { x: 42, y: -45 } } },
      body: { w: 112, h: 84 }, leg: 15, floorY: 84, tail: { len: [18, 17, 15], w: 20, inner: 7 },
      wag: { slow: 14, fast: 30, amp: 36 }, hopH: 10, flopGain: 2.4, yaw0: 0.3, tongueSide: 0 }
  },
  jack: {
    name: 'Jack Russell',
    build: { head: { h: 98, r: 28 }, muzzle: { w: 54, h: 40 }, eye: 1.06, pupil: 0.95, brow: { w: 9, h: 4.5, y: -52 },
      // button ears: an up ear whose tip stays folded over; it lifts when the dog is called or surprised
      ears: ['up', 'up'], earShape: 'button', earScale: 0.74, foldable: true, foldIdle: { L: flat(1), R: flat(1) },
      body: { w: 100, h: 72 }, leg: 13, floorY: 76, tail: { len: [12, 11, 9], w: 10, rest: 30 },
      wag: { slow: 20, fast: 38, amp: 46 }, hopH: 15, flopGain: 2, yaw0: -0.28, tongueSide: 1 }
  },
  corgi: {
    name: 'Corgi',
    build: { head: { h: 96, r: 32 }, muzzle: { w: 60, h: 42 }, eye: 1.06, pupil: 1, brow: { w: 10, h: 5, y: -52.5 },
      ears: ['up', 'up'], earShape: 'bat', earScale: 1.12, earAt: { up: { L: { x: -29, y: -49 }, R: { x: 31, y: -49 } } },
      body: { w: 132, h: 70, legs: [24, 92, 114] }, leg: 15, floorY: 60, tail: { len: [8, 7, 6], w: 20 },
      wag: { slow: 24, fast: 40, amp: 50 }, hopH: 9, flopGain: 1.2, yaw0: 0.3, tongueSide: 1 }
  },
  dachshund: {
    name: 'Dachshund',
    build: { head: { h: 100, r: 26 }, muzzle: { w: 52, h: 50 }, eye: 1.02, pupil: 1, brow: { w: 10, h: 5, y: -52.5 },
      ears: ['flop', 'flop'], flop: { w: 24, h: 58, shape: 'long' }, earAt: { flop: { L: { x: -38, y: -44 }, R: { x: 40, y: -44 } } },
      body: { w: 150, h: 62, legs: [22, 104, 132] }, leg: 14, floorY: 54, tail: { len: [20, 18, 16], w: 9, rest: -12, at: [8, 6] },
      wag: { slow: 16, fast: 30, amp: 30 }, hopH: 8, flopGain: 2.8, yaw0: -0.3, tongueSide: 0 }
  },
  husky: {
    name: 'Husky',
    build: { head: { h: 100, r: 30 }, muzzle: { w: 54, h: 42 }, eye: 1.04, pupil: 0.95, brow: { w: 10, h: 5.5, y: -53 },
      ears: ['up', 'up'], earShape: 'prick', foldable: false, body: { w: 112, h: 82 }, leg: 14, floorY: 82,
      tail: { len: [16, 15, 13], w: 20, curl: 55, inner: 9, over: true }, bib: 'chest',
      wag: { slow: 12, fast: 24, amp: 26 }, hopH: 10, flopGain: 1, yaw0: 0.32, tongueSide: 0 }
  },
  pug: {
    name: 'Pug',
    build: { head: { h: 92, r: 44 }, muzzle: { w: 62, h: 34, r: 14 }, eye: 1.16, pupil: 1.05, brow: { w: 9, h: 4.5, y: -51.5 },
      ears: ['flop', 'flop'], flop: { w: 20, h: 18, shape: 'rose' }, earAt: { flop: { L: { x: -40, y: -46 }, R: { x: 42, y: -46 } } },
      body: { w: 104, h: 86 }, leg: 13, floorY: 76, tail: { len: [9, 8, 7], w: 13, curl: 80, rest: 10, over: true, inner: 5 },
      wag: { slow: 20, fast: 36, amp: 30 }, hopH: 9, flopGain: 2, yaw0: -0.3, tongueSide: 1 }
  },
  dalmatian: {
    name: 'Dalmatian',
    build: { head: { h: 104, r: 24 }, muzzle: { w: 56, h: 46 }, eye: 1, pupil: 1, brow: { w: 11, h: 5, y: -53 },
      ears: ['flop', 'flop'], flop: { w: 24, h: 40 }, body: { w: 112, h: 82 }, leg: 14, floorY: 86,
      tail: { len: [18, 16, 15], w: 11, dots: 6 }, wag: { slow: 14, fast: 28, amp: 32 }, hopH: 11, flopGain: 2, yaw0: 0.3, tongueSide: 0 }
  },
  shiba: {
    name: 'Shiba Inu',
    build: { head: { h: 98, r: 32 }, muzzle: { w: 52, h: 40 }, eye: 1.02, pupil: 0.95, brow: { w: 8, h: 5, y: -52 },
      ears: ['up', 'up'], earShape: 'prick', earScale: 0.86, body: { w: 104, h: 78 }, leg: 13, floorY: 78,
      tail: { len: [15, 14, 12], w: 22, curl: 65, inner: 10, over: true }, bib: 'chest',
      wag: { slow: 16, fast: 30, amp: 28 }, hopH: 11, flopGain: 1, yaw0: -0.3, tongueSide: 0 }
  }
};

/* the dogs, grouped by breed: the menus list them in this order. `hint`: a line of personality for a tooltip */
export const DOGS = [
  { id: 'duke', name: 'Duke', breed: 'doberman', hint: 'Steady and proud', expr: 'overjoyed', scale: 1.5, mirror: false,
    pal: { coat: '#463e62', sh: '#352e4e', tan: '#e5a259', tanSh: '#cf8a45', feature: '#8a80ad', ink: '#241f36', nose: '#241f36',
      noseHi: '#4a4363', collar: '#ff4b4b', disc: '#ffe3e4', floor: '#ffc4c8' } },
  { id: 'rosie', name: 'Rosie', breed: 'doberman', hint: 'Warm and bashful', expr: 'bashful', scale: 1.58, mirror: false,
    head: { h: 110, r: 28 }, muzzle: { w: 56, h: 48 }, eye: 0.96, pupil: 1.06, brow: { w: 11, h: 5, y: -52.5 },
    ears: ['flop', 'flop'], flop: { w: 22, h: 38 }, body: { w: 112, h: 86 }, floorY: 84, tail: { len: [18, 16, 14], w: 12.5 },
    wag: { slow: 12, fast: 24, amp: 24 }, hopH: 8, flopGain: 2.2, yaw0: -0.26,
    pal: { coat: '#8c4a2f', sh: '#713a24', tan: '#e8a15f', tanSh: '#d0894a', feature: '#562a19', ink: '#2d1a14', nose: '#4a2416',
      noseHi: '#6e3a26', mouth: '#a8343a', collar: '#1cb0f6', disc: '#ddf4ff', floor: '#bfe4f7' } },
  { id: 'pip', name: 'Pip', breed: 'doberman', hint: 'Floppy-eared hype', expr: 'goofy', scale: 1.25, mirror: true,
    head: { h: 96, r: 30 }, muzzle: { w: 54, h: 40 }, eye: 1.12, pupil: 0.8, brow: { w: 9.5, h: 5, y: -52.5 }, foldable: true,
    body: { w: 96, h: 74 }, leg: 13, floorY: 72, tail: { len: [14, 13, 11], w: 11 }, wag: { slow: 18, fast: 32, amp: 42 },
    hopH: 14, flopGain: 2.6, yaw0: 0.3, tongueSide: 1,
    // Puppy ears that won't make up their minds: each tip folds down and flips back up on its own beat.
    foldIdle: {
      L: [[0, 0], [900, 0], [1250, 1], [2400, 1], [2750, 0], [4600, 0], [4950, 1], [5600, 1], [5950, 0], [7200, 0]],
      R: [[0, 1], [1500, 1], [1850, 0], [3300, 0], [3650, 1], [6000, 1], [6350, 0], [6850, 0], [7200, 1]]
    },
    pal: { coat: '#5d6b8e', sh: '#4a5675', tan: '#ebaa6e', tanSh: '#d69157', feature: '#38415c', ink: '#222a3d', nose: '#3c4560',
      noseHi: '#5d688a', collar: '#ce82ff', disc: '#f3e6ff', floor: '#e2c9fb', blush: '#ff9ab5' } },
  { id: 'mochi', name: 'Mochi', breed: 'pomeranian', hint: 'A ball of sunshine', expr: 'excited', scale: 1.34, mirror: false,
    pal: { coat: '#f2953f', sh: '#e2822e', tan: '#ffe7c7', tanSh: '#f6d0a0', feature: '#8a4a1a', ink: '#2b1a0e', nose: '#2b1a0e',
      noseHi: '#5e3d24', collar: '#2ec4a6', disc: '#fff0dc', floor: '#ffdcae',
      mane: '#f7aa58', maneSh: '#e88a36', bib: '#ffe7c7', bibSh: '#f8d6a9', earIn: '#ffc4a0', tail: '#f7aa58' } },
  { id: 'biscuit', name: 'Biscuit', breed: 'pomeranian', hint: 'Soft as a teddy', expr: 'bashful', scale: 1.28, mirror: true,
    head: { h: 90, r: 46 }, muzzle: { w: 42, h: 32 }, eye: 1.14, pupil: 1, brow: { w: 8.5, h: 4.2, y: -51 }, earScale: 0.64,
    mane: { rx: 52, ry: 42, n: 12, sc: 14 }, body: { w: 94, h: 78 }, floorY: 68, tail: { len: [12, 11, 9], w: 22 },
    wag: { slow: 22, fast: 36, amp: 44 }, hopH: 14, flopGain: 1.4, yaw0: 0.28, tongueSide: 1,
    pal: { coat: '#f7d9ae', sh: '#ecc68f', tan: '#fff8ee', tanSh: '#f2dcc0', feature: '#a86b3c', ink: '#3a2414', nose: '#3a2414',
      noseHi: '#6b4a33', collar: '#ff7eb6', disc: '#ffeef3', floor: '#ffd6e4', blush: '#ff9aa8',
      mane: '#fde6c6', maneSh: '#efcc98', bib: '#fffaf2', bibSh: '#f6e6cf', earIn: '#f7c9ae', tail: '#fde6c6' } },
  { id: 'pepper', name: 'Pepper', breed: 'pomeranian', hint: 'Small, fierce, loyal', expr: 'proud', scale: 1.36, mirror: false,
    head: { h: 94, r: 40 }, muzzle: { w: 46, h: 36 }, eye: 1.08, pupil: 0.95, brow: { w: 10, h: 5, y: -52.5 }, earScale: 0.84,
    mane: { rx: 62, ry: 48, n: 16, sc: 17 }, body: { w: 100, h: 82 }, floorY: 72, tail: { len: [14, 12, 10], w: 25 },
    wag: { slow: 18, fast: 32, amp: 38 }, hopH: 12, flopGain: 1.6, yaw0: -0.32,
    pal: { coat: '#473f52', sh: '#393243', tan: '#f2ab5c', tanSh: '#d98f43', feature: '#f2ab5c', ink: '#16121b', nose: '#16121b',
      noseHi: '#4a4352', mouth: '#a8343a', collar: '#ff4b4b', disc: '#ece6ff', floor: '#d6ccf5',
      mane: '#5a5066', maneSh: '#2a2430', bib: '#f2c389', bibSh: '#e2a964', earIn: '#f2ab5c', tail: '#4b4354' } },
  { id: 'sunny', name: 'Sunny', breed: 'golden', hint: 'Everyone’s best friend', expr: 'overjoyed', scale: 1.42, mirror: false,
    pal: { coat: '#f2b450', sh: '#d9953a', tan: '#fbd58b', tanSh: '#efbf6c', feature: '#a8641f', ink: '#2b1a0c', nose: '#3a2416',
      noseHi: '#6b4a33', collar: '#58cc02', disc: '#fff1d6', floor: '#ffdca3', ear: '#d48c35', tail: '#e6a344', tailIn: '#f8cc7a',
      bib: '#f9cf80', bibSh: '#ebb463', foot: '#f6c46c', footFar: '#e9b25a', brow: '#f9d48e' } },
  { id: 'scout', name: 'Scout', breed: 'jack', hint: 'Never stops moving', expr: 'excited', scale: 1.34, mirror: true,
    marks: [
      { on: 'head', svg: '<path d="M-56 -64 C-34 -70 -12 -62 -5 -44 C1 -28 -6 -14 -22 -12 C-40 -10 -56 -22 -56 -34 Z" fill="{patch}"/>' },
      { on: 'head', svg: '<path d="M14 -64 C30 -68 52 -62 56 -52 L56 -40 C44 -38 28 -42 18 -48 Z" fill="{patch}"/>' },
      { on: 'body', svg: g => `<ellipse cx="${g.bL + 7}" cy="-6" rx="15" ry="15" fill="{saddle}"/>` }   // on the rump: the rest of the body is behind the head
    ],
    pal: { coat: '#f6f2ea', sh: '#e2dacd', tan: '#ffffff', tanSh: '#eee8de', feature: '#8a6a4a', ink: '#2a1d14', nose: '#2a201c',
      noseHi: '#5a4a40', collar: '#ff4b4b', disc: '#e3f4ff', floor: '#c6e6fb', patch: '#c98543', saddle: '#3d3029',
      ear: '#c98543', earBack: '#a86a30', earIn: '#e8b27a', lidL: '#c98543', brow: '#e7b67c', foot: '#ffffff', footFar: '#eee8de' } },
  { id: 'waffles', name: 'Waffles', breed: 'corgi', hint: 'Short legs, big plans', expr: 'happy', scale: 1.4, mirror: false,
    marks: [
      { on: 'head', svg: '<path d="M-6 -56 L8 -56 C8 -44 12 -30 14 -18 L-12 -18 C-10 -30 -6 -44 -6 -56 Z" fill="{blaze}"/>' },
      { on: 'head', svg: '<ellipse cx="1" cy="6" rx="42" ry="24" fill="{blaze}"/>' },
      { on: 'body', svg: g => `<ellipse cx="${g.bR - 14}" cy="${-20 + 70}" rx="30" ry="22" fill="{blaze}"/>` }
    ],
    pal: { coat: '#ec8f3b', sh: '#d4772a', tan: '#fff6ea', tanSh: '#f0e2cd', feature: '#9a4d17', ink: '#2b170b', nose: '#2b170b',
      noseHi: '#5e3a22', collar: '#ce82ff', disc: '#fff0dc', floor: '#ffd9ae', blaze: '#fff6ea', earIn: '#ffd8bf',
      brow: '#f7b46e', tail: '#e9893a' } },
  { id: 'noodle', name: 'Noodle', breed: 'dachshund', hint: 'Long, brave, curious', expr: 'curious', scale: 1.36, mirror: true,
    pal: { coat: '#b5532b', sh: '#97421f', tan: '#d07646', tanSh: '#b8602f', feature: '#5e2410', ink: '#2b120a', nose: '#2b120a',
      noseHi: '#5a3020', collar: '#1cb0f6', disc: '#ffe7dc', floor: '#ffcdb8', ear: '#8b3a1a', brow: '#d07646',
      foot: '#a84b25', footFar: '#943f1d' } },
  { id: 'koda', name: 'Koda', breed: 'husky', hint: 'Talks back, loves snow', expr: 'proud', scale: 1.4, mirror: false,
    marks: [
      { on: 'head', svg: '<path d="M-56 -20 C-40 -14 -24 -12 -12 -17 L1 -26 L14 -17 C26 -12 42 -14 56 -20 L56 70 L-56 70 Z" fill="{mask}"/>' }
    ],
    pal: { coat: '#76839c', sh: '#5f6b83', tan: '#ffffff', tanSh: '#e2e8f0', feature: '#454f63', ink: '#2c5fa8', nose: '#1f232b',
      noseHi: '#4b5262', collar: '#ff4b4b', disc: '#e6f2ff', floor: '#c7dcf5', mask: '#f4f7fb', brow: '#ffffff', earIn: '#f4dcdc',
      foot: '#ffffff', footFar: '#e2e8f0', tail: '#66728a', tailIn: '#f4f7fb', bib: '#f4f7fb', bibSh: '#dde4ee' } },
  { id: 'pudding', name: 'Pudding', breed: 'pug', hint: 'Snores, snuggles, snacks', expr: 'goofy', scale: 1.36, mirror: true,
    marks: [
      { on: 'snout', svg: '<path d="M-14 -20.5 Q1 -26 16 -20.5" fill="none" stroke="{wrinkle}" stroke-width="2.6" stroke-linecap="round"/>' },
      { on: 'head', svg: '<path d="M-4 -52 Q1 -49 6 -52" fill="none" stroke="{wrinkleSoft}" stroke-width="2.2" stroke-linecap="round"/>' }
    ],
    pal: { coat: '#ebcb92', sh: '#d6b077', tan: '#3d322e', tanSh: '#2e2522', feature: '#7a5a32', ink: '#1e1714', nose: '#141010',
      noseHi: '#4a3d38', collar: '#ff9600', disc: '#fff3dc', floor: '#ffe0ae', ear: '#3a2f2b', brow: '#d7b47a',
      wrinkle: '#3d322e', wrinkleSoft: '#c9a46c', foot: '#e3c084', footFar: '#d6b077', tail: '#c3955a', tailIn: '#e6c48c' } },
  { id: 'domino', name: 'Domino', breed: 'dalmatian', hint: 'Fire-station charm', expr: 'happy', scale: 1.4, mirror: false,
    marks: [
      { on: 'head', svg: '<circle cx="-30" cy="-50" r="5" fill="{spot}"/><circle cx="26" cy="-52" r="4" fill="{spot}"/><circle cx="-40" cy="-10" r="4.5" fill="{spot}"/><circle cx="38" cy="-16" r="5" fill="{spot}"/><circle cx="42" cy="8" r="3.2" fill="{spot}"/><circle cx="-6" cy="-58" r="3.5" fill="{spot}"/>' },
      { on: 'muzzle', svg: '<circle cx="-12" cy="0" r="1.7" fill="{spot}"/><circle cx="-7" cy="5" r="1.4" fill="{spot}"/><circle cx="16" cy="1" r="1.7" fill="{spot}"/><circle cx="11" cy="6" r="1.4" fill="{spot}"/>' },
      { on: 'earR', svg: '<circle cx="-3" cy="8" r="4" fill="{spot}"/><circle cx="4" cy="20" r="3.2" fill="{spot}"/>' },
      { on: 'body', svg: g => [[18, -8, 6], [44, 6, 5], [64, -12, 6.5], [86, 4, 5], [32, 26, 4.5], [72, 28, 5]].map(([x, y, r]) => `<circle cx="${g.bL + x}" cy="${y}" r="${r}" fill="{spot}"/>`).join('') }
    ],
    pal: { coat: '#f7f7f5', sh: '#e4e4e0', tan: '#ffffff', tanSh: '#ececea', feature: '#3a3a44', ink: '#24242a', nose: '#1c1c22',
      noseHi: '#4a4a55', collar: '#ff4b4b', disc: '#ffe3e4', floor: '#ffc4c8', spot: '#2a2a30', earL: '#2a2a30', earR: '#f0f0ee',
      brow: '#d6d6dc', tail: '#e4e4e0', tailDots: '#2a2a30', foot: '#ffffff', footFar: '#ececea' } },
  { id: 'kiko', name: 'Kiko', breed: 'shiba', hint: 'Cool, calm, a little smug', expr: 'mog', scale: 1.38, mirror: true,
    marks: [
      { on: 'head', svg: '<ellipse cx="-30" cy="0" rx="19" ry="15" fill="{urajiro}"/><ellipse cx="32" cy="0" rx="19" ry="15" fill="{urajiro}"/>' }
    ],
    pal: { coat: '#e3843a', sh: '#c96f2a', tan: '#fbebd3', tanSh: '#f0d8b6', feature: '#8a4512', ink: '#2b170a', nose: '#2b170a',
      noseHi: '#5e3a22', collar: '#1cb0f6', disc: '#fff0dc', floor: '#ffd9ae', urajiro: '#fbebd3', brow: '#fbebd3', earIn: '#fbebd3',
      tail: '#d97a33', tailIn: '#fbebd3', bib: '#fbebd3', bibSh: '#efd6b2', foot: '#fbebd3', footFar: '#f0d8b6' } }
];

/* one dog, everything the rig reads: the breed's build under the dog's own keys, and a palette with every role filled
   (a part asks for `muzzle`, `lidL`, `earR`, … and gets the dog's colour, or the role it follows by default) */
export function resolve(d) {
  const B = BREEDS[d.breed];
  if (!B) throw new Error(`breeds.mjs: ${d.id} names an unknown breed ${d.breed}`);
  const c = { ...B.build, ...d, breedName: B.name };
  const p = { ...PAL0, ...d.pal };
  const up = side => c.ears[side === 'L' ? 0 : 1] === 'up';
  /* the legs are drawn over the body from the hip down (parts.mjs), in its colour: a leg of another colour would show
     its whole length on the body, a stilt. A dog's socks are its `foot` */
  p.body = p.body || p.sh; p.foot = p.foot || p.tan; p.footFar = p.footFar || p.tanSh;
  p.muzzle = p.muzzle || p.tan; p.brow = p.brow || p.tan; p.tail = p.tail || p.sh;
  for (const s of ['L', 'R']) {
    p['lid' + s] = p['lid' + s] || p.coat;                                  // the lid and the cheek that rises into a squint
    p['ear' + s] = p['ear' + s] || p.ear || (up(s) ? p.coat : p.sh);        // an ear's front
    p['earBack' + s] = p['earBack' + s] || p.earBack || p.sh;               // and its back, when a folded tip shows it
    p['earIn' + s] = p['earIn' + s] || p.earIn || p.tan;                    // the ear's inner
  }
  c.pal = p;
  return c;
}

/* what a host needs to name and show a dog: the menus, the duel, the push notifications */
export const ROSTER = DOGS.map(d => ({ id: d.id, name: d.name, breed: d.breed, breedName: BREEDS[d.breed].name, breedShort: BREEDS[d.breed].short || BREEDS[d.breed].name, hint: d.hint }));
export const DEFAULT_DOG = 'pip';
export const dogById = id => ROSTER.find(d => d.id === id) || ROSTER.find(d => d.id === DEFAULT_DOG);
