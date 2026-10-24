/* rng.mjs: seeded randomness, so both phones and every test draw the same thing from the same seed */

/* FNV-1a over a string: a 32-bit seed from a duel id or a date */
export const hash32 = s => {
  let h = 2166136261;
  for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
};

/* mulberry32: small, fast, and good enough to deal questions */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Fisher-Yates on a copy */
export function shuffle(r, list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/* a fresh seed for a new duel (the only impure function here) */
export const freshSeed = () => (globalThis.crypto?.getRandomValues ? globalThis.crypto.getRandomValues(new Uint32Array(1))[0] : Math.floor(Math.random() * 2 ** 32));
