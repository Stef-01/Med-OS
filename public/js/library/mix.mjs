/* library/mix.mjs - library questions in Duel a Mate (docs/library.md): each becomes a duel question (the vendored
   package's pack format, js/vendor/pup-duel/duel/pack.mjs) tagged with whose it is, and the duel's pack gains decks
   to choose from before the specialty and kind: the bank, yours, your friends', or a mix of all three. Pure. */

export const DECKS = Object.freeze([
  { id: 'bank', label: 'The bank', short: 'Bank' }, { id: 'mine', label: 'Your questions', short: 'Yours' }, { id: 'friends', label: "Friends' questions", short: 'Friends' }
]);

const LET = 'ABCDE';
/* one library item as a duel question; from: 'mine' | 'friends' */
export function duelQuestion(it, from) {
  const ask = it.ask ? ` ${it.ask}` : '';
  const q = { id: `lib-${it.id}`.slice(0, 80), stem: `${it.stem}${ask}`, options: it.options, answer: it.answer, origin: 'human', source: from === 'mine' ? 'mine' : 'friend', deck: from === 'mine' ? 'mine' : 'friends' };
  if (it.explanation) q.why = `${LET[it.answer]}: ${it.options[it.answer]}. ${it.explanation}`;
  if (Array.isArray(it.why) && it.why.length === it.options.length && it.why.some(Boolean)) q.notes = it.why;
  if (it.topic) { q.topic = it.topic; q.topics = [it.topic]; }
  if (it.cat) q.cat = it.cat;
  if (it.year) q.year = it.year;
  if (it.difficulty) q.difficulty = it.difficulty;
  return q;
}

/* the bank's pack with the library added: every bank question in deck 'bank', then yours, then friends' (a friend's
   question that is also yours, by id, comes once, as yours). decks lists only those with questions */
/* the bank's questions in your placement's specialties, again, as a deck of their own (My placement) */
export function placePack(pack, specs = [], name = '') {
  if (!specs.length) return pack;
  const on = new Set(specs), qs = pack.questions.filter(q => q.deck === 'bank' && (q.topics || [q.topic]).some(t => on.has(t)));
  if (!qs.length) return pack;
  return { ...pack, questions: [...qs.map(q => ({ ...q, id: `pl-${q.id}`, deck: 'place' })), ...pack.questions],
    decks: [{ id: 'place', label: `My placement${name ? `: ${name}` : ''}`.slice(0, 60), short: 'Rotation' }, ...(pack.decks || [])] };
}
export function mixPack(bank, mine = [], friends = []) {
  const qs = [...(bank?.questions || []).map(q => ({ ...q, deck: 'bank' }))], seen = new Set(qs.map(q => q.id));
  for (const [list, from] of [[mine, 'mine'], [friends, 'friends']]) for (const it of list) { const q = duelQuestion(it, from); if (!seen.has(q.id)) { seen.add(q.id); qs.push(q); } }
  const have = new Set(qs.map(q => q.deck));
  return { ...bank, questions: qs, decks: DECKS.filter(d => have.has(d.id)) };
}
