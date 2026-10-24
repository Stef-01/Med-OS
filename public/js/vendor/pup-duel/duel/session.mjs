/* session.mjs: one phone's side of one duel. It owns the rows it has seen and nothing else: the game is reduce()
   over them, every time. Rows come two ways, both from the server: the reply to its own post, and the poll of the
   log. The broadcast fast path carries no rows that count: a message on it only says "poll now" (anyone with the
   anon key can broadcast, so its contents are never trusted; review 2026-10-24).

   The 5-second promise (docs/architecture.md): the poll runs every 1.5 s while the duel is open, whatever the fast
   path is doing, so another phone's move reaches this one within one poll and one round trip.

   The poll returns every row after its cursor, in order, so the rows up to the cursor are the whole log up to
   there. A row from this phone's own post can be ahead of that (another move may sit between), so the state can be
   ahead of the log; the screen may show it, but nothing final is decided on it: the end of the game shows only once
   the poll has caught up ("firm"). The server keeps the record itself (pup_outcome), so no phone posts a result.

   const s = createSession({ transport, me, duel, onChange: view => paint(view) });
   s.start(); s.answer(2); s.emote('gg'); s.leave(); s.stop(); */

import { RULES, EMOTES, reduce, stepClock, newClock, stage, due, nextEdge, evId, other } from './core.mjs';
import { realTimers } from './transport-memory.mjs';

export const POLL_MS = 1500, HIDDEN_POLL_MS = 5000, RETRY_MS = [1000, 2000, 4000, 8000], EMOTE_GAP_MS = 1500, REFUSED_RETRY_MS = 5000, POKE_GAP_MS = 250;
const docVisible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden';
const OVER = p => p !== 'live' && p !== 'invited';

