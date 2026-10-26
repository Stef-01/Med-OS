/* transport-supabase.mjs: the duel over a Supabase project: the functions in 0001_pup_duel.sql through PostgREST
   (POST /rest/v1/rpc/pup_*), and broadcast channels through Realtime for the fast path. No supabase-js: two fetch
   calls and realtime.mjs are all it needs.

   An error the server raised (a taken name, a wrong PIN) has `server: true` and is not retried at once; a network
   failure, a 5xx, a 404 (PostgREST reloading its function list), a 408 or a 429 is, by the session, with the same
   event id.

   Every call gives up after TIMEOUT_MS (a network failure like any other): a phone on flaky wifi can send a request
   into a black hole, and the browser's own limit is minutes, so one hung poll stopped every poll after it (the
   session waits on the poll in flight) and the duel froze on that phone (evals, 2026-10-25). */

import { createRealtime } from './realtime.mjs';

const isJwt = k => typeof k === 'string' && k.split('.').length === 3;
const RETRYABLE = new Set([404, 408, 425, 429]);
export const TIMEOUT_MS = 8000;
/* pup_login answers a wrong PIN with {error} (so the failure it records survives): a refusal like any other */
const refusal = r => { if (r && typeof r.error === 'string') throw Object.assign(new Error(r.error), { server: true }); return r; };

export function supabaseTransport({ url, key, fetch = globalThis.fetch?.bind(globalThis), WebSocket = globalThis.WebSocket, timers, realtime = true, heartbeatMs, timeoutMs = TIMEOUT_MS } = {}) {
  if (!url || !key) throw new Error('supabaseTransport needs the project URL and its anon key');
  const base = `${String(url).replace(/\/+$/, '')}/rest/v1/rpc/`;
  /* a legacy anon key is a JWT and goes in Authorization too; a publishable key (sb_publishable_...) only as apikey */
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json', apikey: key, ...(isJwt(key) ? { Authorization: `Bearer ${key}` } : {}) };

  async function rpc(fn, args) {
    const ac = typeof AbortController === 'function' ? new AbortController() : null;
    let timer = null, res, text;
    /* the timer rejects on its own as well, for a fetch that does not listen to its signal */
    const late = new Promise((_, no) => { timer = setTimeout(() => { ac?.abort(); no(Object.assign(new Error('No connection'), { server: false, timeout: true })); }, timeoutMs); });
    try {
      res = await Promise.race([fetch(base + fn, { method: 'POST', headers, body: JSON.stringify(args), ...(ac ? { signal: ac.signal } : {}) }), late]);
      text = await Promise.race([res.text(), late]);
    } catch (e) { throw e?.timeout ? e : Object.assign(new Error('No connection'), { server: false, cause: e }); } finally { clearTimeout(timer); late.catch(() => {}); }
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    if (!res.ok) {
      const msg = (data && (data.message || data.error_description || data.error)) || `${fn} failed (${res.status})`;
      throw Object.assign(new Error(msg), { server: !RETRYABLE.has(res.status) && res.status < 500, status: res.status, code: data?.code });
    }
    return data;
  }

  let rt = null;
  const socket = () => (rt ||= createRealtime({ url, key, WebSocket, timers, ...(heartbeatMs ? { heartbeatMs } : {}) }));
  const live = realtime && WebSocket ? (topic, onMsg) => {
    const ch = socket().channel(topic, (event, payload) => { if (event === 'pup') onMsg(payload); });
    return { send: msg => ch.send('pup', msg), close: () => ch.close() };
  } : null;

  return {
    name: 'supabase',
    register: (name, pin, look) => rpc('pup_register', { p_name: name, p_pin: pin, p_look: look || {} }),
    login: async (name, pin) => refusal(await rpc('pup_login', { p_name: name, p_pin: pin })),
    touch: (me, look) => rpc('pup_touch', { p_token: me.token, p_look: look ?? null }),
    roster: me => rpc('pup_roster', { p_token: me.token }),
    challenge: (me, opp, setup) => rpc('pup_challenge', { p_token: me.token, p_opponent: opp, p_setup: setup }),
    inbox: me => rpc('pup_inbox', { p_token: me.token }),
    post: (me, duel, ev) => rpc('pup_post', { p_token: me.token, p_duel: duel, p_id: ev.id, p_kind: ev.kind, p_body: ev.body || {} }),
    log: (me, duel, after) => rpc('pup_log', { p_token: me.token, p_duel: duel, p_after: after || 0 }),
    /* the store (0002_pup_store.sql) */
    wallet: me => rpc('pup_wallet', { p_token: me.token }),
    buy: (me, item, price, day) => rpc('pup_buy', { p_token: me.token, p_item: item, p_price: price, p_day: day }),
    buySet: (me, set, price) => rpc('pup_buy_set', { p_token: me.token, p_set: set, p_price: price }),
    loadout: (me, slot, name, look) => rpc('pup_loadout', { p_token: me.token, p_slot: slot, p_name: name, p_look: look ?? {} }),
    live,
    get socket() { return rt?.state || 'idle'; },
    close() { rt?.close(); rt = null; }
  };
}
