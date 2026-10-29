// gifts.mjs — special gifts: a word typed in a host's Settings that unlocks dogs no one sees until then (founder
// 2026-10-26: "Put in Evee from pokemon as one of the dogs, and all of the eeveelutions, and they only are unlocked when
// you type pokemon in the special gift section in settings").
//
// A dog in breeds.mjs with `gift: '<id>'` is listed by a host's dog pickers only once that gift is redeemed on the
// device (ROSTER carries the gift; shown() decides). Redeemed gifts are kept in localStorage under KEY, so every page of
// one site (Med-OS's Settings and its duel, say) sees the same. A look that already wears a gift dog keeps it: hiding
// is for the pickers, never for a dog someone chose.
// Part of the dog kit (public/doberman/); docs/doberman/README.md has the map.

export const KEY = 'pup.gifts';
export const GIFTS = {
  pokemon: { name: 'Eevee and its evolutions', note: 'Eevee, Vaporeon, Jolteon, Flareon, Espeon, Umbreon, Leafeon, Glaceon and Sylveon join the dogs.' },
  /* the pack stars (breeds.mjs): a host redeems one when its question pack is finished */
  mdpaedsacute: { name: 'Tailor', note: 'Tailor joins the dogs, sequin fringe and all.', star: true },
  mdpaedsfebrile: { name: 'Barkpenter', note: 'Barkpenter joins the dogs, curtain fringe and baby-blue bow.', star: true },
  mdogbp: { name: 'Charli', note: 'Charli joins the dogs, in the lime-green bp band.', star: true }
};

/* a typed code, as compared: letters and digits only, any case ("Pokémon!", " POKEMON " are pokemon) */
export const codeOf = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

const store = s => s || (typeof localStorage !== 'undefined' ? localStorage : null);
/* the gifts redeemed on this device */
export function unlocked(s) {
  try { const v = JSON.parse(store(s)?.getItem(KEY) || '[]'); return new Set(Array.isArray(v) ? v.filter(g => Object.hasOwn(GIFTS, g)) : []); } catch { return new Set(); }
}
/* redeem a code: { ok, gift, already, msg } (msg is what a host shows) */
export function redeem(code, s) {
  const c = codeOf(code);
  if (!c) return { ok: false, gift: '', already: false, msg: 'Type a gift code first.' };
  if (!Object.hasOwn(GIFTS, c)) return { ok: false, gift: '', already: false, msg: 'That code is not a gift. Check the spelling.' };
  const have = unlocked(s), already = have.has(c);
  if (!already) { have.add(c); try { store(s)?.setItem(KEY, JSON.stringify([...have])); } catch { return { ok: false, gift: c, already: false, msg: 'This browser could not save it.' }; } }
  return { ok: true, gift: c, already, msg: already ? `Already unlocked: ${GIFTS[c].name}.` : `Unlocked: ${GIFTS[c].name}. ${GIFTS[c].note}` };
}
/* may a picker list this dog (a ROSTER or DOGS entry)? */
export const shown = (d, have = unlocked()) => !d?.gift || have.has(d.gift);
