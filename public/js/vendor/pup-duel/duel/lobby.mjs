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

/* crossed challenges (both tapped Rematch, or challenged each other at once, or one player on two phones tapped it
   on both): of every challenge still open between the two of us, the one with the smallest id is the one every phone
   plays, so they all settle on it without asking anybody. And a duel between us that went live in the last minute
   (the other side settled first) is joined, not left waiting beside. `mine` is the duel this phone is waiting on;
   null means keep waiting, else { duel, accept } is the one to open instead (accept: I am its mate). Pure */
export const CROSSED_LIVE_MS = 60000;
export function settleCrossed(meId, themId, mine, inbox) {
  /* the server says mine is no longer an open challenge (they accepted it, and this phone has not polled it yet):
     stay. Leaving it would forfeit a live duel (evals, 2026-10-25: a storm of rematch taps) */
  const now = (inbox || []).find(d => d && d.id === mine.id);
  if (now && now.status !== 'invited') return null;
  const ours = (inbox || []).filter(d => d && d.id !== mine.id && ((d.a === meId && d.b === themId) || (d.a === themId && d.b === meId)));
  const since = mine.created_at ? t(mine.created_at) - CROSSED_LIVE_MS : Infinity;
  const live = ours.filter(d => d.status === 'live' && t(d.created_at) >= since).sort(byId)[0];
  if (live) return { duel: live, accept: false };
  const first = [...ours.filter(d => d.status === 'invited'), mine].sort(byId)[0];
  return first.id === mine.id ? null : { duel: first, accept: first.b === meId };
}
/* their rematch, as an offer on my result screen: the first of their open challenges to me */
export const offerFrom = (meId, themId, inbox) => (inbox || []).filter(d => d && d.status === 'invited' && d.a === themId && d.b === meId).sort(byId)[0] || null;
const byId = (x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0);
/* where a Rematch tap goes, after the duel `last` (pure): a duel between us that went live since `last` began is the
   rematch already under way, so join it; else their open challenge to me, accept it; else null: challenge (the server
   hands back one already open). With one open challenge per pair, a second exists only once the first is live, so a
   phone that sees the second sees the first live: a storm of taps on four phones lands in one duel (evals) */
export function rematchTarget(meId, themId, last, inbox) {
  const live = (inbox || []).filter(d => d && d.id !== last?.id && d.status === 'live' && ((d.a === meId && d.b === themId) || (d.a === themId && d.b === meId)) && last?.created_at && t(d.created_at) >= t(last.created_at)).sort(byId)[0];
  if (live) return { duel: live, accept: false };
  const offer = offerFrom(meId, themId, inbox);
  return offer ? { duel: offer, accept: true } : null;
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