export function createSession({ transport, me, duel, timers = realTimers, rules = RULES, pollMs = POLL_MS, hiddenPollMs = HIDDEN_POLL_MS, retry = RETRY_MS, visible = docVisible, onChange = () => {} }) {
  let d = { ...duel }, st = reduce(d, []), firm = st, clock = newClock(), cursor = 0, stopped = false, started = false, loaded = false;
  let pollTimer = null, edgeTimer = null, pokeTimer = null, inFlight = null, again = false, lastPoll = -1e12, chan = null, lastEmote = -1e12, emoteSeq = 0, endedAt = null;
  const rows = new Map(), pending = new Map(), refused = new Map(), picked = {}, firstSeen = new Map();
  const net = { live: !!transport.live, pokes: 0, viaPoll: 0, polls: 0, fails: 0, lastOk: null, error: '' };

  const now = () => timers.now();
  const wall = () => (timers.wall ? timers.wall() : Date.now());
  const sleep = ms => new Promise(res => timers.setTimeout(res, ms));
  const emit = () => { if (!stopped) try { onChange(view()); } catch { /* the screen's bug is the screen's */ } };

  function add(list, via) {
    let added = 0;
    for (const r of list || []) {
      if (!r || r.duel !== d.id || typeof r.n !== 'number' || rows.has(r.id)) continue;
      rows.set(r.id, r); firstSeen.set(r.id, now()); added++;
      if (via === 'poll') net.viaPoll++;
    }
    return added;
  }

  /* fold the log, move the clock, post what is due, sleep until the next edge, repaint. `past` (a reload's first
     poll) maps a row to when it happened on this phone's clock */
  function settle(past = null) {
    const all = [...rows.values()];
    st = reduce(d, all);
    firm = st.last <= cursor ? st : reduce(d, all.filter(r => r.n <= cursor));
    clock = stepClock(clock, st, now(), rules, past);
    endedAt = OVER(firm.phase) ? endedAt ?? now() : null;
    for (const a of due(st, clock, now(), me.id, rules)) {
      if (a.kind === 'answer') post('answer', { round: a.round, choice: null, ms: a.ms }, evId(d.id, 'answer', { round: a.round, who: me.id }));
      else post('timeout', { round: a.round, for: a.for }, evId(d.id, 'timeout', { round: a.round, who: a.for }));
    }
    if (OVER(st.phase) && st.last > cursor) poke();   // an ending seen only in my own reply: confirm it against the log now
    timers.clearTimeout(edgeTimer); edgeTimer = null;
    const t = nextEdge(st, clock, now(), me.id, rules);
    if (t !== null && !stopped) edgeTimer = timers.setTimeout(() => settle(), Math.max(0, t - now()) + 1);
    emit();
  }

  async function post(kind, body, id) {
    if (rows.has(id) || pending.has(id)) return null;
    if (refused.has(id) && now() - refused.get(id) < REFUSED_RETRY_MS) return null;
    const job = { kind, body, tries: 0, error: '' };
    pending.set(id, job); emit();
    for (;;) {
      if (stopped) return null;
      try {
        const row = await transport.post(me, d.id, { id, kind, body });
        pending.delete(id); refused.delete(id); net.lastOk = now(); net.error = '';
        if (add([row], 'own')) settle();
        chan?.send({ type: 'poke', n: row?.n });
        emit();
        return row;
      } catch (e) {
        job.tries++; job.error = e.message; net.fails++; net.error = e.message;
        /* the server said no: not again at once, but a move that is due is asked for again on a later settle (a
           refusal can pass: a function list reloading, a rate limit), so the game never waits on it for ever */
        if (e.server) { pending.delete(id); refused.set(id, now()); emit(); return null; }
        emit();
        await sleep(retry[Math.min(job.tries - 1, retry.length - 1)]);
      }
    }
  }

  function poll() {
    if (stopped) return Promise.resolve();
    if (inFlight) { again = true; return inFlight; }
    timers.clearTimeout(pollTimer); pollTimer = null;
    const began = now();
    lastPoll = began;
    inFlight = (async () => {
      let past = null;
      try {
        for (let page = 0; page < 10; page++) {
          const res = await transport.log(me, d.id, cursor);
          net.polls++; net.lastOk = now(); net.error = '';
          if (res?.duel) d = { ...d, status: res.duel.status, result: res.duel.result };
          const got = res?.rows || [];
          if (!loaded) {   /* a reload: what already happened happened at the server's time, not now */
            const local = new Map(got.map(r => [r.n, now() - (wall() - Date.parse(r.at))]));
            past = n => local.get(n);
          }
          for (const r of got) cursor = Math.max(cursor, r.n);
          add(got, 'poll');
          if (got.length < 200) break;
        }
        loaded = true;
      } catch (e) { net.fails++; net.error = e.message; }
      inFlight = null;
      settle(past);   // every poll, new rows or not: what is due is asked for again
      if (again) { again = false; poll(); } else schedulePoll(now() - began);
    })();
    return inFlight;
  }
  /* a steady cadence from each poll's start, not its end, so a slow link does not stretch the interval */
  function schedulePoll(took = 0) {
    if (stopped) return;
    timers.clearTimeout(pollTimer);
    if (OVER(firm.phase) && pending.size === 0 && endedAt !== null && now() - endedAt > pollMs * 2) return;   // the game is over and the log agrees: stop asking
    pollTimer = timers.setTimeout(poll, Math.max(100, (visible() ? pollMs : hiddenPollMs) - took));
  }
  /* "something happened": poll now, but at most every POKE_GAP_MS, however many pokes arrive */
  function poke() {
    if (stopped || pokeTimer !== null) return;
    if (inFlight) { again = true; return; }
    pokeTimer = timers.setTimeout(() => { pokeTimer = null; poll(); }, Math.max(0, POKE_GAP_MS - (now() - lastPoll)));
  }
  const onLive = () => { net.pokes++; poke(); };
  const onVisible = () => { if (visible()) poll(); };

  function view() {
    const s = stage(st, clock, now(), me.id), opp = other(st, me.id), R = s.round !== undefined ? st.rounds[s.round] : null;
    return {
      duel: d, state: st, firm, confirmed: st.last <= cursor, stage: s, me: me.id, opp, clock,
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
      timers.clearTimeout(pollTimer); timers.clearTimeout(edgeTimer); timers.clearTimeout(pokeTimer);
      chan?.close(); chan = null;
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible);
    },
    poll, view, get state() { return st; }, get firm() { return firm; }, seenAt: id => firstSeen.get(id), get rows() { return [...rows.values()].sort((a, b) => a.n - b.n); },
    /* my pick for the open question; false when there is nothing to answer (or my time is up: the blank is on its way) */
    answer(choice) {
      const s = stage(st, clock, now(), me.id);
      if (s.name !== 'question' || s.left <= 0 || picked[s.round] !== undefined) return false;
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
