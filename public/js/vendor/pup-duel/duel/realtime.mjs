/* realtime.mjs: the smallest Supabase Realtime client the duel needs: public broadcast channels over one WebSocket,
   in the Phoenix protocol's JSON frames (vsn 1.0.0: {topic, event, payload, ref, join_ref}). It is the fast path
   only; the event log is the truth and the session polls it, so this client may lose a message and nothing breaks.

   The frames match @supabase/realtime-js 2.118.0 (REA ev_95bd19d4..., RealtimeChannel.js subscribe(): the join
   config {broadcast: {ack, self}, presence: {key, enabled}, postgres_changes: [], private}, access_token only when
   the key is a JWT). Two choices differ, for the 5-second budget: a heartbeat every 5 s rather than 25 s, and a
   socket whose heartbeat goes unanswered by the next one is closed and reopened (1, 2, 5, 10 s, then 10 s). */

const isJwt = k => typeof k === 'string' && k.split('.').length === 3;
export const BACKOFF = [1000, 2000, 5000, 10000];

export function joinFrame(topic, key, ref) {
  return {
    topic, event: 'phx_join', ref, join_ref: ref,
    payload: { config: { broadcast: { ack: false, self: false }, presence: { key: '', enabled: false }, postgres_changes: [], private: false }, ...(isJwt(key) ? { access_token: key } : {}) }
  };
}
export const endpointOf = (url, key) => `${String(url).replace(/^http/, 'ws').replace(/\/+$/, '')}/realtime/v1/websocket?apikey=${encodeURIComponent(key)}&vsn=1.0.0`;

export function createRealtime({ url, key, WebSocket = globalThis.WebSocket, timers, heartbeatMs = 5000, backoff = BACKOFF, onState = () => {} }) {
  const T = timers || { setTimeout: (f, ms) => globalThis.setTimeout(f, ms), clearTimeout: id => globalThis.clearTimeout(id) };
  const chans = new Map();
  let ws = null, ref = 0, tries = 0, hbTimer = null, hbRef = null, retryTimer = null, closed = false, state = 'idle';
  const setState = s => { if (s !== state) { state = s; onState(s); } };
  const nextRef = () => String(++ref);
  const open = () => ws && ws.readyState === 1;
  const send = frame => { if (open()) { ws.send(JSON.stringify(frame)); return true; } return false; };

  function join(ch) {
    ch.joined = false; ch.joinRef = nextRef();
    send(joinFrame(ch.topic, key, ch.joinRef));
  }
  function beat() {
    T.clearTimeout(hbTimer);
    hbTimer = T.setTimeout(() => {
      if (!open()) return;
      if (hbRef !== null) { hbRef = null; try { ws.close(4000, 'heartbeat timeout'); } catch { /* already closing */ } return; }   // the last one never came back: the socket is dead
      hbRef = nextRef();
      send({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: hbRef });
      beat();
    }, heartbeatMs);
  }
  function retry() {
    if (closed || retryTimer !== null) return;
    const wait = backoff[Math.min(tries, backoff.length - 1)];
    tries++;
    setState('waiting');
    retryTimer = T.setTimeout(() => { retryTimer = null; connect(); }, wait);
  }
  function connect() {
    if (closed || (ws && ws.readyState <= 1)) return;
    setState('connecting');
    let sock;
    try { sock = new WebSocket(endpointOf(url, key)); } catch { retry(); return; }
    ws = sock; hbRef = null;
    sock.onopen = () => { if (ws !== sock) return; tries = 0; setState('open'); chans.forEach(join); beat(); };
    sock.onmessage = e => { if (ws === sock) receive(e.data); };
    sock.onerror = () => { /* onclose follows */ };
    sock.onclose = () => {
      if (ws !== sock) return;
      T.clearTimeout(hbTimer); ws = null;
      chans.forEach(ch => { ch.joined = false; });
      if (!closed) retry(); else setState('closed');
    };
  }
  function receive(data) {
    let m;
    try { m = JSON.parse(typeof data === 'string' ? data : new TextDecoder().decode(data)); } catch { return; }
    if (!m || typeof m !== 'object') return;
    if (m.topic === 'phoenix' && m.event === 'phx_reply') { if (m.ref === hbRef) hbRef = null; return; }
    const ch = chans.get(m.topic);
    if (!ch) return;
    if (m.event === 'phx_reply' && m.ref === ch.joinRef) {
      ch.joined = m.payload?.status === 'ok';
      if (ch.joined) { const q = ch.queue.splice(0); q.forEach(f => send({ ...f, join_ref: ch.joinRef, ref: nextRef() })); }
      else ch.error = m.payload?.response?.reason || 'join refused';
      return;
    }
    if (m.event === 'broadcast' && m.payload && typeof m.payload.event === 'string') { ch.handlers.forEach(h => { try { h(m.payload.event, m.payload.payload); } catch { /* a handler's bug stays its own */ } }); return; }
    if (m.event === 'phx_error' || m.event === 'phx_close') { ch.joined = false; if (open() && !closed) T.setTimeout(() => { if (chans.get(ch.topic) === ch && open()) join(ch); }, backoff[0]); }
  }

  return {
    get state() { return state; },
    channel(name, onBroadcast) {
      const topic = `realtime:${name}`;
      let ch = chans.get(topic);
      if (!ch) { ch = { topic, joined: false, joinRef: null, handlers: new Set(), queue: [], error: '' }; chans.set(topic, ch); if (open()) join(ch); else connect(); }
      ch.handlers.add(onBroadcast);
      return {
        send(event, payload) {
          const frame = { topic, event: 'broadcast', payload: { type: 'broadcast', event, payload } };
          if (ch.joined && send({ ...frame, ref: nextRef(), join_ref: ch.joinRef })) return true;
          if (ch.queue.length < 20) ch.queue.push(frame);   // sent once joined; the log covers anything lost
          return false;
        },
        close() {
          ch.handlers.delete(onBroadcast);
          if (ch.handlers.size) return;
          chans.delete(topic);
          if (ch.joined) send({ topic, event: 'phx_leave', payload: {}, ref: nextRef(), join_ref: ch.joinRef });
        },
        get joined() { return ch.joined; }
      };
    },
    close() {
      closed = true; T.clearTimeout(hbTimer); T.clearTimeout(retryTimer); retryTimer = null;
      if (ws) { try { ws.close(1000, 'bye'); } catch { /* gone */ } }
      setState('closed');
    }
  };
}
