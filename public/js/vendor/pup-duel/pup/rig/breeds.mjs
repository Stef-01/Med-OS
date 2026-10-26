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
  },
  // ---- the second eighteen (founder 2026-10-25: "add double amount of dog varieties too"), picked for what each adds to
  // the line-up: a silhouette (the Dane's height, the whippet's legs, the basset's length, the bulldog's width), an ear
  // (the shepherd's tall pricks, the rottweiler's triangles, the spaniels' silk), a coat (merle, speckle, salt and pepper,
  // harlequin), a face (the schnauzer's beard, the chow's blue tongue, the weimaraner's amber eyes) ----
  // German Shepherd: tall prick ears, a black saddle and a dark bridge down to the nose on tan, a bushy tail carried low
  german: {
    name: 'German Shepherd', short: 'Shepherd',
    build: { head: { h: 102, r: 28 }, muzzle: { w: 50, h: 46 }, eye: 1.02, pupil: 0.95, brow: { w: 10, h: 5, y: -53 },
      ears: ['up', 'up'], earShape: 'prick', earScale: 1.28, earAt: { up: { L: { x: -30, y: -48 }, R: { x: 32, y: -48 } } },
      body: { w: 120, h: 80 }, leg: 14, floorY: 84, tail: { len: [17, 16, 15], w: 18, rest: -66, curl: 12, inner: 7 },
      wag: { slow: 14, fast: 28, amp: 30 }, hopH: 10, flopGain: 1.2, yaw0: 0.32, tongueSide: 0,
      marks: [
        { on: 'head', svg: '<path d="M-9 -64 H11 C11 -44 13 -30 16 -17 H-14 C-11 -30 -9 -44 -9 -64 Z" fill="{mask}"/>' },
        { on: 'muzzle', svg: '<ellipse cx="1" cy="-15" rx="23" ry="17" fill="{mask}"/>' },
        { on: 'body', svg: g => `<path d="M${g.bL - 4} -24 H${g.bR + 4} V14 C${g.bR - 40} 26 ${g.bL + 40} 26 ${g.bL + 14} 16 C${g.bL + 4} 10 ${g.bL - 4} 0 ${g.bL - 4} -24 Z" fill="{patch}"/>` }
      ] }
  },
  // Rottweiler: black and tan, broad, triangular drop ears, tan cheeks and brow spots, the natural tail (docking is
  // banned in Australia)
  rottweiler: {
    name: 'Rottweiler', short: 'Rottie',
    build: { head: { h: 100, r: 26 }, muzzle: { w: 58, h: 42 }, eye: 1.02, pupil: 1, brow: { w: 11, h: 6, y: -53 },
      ears: ['flop', 'flop'], flop: { w: 26, h: 30, shape: 'tri' }, earAt: { flop: { L: { x: -38, y: -49 }, R: { x: 40, y: -49 } } },
      body: { w: 116, h: 88 }, leg: 16, floorY: 82, tail: { len: [15, 14, 12], w: 13, rest: -18, curl: -4 },
      wag: { slow: 14, fast: 28, amp: 34 }, hopH: 9, flopGain: 1.8, yaw0: -0.3, tongueSide: 0 }
  },
  // Boxer: fawn with a black mask, a white blaze and chest, a short wide muzzle with jowls, high drop ears
  boxer: {
    name: 'Boxer',
    build: { head: { h: 98, r: 24 }, muzzle: { w: 62, h: 36, r: 14 }, eye: 1.08, pupil: 1, brow: { w: 9, h: 4.5, y: -52 },
      ears: ['flop', 'flop'], flop: { w: 24, h: 28, shape: 'tri' }, earAt: { flop: { L: { x: -38, y: -51 }, R: { x: 40, y: -51 } } },
      bib: 'chest', body: { w: 110, h: 80 }, leg: 15, floorY: 86, tail: { len: [14, 13, 11], w: 10, rest: -6, curl: 6 },
      wag: { slow: 22, fast: 40, amp: 48 }, hopH: 14, flopGain: 2, yaw0: 0.3, tongueSide: 1 }
  },
  // English Bulldog: low and wide, the widest muzzle in the kit with jowls hanging past it, small rose ears, a screw tail
  bulldog: {
    name: 'English Bulldog', short: 'Bulldog',
    build: { head: { h: 96, r: 30 }, muzzle: { w: 74, h: 34, r: 16 }, eye: 1.1, pupil: 1, brow: { w: 10, h: 4.5, y: -51.5 },
      ears: ['flop', 'flop'], flop: { w: 20, h: 18, shape: 'rose' }, earAt: { flop: { L: { x: -42, y: -48 }, R: { x: 44, y: -48 } } },
      body: { w: 116, h: 80 }, leg: 16, floorY: 66, tail: { len: [6, 5, 4], w: 11, rest: 40, curl: -40 },
      wag: { slow: 16, fast: 28, amp: 26 }, hopH: 7, flopGain: 1.6, yaw0: -0.3, tongueSide: 1 }
  },
  // Cavalier King Charles Spaniel: a domed head, big round eyes, long silky ears, Blenheim chestnut on white
  cavalier: {
    name: 'Cavalier King Charles', short: 'Cavalier',
    build: { head: { h: 96, r: 34 }, muzzle: { w: 46, h: 36 }, eye: 1.14, pupil: 1.06, brow: { w: 9, h: 4.5, y: -52 },
      ears: ['flop', 'flop'], flop: { w: 30, h: 58, shape: 'silk' }, earAt: { flop: { L: { x: -42, y: -46 }, R: { x: 44, y: -46 } } },
      body: { w: 104, h: 74 }, leg: 12, floorY: 70, tail: { len: [14, 13, 11], w: 14, rest: 10, curl: -6, inner: 6 },
      wag: { slow: 20, fast: 36, amp: 44 }, hopH: 12, flopGain: 2.6, yaw0: 0.3, tongueSide: 0 }
  },
  // Shih Tzu: a round face in long hair: a white blaze and moustache, gold silk ears to the chin, a plume over the back
  shihtzu: {
    name: 'Shih Tzu',
    build: { head: { h: 92, r: 42 }, muzzle: { w: 44, h: 32 }, eye: 1.1, pupil: 1.04, brow: { w: 9, h: 4.5, y: -52 },
      ears: ['flop', 'flop'], flop: { w: 32, h: 62, shape: 'silk' }, earAt: { flop: { L: { x: -42, y: -44 }, R: { x: 44, y: -44 } } },
      body: { w: 100, h: 72 }, leg: 11, floorY: 66, tail: { len: [12, 11, 10], w: 18, curl: 60, inner: 8, over: true },
      wag: { slow: 18, fast: 32, amp: 30 }, hopH: 12, flopGain: 2.4, yaw0: -0.3, tongueSide: 1 }
  },
  // Yorkshire Terrier: tiny, a tan head with small V prick ears, a steel-blue body, a tail carried high
  yorkie: {
    name: 'Yorkshire Terrier', short: 'Yorkie',
    build: { head: { h: 94, r: 34 }, muzzle: { w: 42, h: 34 }, eye: 1.1, pupil: 1, brow: { w: 8, h: 4, y: -52 },
      ears: ['up', 'up'], earShape: 'prick', earScale: 0.8, earAt: { up: { L: { x: -27, y: -50 }, R: { x: 29, y: -50 } } },
      body: { w: 98, h: 70 }, leg: 11, floorY: 70, tail: { len: [12, 11, 9], w: 9, rest: 24, curl: 10 },
      wag: { slow: 22, fast: 40, amp: 46 }, hopH: 15, flopGain: 1.5, yaw0: -0.3, tongueSide: 1 }
  },
  // Australian Shepherd: blue merle patches, copper brows and cheeks, a white blaze and chest, tipped ears, a bobtail
  aussie: {
    name: 'Australian Shepherd', short: 'Aussie',
    build: { head: { h: 100, r: 30 }, muzzle: { w: 50, h: 44 }, eye: 1.04, pupil: 0.95, brow: { w: 10, h: 5, y: -53 },
      ears: ['up', 'up'], earShape: 'prick', earScale: 0.94, foldable: true, foldIdle: { L: flat(1), R: flat(1) }, bib: 'chest',
      body: { w: 112, h: 78 }, leg: 14, floorY: 80, tail: { len: [5, 4, 3], w: 14, rest: 20 },
      wag: { slow: 22, fast: 40, amp: 50 }, hopH: 13, flopGain: 1.4, yaw0: 0.32, tongueSide: 1 }
  },
  // Whippet: all legs: a slim body high off the ground, a long narrow muzzle, rose ears folded back, a low tucked tail
  whippet: {
    name: 'Whippet',
    build: { head: { h: 100, r: 26 }, muzzle: { w: 44, h: 50 }, eye: 1, pupil: 1, brow: { w: 9, h: 4.5, y: -53 },
      ears: ['flop', 'flop'], flop: { w: 18, h: 22, shape: 'rose' }, earAt: { flop: { L: { x: -36, y: -52 }, R: { x: 38, y: -52 } } },
      body: { w: 118, h: 56 }, leg: 10, floorY: 96, tail: { len: [18, 17, 16], w: 6, rest: -84, curl: 22 },
      wag: { slow: 14, fast: 30, amp: 30 }, hopH: 14, flopGain: 2, yaw0: 0.3, tongueSide: 0 }
  },
  // Basset Hound: long and low on short legs, the longest ears in the kit, a long tail carried up (at full length it
  // widens the mascot's frame, parts.mjs reach(), so a cape trailing off the long back stays in it)
  basset: {
    name: 'Basset Hound', short: 'Basset',
    build: { head: { h: 104, r: 30 }, muzzle: { w: 54, h: 50 }, eye: 1, pupil: 1, brow: { w: 11, h: 5, y: -52 },
      ears: ['flop', 'flop'], flop: { w: 30, h: 74, shape: 'long' }, earAt: { flop: { L: { x: -40, y: -40 }, R: { x: 42, y: -40 } } },
      body: { w: 150, h: 66, legs: [22, 104, 132] }, leg: 15, floorY: 58,
      tail: { len: [16, 15, 14], w: 10, rest: 30, curl: -4 },
      wag: { slow: 14, fast: 26, amp: 30 }, hopH: 6, flopGain: 3, yaw0: -0.3, tongueSide: 0 }
  },
  // Great Dane: the tallest: a long square head, high-set drop ears, long legs, a long tail
  dane: {
    name: 'Great Dane', short: 'Dane',
    build: { head: { h: 108, r: 24 }, muzzle: { w: 58, h: 52 }, eye: 0.98, pupil: 1, brow: { w: 11, h: 5.5, y: -53 },
      ears: ['flop', 'flop'], flop: { w: 22, h: 34 }, earAt: { flop: { L: { x: -38, y: -50 }, R: { x: 40, y: -50 } } },
      body: { w: 124, h: 78 }, leg: 16, floorY: 104, tail: { len: [20, 18, 16], w: 10, rest: -40, curl: 6 },
      wag: { slow: 12, fast: 24, amp: 30 }, hopH: 8, flopGain: 2, yaw0: 0.3, tongueSide: 0 }
  },
  // Saint Bernard: huge, red and white, a dark mask round the eyes, a white blaze, muzzle and chest, a bushy low tail
  stbernard: {
    name: 'Saint Bernard', short: 'St Bernard',
    build: { head: { h: 106, r: 32 }, muzzle: { w: 60, h: 48 }, eye: 1, pupil: 1, brow: { w: 11, h: 5.5, y: -53 },
      ears: ['flop', 'flop'], flop: { w: 30, h: 38, shape: 'feather' }, earAt: { flop: { L: { x: -41, y: -46 }, R: { x: 43, y: -46 } } },
      bib: 'chest', body: { w: 126, h: 90 }, leg: 17, floorY: 88, tail: { len: [16, 15, 14], w: 18, rest: -66, curl: 14, inner: 7 },
      wag: { slow: 12, fast: 24, amp: 28 }, hopH: 8, flopGain: 2.2, yaw0: -0.3, tongueSide: 0 }
  },
  // The Eevee family (founder 2026-10-26: "Put in Evee from pokemon as one of the dogs, and all of the eeveelutions,
  // and they only are unlocked when you type pokemon in the special gift section"): a fox-like head with huge eyes and
  // a small muzzle, tall pointed ears, a fluffy ruff, a plume tail with a lighter core. Each one is a dog below (its
  // colours and marks), each carries `gift: 'pokemon'`: a host lists it only once that gift is redeemed (gifts.mjs)
  eevee: {
    name: 'Eevee family', short: 'Eevee',
    build: { head: { h: 92, r: 42 }, muzzle: { w: 38, h: 28 }, eye: 1.24, pupil: 1.08, brow: { w: 7, h: 3.6, y: -52 },
      ears: ['up', 'up'], earShape: 'chi', earScale: 1.4, earAt: { up: { L: { x: -34, y: -42 }, R: { x: 36, y: -42 } } },
      foldable: false, body: { w: 96, h: 70 }, leg: 12, floorY: 68, tail: { len: [16, 15, 14], w: 26, curl: 50, inner: 12, over: true },
      wag: { slow: 18, fast: 34, amp: 36 }, hopH: 13, flopGain: 1.2, yaw0: -0.3, tongueSide: 0 }
  },
  // Chow Chow: a lion's mane, small round ears half in it, a short flat muzzle, deep-set eyes, the blue-black tongue
  chow: {
    name: 'Chow Chow', short: 'Chow',
    build: { head: { h: 94, r: 40 }, muzzle: { w: 50, h: 34, r: 14 }, eye: 0.96, pupil: 0.9, brow: { w: 10, h: 5, y: -51 },
      ears: ['up', 'up'], earShape: 'round', earScale: 0.62, earAt: { up: { L: { x: -34, y: -48 }, R: { x: 36, y: -48 } } },
      mane: { rx: 62, ry: 52, n: 16, sc: 18 }, body: { w: 112, h: 86 }, leg: 16, floorY: 76,
      tail: { len: [14, 13, 11], w: 24, curl: 60, inner: 10, over: true },
      wag: { slow: 10, fast: 22, amp: 22 }, hopH: 8, flopGain: 1, yaw0: 0.3, tongueSide: 0 }
  },
  // Miniature Schnauzer: a boxy head, bushy brows and a beard, folded V ears, salt and pepper
  schnauzer: {
    name: 'Schnauzer',
    build: { head: { h: 100, r: 22 }, muzzle: { w: 50, h: 44, r: 8 }, eye: 1, pupil: 0.95, brow: { w: 17, h: 8, y: -55 },
      ears: ['up', 'up'], earShape: 'button', earScale: 0.84, foldable: true, foldIdle: { L: flat(1), R: flat(1) },
      body: { w: 108, h: 76 }, leg: 14, floorY: 80, tail: { len: [11, 10, 9], w: 10, rest: 24, curl: 6 },
      wag: { slow: 18, fast: 34, amp: 40 }, hopH: 12, flopGain: 1.6, yaw0: 0.3, tongueSide: 0 }
  },
  // Weimaraner: the grey ghost: one silver coat, amber eyes, a pink-grey nose, long drop ears
  weimaraner: {
    name: 'Weimaraner', short: 'Weim',
    build: { head: { h: 104, r: 26 }, muzzle: { w: 52, h: 48 }, eye: 1, pupil: 1, brow: { w: 10, h: 5, y: -53 },
      ears: ['flop', 'flop'], flop: { w: 28, h: 50, shape: 'long' }, earAt: { flop: { L: { x: -40, y: -46 }, R: { x: 42, y: -46 } } },
      body: { w: 118, h: 80 }, leg: 14, floorY: 88, tail: { len: [16, 15, 13], w: 10, rest: -10, curl: -4 },
      wag: { slow: 16, fast: 32, amp: 38 }, hopH: 11, flopGain: 2.2, yaw0: -0.3, tongueSide: 0 }
  },
  // Australian Cattle Dog (the blue heeler): speckled, a dark mask over one eye, a white star on the forehead, tan
  // brows and cheeks, broad prick ears, a low brush tail
  heeler: {
    name: 'Australian Cattle Dog', short: 'Heeler',
    build: { head: { h: 100, r: 30 }, muzzle: { w: 52, h: 42 }, eye: 1.04, pupil: 0.95, brow: { w: 10, h: 5, y: -53 },
      ears: ['up', 'up'], earShape: 'prick', earScale: 1.06, earAt: { up: { L: { x: -30, y: -49 }, R: { x: 32, y: -49 } } },
      body: { w: 110, h: 78 }, leg: 14, floorY: 80, tail: { len: [16, 15, 13], w: 13, rest: -58, curl: 10 },
      wag: { slow: 16, fast: 32, amp: 36 }, hopH: 13, flopGain: 1.2, yaw0: 0.32, tongueSide: 1,
      marks: [
        { on: 'head', svg: '<path d="M-56 -60 C-40 -64 -16 -58 -8 -40 C-2 -26 -10 -16 -24 -14 C-40 -12 -56 -24 -56 -36 Z" fill="{mask}"/>' +
            '<path d="M14 -64 C30 -68 52 -62 56 -52 L56 -40 C44 -40 28 -44 20 -50 Z" fill="{mask}"/><ellipse cx="1" cy="-50" rx="5" ry="7" fill="{blaze}"/>' +
            '<ellipse cx="-29" cy="-3" rx="10" ry="9" fill="{rust}"/><ellipse cx="31" cy="-3" rx="10" ry="9" fill="{rust}"/>' +
            '<circle cx="30" cy="-30" r="2.4" fill="{speck}"/><circle cx="40" cy="-14" r="2" fill="{speck}"/><circle cx="-40" cy="2" r="2.2" fill="{speck}"/><circle cx="22" cy="-40" r="1.8" fill="{speck}"/>' },
        { on: 'body', svg: g => [[14, -6, 3], [30, 4, 2.4], [46, -10, 2.8], [62, 6, 2.2], [24, 22, 2.6], [78, -4, 2.4], [52, 24, 2]].map(([x, y, r]) => `<circle cx="${g.bL + x}" cy="${y}" r="${r}" fill="{speck}"/>`).join('') }
      ] }
  },
  // Cavoodle (a cavalier and poodle cross, Australia's favourite): a teddy bear: a halo of small curls round the
  // head, ears of curls, a fluffy muzzle
  cavoodle: {
    name: 'Cavoodle',
    build: { head: { h: 94, r: 42 }, muzzle: { w: 46, h: 36 }, eye: 1.1, pupil: 1.04, brow: { w: 9, h: 4.5, y: -52 },
      ears: ['flop', 'flop'], flop: { w: 30, h: 48, shape: 'puff' }, earAt: { flop: { L: { x: -42, y: -44 }, R: { x: 44, y: -44 } } },
      mane: { rx: 52, ry: 50, n: 18, sc: 11 }, body: { w: 102, h: 76 }, leg: 13, floorY: 72,
      tail: { len: [12, 11, 10], w: 18, rest: 20, curl: 8 },
      wag: { slow: 22, fast: 38, amp: 46 }, hopH: 13, flopGain: 2.4, yaw0: 0.3, tongueSide: 1,
      marks: [
        { on: 'snout', svg: '<circle cx="-16" cy="10" r="10" fill="{fluff}"/><circle cx="1" cy="16" r="11" fill="{fluff}"/><circle cx="18" cy="10" r="10" fill="{fluff}"/>' }
      ] }
  },
  // Staffordshire Bull Terrier: a broad head and cheeks, the widest grin, small rose ears, a white chest, muscle
  staffy: {
    name: 'Staffordshire Bull Terrier', short: 'Staffy',
    build: { head: { h: 96, r: 26 }, muzzle: { w: 62, h: 40, r: 12 }, eye: 1.04, pupil: 1, brow: { w: 10, h: 5, y: -52.5 },
      ears: ['flop', 'flop'], flop: { w: 22, h: 20, shape: 'rose' }, earAt: { flop: { L: { x: -40, y: -50 }, R: { x: 42, y: -50 } } },
      body: { w: 108, h: 84 }, leg: 16, floorY: 76, tail: { len: [14, 12, 10], w: 10, rest: -20, curl: -6 },
      wag: { slow: 20, fast: 38, amp: 48 }, hopH: 12, flopGain: 1.6, yaw0: -0.3, tongueSide: 1 }
  }
};

