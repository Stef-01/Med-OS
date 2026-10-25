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
  },
  // Beagle: a tricolour hound: a tan head with a white blaze and muzzle, long low-set ears, a black saddle on a white
  // body, the tail carried high with a white tip (its one spot: a dotted line's second dot, 2.2 × dots along it, falls
  // at its end; `at` roots it a dot's radius inside the body, which hides the first)
  beagle: {
    name: 'Beagle',
    build: { head: { h: 100, r: 30 }, muzzle: { w: 54, h: 46 }, eye: 1.06, pupil: 1.04, brow: { w: 10, h: 5, y: -52.5 },
      ears: ['flop', 'flop'], flop: { w: 28, h: 58, shape: 'long' }, earAt: { flop: { L: { x: -40, y: -42 }, R: { x: 42, y: -42 } } },
      body: { w: 126, h: 76 }, leg: 14, floorY: 80, tail: { len: [12, 11, 10], w: 11, rest: 26, curl: -4, dots: 14.2, at: [19.7, -7.3] },
      wag: { slow: 18, fast: 36, amp: 40 }, hopH: 12, flopGain: 2.6, yaw0: 0.3, tongueSide: 0 }
  },
  // French Bulldog: a square head with a short, wide, flat face, broad bat ears, a compact body on short legs, a stub tail
  frenchie: {
    name: 'French Bulldog', short: 'Frenchie',
    build: { head: { h: 92, r: 26 }, muzzle: { w: 66, h: 32, r: 15 }, eye: 1.12, pupil: 1.04, brow: { w: 9, h: 4.5, y: -51.5 },
      ears: ['up', 'up'], earShape: 'frenchie', earScale: 0.92, earAt: { up: { L: { x: -32, y: -46 }, R: { x: 34, y: -46 } } },
      body: { w: 100, h: 78 }, leg: 15, floorY: 70, tail: { len: [6, 5, 4], w: 12, rest: 10 },
      wag: { slow: 22, fast: 40, amp: 36 }, hopH: 10, flopGain: 1.2, yaw0: -0.3, tongueSide: 1 }
  },
  // Border Collie: black and white (a white blaze, muzzle and collar), semi-erect ears whose tips fold over, a long low
  // tail that sweeps up at its end
  collie: {
    name: 'Border Collie',
    build: { head: { h: 100, r: 30 }, muzzle: { w: 48, h: 44 }, eye: 1.04, pupil: 0.95, brow: { w: 10, h: 5, y: -53 },
      ears: ['up', 'up'], earShape: 'prick', earScale: 1, foldable: true, foldIdle: { L: flat(1), R: flat(1) }, bib: 'chest',
      body: { w: 112, h: 76 }, leg: 13, floorY: 80, tail: { len: [17, 16, 14], w: 12, rest: -62, curl: 14 },
      wag: { slow: 14, fast: 30, amp: 30 }, hopH: 13, flopGain: 1.4, yaw0: 0.32, tongueSide: 1 }
  },
  // Labrador Retriever: one plain coat, a broad head and muzzle, soft drop ears, the otter tail: thick, straight, carried out
  lab: {
    name: 'Labrador Retriever', short: 'Labrador',
    build: { head: { h: 104, r: 30 }, muzzle: { w: 58, h: 46 }, eye: 1.02, pupil: 1.05, brow: { w: 11, h: 5, y: -52.5 },
      ears: ['flop', 'flop'], flop: { w: 27, h: 44 }, earAt: { flop: { L: { x: -41, y: -44 }, R: { x: 43, y: -44 } } },
      body: { w: 116, h: 84 }, leg: 15, floorY: 84, tail: { len: [16, 15, 13], w: 17, rest: -20, curl: -9 },
      wag: { slow: 16, fast: 34, amp: 42 }, hopH: 11, flopGain: 2.2, yaw0: 0.3, tongueSide: 0 }
  },
  // Samoyed: a white cloud: a ruff round the head, small prick ears, the smile (black lips turned up at the corners),
  // a plume curled over the back
  samoyed: {
    name: 'Samoyed',
    build: { head: { h: 98, r: 38 }, muzzle: { w: 50, h: 40 }, eye: 1.04, pupil: 1, brow: { w: 9, h: 4.5, y: -52 },
      ears: ['up', 'up'], earShape: 'prick', earScale: 0.72, mane: { rx: 56, ry: 47, n: 16, sc: 15 }, bib: 'chest',
      body: { w: 112, h: 86 }, leg: 15, floorY: 84, tail: { len: [16, 15, 13], w: 26, curl: 60, inner: 12, over: true },
      wag: { slow: 14, fast: 28, amp: 32 }, hopH: 11, flopGain: 1, yaw0: 0.3, tongueSide: 0 }
  },
  // Chihuahua: a small domed apple head with huge eyes and a short snout, enormous ears, a tiny body on thin legs, a
  // thin sickle tail
  chihuahua: {
    name: 'Chihuahua',
    build: { head: { h: 90, r: 46 }, muzzle: { w: 40, h: 30 }, eye: 1.16, pupil: 1.06, brow: { w: 8, h: 4, y: -53.6 },
      ears: ['up', 'up'], earShape: 'chi', earScale: 1.2, earAt: { up: { L: { x: -36, y: -41 }, R: { x: 38, y: -41 } } },
      body: { w: 102, h: 60 }, leg: 10, floorY: 66, tail: { len: [11, 10, 9], w: 7, rest: 22, curl: 14 },
      wag: { slow: 22, fast: 40, amp: 46 }, hopH: 15, flopGain: 1.5, yaw0: -0.3, tongueSide: 1 }
  },
  // Poodle, in a show clip: a topknot (a tall mane: its crown over the head, its fluff under the chin, its sides behind
  // the ears), ears of curls, a shaved face and hindquarters on long legs, a rosette on the hip, pom-pom bracelets (its
  // feet) and the pom-pom tail (its one spot, at the end)
  poodle: {
    name: 'Poodle',
    build: { head: { h: 100, r: 30 }, muzzle: { w: 44, h: 46 }, eye: 1, pupil: 1, brow: { w: 9, h: 4.5, y: -52.5 },
      ears: ['flop', 'flop'], flop: { w: 30, h: 56, shape: 'puff' }, earAt: { flop: { L: { x: -40, y: -44 }, R: { x: 42, y: -44 } } },
      mane: { rx: 42, ry: 58, n: 14, sc: 15 }, body: { w: 120, h: 70 }, leg: 12, floorY: 86,
      tail: { len: [10.5, 9.5, 9], w: 6, rest: 28, curl: -9, dots: 12.6, at: [18.2, -8.2] },
      wag: { slow: 18, fast: 34, amp: 34 }, hopH: 13, flopGain: 2.4, yaw0: -0.3, tongueSide: 0 }
  },
  // Bernese Mountain Dog: big and fluffy, tricolour: a black coat, a white blaze, muzzle and chest, rust brows and
  // cheeks, feathered drop ears, a bushy tail carried low that sweeps up at its end
  bernese: {
    name: 'Bernese Mountain Dog', short: 'Bernese',
    build: { head: { h: 104, r: 32 }, muzzle: { w: 54, h: 44 }, eye: 1.02, pupil: 1, brow: { w: 11, h: 5.5, y: -52.5 },
      ears: ['flop', 'flop'], flop: { w: 30, h: 40, shape: 'feather' }, earAt: { flop: { L: { x: -40, y: -46 }, R: { x: 42, y: -46 } } },
      bib: 'chest', body: { w: 122, h: 88 }, leg: 16, floorY: 86,
      tail: { len: [14, 13, 12], w: 18, rest: -70, curl: 16, inner: 8, at: [12.5, 14] },
      wag: { slow: 12, fast: 26, amp: 30 }, hopH: 9, flopGain: 2.2, yaw0: 0.3, tongueSide: 0 }
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
      tail: '#d97a33', tailIn: '#fbebd3', bib: '#fbebd3', bibSh: '#efd6b2', foot: '#fbebd3', footFar: '#f0d8b6' } },
  { id: 'bagel', name: 'Bagel', breed: 'beagle', hint: 'Follows its nose anywhere', expr: 'curious', scale: 1.36, mirror: false,
    marks: [
      { on: 'head', svg: '<rect x="-4" y="-64" width="10" height="26" rx="5" fill="{blaze}"/><ellipse cx="1" cy="44" rx="24" ry="15" fill="{blaze}"/>' },
      { on: 'body', svg: g => `<ellipse cx="${g.bL + 18}" cy="28" rx="21" ry="23" fill="{coat}"/>` +
          `<path d="M${g.bL - 4} -24 H${g.bR + 4} V16 C${g.bR - 44} 24 ${g.bL + 40} 24 ${g.bL + 18} 12 C${g.bL + 8} 6 ${g.bL - 4} -2 ${g.bL - 4} -24 Z" fill="{saddle}"/>` }
    ],
    pal: { coat: '#cf8a48', sh: '#b8743a', tan: '#fbf7f1', tanSh: '#ece4d8', feature: '#6e3c17', ink: '#2a1a10', nose: '#2a1d18',
      noseHi: '#5a463c', collar: '#58cc02', disc: '#eaffd6', floor: '#c9f0a8', body: '#f6f1ea', blaze: '#fbf7f1', saddle: '#3a3236',
      ear: '#a9622c', brow: '#e8ad6e', tail: '#c4803f', tailDots: '#ffffff', foot: '#ffffff', footFar: '#ece6dc' } },
  { id: 'gaston', name: 'Gaston', breed: 'frenchie', hint: 'Struts like he owns Paris', expr: 'mog', scale: 1.3, mirror: true,
    marks: [
      { on: 'snout', svg: '<circle cx="-14" cy="4" r="15" fill="{muzzle}"/><circle cx="16" cy="4" r="15" fill="{muzzle}"/>' +
          '<path d="M-13 -20 Q1 -25 15 -20" fill="none" stroke="{wrinkle}" stroke-width="2.4" stroke-linecap="round"/>' },
      { on: 'body', svg: g => `<ellipse cx="${g.bR - 26}" cy="50" rx="18" ry="16" fill="{blaze}"/>` }
    ],
    pal: { coat: '#8b93a8', sh: '#77809a', tan: '#646c84', tanSh: '#59617a', feature: '#4a5166', ink: '#1f2433', nose: '#262a36',
      noseHi: '#545a6c', collar: '#ff4b4b', disc: '#ffe3e4', floor: '#ffc4c8', earIn: '#f2b8c0', brow: '#a7aec1', blaze: '#f4f5f8',
      wrinkle: '#6c748a', foot: '#9aa2b6', footFar: '#8a92a7' } },
  { id: 'dash', name: 'Dash', breed: 'collie', hint: 'Herds anything that moves', expr: 'lockedin', scale: 1.4, mirror: false,
    foldIdle: { L: flat(0), R: flat(1) },   // one ear that never folds
    marks: [
      { on: 'head', svg: '<path d="M-5 -60 H7 L9 -30 H-7 Z" fill="{blaze}"/><ellipse cx="1" cy="40" rx="27" ry="18" fill="{blaze}"/>' },
      { on: 'body', svg: g => `<ellipse cx="${g.bR - 84}" cy="-6" rx="16" ry="34" fill="{blaze}"/>` }
    ],
    pal: { coat: '#48455a', sh: '#3a3849', tan: '#ffffff', tanSh: '#e4e6ee', feature: '#26242f', ink: '#2b2433', nose: '#1d1b25',
      noseHi: '#4a4758', collar: '#1cb0f6', disc: '#ddf4ff', floor: '#bfe4f7', blaze: '#ffffff', bib: '#ffffff', bibSh: '#dfe2ea',
      brow: '#5f5b72', earIn: '#d8b8c2', foot: '#ffffff', footFar: '#e4e6ee', tail: '#3e3c4f' } },
  { id: 'fudge', name: 'Fudge', breed: 'lab', hint: 'Fetch first, questions later', expr: 'excited', scale: 1.42, mirror: true,
    pal: { coat: '#7b5039', sh: '#69432f', tan: '#8f644c', tanSh: '#7d5640', feature: '#3e2619', ink: '#22140d', nose: '#2a1a14',
      noseHi: '#5a4036', collar: '#ff9600', disc: '#fff0dc', floor: '#ffdcae', ear: '#62402f', brow: '#9a7059', tail: '#714a36',
      foot: '#87604b', footFar: '#76523f' } },
  { id: 'nimbus', name: 'Nimbus', breed: 'samoyed', hint: 'A cloud with a smile', expr: 'overjoyed', scale: 1.42, mirror: false,
    marks: [
      { on: 'snout', svg: '<path d="M-8.5 -7 Q-13 -6.5 -15.5 -10.5 M11.5 -7 Q16 -6.5 18.5 -10.5" fill="none" stroke="{lip}" stroke-width="2.4" stroke-linecap="round"/>' }
    ],
    pal: { coat: '#f6f8fb', sh: '#d5dbe6', tan: '#ffffff', tanSh: '#e7ebf2', feature: '#5d6577', ink: '#231f2a', nose: '#22212a',
      noseHi: '#4c4a58', collar: '#ce82ff', disc: '#f3e6ff', floor: '#e2c9fb', mane: '#ffffff', maneSh: '#d9dfe9', bib: '#ffffff',
      bibSh: '#e1e6ee', earIn: '#f6d3d8', brow: '#e3e7ef', tail: '#eef1f6', tailIn: '#ffffff', foot: '#ffffff', footFar: '#e9edf3', lip: '#3a3842' } },
  { id: 'churro', name: 'Churro', breed: 'chihuahua', hint: 'All ears, no fear', expr: 'hyped', scale: 1.16, mirror: true,
    pal: { coat: '#e3a868', sh: '#cd8f52', tan: '#fbe3c4', tanSh: '#f0cfa5', feature: '#8a5527', ink: '#24160c', nose: '#2b1a10',
      noseHi: '#5a4030', collar: '#ff7eb6', disc: '#ffeef3', floor: '#ffd6e4', earIn: '#ffb9b0', brow: '#f6c98f', tail: '#d9995a',
      foot: '#fbe3c4', footFar: '#f0cfa5' } },
  { id: 'lulu', name: 'Lulu', breed: 'poodle', hint: 'Prances, never walks', expr: 'proud', scale: 1.38, mirror: true,
    marks: [
      { on: 'body', svg: g => `<circle cx="${g.bL + 22}" cy="16" r="16" fill="{maneSh}"/><circle cx="${g.bL + 22}" cy="13" r="14" fill="{mane}"/>` }
    ],
    pal: { coat: '#eea77f', sh: '#e39a72', tan: '#f3b791', tanSh: '#e8a47c', feature: '#9a5532', ink: '#2a1810', nose: '#2b1a12',
      noseHi: '#5c3f30', collar: '#2ec4a6', disc: '#ddfaf3', floor: '#b8efe2', mane: '#f7c4a3', maneSh: '#e8956b', ear: '#f7c4a3',
      brow: '#f7c4a3', tail: '#e39a72', tailDots: '#f7c4a3', foot: '#f7c4a3', footFar: '#eeb38f' } },
  { id: 'heidi', name: 'Heidi', breed: 'bernese', hint: 'A gentle giant who leans in', expr: 'love', scale: 1.52, mirror: false,
    marks: [
      { on: 'head', svg: '<ellipse cx="-22" cy="12" rx="14" ry="12" fill="{rust}"/><ellipse cx="24" cy="12" rx="14" ry="12" fill="{rust}"/>' +
          '<path d="M-4 -60 H6 L8 -38 H-6 Z" fill="{blaze}"/><ellipse cx="1" cy="42" rx="24" ry="14" fill="{blaze}"/>' }
    ],
    pal: { coat: '#4a4248', sh: '#3d363c', tan: '#fbf8f4', tanSh: '#ebe5de', feature: '#2a2328', ink: '#2a1d18', nose: '#1e181b',
      noseHi: '#4d4448', collar: '#ff4b4b', disc: '#ffe3e4', floor: '#ffc4c8', brow: '#d27a3e', rust: '#c96a33', blaze: '#fbf8f4',
      bib: '#fbf8f4', bibSh: '#e6dfd6', tail: '#3f383e', tailIn: '#564d54', foot: '#fbf8f4', footFar: '#ebe5de' } }
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
