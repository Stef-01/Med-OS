/* ranked.mjs: ranked duels, the ladder and the matchmaking queue (founder 2026-10-25: "a whole leaderboard system and
   ranked based matching"). Pure. The same rules run in Postgres (supabase/migrations/0003_pup_ranked.sql) and in
   server-core.mjs, pinned by test/ranked.test.mjs.

   rating    Elo from 1000, K 32, zero-sum: what one player gains the other loses. Only a matchmade duel is ranked
             (the server sets the flag; a challenge between mates never carries it); walking out is a loss.
   tiers     Bronze, Silver from 950, Gold from 1100, Platinum from 1250, Diamond from 1400; placing until 3 games.
   the queue whoever asks for a match is paired with the closest waiting player inside a window that widens while
             they wait (±100, 50 more every 10 s, anyone after a minute); a ticket nobody has asked about for 15 s is
             dropped (the phone closed). The pairing makes the duel and accepts it for the one who waited. */

export const START = 1000, K = 32, PLACING = 3;
export const WINDOW = { base: 100, step: 50, every: 10000, open: 60000 }, STALE = 15000;
export const TIERS = [
  { id: 'bronze', name: 'Bronze', min: -Infinity },
  { id: 'silver', name: 'Silver', min: 950 },
  { id: 'gold', name: 'Gold', min: 1100 },
  { id: 'platinum', name: 'Platinum', min: 1250 },
  { id: 'diamond', name: 'Diamond', min: 1400 }
];

export const expected = (ra, rb) => 1 / (1 + Math.pow(10, (rb - ra) / 400));
/* the change to a's rating when a scores s (1 a win, 0.5 a draw, 0 a loss) against b; b's is its negative. Rounded on
   its size, half away from zero, as Postgres rounds a numeric */
export function eloDelta(ra, rb, s) {
  const x = K * (s - expected(ra, rb));
  return Math.sign(x) * Math.round(Math.abs(x)) + 0;   // + 0: never -0
}

/* where a rating sits: { id, name, min, next (the next tier's floor, or null), toNext, placing } */
export function tierOf(rating = START, games = 0) {
  let i = 0;
  for (let k = 0; k < TIERS.length; k++) if (rating >= TIERS[k].min) i = k;
  const t = TIERS[i], nx = TIERS[i + 1] || null;
  return { id: t.id, name: t.name, min: t.min, next: nx ? nx.min : null, nextName: nx?.name || null, toNext: nx ? nx.min - rating : 0, placing: games < PLACING };
}

/* how far apart two ratings may be after waiting `ms` */
export const windowFor = ms => (ms >= WINDOW.open ? Infinity : WINDOW.base + WINDOW.step * Math.floor(Math.max(0, ms) / WINDOW.every));

/* the opponent for `me` among the queue's live tickets ({ player, rating, joined_at, polled_at, duel }): the nearest
   rating inside either one's window (the longer wait widens both), then whoever has waited longest; null when nobody */
export function pickOpponent(me, queue, now) {
  const at = s => Date.parse(s);
  let best = null;
  for (const t of queue) {
    if (t.player === me.player || t.duel || now - at(t.polled_at) > STALE) continue;
    const gap = Math.abs(t.rating - me.rating), win = windowFor(Math.max(now - at(t.joined_at), now - at(me.joined_at)));
    if (gap > win) continue;
    if (!best || gap < best.gap || (gap === best.gap && at(t.joined_at) < at(best.t.joined_at))) best = { t, gap };
  }
  return best ? best.t : null;
}

/* the ladder: by rating, then most ranked games, then name; the weekly board by wins in the last 7 days */
export const byRating = (a, b) => b.rating - a.rating || b.ranked - a.ranked || a.name.localeCompare(b.name);
export const byWeek = (a, b) => b.week - a.week || b.rating - a.rating || a.name.localeCompare(b.name);
/* 1-based ranks with ties sharing a place (two at 1012 are both 3rd) */
export function ranked(list, cmp, key) {
  const s = list.slice().sort(cmp);
  return s.map((p, i) => ({ ...p, place: i && key(s[i - 1]) === key(p) ? null : i + 1 })).map((p, i, a) => ({ ...p, place: p.place ?? a.slice(0, i).reverse().find(x => x.place != null).place }));
}

/* what a ranked result did to a player's standing, for the result's one line: null (nothing worth a moment),
   { kind: 'placed', tier } (the last placing game), { kind: 'up' | 'down', tier } (into another tier) */
export function rankChange(before, after) {
  if (!before || !after) return null;
  const a = tierOf(before.rating, before.ranked), b = tierOf(after.rating, after.ranked);
  if (a.placing && !b.placing) return { kind: 'placed', tier: b.name };
  if (b.placing || a.id === b.id) return null;
  return { kind: after.rating > before.rating ? 'up' : 'down', tier: b.name };
}
