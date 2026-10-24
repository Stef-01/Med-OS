/* play.mjs — the game around the mascot (founder 2026-10-23: "keep improving game mechanics so the dog feels more alive
   and integrated into the learn system ... improve the currency system to make the platform more engaging").
   Reverse engineered from the Duolingo clones (docs/learn/mascot.md; REA ev_f095a18a… on ludolang's frontend, and the
   ludolang backend's QuestService / StreakService / MonthlyChallengeService read as source):
     day streak    ludolang StreakService: the first answer of a day extends the run if the last study day was
                   yesterday, keeps it if today, else restarts at 1. Duolingo's streak freeze (bought with gems) is
                   added: one freeze covers one missed day and is spent automatically.
     daily quests  ludolang QuestService: a row per (user, quest, date), progress capped at the target, every step also
                   counted toward a monthly challenge. Ours: three quests a day, drawn from a pool by the date, each
                   worth bones; all three open a treat chest (Duolingo's quest chest).
     combo         Kahoot's answer streak: bones per right answer double at 5 in a row and triple at 10.
     happiness     Finch / Tamagotchi: treats (bought with bones) fill it, missed days drain it, and it sets the
                   dog's mood at rest, so neglect shows on its face and care is rewarded.
   Everything here is pure over a plain state object (tested in scripts/mascot.test.js); mascot.mjs owns the state
   (localStorage optimus.mascot, key `play`, synced across devices as its own shard). */

export const QUEST_POOL = [
  { id: 'answer15', name: 'Answer 15 questions', target: 15, step: e => 1 },
  { id: 'right10', name: 'Get 10 right', target: 10, step: e => (e.ok ? 1 : 0) },
  { id: 'run5', name: 'Get 5 in a row', target: 1, step: e => (e.streak >= 5 ? 1 : 0) },
  { id: 'cards20', name: 'Review 20 flashcards', target: 20, step: e => (e.source === 'card' ? 1 : 0) },
  { id: 'mcq10', name: 'Answer 10 MCQs', target: 10, step: e => (e.source === 'mcq' ? 1 : 0) },
  { id: 'case3', name: 'Answer 3 case questions', target: 3, step: e => (e.source === 'case' ? 1 : 0) },
  { id: 'og5', name: 'Get 5 O&G right', target: 5, step: e => (e.ok && e.field === 'obs' ? 1 : 0) },
  { id: 'paeds5', name: 'Get 5 Paeds right', target: 5, step: e => (e.ok && e.field === 'paeds' ? 1 : 0) },
  { id: 'comeback2', name: 'Bounce back after a miss twice', target: 2, step: e => (e.comeback ? 1 : 0) }
];
export const QUEST_BONES = 10, FREEZE_COST = 30, FREEZE_MAX = 2, TREAT_COST = 5, MONTH_GOAL = 30;

export const dayKey = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / 864e5);
const hash = s => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

/* three quests a day: "Answer 15" always (the daily goal), two more chosen by the date */
export function questsFor(day) {
  const rest = QUEST_POOL.slice(1), h = hash(day), a = h % rest.length, b = (a + 1 + (h >>> 8) % (rest.length - 1)) % rest.length;
  return [QUEST_POOL[0], rest[a], rest[b]].map(q => ({ id: q.id, prog: 0, done: false }));
}
export const questDef = id => QUEST_POOL.find(q => q.id === id);

export function freshPlay() { return { wager: null, lastDay: '', days: 0, best: 0, freezes: 0, quests: { day: '', list: [], chest: false }, happy: 70, fedDay: '', month: { key: '', done: 0 } }; }
export function normPlay(p) {
  const f = freshPlay(), o = p && typeof p === 'object' ? p : {};
  return { ...f, ...o, quests: { ...f.quests, ...(o.quests || {}) }, month: { ...f.month, ...(o.month || {}) } };
}

/* a new day: roll the quests, drain happiness for the days away. Returns the state (a copy) */
export function rollDay(p0, day) {
  const p = normPlay(p0);
  if (p.quests.day !== day) {
    /* the days between the last study day and today drain happiness, once, as the new day's quests roll */
    if (p.lastDay) p.happy = Math.max(0, p.happy - 15 * Math.max(0, daysBetween(p.lastDay, day) - 1));
    p.quests = { day, list: questsFor(day), chest: false };
  }
  const mk = day.slice(0, 7); if (p.month.key !== mk) p.month = { key: mk, done: 0 };
  return p;
}

