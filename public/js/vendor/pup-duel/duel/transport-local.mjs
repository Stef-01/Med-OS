/* transport-local.mjs: duels between two tabs of one browser, with no backend. The server's rules run in each tab
   over one copy of the data in localStorage (serialised with the Web Locks API where there is one), and the fast
   path is a BroadcastChannel. For trying the duel out and for practice; two phones need the Supabase transport. */

import { createServer, emptyDb, DuelError } from './server-core.mjs';

export function localTransport({ key = 'pup-duel.local', storage = globalThis.localStorage, BC = globalThis.BroadcastChannel, locks = globalThis.navigator?.locks } = {}) {
  const load = () => { try { return JSON.parse(storage.getItem(key)) || emptyDb(); } catch { return emptyDb(); } };
  const save = db => { try { storage.setItem(key, JSON.stringify(db)); } catch { /* full or blocked: this call's change is lost */ } };
  const run = async fn => {
    const once = async () => {
      const db = load(), out = await fn(createServer({ db }));
      save(db);
      return out;
    };
    try { return await (locks?.request ? locks.request(key, once) : once()); } catch (e) { if (e instanceof DuelError) e.server = true; throw e; }
  };
  return {
    name: 'local',
    register: (name, pin, look) => run(s => s.register(name, pin, look || {})),
    login: (name, pin) => run(s => s.login(name, pin)),
    touch: (me, look) => run(s => s.touch(me.token, look ?? null)),
    roster: me => run(s => s.roster(me.token)),
    challenge: (me, opp, setup) => run(s => s.challenge(me.token, opp, setup)),
    inbox: me => run(s => s.inbox(me.token)),
    post: (me, duel, ev) => run(s => s.post(me.token, duel, ev.id, ev.kind, ev.body || {})),
    log: (me, duel, after) => run(s => s.log(me.token, duel, after || 0)),
    wallet: me => run(s => s.wallet(me.token)),
    buy: (me, item, price, day) => run(s => s.buy(me.token, item, price, day)),
    buySet: (me, set, price) => run(s => s.buySet(me.token, set, price)),
    loadout: (me, slot, name, look) => run(s => s.loadout(me.token, slot, name, look ?? {})),
    live: BC ? (topic, onMsg) => {
      const bc = new BC(`${key}:${topic}`);   // a BroadcastChannel never hears itself: self: false
      bc.onmessage = e => onMsg(e.data);
      return { send: msg => bc.postMessage(msg), close: () => bc.close() };
    } : null
  };
}
