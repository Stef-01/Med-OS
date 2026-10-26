/* store-core.mjs: supabase/migrations/0002_pup_store.sql written again in JavaScript, over the same plain db as
   server-core.mjs (which mounts these methods beside its own), so local play, the memory transport, the tests and
   scripts/fake-supabase.mjs keep a wallet the way Casa does. test/store-parity.test.mjs pins the two;
   test/sql.test.mjs runs test/helpers/store-scenario.mjs against both.

   db.wallets { [player]: { bones, earned, spent } }, db.earnings [{ duel, player, bones }], db.owned [{ player, item }],
   db.spends [{ player, kind, ref, bones }], db.loadouts { [player]: { [slot]: { name, look } } }. */

import { ITEMS, SETS } from '../pup/wardrobe.mjs';
import { WELCOME, LOADOUTS, earnFor, sellable, dayOk, canBuy, canBuySet, ownedLook, loadoutName, walletOf } from './wallet.mjs';
import { jsonbBytes } from './core.mjs';

export const STORE_ERR = {
  item: 'No such piece', set: 'No such bundle', owned: 'You own that already', ownedSet: 'You own every piece in that bundle',
  bones: 'Not enough bones', price: 'The price changed: look again', day: 'Check the date on this phone', slot: 'A loadout is number 1 to 3'
};
const ORD = new Map(ITEMS.map((it, i) => [it.id, i]));

export function storeDb(db) {
  db.wallets ||= {}; db.earnings ||= []; db.owned ||= []; db.spends ||= []; db.loadouts ||= {};
  return db;
}

/* the store's functions over db; `me(token)` finds the player, `fail(msg)` raises, `lookMax` the look size limit */
export function storeServer({ db, me, now, fail, lookMax = 2048, lookErr = 'That look is too big' }) {
  storeDb(db);
  const owned = pid => new Set(db.owned.filter(o => o.player === pid).map(o => o.item));
  /* every finished duel of the player's that has not paid them yet pays them now, once (pup_settle) */
  function settle(pid) {
    const w = (db.wallets[pid] ||= { bones: WELCOME, earned: 0, spent: 0 });
    for (const d of Object.values(db.duels)) {
      if ((d.a !== pid && d.b !== pid) || d.status !== 'done' || !d.result) continue;
      if (db.earnings.some(e => e.duel === d.id && e.player === pid)) continue;
      const { bones } = earnFor(d.result, pid);
      db.earnings.push({ duel: d.id, player: pid, bones, at: now() });
      w.bones += bones; w.earned += bones;
    }
    return w;
  }
  const row = pid => {
    const w = db.wallets[pid], mine = owned(pid), lo = db.loadouts[pid] || {};
    return {
      bones: w.bones, earned: w.earned,
      owned: [...mine].sort((x, y) => ORD.get(x) - ORD.get(y)),
      loadouts: Object.keys(lo).map(Number).sort((x, y) => x - y).map(slot => ({ slot, name: lo[slot].name, look: lo[slot].look }))
    };
  };
  return {
    /* the look as the server keeps it: only pieces the player owns (the trigger pup_fit_look) */
    fitLook: (pid, look) => ownedLook(look, owned(pid)),
    async wallet(token) { const p = me(token); settle(p.id); return row(p.id); },
    async buy(token, item, price, day) {
      const p = me(token), w = settle(p.id);
      if (!sellable(item)) fail(STORE_ERR.item);
      if (!dayOk(day, now())) fail(STORE_ERR.day);
      const r = canBuy({ ...walletOf(w), owned: owned(p.id) }, item, day, price ?? null);
      if (!r.ok) fail(STORE_ERR[r.why]);
      db.owned.push({ player: p.id, item, at: now() });
      db.spends.push({ player: p.id, kind: 'item', ref: item, bones: r.price, at: now() });
      w.bones -= r.price; w.spent += r.price;
      return row(p.id);
    },
    async buySet(token, set, price) {
      const p = me(token), w = settle(p.id);
      if (!SETS.some(s => s.id === set)) fail(STORE_ERR.set);
      const r = canBuySet({ ...walletOf(w), owned: owned(p.id) }, set, price ?? null);
      if (!r.ok) fail(r.why === 'owned' ? STORE_ERR.ownedSet : STORE_ERR[r.why]);
      for (const item of r.left) db.owned.push({ player: p.id, item, at: now() });
      db.spends.push({ player: p.id, kind: 'set', ref: set, bones: r.price, at: now() });
      w.bones -= r.price; w.spent += r.price;
      return row(p.id);
    },
    /* a saved loadout: slot 1 to 3, a name, a look (kept with owned pieces only) */
    async loadout(token, slot, name, look) {
      const p = me(token);
      settle(p.id);
      if (!Number.isInteger(slot) || slot < 1 || slot > LOADOUTS) fail(STORE_ERR.slot);
      if (jsonbBytes(look ?? {}) > lookMax) fail(lookErr);
      (db.loadouts[p.id] ||= {})[slot] = { name: loadoutName(name, slot), look: ownedLook(look ?? {}, owned(p.id)), at: now() };
      return row(p.id);
    }
  };
}
