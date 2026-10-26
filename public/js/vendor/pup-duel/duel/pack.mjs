/* pack.mjs: a question pack, the one shape every host writes (Med-OS builds it from its stations).
   pack     { version, title, source, origin: 'ai' | 'human' | 'mixed', cats?[{ id, label }], questions[] }
   question { id, stem, options[2..6], answer (index), why?, notes?[one per option, or null], topic?, topics?[], cat?, origin? }
   topic is the first layer a player narrows by (Med-OS: the specialty), cat the second (Med-OS: OSCE skills, Clinical,
   Physiology and pathophysiology, Anatomy), its label and order from the pack's cats. A question can sit in more than one
   topic (topics, up to 6: a station that is Emergency Medicine and Paediatrics is found under both); topic is its first.
   Plain text throughout: the duel renders with textContent, so a pack can never inject markup. */

export const LIMITS = { stem: 1200, option: 160, why: 1200, note: 600, topic: 60, cat: 30, cats: 12, id: 80, minOptions: 2, maxOptions: 6 };

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
  const why = text(q.why, LIMITS.why); if (why) out.why = why;
  if (Array.isArray(q.notes) && q.notes.length === options.length) out.notes = q.notes.map(n => text(n, LIMITS.note) || null);
  const topic = text(q.topic, LIMITS.topic); if (topic) out.topic = topic;
  const topics = [...new Set((Array.isArray(q.topics) ? q.topics : []).map(t => text(t, LIMITS.topic)).filter(Boolean))].slice(0, 6);
  if (topics.length) { out.topics = topic && !topics.includes(topic) ? [topic, ...topics].slice(0, 6) : topics; if (!out.topic) out.topic = out.topics[0]; }
  const cat = text(q.cat, LIMITS.cat); if (cat) out.cat = cat;
  if (q.origin === 'ai' || q.origin === 'human') out.origin = q.origin;
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
  return { pack: { version: text(String(src.version ?? ''), 40), title: text(src.title, 80) || 'Questions', source: text(src.source, 200), origin, cats, questions }, dropped };
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

/* is a question in a topic (its first, or any of its topics) */
export const inTopic = (q, topic) => q.topic === topic || (Array.isArray(q.topics) && q.topics.includes(topic));
/* the topics a duel can be narrowed to, with their counts (a question in two topics counts in both), biggest first */
export function topicsOf(pack) {
  const n = new Map();
  for (const q of pack.questions) for (const t of q.topics || (q.topic ? [q.topic] : [])) n.set(t, (n.get(t) || 0) + 1);
  return [...n].map(([topic, count]) => ({ topic, count })).sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic));
}
