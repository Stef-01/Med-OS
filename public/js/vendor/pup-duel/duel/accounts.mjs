/* accounts.mjs: a player is a name and a 4-digit PIN (founder 2026-10-24: "no complex security or auth or strong
   password system as it is just for mates"). The same rules run in Postgres (supabase/migrations/0001_pup_duel.sql,
   pinned by test/sql-parity.test.mjs) and in server-core.mjs. */

export const NAME_MIN = 2, NAME_MAX = 20;
export const NAME_RE = /^[A-Za-z0-9 ._-]{2,20}$/;
export const PIN_RE = /^[0-9]{4}$/;
export const DOGS = [
  { id: 'duke', name: 'Duke', hint: 'Steady and proud' },
  { id: 'rosie', name: 'Rosie', hint: 'Warm and bashful' },
  { id: 'pip', name: 'Pip', hint: 'Floppy-eared hype' },
  { id: 'mochi', name: 'Mochi', hint: 'Orange Pomeranian' },
  { id: 'biscuit', name: 'Biscuit', hint: 'Cream teddy Pomeranian' },
  { id: 'pepper', name: 'Pepper', hint: 'Black-and-tan Pomeranian' }
];
export const SLOTS = ['head', 'face', 'neck', 'back'];

/* trimmed, single spaces: "  Sam   Lee " is "Sam Lee" */
export const normName = s => (typeof s === 'string' ? s.trim().replace(/\s+/g, ' ') : '');
export const nameKey = s => normName(s).toLowerCase();

export function nameError(s) {
  const n = normName(s);
  if (n.length < NAME_MIN) return `A name needs at least ${NAME_MIN} characters`;
  if (n.length > NAME_MAX) return `A name is at most ${NAME_MAX} characters`;
  if (!NAME_RE.test(n)) return 'Letters, numbers, spaces, dots, dashes and underscores only';
  if (!/[A-Za-z0-9]/.test(n)) return 'A name needs a letter or a number';
  return '';
}
export const pinError = s => (PIN_RE.test(String(s ?? '')) ? '' : 'The PIN is 4 digits');

/* a dog and what it wears; anything unknown falls away. `known(id)` says whether a wardrobe id exists */
export function normLook(l, known = () => true) {
  const o = l && typeof l === 'object' ? l : {}, wear = {};
  for (const s of SLOTS) { const v = o.wear?.[s]; if (typeof v === 'string' && v.length <= 40 && known(v)) wear[s] = v; }
  return { dog: DOGS.some(d => d.id === o.dog) ? o.dog : 'pip', wear };
}
export const dogName = id => (DOGS.find(d => d.id === id) || DOGS[2]).name;