/* the day streak (ludolang StreakService, plus freezes): called on each answer; changes only on a day's first */
export function touchDay(p0, day) {
  const p = normPlay(p0), prev = p.days;
  let froze = 0;
  if (p.lastDay === day) return { p, prev, next: prev, froze, up: false };
  const gap = p.lastDay ? daysBetween(p.lastDay, day) : 0;
  if (!p.lastDay || prev === 0) p.days = 1;
  else if (gap === 1) p.days = prev + 1;
  else if (gap > 1 && gap - 1 <= p.freezes) { froze = gap - 1; p.freezes -= froze; p.days = prev + 1; }
  else p.days = 1;
  p.lastDay = day; p.best = Math.max(p.best, p.days);
  return { p, prev, next: p.days, froze, up: p.days > prev };
}

/* one answer through today's quests. Returns the state and the quests that just completed (each worth QUEST_BONES),
   and chest:true the moment the third is done */
export function stepQuests(p0, e) {
  const p = normPlay(p0), done = [];
  p.quests.list = p.quests.list.map(q => {
    if (q.done) return q;
    const def = questDef(q.id); if (!def) return q;
    const prog = Math.min(def.target, q.prog + def.step(e));
    const nq = { ...q, prog, done: prog >= def.target };
    if (nq.done) { done.push(def); p.month.done++; }
    return nq;
  });
  const chest = !p.quests.chest && p.quests.list.length > 0 && p.quests.list.every(q => q.done);
  if (chest) p.quests.chest = true;
  return { p, done, chest };
}

/* the treat chest: 15 to 40 bones, a seeded roll so a test can pin it */
export const chestBones = (rnd = Math.random) => 15 + Math.floor(rnd() * 26);
/* Kahoot's combo: bones per right answer by the run, plus 5 at every fifth in a row */
export const comboOf = streak => (streak >= 10 ? 3 : streak >= 5 ? 2 : 1);
export const earnFor = (mood, streak) => (mood === 'right' || mood === 'party' ? comboOf(streak || 0) + (streak && streak % 5 === 0 ? 5 : 0) : 0);

/* a treat: costs bones, fills happiness (at most 100), feeds today */
export function feed(p0, bones, day) {
  const p = normPlay(p0);
  if (bones < TREAT_COST) return { ok: false, p, bones };
  p.happy = Math.min(100, p.happy + 20); p.fedDay = day;
  return { ok: true, p, bones: bones - TREAT_COST };
}
export function buyFreeze(p0, bones) {
  const p = normPlay(p0);
  if (p.freezes >= FREEZE_MAX) return { ok: false, why: 'max', p, bones };
  if (bones < FREEZE_COST) return { ok: false, why: 'bones', need: FREEZE_COST - bones, p, bones };
  p.freezes++;
  return { ok: true, p, bones: bones - FREEZE_COST };
}
/* the face at rest follows care: a well-fed dog is proud or happy, a neglected one droops */
export const restMood = (happy, streak) => (happy < 15 ? 'sleepy' : happy < 40 ? 'puppy' : streak >= 5 || happy >= 85 ? 'proud' : 'happy');

/* ---- currency sinks and long goals (Duolingo's gem economy, ludolang MonthlyChallengeService) ----
   monthly challenge  every finished quest counts; MONTH_GOAL in a calendar month unlocks the month's exclusive item
                      (it cannot be bought), the way ludolang's monthly challenge sits above the dailies.
   streak wager       Duolingo's double-or-nothing: stake WAGER bones on keeping the day streak WAGER_DAYS more days;
                      kept, it pays twice the stake; a missed day (with no freeze to cover it) loses it. */
export const WAGER = 50, WAGER_DAYS = 7, MONTH_ITEM = 'laurel';
export const monthDone = p => normPlay(p).month.done >= MONTH_GOAL;
export function startWager(p0, bones, day) {
  const p = normPlay(p0);
  if (p.wager) return { ok: false, why: 'on', p, bones };
  if (bones < WAGER) return { ok: false, why: 'bones', need: WAGER - bones, p, bones };
  p.wager = { from: p.days, start: day };
  return { ok: true, p, bones: bones - WAGER };
}
/* after touchDay: settle a running wager. won: pays 2 x WAGER; lost: the streak broke */
export function settleWager(p0, d) {
  const p = normPlay(p0); if (!p.wager) return { p, won: 0, lost: false };
  if (d.up && d.next >= p.wager.from + WAGER_DAYS) { p.wager = null; return { p, won: 2 * WAGER, lost: false }; }
  if (d.next < d.prev || (d.prev > 0 && d.next === 1)) { p.wager = null; return { p, won: 0, lost: true }; }
  return { p, won: 0, lost: false };
}
