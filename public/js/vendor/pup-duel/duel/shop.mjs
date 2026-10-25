/* shop.mjs: the duel's bank. Bones are earned by playing (duels and practice) and spent in the shop on wardrobe pieces
   (founder 2026-10-25: "make the shop and customisation far richer"; docs/shop-research.md says what was borrowed).
   The prices, the daily rotation, the deal and the set bundles are the wardrobe's (wardrobe.mjs, shared with Optimus);
   this file is what a duel host adds: a wallet, what a duel or a practice run pays, what a purchase may cost, which
   pieces a look may wear, and saved outfits. Pure. The same rules run in Postgres (supabase/migrations/0002_pup_shop.sql)
   and in server-core.mjs, pinned by test/shop.test.mjs.

   wallet  { bones, owned: [id], outfits: [look], ledger: [{ d, why, at }], practice: { day, got } } */

import { lockerFor } from './locker.mjs';

export const WELCOME = 25;
/* a finished duel pays both players: the result, and one bone a right answer. A player who walks out (reason 'leave')
   gets nothing; a forfeit (three timeouts) pays the loser only their right answers */
export const PAY = { win: 12, draw: 8, loss: 5 };
export const PER_RIGHT = 1;
/* practice against Rex pays a bone a right answer, up to 15 a day: a bot is not a mate */
export const PRACTICE_CAP = 15;
export const OUTFITS = 3, LEDGER = 12;
/* the least a purchase may cost: half the full price of what it buys (the deal is 40 % off, a bundle 25 %, each
   rounded to 5); the server holds every purchase to it, whatever a phone says the price is */
export const FLOOR = 0.5;
export const WHY = { welcome: 'Welcome', legacy: 'Duels before the shop', win: 'Duel won', draw: 'Duel drawn', loss: 'Duel played', forfeit: 'Duel lost on time', practice: 'Practice', buy: 'Bought' };

/* the pieces a new player owns: every common (a dog is never undressed for want of bones) */
export const starterOwned = items => items.filter(i => i.rarity === 'common' && !i.exclusive).map(i => i.id);

/* a player from before the shop: their bones as if every duel had paid (no right answers: the log is not re-read), and
   every piece the old locker had opened for their wins, so nobody loses a piece they wore */
export function legacyWallet(items, rec = {}) {
  const w = rec.wins | 0, d = rec.draws | 0, l = rec.losses | 0;
  const bones = WELCOME + w * PAY.win + d * PAY.draw + l * PAY.loss;
  return { bones, owned: [...lockerFor(items, w).open], outfits: [], ledger: [{ d: bones, why: w + d + l ? 'legacy' : 'welcome' }], practice: { day: '', got: 0 } };
}

/* what a finished duel (its result: { winner, reason, right: { id: n } }) pays one of its players */
export function duelPay(result, pid) {
  if (!result || !pid) return { d: 0, why: 'loss' };
  const right = Math.max(0, (result.right?.[pid] | 0)) * PER_RIGHT, won = result.winner === pid;
  if (won) return { d: PAY.win + right, why: 'win' };
  if (result.winner == null) return { d: PAY.draw + right, why: 'draw' };
  if (result.reason === 'leave') return { d: 0, why: 'loss' };
  if (result.reason === 'forfeit') return { d: right, why: 'forfeit' };
  return { d: PAY.loss + right, why: 'loss' };
}

/* a practice run: a bone a right answer, up to the day's cap; `right` is clamped to 0..15 (a duel's most questions) */
export function practicePay(practice, right, day) {
  const got = practice?.day === day ? practice.got | 0 : 0, r = Math.max(0, Math.min(15, Math.floor(Number(right) || 0)));
  const d = Math.max(0, Math.min(r * PER_RIGHT, PRACTICE_CAP - got));
  return { d, practice: { day, got: got + d } };
}

export function normWallet(w, known = () => true) {
  const o = w && typeof w === 'object' ? w : {};
  return {
    bones: Math.max(0, Math.floor(Number(o.bones) || 0)),
    owned: [...new Set((Array.isArray(o.owned) ? o.owned : []).filter(id => typeof id === 'string' && known(id)))],
    outfits: (Array.isArray(o.outfits) ? o.outfits : []).slice(0, OUTFITS).map(x => (x && typeof x === 'object' ? x : null)),
    ledger: (Array.isArray(o.ledger) ? o.ledger : []).slice(0, LEDGER),
    practice: { day: String(o.practice?.day || ''), got: Math.max(0, o.practice?.got | 0) }
  };
}
/* a ledger with one more line on top (the newest first, twelve kept) */
export const logged = (ledger, d, why, at) => [{ d, why, at }, ...(ledger || [])].slice(0, LEDGER);

/* may this wallet buy `ids` for `total`? '' when it may, else the reason (the same words the server raises) */
export const BUY_ERR = { none: 'Pick something to buy', unknown: 'No such piece', exclusive: 'That piece cannot be bought', owned: 'You own that already', cheap: 'That price is wrong', short: 'Not enough bones' };
export function buyError(items, wallet, ids, total) {
  const list = Array.isArray(ids) ? [...new Set(ids)] : [];
  if (!list.length) return BUY_ERR.none;
  const byId = new Map(items.map(i => [i.id, i])), owned = new Set(wallet.owned);
  let full = 0;
  for (const id of list) {
    const it = byId.get(id);
    if (!it) return BUY_ERR.unknown;
    if (it.exclusive) return BUY_ERR.exclusive;
    if (owned.has(id)) return BUY_ERR.owned;
    full += it.price;
  }
  if (!Number.isInteger(total) || total < Math.floor(full * FLOOR)) return BUY_ERR.cheap;
  if (total > wallet.bones) return BUY_ERR.short;
  return '';
}
export function buy(items, wallet, ids, total, at) {
  const err = buyError(items, wallet, ids, total);
  if (err) return { ok: false, err, wallet };
  const list = [...new Set(ids)];
  return { ok: true, err: '', wallet: { ...wallet, bones: wallet.bones - total, owned: [...wallet.owned, ...list], ledger: logged(wallet.ledger, -total, 'buy', at) } };
}

/* a look may wear only what its player owns (the exclusive laurel is the host's to give, never the shop's) */
export const fitWear = (look, owned) => {
  const own = owned instanceof Set ? owned : new Set(owned || []);
  return { ...look, wear: Object.fromEntries(Object.entries(look?.wear || {}).filter(([, id]) => own.has(id))) };
};

/* the shop's view of one piece for one wallet: 'equipped' | 'owned' | 'exclusive' | 'buy' | 'short' */
export function stateOf(it, wallet, wear, price) {
  if (wallet.owned.includes(it.id)) return Object.values(wear || {}).includes(it.id) ? 'equipped' : 'owned';
  if (it.exclusive) return 'exclusive';
  return price > wallet.bones ? 'short' : 'buy';
}
/* how far a wallet is from a price, in duels won (the earning loop made concrete: "2 wins away") */
export const winsAway = (short) => Math.max(1, Math.ceil(short / (PAY.win + 3)));

/* how much of the catalogue a wallet has: { owned, total, byRarity: { r: [owned, total] } } */
export function collection(items, owned) {
  const own = new Set(owned), byRarity = {};
  for (const it of items) { const r = (byRarity[it.rarity] ||= [0, 0]); r[1]++; if (own.has(it.id)) r[0]++; }
  return { owned: items.filter(i => own.has(i.id)).length, total: items.length, byRarity };
}
