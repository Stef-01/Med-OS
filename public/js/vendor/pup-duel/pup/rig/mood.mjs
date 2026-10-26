// mood.mjs — how a dog feels about being left alone (founder 2026-10-26: "implement neglect, so the dog gets sad the less
// you login so if you dont engage every day the dog gets depression and you can physically see it become depressed and
// then eventually it gets dirty and ugly and knotted to symbolise neglect, but then you play the game and then it will
// get happy"). Pure: a host gives the time of the last game played and now, and gets the stage, the face to wear, how
// grubby to draw it (rig.setMood) and a line to show. Days are calendar days in the host's zone, so a game any time
// yesterday is "yesterday" whatever the hour.
// Part of the dog kit (public/doberman/); docs/doberman/README.md has the map.

export const STAGES = [
  { id: 'happy', days: 0, expr: '', dirt: 0, line: n => `${n} is happy you are here.` },
  { id: 'missing', days: 1, expr: 'puppy', dirt: 0, line: n => `${n} missed you yesterday.` },
  { id: 'moping', days: 2, expr: 'mopey', dirt: 0.25, line: n => `${n} has been moping for two days.` },
  { id: 'grubby', days: 3, expr: 'mopey', dirt: 0.6, line: n => `${n} is getting grubby and sad. Play a round to cheer them up.` },
  { id: 'neglected', days: 5, expr: 'sad', dirt: 1, line: n => `${n} is muddy, matted and miserable. Play a round to clean them up.` }
];
export const LS = 'pup.played';

const dayOf = t => { const d = new Date(t); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5; };
/* whole calendar days since the last game (0 today; a dog never played with is treated as played today: a new player
   starts happy) */
export const daysSince = (played, now = Date.now()) => (played ? Math.max(0, dayOf(now) - dayOf(played)) : 0);
/* the stage for a number of days away */
export const stageFor = days => STAGES.reduce((s, x) => (days >= x.days ? x : s), STAGES[0]);
/* everything a host shows: { id, days, expr, dirt, line } for a dog named `name` */
export function moodOf(played, name = 'Your dog', now = Date.now()) {
  const days = daysSince(played, now), s = stageFor(days);
  return { id: s.id, days, expr: s.expr, dirt: s.dirt, line: s.line(name) };
}

/* this device's record of the last game (a host may also know a later one from the server: pass the larger) */
export function lastPlayed(store) {
  try { const v = Number((store || localStorage).getItem(LS)); return Number.isFinite(v) && v > 0 ? v : 0; } catch { return 0; }
}
export function markPlayed(t = Date.now(), store) {
  try { (store || localStorage).setItem(LS, String(t)); } catch { /* private mode: the mood just resets next visit */ }
}
