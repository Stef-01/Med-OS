/* transport-supabase.mjs: the duel over a Supabase project: the functions in 0001_pup_duel.sql through PostgREST
   (POST /rest/v1/rpc/pup_*), and broadcast channels through Realtime for the fast path. No supabase-js: two fetch
   calls and realtime.mjs are all it needs.

   An error the server raised (a taken name, a wrong PIN) has `server: true` and is not retried at once; a network
   failure, a 5xx, a 404 (PostgREST reloading its function list), a 408 or a 429 is, by the session, with the same
   event id. */

import { createRealtime } from './realtime.mjs';

const isJwt = k => typeof k === 'string' && k.split('.').length === 3;
const RETRYABLE = new Set([404, 408, 425, 429]);
/* pup_login answers a wrong PIN with {error} (so the failure it records survives): a refusal like any other */
const refusal = r => { if (r && typeof r.error === 'string') throw Object.assign(new Error(r.error), { server: true }); return r; };

export function supabaseTransport({ url, key, fetch = globalThis.fetch?.bind(globalThis), WebSocket = globalThis.WebSocket, timers, realtime = true, heartbeatMs } = {}) {
  if (!url || !key) throw new Error('supabaseTransport needs the project URL and its anon key');
  const base = `${String(url).replace(/\/+$/, '')}/rest/v1/rpc/`;
  /* a legacy anon key is a JWT and goes in Authorization too; a publishable key (sb_publishable_...) only as apikey */
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json', apikey: key, ...(isJwt(key) ? { Authorization: `Bearer ${key}` } : {}) };

  async function rpc(fn, args) {
    let res;
    try { res = await fetch(base + fn, { method: 'POST', headers, body: JSON.stringify(args) }); } catch (e) { throw Object.assign(new Error('No connection'), { server: false, cause: e }); }
    const text = await res.text();
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
    /* the shop (0002_pup_shop.sql) */
    wallet: me => rpc('pup_wallet', { p_token: me.token }),
    buy: (me, ids, total) => rpc('pup_buy', { p_token: me.token, p_ids: ids, p_total: total }),
    practice: (me, right) => rpc('pup_practice', { p_token: me.token, p_right: right }),
    outfits: (me, list) => rpc('pup_outfits', { p_token: me.token, p_outfits: list }),
    /* ranked (0003_pup_ranked.sql) */
    queue: (me, setup) => rpc('pup_queue', { p_token: me.token, p_setup: setup }),
    unqueue: me => rpc('pup_unqueue', { p_token: me.token }),
    leaderboard: me => rpc('pup_leaderboard', { p_token: me.token }),
    live,
    get socket() { return rt?.state || 'idle'; },
    close() { rt?.close(); rt = null; }
  };
}
