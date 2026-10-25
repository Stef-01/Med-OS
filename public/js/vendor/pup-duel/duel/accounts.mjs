/* accounts.mjs: a player is a name and a 4-digit PIN (founder 2026-10-24: "no complex security or auth or strong
   password system as it is just for mates"). The same rules run in Postgres (supabase/migrations/0001_pup_duel.sql,
   pinned by test/sql-parity.test.mjs) and in server-core.mjs. */

export const NAME_MIN = 2, NAME_MAX = 20;
export const NAME_RE = /^[A-Za-z0-9 ._-]{2,20}$/;
export const PIN_RE = /^[0-9]{4}$/;
/* the dogs come from the dog kit's registry (src/pup/rig/breeds.mjs, the same file as Optimus's): a new dog there is
   a new choice here */
import { ROSTER, DEFAULT_DOG } from '../pup/rig/breeds.mjs';
import { coatsFor, COLLARS } from '../pup/rig/coats.mjs';
export { DEFAULT_DOG };
export const DOGS = ROSTER;
export const SLOTS = ['head', 'face', 'neck', 'back'];

/* trimmed, single spaces: "  Sam   Lee " is "Sam Lee". ASCII whitespace only, as the migration's regex sees it (a
   non-breaking space is not a space here or there, so the name rule refuses it in both) */
export const normName = s => (typeof s === 'string' ? s.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, '').replace(/[ \t\n\r\f\v]+/g, ' ') : '');
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

/* a dog, its coat and collar (src/pup/rig/coats.mjs) and what it wears; anything unknown falls away, so a coat
   another breed has, or one this build has never heard of, leaves the dog in its own. `known(id)` says whether a
   wardrobe id exists. The server stores a look as sent (up to 2 KB), so every look read back goes through here */
export function normLook(l, known = () => true) {
  const o = l && typeof l === 'object' ? l : {}, wear = {};
  for (const s of SLOTS) { const v = o.wear?.[s]; if (typeof v === 'string' && v.length <= 40 && known(v)) wear[s] = v; }
  const dog = DOGS.some(d => d.id === o.dog) ? o.dog : DEFAULT_DOG, out = { dog };
  if (coatsFor(dog).some(k => k.id === o.coat && k.from !== dog)) out.coat = o.coat;
  if (COLLARS.some(k => k.id === o.collar)) out.collar = o.collar;
  out.wear = wear;
  return out;
}
export const dogName = id => (DOGS.find(d => d.id === id) || DOGS.find(d => d.id === DEFAULT_DOG)).name;
