/* pack.mjs: a question pack, the one shape every host writes (Med-OS builds it from its stations).
   pack     { version, title, source, origin: 'ai' | 'human' | 'mixed', questions[] }
   question { id, stem, options[2..6], answer (index), why?, notes?[one per option, or null], topic?, origin? }
   Plain text throughout: the duel renders with textContent, so a pack can never inject markup. */

export const LIMITS = { stem: 1200, option: 160, why: 1200, note: 600, topic: 60, id: 80, minOptions: 2, maxOptions: 6 };

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
  return { pack: { version: text(String(src.version ?? ''), 40), title: text(src.title, 80) || 'Questions', source: text(src.source, 200), origin, questions }, dropped };
}

/* the topics a duel can be narrowed to, with their counts, biggest first */
export function topicsOf(pack) {
  const n = new Map();
  for (const q of pack.questions) if (q.topic) n.set(q.topic, (n.get(q.topic) || 0) + 1);
  return [...n].map(([topic, count]) => ({ topic, count })).sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic));
}
