/* pack.mjs: a question pack, the one shape every host writes (Med-OS builds it from its stations).
   pack     { version, title, source, origin: 'ai' | 'human' | 'mixed', cats?[{ id, label }], questions[] }
   question { id, stem, options[2..6], answer (index), why?, notes?[one per option, or null], topic?, topics?[], cat?, origin?, source?, deck?, year?, difficulty? }
   year     1 to 4, the year of medical school a question is pitched at (Med-OS: first principles to final year); a pack
            with two or more years offers 0 to 1, the duel that climbs them in order
   decks    [{ id, label, short? }]: where questions come from, a layer in front of the topic (Med-OS: the bank, your own questions,
            your friends'); each question names its deck. With fewer than two decks there is no such layer
   topic is the first layer a player narrows by (Med-OS: the specialty), cat the second (Med-OS: OSCE skills, Clinical,
   Physiology and pathophysiology, Anatomy), its label and order from the pack's cats. A question can sit in more than one
   topic (topics, up to 6: a station that is Emergency Medicine and Paediatrics is found under both); topic is its first.
   source is where the question came from (Med-OS's MCQ pool: user, ai, amsa, usmle-resource); the duel tags each
   question with it (sourceLabel), and a question without one is tagged AI-written when its origin is ai.
   Plain text throughout: the duel renders with textContent, so a pack can never inject markup. */

export const LIMITS = { stem: 1200, option: 160, why: 1200, note: 600, topic: 60, cat: 30, cats: 12, id: 80, source: 30, deck: 20, decks: 6, minOptions: 2, maxOptions: 6 };
export const SOURCES = { user: 'Student', ai: 'AI-written', amsa: 'AMSA', 'usmle-resource': 'USMLE', 'open-exam': 'Exam', mine: 'Yours', friend: "A friend's", player: "A player's" };
/* a source that names whose question it is from one phone's side (mine, friend) cannot travel in a duel's setup, which
   both phones read: the mate would see "Yours" on a question they never wrote. A deal says only that a player wrote it */
export const dealtSource = s => (s === 'mine' || s === 'friend' ? 'player' : s);
/* a pack without anyone's own questions: ranked deals from it, since a stranger never agreed to play a player's
   unreviewed deck (a host's library sources are mine and friend) */
export const PERSONAL = new Set(['mine', 'friend']);
export const publicPack = pack => ({ ...pack, questions: (pack?.questions || []).filter(q => !PERSONAL.has(q.source)) });   /* short: the tag shares the match's top bar with the round dots */
/* the tag a question shows: its source's name, else AI-written for an ai question, else none */
export const sourceLabel = q => (typeof q?.source === 'string' && Object.hasOwn(SOURCES, q.source) ? SOURCES[q.source] : q?.origin === 'ai' ? SOURCES.ai : '');   /* own keys only: a setup comes from the other phone */

const text = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/* one question, cleaned; null with the reason when it cannot be played */
export function normQuestion(q) {
  if (!q || typeof q !== 'object') return { q: null, why: 'not an object' };
  const id = text(q.id, LIMITS.id), stem = text(q.stem, LIMITS.stem);
  if (!id) return { q: null, why: 'no id' };
  if (!stem) return { q: null, why: `${id}: no stem` };
  if (!Array.isArray(q.options)) return { q: null, why: `${id}: no options` };
  const options = q.options.map(o => text(o, LIMITS.option));
  if (options.length < LIMITS.minOptions || options.length > LIMITS.maxOptions) return { q: null, why: `${id}: ${options.length} options` };
  if (options.some(o => !o)) return { q: null, why: `${id}: an empty option` };
  if (new Set(options.map(o => o.toLowerCase())).size !== options.length) return { q: null, why: `${id}: two options alike` };
  if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= options.length) return { q: null, why: `${id}: answer out of range` };
  const out = { id, stem, options, answer: q.answer };
  const why = text(q.why, LIMITS.why); if (why) { out.why = why; if (q.whyBy === 'ai') out.whyBy = 'ai'; }   /* an explanation written by AI for a question that came without one: the review says so */
  if (Array.isArray(q.notes) && q.notes.length === options.length) out.notes = q.notes.map(n => text(n, LIMITS.note) || null);
  const topic = text(q.topic, LIMITS.topic); if (topic) out.topic = topic;
  const topics = [...new Set((Array.isArray(q.topics) ? q.topics : []).map(t => text(t, LIMITS.topic)).filter(Boolean))].slice(0, 6);
  if (topics.length) { out.topics = topic && !topics.includes(topic) ? [topic, ...topics].slice(0, 6) : topics; if (!out.topic) out.topic = out.topics[0]; }
  const cat = text(q.cat, LIMITS.cat); if (cat) out.cat = cat;
  if (q.origin === 'ai' || q.origin === 'human') out.origin = q.origin;
  const source = text(q.source, LIMITS.source).toLowerCase(); if (/^[a-z0-9-]+$/.test(source)) out.source = source;
  const deck = text(q.deck, LIMITS.deck).toLowerCase(); if (/^[a-z0-9-]+$/.test(deck)) out.deck = deck;
  const group = text(q.group, LIMITS.id); if (group) out.group = group;   /* questions on one case: a duel deals one of them (core.mjs oneOfEach) */
  if (Number.isInteger(q.year) && q.year >= 1 && q.year <= 4) out.year = q.year;
  if (Number.isInteger(q.difficulty) && q.difficulty >= 1 && q.difficulty <= 3) out.difficulty = q.difficulty;   /* 1 Easy, 2 Medium, 3 Hard, for a student of its year */
  return { q: out, why: '' };
}