/* the dogs, grouped by breed: the menus list them in this order. `hint`: a line of personality for a tooltip */
/* the Eevee family's own shapes, in head units (the head's top at y -55, its chin at 37 on this build; an ear's root at
   y 2, its tip at -34.5): what makes each one itself sits outside the head (marks 'behind' and 'crest', unclipped),
   or on an ear (clipped to it) */
const arcPts = (cx, cy, rx, ry, a0, a1, n, f) => Array.from({ length: n }, (_, i) => { const a = a0 + (a1 - a0) * i / (n - 1); return f(cx + rx * Math.cos(a), cy + ry * Math.sin(a), i); });
const R1 = v => Math.round(v * 10) / 10;
/* a fluffy ruff under the chin and down the chest (Eevee, Flareon): two tones of scallops */
const RUFF = (sh, c, k = 1) => arcPts(1, 30, 44 * k, 22 * k, -0.25, Math.PI + 0.25, 11, (x, y) => `<circle cx="${R1(x)}" cy="${R1(y + 3)}" r="${R1(13 * k)}" fill="${sh}"/>`).join('') +
  `<ellipse cx="1" cy="${R1(26 * k)}" rx="${R1(44 * k)}" ry="${R1(24 * k)}" fill="${sh}"/>` +
  arcPts(1, 27, 40 * k, 19 * k, -0.2, Math.PI + 0.2, 11, (x, y) => `<circle cx="${R1(x)}" cy="${R1(y)}" r="${R1(12 * k)}" fill="${c}"/>`).join('') +
  `<ellipse cx="1" cy="${R1(22 * k)}" rx="${R1(40 * k)}" ry="${R1(20 * k)}" fill="${c}"/>`;
