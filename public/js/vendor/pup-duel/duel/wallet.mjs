/* wallet.mjs: bones, the store and the locker's loadouts, as laws (founder 2026-10-25: "have no health system ...
   enhance with full store and loadout system that optimus has live rn"). Pure: the server keeps the wallet
   (supabase/migrations/0002_pup_store.sql, and store-core.mjs, the same rules in JavaScript); the screens ask these
   what a piece costs and whether it can be bought, and the server answers for real.

   Bones are earned by duels with a mate, from the record the server keeps of each finished duel (pup_duels.result,
   folded from the log, never a phone's claim), once per duel and player:
     RIGHT   1 bone a right answer
     FINISH  2 for playing to the last question (a duel that ends on a leave or a forfeit pays no one this)
     WIN     5 for the win, when the winner got at least one right (a mate who leaves at once gives nothing away)
   so a duel pays 0 to 22. A new player starts with WELCOME bones (Optimus's mascot starts with 20 too), enough for
   one common piece. Practice against Rex earns nothing: it is played on the phone, where nothing can be checked.
   There is no health, no hunger, no treats and nothing that drains: bones only go up by duels and down by buying,
   and never below zero.

   The store is Optimus's (src/pup/wardrobe.mjs, the one catalogue): today's shop is shopFor(day), a piece costs
   priceToday(id, day) (the daily deal DEAL_OFF less), a bundle setPrice(set, owned) (SET_OFF less, for the parts you
   lack). The exclusive piece (Optimus's monthly challenge) is not sold here: the duel has no such challenge, and it
   never had a way to win one. */

import { ITEMS, SETS, SLOTS, DEAL_OFF, SET_OFF, itemOf, shopFor, priceToday, setPrice } from '../pup/wardrobe.mjs';

export const EARN = { right: 1, finish: 2, win: 5 };
export const WELCOME = 20, LOADOUTS = 3, LOADOUT_NAME_MAX = 16;

/* what one finished duel pays one of its players: { bones, right, finish, win } (0 for a duel not done, or not theirs) */
export function earnFor(result, player) {
  const zero = { bones: 0, right: 0, finish: 0, win: 0 };
  if (!result || result.phase !== 'done' || !result.right || !(player in result.right)) return zero;
  const r = Math.max(0, Math.floor(Number(result.right[player]) || 0));
  const right = r * EARN.right, finish = result.reason === 'end' ? EARN.finish : 0, win = result.winner === player && r >= 1 ? EARN.win : 0;
  return { bones: right + finish + win, right, finish, win };
}

/* a piece the store sells (every piece but the exclusive) */
export const sellable = id => { const it = itemOf(id); return !!it && !it.exclusive; };
export const SOLD = ITEMS.filter(i => !i.exclusive);

/* the days a phone may buy at: its own date, which is the server's UTC date give or take the time zones (UTC-12 to
   UTC+14). A day is 'YYYY-MM-DD' */
export const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
/* this phone's date, the day its shop is (Optimus's dayKey): the rotation turns at local midnight */
export const localDay = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const utcDay = ms => new Date(ms).toISOString().slice(0, 10);
export function dayOk(day, nowIso) {
  if (typeof day !== 'string' || !DAY_RE.test(day)) return false;
  const d = Date.parse(`${day}T00:00:00Z`), t = Date.parse(nowIso);
  if (!Number.isFinite(d) || !Number.isFinite(t) || utcDay(d) !== day) return false;
  return day >= utcDay(t - 12 * 36e5) && day <= utcDay(t + 14 * 36e5);
}

/* the player's side of the store: { bones, owned: Set, loadouts: [{slot, name, look}] } */
export const emptyWallet = () => ({ bones: WELCOME, owned: new Set(), loadouts: [] });
export const walletOf = w => ({ bones: Math.max(0, Math.floor(w?.bones ?? 0)), owned: new Set(Array.isArray(w?.owned) ? w.owned.filter(sellable) : w?.owned instanceof Set ? [...w.owned] : []), loadouts: Array.isArray(w?.loadouts) ? w.loadouts : [] });

/* can this wallet buy this piece today at `price` (what the screen showed)? { ok, price, why, need } */
export function canBuy(wallet, id, day, price = undefined) {
  if (!sellable(id)) return { ok: false, why: 'unknown' };
  if (wallet.owned.has(id)) return { ok: false, why: 'owned' };
  const cost = priceToday(id, day);
  if (price !== undefined && price !== cost) return { ok: false, why: 'price', price: cost };
  if (wallet.bones < cost) return { ok: false, why: 'bones', price: cost, need: cost - wallet.bones };
  return { ok: true, price: cost };
}
/* a bundle: the parts the wallet lacks, at the bundle's price */
export function canBuySet(wallet, id, price = undefined) {
  if (!SETS.some(s => s.id === id)) return { ok: false, why: 'unknown' };
  const { price: cost, left } = setPrice(id, [...wallet.owned]);
  if (!left.length) return { ok: false, why: 'owned' };
  if (price !== undefined && price !== cost) return { ok: false, why: 'price', price: cost };
  if (wallet.bones < cost) return { ok: false, why: 'bones', price: cost, need: cost - wallet.bones, left };
  return { ok: true, price: cost, left };
}

/* a look wearing only pieces its player owns, each in its own slot. A look's other keys (dog, coat, collar) stay as
   they are (normLook checks those); a look with no wear is left alone. The server stores every look through this */
export function ownedLook(look, owned) {
  if (!look || typeof look !== 'object' || Array.isArray(look) || !('wear' in look)) return look;
  const w = look.wear && typeof look.wear === 'object' && !Array.isArray(look.wear) ? look.wear : {};
  const has = owned instanceof Set ? id => owned.has(id) : id => (owned || []).includes(id);
  return { ...look, wear: Object.fromEntries(Object.entries(w).filter(([s, id]) => typeof id === 'string' && has(id) && itemOf(id)?.slot === s)) };
}
/* the same as a screen's filter: the slots the wardrobe draws, only owned pieces */
export const fitOwned = (look, owned) => ({ ...look, wear: Object.fromEntries(SLOTS.filter(s => look?.wear?.[s] && owned.has(look.wear[s]) && itemOf(look.wear[s])?.slot === s).map(s => [s, look.wear[s]])) });

/* a loadout's name: trimmed, single spaces, 1 to 16 characters of letters, numbers, spaces and . _ - ' (else the
   default, "Loadout 2") */
export const LOADOUT_RE = /^[A-Za-z0-9 ._'-]{1,16}$/;
export function loadoutName(s, slot) {
  const n = typeof s === 'string' ? s.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, '').replace(/[ \t\n\r\f\v]+/g, ' ') : '';
  return LOADOUT_RE.test(n) ? n : `Loadout ${slot}`;
}

/* the price table the migration is seeded with (scripts/seed-store.mjs): every piece in catalogue order, its deal
   price, and the bundles. The SQL's own shopFor (pup_shop_deal) walks this order, so the order is part of the data */
export function seedRows() {
  return {
    items: ITEMS.map((it, ord) => ({ id: it.id, ord, slot: it.slot, rarity: it.rarity, price: it.price, deal: dealPrice(it.price), exclusive: !!it.exclusive })),
    sets: SETS.map((s, ord) => ({ id: s.id, ord, items: s.items.slice() })),
    setOff: SET_OFF
  };
}
/* a piece's price on the day it is the deal (wardrobe.mjs priceToday, for the seed) */
export const dealPrice = price => Math.max(5, Math.round(price * (1 - DEAL_OFF) / 5) * 5);
export { shopFor, priceToday, setPrice };