/* a whole pack: the playable questions (first of any repeated id) and what was dropped */
export function normPack(p) {
  const src = p && typeof p === 'object' ? p : {}, seen = new Set(), questions = [], dropped = [];
  for (const raw of Array.isArray(src.questions) ? src.questions : []) {
    const { q, why } = normQuestion(raw);
    if (!q) { dropped.push(why); continue; }
    if (seen.has(q.id)) { dropped.push(`${q.id}: repeated`); continue; }
    seen.add(q.id); questions.push(q);
  }
  const origin = ['ai', 'human', 'mixed'].includes(src.origin) ? src.origin : 'mixed';
  const cats = (Array.isArray(src.cats) ? src.cats : []).map(c => ({ id: text(c?.id, LIMITS.cat), label: text(c?.label, LIMITS.topic) })).filter(c => c.id && c.label).slice(0, LIMITS.cats);
  const decks = (Array.isArray(src.decks) ? src.decks : []).map(d => ({ id: text(d?.id, LIMITS.deck).toLowerCase(), label: text(d?.label, LIMITS.topic), ...(text(d?.short, 12) ? { short: text(d.short, 12) } : {}), ...(d?.mix === false ? { mix: false } : {}) })).filter(d => /^[a-z0-9-]+$/.test(d.id) && d.label).slice(0, LIMITS.decks);
  return { pack: { version: text(String(src.version ?? ''), 40), title: text(src.title, 80) || 'Questions', source: text(src.source, 200), origin, cats, ...(decks.length ? { decks } : {}), questions }, dropped };
}

/* the two layers a player drills through: every topic with its count and, under it, every category the pack names with
   its count there (0 when none yet, so the layers read the same in every topic); `all` is the categories over the whole
   pack. Categories in the pack's order; a category no cats entry names comes after, labelled by its id */
export function topicTree(pack) {
  const named = [...(pack.cats || [])], qs = pack.questions || [];
  for (const q of qs) if (q.cat && !named.some(c => c.id === q.cat)) named.push({ id: q.cat, label: q.cat });
  const catsIn = list => named.map(c => ({ ...c, count: list.filter(q => q.cat === c.id).length }));
  return {
    all: { count: qs.length, cats: catsIn(qs) },
    topics: topicsOf(pack).map(t => ({ ...t, cats: catsIn(qs.filter(q => inTopic(q, t.topic))) }))
  };
}
/* how many questions a pick has */
export const poolOf = (pack, { topic = '', cat = '' } = {}) => (pack?.questions || []).filter(q => (!topic || inTopic(q, topic)) && (!cat || q.cat === cat));
/* "Paediatrics › Anatomy", "Every topic › Clinical", "Every topic" */
export function pickLabel(pack, { topic = '', cat = '' } = {}) {
  const c = cat && ((pack?.cats || []).find(x => x.id === cat)?.label || cat);
  return `${topic || 'Every topic'}${c ? ` › ${c}` : ''}`;
}

/* the decks a player can choose from, with their counts: those the pack names that have questions; [] when there is
   only one (no layer to show) */
export function decksOf(pack) {
  const list = (pack?.decks || []).map(d => ({ ...d, count: (pack.questions || []).filter(q => q.deck === d.id).length })).filter(d => d.count);
  return list.length > 1 ? list : [];
}
/* the years a pack's questions span (ascending): two or more and the setup offers 0 to 1 */
export const yearsOf = pack => [...new Set((pack?.questions || []).map(q => q.year).filter(Boolean))].sort((a, b) => a - b);
export const YEAR_LABEL = y => `Year ${y}`;

/* the pack narrowed to one deck ('' is every deck: the mix) */
/* one deck's questions, or Mix: every deck but one marked mix: false (a host's view over questions already in the bank,
   like Med-OS's placement copies, would deal the same question twice) */
export const deckPack = (pack, deck = '') => {
  if (deck) return { ...pack, questions: (pack?.questions || []).filter(q => q.deck === deck) };
  const out = new Set((pack?.decks || []).filter(d => d && d.mix === false).map(d => d.id));
  return out.size ? { ...pack, questions: (pack?.questions || []).filter(q => !out.has(q.deck)) } : pack;
};

/* is a question in a topic (its first, or any of its topics) */
export const inTopic = (q, topic) => q.topic === topic || (Array.isArray(q.topics) && q.topics.includes(topic));
/* the topics a duel can be narrowed to, with their counts (a question in two topics counts in both), biggest first */
export function topicsOf(pack) {
  const n = new Map();
  for (const q of pack.questions) for (const t of q.topics || (q.topic ? [q.topic] : [])) n.set(t, (n.get(t) || 0) + 1);
  return [...n].map(([topic, count]) => ({ topic, count })).sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic));
}
