/* lobby.mjs: who is around and which duels are mine. Polls the roster and my inbox every 3 s (the 5-second bound
   for an invite), and refreshes at once when the per-player channel says something happened. */

import { realTimers } from './transport-memory.mjs';

export const LOBBY_POLL_MS = 3000, LOBBY_HIDDEN_MS = 12000, ONLINE_MS = 120000;
const docVisible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden';
const t = iso => (iso ? Date.parse(iso) : 0);

/* the lobby's lists, from the roster and the inbox (pure; test/lobby.test.mjs) */
export function lobbyView(meId, roster, inbox, at = Date.now()) {
  const self = roster.find(p => p.id === meId) || null, mates = roster.filter(p => p.id !== meId);
  const by = id => roster.find(p => p.id === id) || null;
  const withNames = d => ({ ...d, them: by(d.a === meId ? d.b : d.a), mine: d.a === meId });
  const list = inbox.map(withNames);
  return {
    self,
    mates: mates.map(p => ({ ...p, online: at - t(p.seen_at) < ONLINE_MS })).sort((x, y) => Number(y.online) - Number(x.online) || t(y.seen_at) - t(x.seen_at)),
    invites: list.filter(d => d.status === 'invited' && !d.mine),
    waiting: list.filter(d => d.status === 'invited' && d.mine),
    live: list.filter(d => d.status === 'live'),
    past: list.filter(d => d.status === 'done' || d.status === 'declined' || d.status === 'cancelled').slice(0, 10)
  };
}

export function createLobby({ transport, me, timers = realTimers, pollMs = LOBBY_POLL_MS, hiddenMs = LOBBY_HIDDEN_MS, visible = docVisible, onChange = () => {} }) {
  let roster = [], inbox = [], error = '', loaded = false, stopped = false, timer = null, chan = null, busy = null;
  const emit = () => { if (!stopped) try { onChange(view()); } catch { /* the screen's */ } };
  const view = () => ({ ...lobbyView(me.id, roster, inbox), error, loaded });

  function schedule() {
    if (stopped) return;
    timers.clearTimeout(timer);
    timer = timers.setTimeout(refresh, visible() ? pollMs : hiddenMs);
  }
  function refresh() {
    if (stopped) return Promise.resolve();
    if (busy) return busy;
    busy = (async () => {
      try { [roster, inbox] = await Promise.all([transport.roster(me), transport.inbox(me)]); error = ''; loaded = true; } catch (e) { error = e.message; }
      busy = null; schedule(); emit();
    })();
    return busy;
  }
  /* a nudge on the mate's own channel: their lobby refreshes now instead of at its next poll */
  function nudge(playerId, msg) {
    if (!transport.live) return;
    try { const c = transport.live(`pup-player-${playerId}`, () => {}); c.send(msg); timers.setTimeout(() => c.close(), 4000); } catch { /* the poll covers it */ }
  }
  const onVisible = () => { if (visible()) refresh(); };

  return {
    start() {
      if (transport.live) { try { chan = transport.live(`pup-player-${me.id}`, msg => { if (msg && typeof msg.type === 'string') refresh(); }); } catch { chan = null; } }
      if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible);
      refresh();
      return this;
    },
    stop() {
      stopped = true; timers.clearTimeout(timer); chan?.close(); chan = null;
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible);
    },
    refresh, view, nudge,
    async challenge(opponent, setup) {
      const duel = await transport.challenge(me, opponent, setup);
      inbox = [duel, ...inbox.filter(d => d.id !== duel.id)];
      nudge(opponent, { type: 'invite', duel: duel.id, from: me.id });
      emit();
      return duel;
    },
    async look(look) { const p = await transport.touch(me, look); roster = roster.map(x => (x.id === p.id ? p : x)); emit(); return p; }
  };
}
