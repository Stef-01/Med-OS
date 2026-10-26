/* library/sched.mjs - when a library question comes back in Study (docs/library.md). SM-2 as Anki runs it, in four
   buttons: Again (back in 10 minutes, the interval starts over), Hard (a little longer), Good (1 day, then 3, then the
   interval times the ease), Easy (longer still, and the card gets easier). A card is { due, ivl, ease, reps, lapses }
   (due in ms, ivl in days); a question never studied has no card. Pure: the Study tab, sync and the tests. */

export const GRADES = Object.freeze(['again', 'hard', 'good', 'easy']);
export const START_EASE = 2.5, MIN_EASE = 1.3, NEW_A_DAY = 20, DAY = 864e5;
const MIN = 6e4;

export const newCard = () => ({ due: 0, ivl: 0, ease: START_EASE, reps: 0, lapses: 0 });
/* a card as stored, or null; other fields on it (stats.mjs's r and w) are kept through every grade */
const ok = c => (c && typeof c === 'object' && !Array.isArray(c) ? { ...newCard(), ...c, due: Number.isFinite(c.due) ? c.due : 0 } : null);

/* the card after a grade, at `now` */
export function grade(card, g, now) {
  const c = ok(card) || newCard();
  if (!GRADES.includes(g)) return c;
  if (g === 'again') return { ...c, due: now + 10 * MIN, ivl: 0, ease: Math.max(MIN_EASE, +(c.ease - 0.2).toFixed(2)), reps: 0, lapses: c.lapses + 1 };
  let ivl, ease = c.ease;
  if (g === 'hard') { ivl = Math.max(1, Math.round(c.ivl * 1.2)); ease = Math.max(MIN_EASE, +(ease - 0.15).toFixed(2)); }
  else if (g === 'good') ivl = c.reps === 0 ? 1 : c.reps === 1 ? 3 : Math.max(c.ivl + 1, Math.round(c.ivl * ease));
  else { ivl = c.reps === 0 ? 4 : Math.max(c.ivl + 2, Math.round(c.ivl * ease * 1.3)); ease = +(ease + 0.15).toFixed(2); }
  return { ...c, due: now + ivl * DAY, ivl, ease, reps: c.reps + 1 };
}

/* what one grade would give, for the buttons: "10 min", "1 day", "3 days", "2 mo" */
export function preview(card, g, now) { return span(grade(card, g, now).due - now); }
export function span(ms) {
  const m = Math.round(ms / MIN);
  if (m < 60) return `${Math.max(1, m)} min`;
  const d = Math.round(ms / DAY);
  if (d < 1) return `${Math.round(m / 60)} h`;
  if (d < 31) return `${d} day${d === 1 ? '' : 's'}`;
  if (d < 365) return `${Math.round(d / 30)} mo`;
  return `${(d / 365).toFixed(1)} yr`;
}

/* a study session over `items` (already narrowed to the pick): the due ones, the most overdue first, then new ones up
   to the day's allowance (NEW_A_DAY less the new ones started today). cards: { id: card }; started: ids first seen today */
export function queue(items, cards, now, startedToday = 0) {
  const due = [], fresh = [];
  for (const it of items || []) { const c = ok(cards?.[it.id]); if (!c || !c.reps && !c.lapses && !c.due) fresh.push(it); else if (c.due <= now) due.push([c.due, it]); }
  due.sort((a, b) => a[0] - b[0]);
  return [...due.map(x => x[1]), ...fresh.slice(0, Math.max(0, NEW_A_DAY - startedToday))];
}
/* the counts a deck or pick shows: { due, new, learnt } */
export function counts(items, cards, now) {
  let due = 0, fresh = 0, learnt = 0;
  for (const it of items || []) { const c = ok(cards?.[it.id]); if (!c || !c.reps && !c.lapses && !c.due) fresh++; else if (c.due <= now) due++; else learnt++; }
  return { due, new: fresh, learnt };
}
