/* session.mjs: one phone's side of one duel. It owns the rows it has seen and nothing else: the game is reduce()
   over them, every time. Rows come three ways (its own posts, the broadcast fast path, the poll of the log) and
   are merged by id, so it does not matter which arrives first or how often.

   The 5-second promise (docs/architecture.md): the poll runs every 1.5 s while the duel is open, whatever the fast
   path is doing, so another phone's move reaches this one within one poll and one round trip.

   const s = createSession({ transport, me, duel, onChange: view => paint(view) });
   s.start(); s.answer(2); s.emote('gg'); s.leave(); s.stop(); */

import { RULES, EMOTES, reduce, stepClock, newClock, stage, due, nextEdge, evId, summary, other } from './core.mjs';
import { realTimers } from './transport-memory.mjs';

export const POLL_MS = 1500, HIDDEN_POLL_MS = 5000, RETRY_MS = [1000, 2000, 4000, 8000], EMOTE_GAP_MS = 1500;
const docVisible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden';

export function createSession({ transport, me, duel, timers = realTimers, rules = RULES, pollMs = POLL_MS, hiddenPollMs = HIDDEN_POLL_MS, retry = RETRY_MS, visible = docVisible, onChange = () => {} }) {
  let d = { ...duel }, st = reduce(d, []), clock = newClock(), cursor = 0, stopped = false, started = false;
  let pollTimer = null, edgeTimer = null, inFlight = null, chan = null, lastEmote = -1e12, emoteSeq = 0, finalSent = false, endedAt = null;
  const rows = new Map(), pending = new Map(), picked = {}, firstSeen = new Map();
  const net = { live: !!transport.live, viaLive: 0, viaPoll: 0, polls: 0, fails: 0, lastOk: null, error: '' };

  const now = () => timers.now();
  const sleep = ms => new Promise(res => timers.setTimeout(res, ms));
  const emit = () => { if (!stopped) try { onChange(view()); } catch { /* the screen's bug is the screen's */ } };

  function merge(list, via) {
    let added = 0;
    for (const r of list || []) {
      if (!r || r.duel !== d.id || typeof r.n !== 'number' || rows.has(r.id)) continue;
      rows.set(r.id, r); firstSeen.set(r.id, now()); added++;
      if (via === 'live') net.viaLive++; else if (via === 'poll') net.viaPoll++;
    }
    if (added) settle();
    return added;
  }

  /* fold the log, move the clock, post what is due, sleep until the next edge, repaint */
  function settle() {
    st = reduce(d, [...rows.values()]);
    clock = stepClock(clock, st, now(), rules);
    if (st.phase !== 'live' && st.phase !== 'invited' && endedAt === null) endedAt = now();
    for (const a of due(st, clock, now(), me.id, rules)) {
      if (a.kind === 'answer') post('answer', { round: a.round, choice: null, ms: a.ms }, evId(d.id, 'answer', { round: a.round, who: me.id }));
      else post('timeout', { round: a.round, for: a.for }, evId(d.id, 'timeout', { round: a.round, who: a.for }));
    }
    if (st.phase === 'done' && !finalSent && st.rounds.length) { finalSent = true; post('final', summary(st), evId(d.id, 'final', { who: me.id })); }
    timers.clearTimeout(edgeTimer); edgeTimer = null;
    const t = nextEdge(st, clock, now(), me.id, rules);
    if (t !== null && !stopped) edgeTimer = timers.setTimeout(settle, Math.max(0, t - now()) + 1);
    emit();
  }

  async function post(kind, body, id) {
    if (rows.has(id) || pending.has(id)) return null;
    const job = { kind, body, tries: 0, error: '' };
    pending.set(id, job); emit();
    for (;;) {
      if (stopped) return null;
      try {
        const row = await transport.post(me, d.id, { id, kind, body });
        pending.delete(id); net.lastOk = now(); net.error = '';
        merge([row], 'own');
        chan?.send({ type: 'row', row });
        emit();
        return row;
      } catch (e) {
        job.tries++; job.error = e.message; net.fails++; net.error = e.message;
        if (e.server) { pending.delete(id); emit(); return null; }   // the server said no: a retry would say no again
        emit();
        await sleep(retry[Math.min(job.tries - 1, retry.length - 1)]);
      }
    }
  }

  function poll() {
    if (stopped) return Promise.resolve();
    if (inFlight) return inFlight;
    timers.clearTimeout(pollTimer); pollTimer = null;
    const began = now();
    inFlight = (async () => {
      try {
        for (let page = 0; page < 10; page++) {
          const res = await transport.log(me, d.id, cursor);
          net.polls++; net.lastOk = now(); net.error = '';
          if (res?.duel) d = { ...d, status: res.duel.status, result: res.duel.result };
          const got = res?.rows || [];
          for (const r of got) cursor = Math.max(cursor, r.n);
          merge(got, 'poll');
          if (got.length < 200) break;
        }
      } catch (e) { net.fails++; net.error = e.message; emit(); }
      inFlight = null;
      schedulePoll(now() - began);
    })();
    return inFlight;
  }
  /* a steady cadence from each poll's start, not its end, so a slow link does not stretch the interval */
  function schedulePoll(took = 0) {
    if (stopped) return;
    timers.clearTimeout(pollTimer);
    const over = st.phase !== 'live' && st.phase !== 'invited';
    if (over && finalSent && pending.size === 0 && endedAt !== null && now() - endedAt > pollMs * 2) return;   // the game is over and told: stop asking
    if (over && !st.rounds.some(r => r.closed) && endedAt !== null && now() - endedAt > pollMs * 2) return;   // declined or cancelled
    pollTimer = timers.setTimeout(poll, Math.max(100, (visible() ? pollMs : hiddenPollMs) - took));
  }

  function onLive(msg) {
    if (!msg || msg.type !== 'row' || !msg.row) return;
    const fresh = merge([msg.row], 'live');
    if (fresh && msg.row.n > cursor + 1) poll();   // something before it may be missing: ask the log now
  }
  const onVisible = () => { if (visible()) poll(); };

  function view() {
    const s = stage(st, clock, now(), me.id), opp = other(st, me.id), R = s.round !== undefined ? st.rounds[s.round] : null;
    return {
      duel: d, state: st, stage: s, me: me.id, opp, clock,
      question: s.round !== undefined ? st.setup.questions[s.round] : null,
      mine: R ? R.answers[me.id] || null : null,
      theirs: R ? R.answers[opp] || null : null,
      picked: s.round !== undefined ? picked[s.round] : undefined,
      sending: [...pending.values()].map(p => ({ kind: p.kind, tries: p.tries, error: p.error })),
      net: { ...net, socket: transport.socket || null }
    };
  }

  return {
    start() {
      if (started) return this;
      started = true;
      if (transport.live) { try { chan = transport.live(`pup-duel-${d.id}`, onLive); } catch { chan = null; net.live = false; } }
      if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible);
      settle(); poll();
      return this;
    },
    stop() {
      stopped = true;
      timers.clearTimeout(pollTimer); timers.clearTimeout(edgeTimer);
      chan?.close(); chan = null;
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible);
    },
    poll, view, get state() { return st; }, seenAt: id => firstSeen.get(id), get rows() { return [...rows.values()].sort((a, b) => a.n - b.n); },
    /* my pick for the open question; false when there is nothing to answer */
    answer(choice) {
      const s = stage(st, clock, now(), me.id);
      if (s.name !== 'question' || picked[s.round] !== undefined) return false;
      picked[s.round] = choice;
      const ms = Math.max(0, Math.round(now() - clock.openAt[s.round]));
      post('answer', { round: s.round, choice, ms }, evId(d.id, 'answer', { round: s.round, who: me.id }));
      return true;
    },
    accept() { if (st.phase === 'invited' && me.id === st.b) post('accept', {}, evId(d.id, 'accept')); },
    decline() { if (st.phase === 'invited' && me.id === st.b) post('decline', {}, evId(d.id, 'decline')); },
    leave() { if (st.phase === 'invited' || st.phase === 'live') post('leave', {}, evId(d.id, 'leave', { who: me.id })); },
    emote(e) {
      if (!EMOTES[e] || now() - lastEmote < EMOTE_GAP_MS || (st.phase !== 'live' && st.phase !== 'done')) return false;
      lastEmote = now();
      post('emote', { e }, evId(d.id, 'emote', { who: me.id, nonce: `${Math.round(now())}-${++emoteSeq}` }));
      return true;
    },
    rematch(duelId) { if (st.phase === 'done') post('rematch', { duel: duelId }, evId(d.id, 'rematch', { who: me.id })); }
  };
}
