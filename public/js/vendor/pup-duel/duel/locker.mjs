/* locker.mjs: what a player may dress their dog in for duels, when the host has no shop of its own (Med-OS).
   Every common piece from the start, then two more for every win, cheapest first: winning duels dresses the dog.
   A host with a shop (Optimus) passes the pieces its player owns instead. Pure. */

export const START_RARITY = 'common', PER_WIN = 2;

/* the wardrobe's items in unlock order: commons, then by price, then by id */
export function unlockOrder(items) {
  return items.filter(i => !i.exclusive).slice().sort((a, b) => (a.rarity === START_RARITY ? 0 : 1) - (b.rarity === START_RARITY ? 0 : 1) || a.price - b.price || a.id.localeCompare(b.id));
}

/* { open: Set of ids, next: the next pieces to unlock, toNext: wins to the next one } for a player with `wins` */
export function lockerFor(items, wins = 0) {
  const order = unlockOrder(items), commons = order.filter(i => i.rarity === START_RARITY).length;
  const n = Math.min(order.length, commons + Math.max(0, Math.floor(wins)) * PER_WIN);
  return { open: new Set(order.slice(0, n).map(i => i.id)), next: order.slice(n, n + PER_WIN), toNext: n < order.length ? 1 : 0, total: order.length };
}

/* a look with only pieces in the locker */
export const fitLook = (look, open) => ({ dog: look.dog, wear: Object.fromEntries(Object.entries(look.wear || {}).filter(([, id]) => open.has(id))) });