/* a zigzag ring between two radii round a centre, from angle a0 to a1 */
const zig = (cx, cy, r0, r1, a0, a1, n) => 'M' + Array.from({ length: 2 * n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / (2 * n), r = i % 2 ? r1 : r0; return `${R1(cx + r * Math.cos(a))} ${R1(cy + r * Math.sin(a))}`; }).join(' L') + ' Z';
/* Vaporeon's frill: a cream fan round the back of the head, scalloped, over a shadow ring */
const FRILL = (sh, c) => `<path d="${zig(1, -6, 58, 70, Math.PI * 0.82, Math.PI * 2.18, 9)}" fill="${sh}"/><circle cx="1" cy="-6" r="58" fill="${sh}"/>` +
  arcPts(1, -6, 58, 56, Math.PI * 0.86, Math.PI * 2.14, 12, (x, y) => `<circle cx="${R1(x)}" cy="${R1(y)}" r="9" fill="${c}"/>`).join('') + `<circle cx="1" cy="-6" r="56" fill="${c}"/>`;
/* Jolteon's spikes: a yellow crown of points round the back of the head (k: their reach) */
const SPIKES = (sh, c, k = 1) => `<path d="${zig(1, -10, 52, 52 + 18 * k, Math.PI * 0.9, Math.PI * 2.1, 8)}" fill="${sh}"/><path d="${zig(1, -12, 48, 48 + 14 * k, Math.PI * 0.95, Math.PI * 2.05, 8)}" fill="${c}"/>`;
/* and its white spiked collar under the chin */
const COLLAR = (sh, c) => `<path d="${zig(1, 18, 30, 52, -0.15, Math.PI + 0.15, 9)}" fill="${sh}"/><ellipse cx="1" cy="18" rx="44" ry="30" fill="${sh}"/><path d="${zig(1, 15, 28, 46, -0.1, Math.PI + 0.1, 9)}" fill="${c}"/><ellipse cx="1" cy="15" rx="40" ry="27" fill="${c}"/>`;
/* on an ear: a darker tip, a ring band (Umbreon), a fin's edge (Vaporeon), a leaf's green half and vein (Leafeon) */
const EARTIP = c => `<path d="M-20 -26 Q0 -22 20 -26 V-40 H-20 Z" fill="${c}"/>`;
const BAND = c => `<rect x="-20" y="-16" width="40" height="7" fill="${c}"/>`;
const FINEAR = c => `<path d="M-20 4 L-12 4 Q-6 -16 0 -30 Q6 -16 12 4 L20 4 V-40 H-20 Z" fill="${c}"/>`;
const LEAFEAR = (c, v) => `<path d="M-20 -8 Q0 -14 20 -8 V-40 H-20 Z" fill="${c}"/><path d="M0 -10 V-32" stroke="${v}" stroke-width="2" stroke-linecap="round"/>`;

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
  { id: 'honey', name: 'Honey', breed: 'lab', hint: 'Will trade anything for a snack', expr: 'happy', scale: 1.4, mirror: false,
    pal: { coat: '#efc27c', sh: '#ddab62', tan: '#f6d498', tanSh: '#ebc283', feature: '#9a6a30', ink: '#2a1a0c', nose: '#3a2416',
      noseHi: '#6b4a33', collar: '#ff4b4b', disc: '#ffe3e4', floor: '#ffc4c8', ear: '#dba45c', brow: '#f8d9a6', tail: '#e5b56e',
      foot: '#f2c986', footFar: '#e2b673' } },
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
      bib: '#fbf8f4', bibSh: '#e6dfd6', tail: '#3f383e', tailIn: '#564d54', foot: '#fbf8f4', footFar: '#ebe5de' } },
  // ---- the second eighteen breeds ----
  { id: 'max', name: 'Max', breed: 'german', hint: 'On duty, every minute', expr: 'proud', scale: 1.46, mirror: false,
    pal: { coat: '#d6964f', sh: '#bd7d3c', tan: '#f0c48a', tanSh: '#dfad70', feature: '#5a3a1e', ink: '#2a1a10', nose: '#1e1816',
      noseHi: '#4a403d', collar: '#ff4b4b', disc: '#ffe3e4', floor: '#ffc4c8', mask: '#433a40', patch: '#433a40',
      ear: '#433a40', earIn: '#e6ad74', brow: '#f0c48a', tail: '#433a40', tailIn: '#5c5158', foot: '#f0c48a', footFar: '#dfad70' } },
  { id: 'nova', name: 'Nova', breed: 'german', hint: 'Night shift, soft heart', expr: 'curious', scale: 1.42, mirror: true,
    pal: { coat: '#4c4754', sh: '#3e3946', tan: '#5f5968', tanSh: '#534d5c', feature: '#9a92a5', ink: '#2a2230', nose: '#16131a',
      noseHi: '#47414e', collar: '#ff9600', disc: '#fff0dc', floor: '#ffdcae', mask: '#3a3540', patch: '#3e3946',
      ear: '#3e3946', earIn: '#6e6678', brow: '#5f5968', tail: '#3e3946', tailIn: '#524c5a', foot: '#5f5968', footFar: '#534d5c' } },
  { id: 'bruno', name: 'Bruno', breed: 'rottweiler', hint: 'A big softie in a tough coat', expr: 'bashful', scale: 1.48, mirror: false,
    marks: [
      { on: 'head', svg: '<ellipse cx="-29" cy="-3" rx="10" ry="9" fill="{tan}"/><ellipse cx="31" cy="-3" rx="10" ry="9" fill="{tan}"/>' }
    ],
    pal: { coat: '#4a4250', sh: '#3c3542', tan: '#c9773a', tanSh: '#b2652f', feature: '#e3a066', ink: '#24181a', nose: '#1a1517',
      noseHi: '#4a4248', collar: '#1cb0f6', disc: '#ddf4ff', floor: '#bfe4f7', ear: '#3c3542', brow: '#d2823f', tail: '#433b48',
      foot: '#c9773a', footFar: '#b2652f' } },
  { id: 'rocky', name: 'Rocky', breed: 'boxer', hint: 'Bounces off the walls', expr: 'hyped', scale: 1.42, mirror: true,
    marks: [
      { on: 'head', svg: '<path d="M-5 -60 H7 L10 -17 H-8 Z" fill="{blaze}"/>' },
      { on: 'snout', svg: '<circle cx="-15" cy="5" r="15" fill="{muzzle}"/><circle cx="17" cy="5" r="15" fill="{muzzle}"/>' }
    ],
    pal: { coat: '#d98c48', sh: '#c07638', tan: '#fbf4ea', tanSh: '#ebdfd0', feature: '#5a3418', ink: '#22140c', nose: '#1a1414',
      noseHi: '#4a3e3e', collar: '#58cc02', disc: '#eaffd6', floor: '#c9f0a8', muzzle: '#463a3b', blaze: '#fbf4ea', bib: '#fbf4ea',
      bibSh: '#e6d8c6', brow: '#eaa868', ear: '#b56a30', tail: '#c97e3c', foot: '#fbf4ea', footFar: '#ebdfd0' } },
  { id: 'winston', name: 'Winston', breed: 'bulldog', hint: 'Stubborn, sturdy, snores', expr: 'grumpy', scale: 1.36, mirror: false,
    marks: [
      { on: 'head', svg: '<path d="M-6 -62 H8 L13 -17 H-11 Z" fill="{blaze}"/>' },
      { on: 'snout', svg: '<circle cx="-20" cy="6" r="16" fill="{muzzle}"/><circle cx="22" cy="6" r="16" fill="{muzzle}"/>' +
          '<path d="M-16 -20.5 Q1 -26 18 -20.5" fill="none" stroke="{wrinkle}" stroke-width="2.6" stroke-linecap="round"/>' },
      { on: 'body', svg: g => `<ellipse cx="${g.bL + 22}" cy="0" rx="26" ry="22" fill="{coat}"/>` }
    ],
    pal: { coat: '#d99254', sh: '#c27c44', tan: '#fbf6ef', tanSh: '#ede3d6', feature: '#7a4a26', ink: '#22160e', nose: '#2a1c18',
      noseHi: '#5a4840', collar: '#ff4b4b', disc: '#ffe3e4', floor: '#ffc4c8', muzzle: '#fbf6ef', blaze: '#fbf6ef', wrinkle: '#b87a48',
      ear: '#a8693a', brow: '#eab47e', body: '#ebe1d2', tail: '#e8d9c6', foot: '#fbf6ef', footFar: '#ede3d6' } },
  { id: 'archie', name: 'Archie', breed: 'cavalier', hint: 'A lap is the best seat', expr: 'love', scale: 1.26, mirror: true,
    marks: [
      { on: 'head', svg: '<path d="M-56 -64 H-5 C-6 -50 -7 -38 -3 -22 C-14 -12 -40 -10 -56 -14 Z" fill="{patch}"/>' +
          '<path d="M58 -64 H7 C8 -50 9 -38 5 -22 C16 -12 42 -10 58 -14 Z" fill="{patch}"/><circle cx="1" cy="-47" r="4.5" fill="{patch}"/>' },
      { on: 'body', svg: g => `<ellipse cx="${g.bL + 20}" cy="-2" rx="24" ry="20" fill="{patch}"/>` }
    ],
    pal: { coat: '#fbf6ef', sh: '#ebe2d6', tan: '#ffffff', tanSh: '#efe8de', feature: '#6a3418', ink: '#2a1810', nose: '#2a1c18',
      noseHi: '#5a4840', collar: '#ce82ff', disc: '#f3e6ff', floor: '#e2c9fb', patch: '#bf6a33', lidL: '#bf6a33', lidR: '#bf6a33',
      ear: '#a95a28', brow: '#e3a06c', tail: '#bf6a33', tailIn: '#d98a52', foot: '#ffffff', footFar: '#efe8de' } },
  { id: 'mei', name: 'Mei', breed: 'shihtzu', hint: 'Tiny royalty, knows it', expr: 'mog', scale: 1.22, mirror: false,
    marks: [
      { on: 'head', svg: '<path d="M-10 -62 H12 C14 -40 26 -20 36 -2 C20 6 -18 6 -34 -2 C-24 -20 -12 -40 -10 -62 Z" fill="{blaze}"/>' },
      { on: 'snout', svg: '<path d="M-22 -10 C-30 10 -22 30 -8 34 L1 27 L10 34 C24 30 32 10 24 -10 Z" fill="{beard}"/>' }
    ],
    pal: { coat: '#dfa65c', sh: '#c98f47', tan: '#fdf8f0', tanSh: '#efe5d6', feature: '#7a4a1e', ink: '#24160c', nose: '#24180f',
      noseHi: '#56463a', collar: '#ff7eb6', disc: '#ffeef3', floor: '#ffd6e4', blaze: '#fdf8f0', beard: '#fdf8f0', ear: '#c98f47',
      brow: '#f2c78e', tail: '#e6b06a', tailIn: '#fdf8f0', foot: '#fdf8f0', footFar: '#efe5d6' } },
  { id: 'pixie', name: 'Pixie', breed: 'yorkie', hint: 'Pocket-sized boss', expr: 'excited', scale: 1.1, mirror: true,
    pal: { coat: '#d9a25c', sh: '#c38c48', tan: '#ecc48c', tanSh: '#dcae72', feature: '#7a4a1e', ink: '#22160c', nose: '#1d1714',
      noseHi: '#4a3f3a', collar: '#ff4b4b', disc: '#ffe3e4', floor: '#ffc4c8', body: '#5f6c86', tail: '#56627b', ear: '#cf964f',
      earIn: '#f1c9a0', brow: '#ecc48c', foot: '#d9a25c', footFar: '#c38c48' } },
  { id: 'ziggy', name: 'Ziggy', breed: 'aussie', hint: 'Can’t sit still, won’t', expr: 'dance', scale: 1.4, mirror: false,
    marks: [
      { on: 'head', svg: '<path d="M-56 -64 C-40 -66 -26 -58 -22 -46 C-18 -34 -30 -26 -44 -30 C-52 -32 -56 -40 -56 -46 Z" fill="{patch}"/>' +
          '<ellipse cx="34" cy="-52" rx="14" ry="9" fill="{patch}"/><circle cx="45" cy="-24" r="6" fill="{patch}"/><circle cx="-38" cy="-6" r="5" fill="{patch}"/>' +
          '<ellipse cx="-24" cy="12" rx="12" ry="10" fill="{rust}"/><ellipse cx="26" cy="12" rx="12" ry="10" fill="{rust}"/>' +
          '<path d="M-5 -60 H7 L9 -30 H-7 Z" fill="{blaze}"/><ellipse cx="1" cy="40" rx="27" ry="18" fill="{blaze}"/>' },
      { on: 'body', svg: g => [[16, -6, 12], [50, 8, 9], [78, -10, 10], [34, 30, 7]].map(([x, y, r]) => `<circle cx="${g.bL + x}" cy="${y}" r="${r}" fill="{patch}"/>`).join('') }
    ],
    pal: { coat: '#a3acbf', sh: '#8c96ab', tan: '#ffffff', tanSh: '#e6e9f0', feature: '#3c4252', ink: '#2c5fa8', nose: '#1d1f28',
      noseHi: '#4a4e5e', collar: '#ff9600', disc: '#fff0dc', floor: '#ffdcae', patch: '#4a4e60', rust: '#c47640', blaze: '#ffffff',
      bib: '#ffffff', bibSh: '#dfe3eb', lidL: '#4a4e60', earL: '#4a4e60', earR: '#a3acbf', earIn: '#e8c8cc', brow: '#c47640',
      tail: '#8c96ab', foot: '#ffffff', footFar: '#e6e9f0' } },
  { id: 'flash', name: 'Flash', breed: 'whippet', hint: 'Fast, then a long nap', expr: 'excited', scale: 1.38, mirror: true,
    marks: [
      { on: 'head', svg: '<path d="M-4 -60 H6 L8 -24 H-6 Z" fill="{blaze}"/>' },
      { on: 'body', svg: g => `<ellipse cx="${g.bR - 20}" cy="30" rx="22" ry="16" fill="{blaze}"/>` }
    ],
    pal: { coat: '#d6a26b', sh: '#c08b56', tan: '#e8bf8e', tanSh: '#d8ab78', feature: '#6a4020', ink: '#24160c', nose: '#2a1c18',
      noseHi: '#5a4840', collar: '#2ec4a6', disc: '#ddfaf3', floor: '#b8efe2', blaze: '#fbf5ec', ear: '#b07a46', brow: '#e8bf8e',
      tail: '#c69560', foot: '#fbf5ec', footFar: '#ebe0d0' } },
  { id: 'barney', name: 'Barney', breed: 'basset', hint: 'Slow, low and very sniffy', expr: 'sleepy', scale: 1.38, mirror: false,
    marks: [
      { on: 'head', svg: '<rect x="-5" y="-64" width="12" height="30" rx="6" fill="{blaze}"/><ellipse cx="1" cy="46" rx="26" ry="16" fill="{blaze}"/>' },
      { on: 'body', svg: g => `<ellipse cx="${g.bL + 18}" cy="22" rx="21" ry="20" fill="{coat}"/>` +
          `<path d="M${g.bL - 4} -24 H${g.bR + 4} V12 C${g.bR - 50} 22 ${g.bL + 50} 22 ${g.bL + 20} 10 C${g.bL + 8} 4 ${g.bL - 4} -4 ${g.bL - 4} -24 Z" fill="{patch}"/>` }
    ],
    pal: { coat: '#c2703a', sh: '#a95e2e', tan: '#fbf7f1', tanSh: '#ece4d8', feature: '#5e2a10', ink: '#2a1a10', nose: '#2a1d18',
      noseHi: '#5a463c', collar: '#1cb0f6', disc: '#ddf4ff', floor: '#bfe4f7', body: '#f6f1ea', blaze: '#fbf7f1', patch: '#b5652f',
      ear: '#9a4f24', brow: '#dc9058', tail: '#b5652f', foot: '#ffffff', footFar: '#ece6dc' } },
  /* a Dane's harlequin patches are drawn on every Dane in `harl` and `harlB` (coats.mjs): a fawn coat paints them in its
     own colours, so they show only in the harlequin coat */
  { id: 'moose', name: 'Moose', breed: 'dane', hint: 'Thinks he is a lapdog', expr: 'goofy', scale: 1.58, mirror: true,
    marks: [
      { on: 'head', svg: '<path d="M-56 -64 C-40 -66 -30 -54 -32 -42 C-34 -30 -48 -28 -56 -32 Z" fill="{harl}"/>' +
          '<ellipse cx="36" cy="-52" rx="12" ry="8" fill="{harl}"/><circle cx="43" cy="-18" r="6" fill="{harl}"/>' },
      { on: 'muzzle', svg: '<ellipse cx="1" cy="-13" rx="30" ry="22" fill="{mask}"/>' },
      { on: 'body', svg: g => [[18, -4, 13], [52, 10, 10], [80, -8, 11], [34, 32, 8], [96, 26, 7]].map(([x, y, r]) => `<circle cx="${g.bL + x}" cy="${y}" r="${r}" fill="{harlB}"/>`).join('') }
    ],
    pal: { coat: '#dcad6a', sh: '#c79855', tan: '#ecc995', tanSh: '#dcb57c', feature: '#5a3a1e', ink: '#24160c', nose: '#1c1616',
      noseHi: '#4a3f3f', collar: '#ff4b4b', disc: '#ffe3e4', floor: '#ffc4c8', mask: '#463b3d', harl: '#dcad6a',
      harlB: '#c79855', ear: '#5a4a42', brow: '#ecc995', tail: '#c79855', foot: '#ecc995', footFar: '#dcb57c' } },
  { id: 'barry', name: 'Barry', breed: 'stbernard', hint: 'Comes to the rescue', expr: 'happy', scale: 1.56, mirror: false,
    marks: [
      { on: 'head', svg: '<ellipse cx="-12" cy="-33" rx="19" ry="15" fill="{mask}"/><ellipse cx="14" cy="-33" rx="19" ry="15" fill="{mask}"/>' +
          '<path d="M-6 -64 H8 L12 -17 H-10 Z" fill="{blaze}"/>' },
      { on: 'body', svg: g => `<path d="M${g.bL - 4} -24 H${g.bR + 4} V10 C${g.bR - 44} 20 ${g.bL + 40} 22 ${g.bL + 16} 10 C${g.bL + 6} 4 ${g.bL - 4} -4 ${g.bL - 4} -24 Z" fill="{patch}"/>` }
    ],
    pal: { coat: '#b9622f', sh: '#a05328', tan: '#fbf6ef', tanSh: '#ece2d4', feature: '#2e1610', ink: '#2a1a10', nose: '#1e1616',
      noseHi: '#4a3e3c', collar: '#ff9600', disc: '#fff0dc', floor: '#ffdcae', mask: '#5a2e1c', lidL: '#5a2e1c', lidR: '#5a2e1c',
      blaze: '#fbf6ef', bib: '#fbf6ef', bibSh: '#e8ddcc', patch: '#b9622f', body: '#ece3d6', ear: '#8e4622', brow: '#d88a52',
      tail: '#b9622f', tailIn: '#d98a52', foot: '#fbf6ef', footFar: '#ece2d4' } },
  /* the chow's tongue and lips are blue-black: they are the dog's own (coats.mjs leaves them under every coat) */
  { id: 'leo', name: 'Leo', breed: 'chow', hint: 'A lion with a blue tongue', expr: 'mog', scale: 1.42, mirror: true,
    pal: { coat: '#c8763a', sh: '#ad6230', tan: '#d98d4e', tanSh: '#c27a40', feature: '#5a2c10', ink: '#1e120a', nose: '#1e1614',
      noseHi: '#4a3e3a', mouth: '#3a3150', tongue: '#5d5aa0', tongueSh: '#46448a', collar: '#2ec4a6', disc: '#ddfaf3', floor: '#b8efe2',
      mane: '#cf7f40', maneSh: '#a85c28', ear: '#b8682f', earIn: '#d98d4e', brow: '#d98d4e', tail: '#cf7f40', tailIn: '#e09a5c',
      foot: '#c8763a', footFar: '#b46a34' } },
  { id: 'otto', name: 'Otto', breed: 'schnauzer', hint: 'Has opinions, and a beard', expr: 'curious', scale: 1.3, mirror: false,
    marks: [
      { on: 'snout', svg: '<path d="M-24 -12 C-27 12 -16 32 1 36 C18 32 29 12 26 -12 Z" fill="{beard}"/>' }
    ],
    pal: { coat: '#8e919c', sh: '#787b87', tan: '#d6d8de', tanSh: '#c2c5cd', feature: '#3a3c46', ink: '#1e1e26', nose: '#1a1a20',
      noseHi: '#46464f', collar: '#ff4b4b', disc: '#ffe3e4', floor: '#ffc4c8', beard: '#eceef2', brow: '#eceef2', ear: '#787b87',
      earBack: '#62656f', earIn: '#b8bac3', tail: '#7f828d', foot: '#d6d8de', footFar: '#c2c5cd' } },
  { id: 'ghost', name: 'Ghost', breed: 'weimaraner', hint: 'Silver, sleek, always hungry', expr: 'puppy', scale: 1.44, mirror: true,
    pal: { coat: '#aaa6ae', sh: '#95919a', tan: '#c4c0c8', tanSh: '#b2aeb7', feature: '#5a5660', ink: '#b07e2a', nose: '#8a7275',
      noseHi: '#a8949a', collar: '#1cb0f6', disc: '#ddf4ff', floor: '#bfe4f7', ear: '#928e98', brow: '#c4c0c8', tail: '#9a96a0',
      foot: '#bcb8c0', footFar: '#aaa6ae' } },
  { id: 'digger', name: 'Digger', breed: 'heeler', hint: 'Works hard, herds harder', expr: 'lockedin', scale: 1.38, mirror: false,
    pal: { coat: '#7d8ca8', sh: '#687793', tan: '#cf8a4f', tanSh: '#b8763f', feature: '#2a3040', ink: '#1e2230', nose: '#16181f',
      noseHi: '#42464f', collar: '#ff4b4b', disc: '#ffe3e4', floor: '#ffc4c8', mask: '#3c4256', lidL: '#3c4256', blaze: '#ffffff',
      rust: '#cf8a4f', speck: '#b8c3d6', ear: '#6f7e9b', earIn: '#d8b8b8', brow: '#cf8a4f', tail: '#687793', foot: '#cf8a4f', footFar: '#b8763f' } },
  { id: 'rusty', name: 'Rusty', breed: 'heeler', hint: 'Red dust and a big grin', expr: 'goofy', scale: 1.36, mirror: true,
    pal: { coat: '#b86e4a', sh: '#9e5b3a', tan: '#e0a06a', tanSh: '#c98a56', feature: '#4a2010', ink: '#2a1810', nose: '#3a2018',
      noseHi: '#6a4a3e', collar: '#1cb0f6', disc: '#ddf4ff', floor: '#bfe4f7', mask: '#7a3a22', lidL: '#7a3a22', blaze: '#ffffff',
      rust: '#e0a06a', speck: '#e2b49c', ear: '#a8603e', earIn: '#f0c4b8', brow: '#e0a06a', tail: '#9e5b3a', foot: '#e0a06a', footFar: '#c98a56' } },
  { id: 'coco', name: 'Coco', breed: 'cavoodle', hint: 'A teddy bear that wags', expr: 'overjoyed', scale: 1.28, mirror: false,
    pal: { coat: '#e9a66c', sh: '#d6915a', tan: '#f2bc88', tanSh: '#e3a874', feature: '#8a4a22', ink: '#2a1810', nose: '#2b1a12',
      noseHi: '#5c3f30', collar: '#ce82ff', disc: '#f3e6ff', floor: '#e2c9fb', mane: '#eeb07a', maneSh: '#d38c56', fluff: '#f5c595',
      ear: '#e09a60', brow: '#f5c595', tail: '#e09a60', foot: '#eeb07a', footFar: '#dc9c66' } },
  { id: 'milo', name: 'Milo', breed: 'cavoodle', hint: 'Puppy energy, teddy looks', expr: 'excited', scale: 1.18, mirror: true,
    head: { h: 92, r: 44 }, eye: 1.14, pupil: 1.06, body: { w: 96, h: 72 }, floorY: 68, wag: { slow: 24, fast: 42, amp: 50 }, hopH: 15,
    pal: { coat: '#7d5040', sh: '#6a4334', tan: '#9a6a55', tanSh: '#875a47', feature: '#2e1810', ink: '#22140c', nose: '#2a1812',
      noseHi: '#5a4036', collar: '#2ec4a6', disc: '#ddfaf3', floor: '#b8efe2', mane: '#86584a', maneSh: '#5e3a2e', fluff: '#a47562',
      ear: '#6e4436', brow: '#a47562', tail: '#6e4436', foot: '#86584a', footFar: '#74493c' } },
  { id: 'ruby', name: 'Ruby', breed: 'staffy', hint: 'Smiles at everyone', expr: 'overjoyed', scale: 1.36, mirror: false,
    marks: [
      { on: 'head', svg: '<path d="M-5 -58 H7 L9 -36 H-7 Z" fill="{blaze}"/><ellipse cx="1" cy="44" rx="22" ry="12" fill="{blaze}"/>' },
      { on: 'body', svg: g => `<ellipse cx="${g.bR - 18}" cy="40" rx="20" ry="18" fill="{blaze}"/>` }
    ],
    pal: { coat: '#b9693d', sh: '#a05832', tan: '#d8925e', tanSh: '#c27e4e', feature: '#4e2410', ink: '#22140c', nose: '#2a1a16',
      noseHi: '#5a463e', collar: '#58cc02', disc: '#eaffd6', floor: '#c9f0a8', blaze: '#fbf6ef', ear: '#9a5230', brow: '#d8925e',
      tail: '#a85c34', foot: '#fbf6ef', footFar: '#ebe0d2' } },
  { id: 'doge', name: 'Doge', breed: 'shiba', hint: 'Such study. Very wow', expr: 'mog', scale: 1.38, mirror: false,
    marks: [
      { on: 'head', svg: '<ellipse cx="-30" cy="0" rx="19" ry="15" fill="{urajiro}"/><ellipse cx="32" cy="0" rx="19" ry="15" fill="{urajiro}"/>' }
    ],
    pal: { coat: '#e7b268', sh: '#cf9a50', tan: '#fbf0d8', tanSh: '#f0dfbc', feature: '#8a5a1e', ink: '#2b1a0a', nose: '#2b1a0a',
      noseHi: '#5e4228', collar: '#ff4b4b', disc: '#fff6e0', floor: '#ffe3b0', urajiro: '#fbf0d8', brow: '#fbf0d8', earIn: '#fbf0d8',
      tail: '#dba25a', tailIn: '#fbf0d8', bib: '#fbf0d8', bibSh: '#efdcb8', foot: '#fbf0d8', footFar: '#f0dfbc' } },
  { id: 'eevee', name: 'Eevee', breed: 'eevee', gift: 'pokemon', hint: 'Could become anything', expr: 'excited', scale: 1.34, mirror: false,
    marks: [
      { on: 'behind', svg: RUFF('{ruffSh}', '{ruff}') },
      { on: 'earL', svg: EARTIP('{earTip}') }, { on: 'earR', svg: EARTIP('{earTip}') }
    ],
    pal: { tag: '#dd9550', tagSh: '#c47d3c', coat: '#dd9550', sh: '#c47d3c', tan: '#e6a463', tanSh: '#d38f50', muzzle: '#e6a463', brow: '#e6a463', ink: '#2a1608', nose: '#3a2010', noseHi: '#6a4630', feature: '#5a3418',
      collar: '#dd9550', disc: '#fff0dc', floor: '#ffdcae', ruff: '#fbe7c0', ruffSh: '#ecd09c', earIn: '#7a4320', earTip: '#a8642c', tail: '#dd9550', tailIn: '#fbe7c0', foot: '#e6a463', footFar: '#d38f50' } },
  { id: 'vaporeon', name: 'Vaporeon', breed: 'eevee', gift: 'pokemon', hint: 'Melts into the water', expr: 'overjoyed', scale: 1.34, mirror: true,
    marks: [
      { on: 'behind', svg: FRILL('{frillSh}', '{frill}') },
      { on: 'crest', svg: '<path d="M-7 -53 C-6 -66 -2 -78 4 -86 C8 -76 11 -64 10 -53 Z" fill="{fin}"/><path d="M4 -86 C8 -76 11 -64 10 -53 L5 -53 C6 -64 6 -76 4 -86 Z" fill="{finSh}"/>' },
      { on: 'earL', svg: FINEAR('{finEdge}') }, { on: 'earR', svg: FINEAR('{finEdge}') }
    ],
    pal: { tag: '#62b8e8', tagSh: '#4a9ccc', coat: '#62b8e8', sh: '#4a9ccc', tan: '#78c4ee', tanSh: '#66b4e0', muzzle: '#78c4ee', brow: '#78c4ee', ink: '#14324a', nose: '#1e3e5a', noseHi: '#4a6e8c', feature: '#1f4e70',
      collar: '#62b8e8', disc: '#e3f5ff', floor: '#bfe6fb', frill: '#fbf6e6', frillSh: '#d9d2bc', fin: '#2f6f9a', finSh: '#245a80', ear: '#f6d46a', earIn: '#e5b94a', finEdge: '#2f6f9a', tail: '#3f8cc0', tailIn: '#62b8e8', foot: '#78c4ee', footFar: '#66b4e0' } },
  { id: 'jolteon', name: 'Jolteon', breed: 'eevee', gift: 'pokemon', hint: 'Static in every hair', expr: 'surprised', scale: 1.32, mirror: false,
    marks: [
      { on: 'behind', svg: SPIKES('{spikeSh}', '{spike}', 1) + COLLAR('{collarSh}', '{collarW}') }
    ],
    pal: { tag: '#f6cf3e', tagSh: '#dcb32a', coat: '#f6cf3e', sh: '#dcb32a', tan: '#f8da62', tanSh: '#eac74a', muzzle: '#f8da62', brow: '#f8da62', ink: '#2b2410', nose: '#3a3018', noseHi: '#6a5a38', feature: '#6a5410',
      collar: '#f6cf3e', disc: '#fffbe0', floor: '#fbeba6', spike: '#f6cf3e', spikeSh: '#d4ac22', collarW: '#ffffff', collarSh: '#dfe3ea', earIn: '#4a3a20', tail: '#ffffff', tailIn: '#f6cf3e', foot: '#f8da62', footFar: '#eac74a' } },
  { id: 'flareon', name: 'Flareon', breed: 'eevee', gift: 'pokemon', hint: 'Always running warm', expr: 'happy', scale: 1.36, mirror: true,
    marks: [
      { on: 'behind', svg: RUFF('{ruffSh}', '{ruff}', 1.15) },
      { on: 'crest', svg: '<path d="M-20 -50 C-26 -74 -6 -94 16 -88 C30 -84 34 -70 26 -60 C24 -72 14 -78 4 -74 C12 -68 12 -58 4 -50 C0 -60 -8 -62 -12 -50 Z" fill="{ruffSh}"/><path d="M-16 -52 C-22 -72 -4 -90 15 -85 C27 -82 30 -72 25 -64 C21 -73 12 -77 2 -72 C9 -66 9 -58 3 -52 C-1 -59 -8 -60 -10 -52 Z" fill="{ruff}"/>' },
      { on: 'earL', svg: EARTIP('{earTip}') }, { on: 'earR', svg: EARTIP('{earTip}') }
    ],
    pal: { tag: '#ee7a3a', tagSh: '#d4642c', coat: '#ee7a3a', sh: '#d4642c', tan: '#f28f52', tanSh: '#e47c3e', muzzle: '#f28f52', brow: '#f28f52', ink: '#2a1608', nose: '#3a1e10', noseHi: '#6a4430', feature: '#7a3412',
      collar: '#ee7a3a', disc: '#fff0dc', floor: '#ffd2ae', ruff: '#fde39c', ruffSh: '#f2c866', earIn: '#c9541c', earTip: '#d4642c', tail: '#fde39c', tailIn: '#fff1c6', foot: '#f28f52', footFar: '#e47c3e' } },
  { id: 'espeon', name: 'Espeon', breed: 'eevee', gift: 'pokemon', hint: 'Knows what you will answer', expr: 'proud', scale: 1.32, mirror: false, iris: 'violet',
    marks: [
      { on: 'behind', svg: '<path d="M-48 2 C-62 0 -68 10 -66 18 C-60 14 -54 14 -48 16 Z M50 2 C64 0 70 10 68 18 C62 14 56 14 50 16 Z" fill="{coat}"/>' },
      { on: 'head', svg: '<circle cx="1" cy="-50" r="4.6" fill="{gem}"/><circle cx="-0.4" cy="-51.4" r="1.5" fill="#ffd1da"/>' }
    ],
    pal: { tag: '#eaa9d8', tagSh: '#d48fc2', coat: '#eaa9d8', sh: '#d48fc2', tan: '#f0bce2', tanSh: '#e2a6d2', muzzle: '#f0bce2', brow: '#f0bce2', ink: '#3a1e44', nose: '#5a2a4a', noseHi: '#8a5a7a', feature: '#8a4a7a',
      collar: '#eaa9d8', disc: '#fbeaf6', floor: '#f4d0ea', gem: '#d8203a', earIn: '#9a5ec4', tail: '#d48fc2', tailIn: '#eaa9d8', foot: '#f0bce2', footFar: '#e2a6d2' } },
  { id: 'umbreon', name: 'Umbreon', breed: 'eevee', gift: 'pokemon', hint: 'Glows after dark', expr: 'mog', scale: 1.34, mirror: true, iris: 'red',
    tail: { len: [15, 14, 13], w: 22, curl: 50, inner: 0, over: true, dots: 13, at: [20, -6] },
    marks: [
      { on: 'head', svg: '<circle cx="1" cy="-51" r="5" fill="none" stroke="{ring}" stroke-width="3"/>' },
      { on: 'earL', svg: BAND('{ring}') }, { on: 'earR', svg: BAND('{ring}') },
      { on: 'body', svg: g => `<circle cx="${g.bL + 26}" cy="8" r="11" fill="none" stroke="{ring}" stroke-width="4.4"/><path d="M${g.bR - 30} 46 h18" stroke="{ring}" stroke-width="5" stroke-linecap="round"/>` }
    ],
    pal: { tag: '#424559', tagSh: '#373a4c', coat: '#424559', sh: '#373a4c', tan: '#4a4d62', tanSh: '#424559', muzzle: '#4a4d62', brow: '#4a4d62', ink: '#120f16', nose: '#100d14', noseHi: '#4a4658', feature: '#8c8aa0',
      collar: '#424559', disc: '#eceaf6', floor: '#cfcde0', ring: '#f5c93a', earIn: '#373a4c', tail: '#424559', tailDots: '#f5c93a', foot: '#4a4d62', footFar: '#424559' } },
  { id: 'leafeon', name: 'Leafeon', breed: 'eevee', gift: 'pokemon', hint: 'Photosynthesises during lectures', expr: 'happy', scale: 1.32, mirror: false,
    marks: [
      { on: 'crest', svg: '<path d="M-2 -50 C-16 -60 -14 -80 2 -92 C14 -80 14 -62 4 -50 Z" fill="{leaf}"/><path d="M1 -52 C0 -64 1 -76 2 -88" fill="none" stroke="{vein}" stroke-width="2" stroke-linecap="round"/>' },
      { on: 'earL', svg: LEAFEAR('{leaf}', '{vein}') }, { on: 'earR', svg: LEAFEAR('{leaf}', '{vein}') }
    ],
    pal: { tag: '#f4e4b4', tagSh: '#dccb92', coat: '#f4e4b4', sh: '#dccb92', tan: '#f8ecc8', tanSh: '#ecdcac', muzzle: '#f8ecc8', brow: '#f8ecc8', ink: '#3a2a12', nose: '#5a3a1c', noseHi: '#8a6a4a', feature: '#8a6a3a',
      collar: '#f4e4b4', disc: '#f0fbe0', floor: '#d6efb4', ear: '#f4e4b4', earIn: '#e8d49a', leaf: '#8cc63e', vein: '#5f9a24', tail: '#8cc63e', tailIn: '#b0dc6a', foot: '#a07a4a', footFar: '#8c6a3e' } },
  { id: 'glaceon', name: 'Glaceon', breed: 'eevee', gift: 'pokemon', hint: 'Cool under exam pressure', expr: 'curious', scale: 1.32, mirror: true, iris: 'ice',
    marks: [
      { on: 'behind', svg: '<path d="M-44 -30 L-56 -8 L-50 26 L-40 4 Z M46 -30 L58 -8 L52 26 L42 4 Z" fill="{deep}"/><path d="M-50 26 L-44 -2 L-40 4 Z M52 26 L46 -2 L42 4 Z" fill="{deepSh}"/>' },
      { on: 'crest', svg: '<path d="M-30 -52 L-18 -70 L1 -76 L20 -70 L32 -52 L18 -56 L1 -50 L-16 -56 Z" fill="{deep}"/><path d="M1 -76 L20 -70 L32 -52 L18 -56 L1 -50 Z" fill="{deepSh}"/><path d="M-6 -66 L1 -72 L8 -66 L1 -58 Z" fill="{light}"/>' },
      { on: 'earL', svg: '<path d="M-20 -14 L0 -40 L20 -14 L0 -2 Z" fill="{deep}"/>' }, { on: 'earR', svg: '<path d="M-20 -14 L0 -40 L20 -14 L0 -2 Z" fill="{deep}"/>' },
      { on: 'body', svg: g => `<path d="M${g.bL + 26} -4 L${g.bL + 34} 6 L${g.bL + 26} 16 L${g.bL + 18} 6 Z" fill="{deep}"/>` }
    ],
    pal: { tag: '#8ed2f0', tagSh: '#6fbadc', coat: '#8ed2f0', sh: '#6fbadc', tan: '#a4dcf4', tanSh: '#8ecbe8', muzzle: '#a4dcf4', brow: '#a4dcf4', ink: '#123048', nose: '#1a3a58', noseHi: '#3c5c78', feature: '#2a5a7a',
      collar: '#8ed2f0', disc: '#e8f8ff', floor: '#c4e9f8', deep: '#3a7cba', deepSh: '#2c6498', light: '#bfe8fb', ear: '#8ed2f0', earIn: '#3a7cba', tail: '#3a7cba', tailIn: '#5a9ad0', foot: '#3a7cba', footFar: '#2c6498' } },
  { id: 'sylveon', name: 'Sylveon', breed: 'eevee', gift: 'pokemon', hint: 'Wins every room with ribbons', expr: 'love', scale: 1.32, mirror: false, iris: 'blue',
    marks: [
      { on: 'crest', svg: '<path d="M30 -48 C26 -20 34 6 44 28" fill="none" stroke="{ribbon}" stroke-width="5" stroke-linecap="round"/><path d="M36 -46 C40 -18 50 2 58 18" fill="none" stroke="{bead}" stroke-width="5" stroke-linecap="round"/>' +
        '<path d="M34 -50 L18 -62 L20 -44 Z M34 -50 L50 -62 L48 -44 Z" fill="{ribbon}"/><circle cx="34" cy="-50" r="5.4" fill="{bead}"/><circle cx="1" cy="34" r="0" fill="{ribbon}"/>' },
      { on: 'behind', svg: '<path d="M-14 38 L-4 44 L-14 50 Z M16 38 L6 44 L16 50 Z" fill="{ribbon}"/><circle cx="1" cy="44" r="4" fill="{bead}"/>' }
    ],
    pal: { tag: '#fbf5f7', tagSh: '#ecdde4', coat: '#fbf5f7', sh: '#ecdde4', tan: '#fef9fb', tanSh: '#f2e6ec', muzzle: '#fef9fb', brow: '#fef9fb', ink: '#2a1a30', nose: '#4a2a3a', noseHi: '#7a5a6a', feature: '#a07090',
      collar: '#fbf5f7', disc: '#fff0f7', floor: '#fbd3e6', ear: '#f59ac0', earIn: '#5aa6e0', ribbon: '#f47ab0', bead: '#5ab8ec', tail: '#f59ac0', tailIn: '#fbd0e2', foot: '#f59ac0', footFar: '#e286ae' } }
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
export const ROSTER = DOGS.map(d => ({ id: d.id, name: d.name, breed: d.breed, breedName: BREEDS[d.breed].name, breedShort: BREEDS[d.breed].short || BREEDS[d.breed].name, hint: d.hint, ...(d.gift ? { gift: d.gift } : {}) }));
export const DEFAULT_DOG = 'pip';
export const dogById = id => ROSTER.find(d => d.id === id) || ROSTER.find(d => d.id === DEFAULT_DOG);
