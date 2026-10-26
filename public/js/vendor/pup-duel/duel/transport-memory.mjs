/* transport-memory.mjs: a whole backend in this process, with the network's faults on demand: latency per hop,
   a share of broadcasts dropped, a client cut off. The session tests play full duels over it on a simulated clock;
   the practice bot plays over it in the page.

   const net = memoryNet({ latency: 300, drop: 1 });   // every broadcast lost: polling alone must carry the game
   const t = net.client('a');                          // the transport interface, as client 'a' */

import { createServer, DuelError } from './server-core.mjs';
import { rng } from './rng.mjs';

export const realTimers = { now: () => (globalThis.performance ? performance.now() : Date.now()), setTimeout: (f, ms) => globalThis.setTimeout(f, ms), clearTimeout: id => globalThis.clearTimeout(id) };
const clone = v => (v === undefined ? v : structuredClone(v));

export function memoryNet({ server = createServer(), latency = 0, drop = 0, seed = 1, timers = realTimers } = {}) {
  const r = rng(seed), topics = new Map(), down = new Set(), stats = { calls: 0, sent: 0, dropped: 0, delivered: 0 };
  const lat = (from, to) => Math.max(0, typeof latency === 'function' ? latency(from, to) : latency);
  const wait = ms => (ms > 0 ? new Promise(res => timers.setTimeout(res, ms)) : Promise.resolve());
  const offline = () => Object.assign(new Error('offline'), { server: false });

  function client(cid) {
    const call = fn => async (...args) => {
      stats.calls++;
      await wait(lat(cid, 'server'));
      if (down.has(cid)) throw offline();
      let out;
      try { out = clone(await server[fn](...args.map(clone))); } catch (e) { if (e instanceof DuelError) e.server = true; throw e; }
      await wait(lat('server', cid));
      if (down.has(cid)) throw offline();   // the write landed; the reply was lost (a retry must not double it)
      return out;
    };
    return {
      name: 'memory', id: cid,
      register: (name, pin, look) => call('register')(name, pin, look || {}),
      login: (name, pin) => call('login')(name, pin),
      touch: (me, look) => call('touch')(me.token, look ?? null),
      roster: me => call('roster')(me.token),
      challenge: (me, opp, setup) => call('challenge')(me.token, opp, setup),
      inbox: me => call('inbox')(me.token),
      post: (me, duel, ev) => call('post')(me.token, duel, ev.id, ev.kind, ev.body || {}),
      log: (me, duel, after) => call('log')(me.token, duel, after || 0),
      wallet: me => call('wallet')(me.token),
      buy: (me, item, price, day) => call('buy')(me.token, item, price, day),
      buySet: (me, set, price) => call('buySet')(me.token, set, price),
      loadout: (me, slot, name, look) => call('loadout')(me.token, slot, name, look ?? {}),
      live(topic, onMsg) {
        if (!topics.has(topic)) topics.set(topic, new Set());
        const subs = topics.get(topic), sub = { cid, onMsg };
        subs.add(sub);
        return {
          send(msg) {
            for (const s of subs) {
              if (s.cid === cid) continue;   // self: false, as on Supabase
              stats.sent++;
              if (down.has(cid) || down.has(s.cid) || r() < drop) { stats.dropped++; continue; }
              const copy = clone(msg);
              timers.setTimeout(() => { if (subs.has(s) && !down.has(s.cid)) { stats.delivered++; s.onMsg(copy); } }, lat(cid, s.cid));
            }
          },
          close() { subs.delete(sub); }
        };
      }
    };
  }
  return { server, client, stats, partition(cid, on = true) { if (on) down.add(cid); else down.delete(cid); } };
}
