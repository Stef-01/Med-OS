/* lib/mcq-sources.mjs - every candidate for the MCQ pool, as questions in public/js/mcq/schema.mjs's shape, each with
   the provenance its writer gives it (and never another):

     stations     one per station, made in code from the station's own differential (lib/duel-pack.mjs stationQuestion,
                  the duel's questions until now): kind "amsa" for an AMSA MedEd station, "ai" for an AI-written one;
                  generator { how: "duel-pack", basis: [station] }. The key's position is spread by the id's hash (the
                  duel-pack writer always put it first).
     generated    data/mcq/generated.json (scripts/generate-mcq.mjs): kind "ai", with the stations and exemplars used
     benchmarks   data/benchmarks/*.jsonl, the MIT-licensed open USMLE-style banks: kind "usmle-resource", the bank's
                  own name, url and licence on every item
     submissions  data/mcq/submissions.json (scripts/mcq-submissions.mjs): kind "user", exactly as submitted
   Pure functions plus small readers. */
import fs from 'node:fs';
import path from 'node:path';
import { stationQuestion } from './duel-pack.mjs';
import { cleanItem, fnv, KINDS } from '../../public/js/mcq/schema.mjs';

/* the key moved to position (hash of id mod n), the per-option notes moved with it */
export function spreadKey(q) {
  const n = q.options.length, to = parseInt(fnv(q.id), 16) % n;
  if (to === q.answer) return q;
  const order = q.options.map((_, i) => i); order.splice(q.answer, 1); order.splice(to, 0, q.answer);
  return { ...q, options: order.map(i => q.options[i]), why: order.map(i => (q.why || [])[i] ?? null), answer: to };
}

export function stationItem(st, pool = []) {
  const { q, why } = stationQuestion(st, pool);
  if (!q) return { item: null, why };
  const m = q.stem.match(/^(.*?)\s*(What is the most likely diagnosis\?)$/);
  const amsa = String(st.id).startsWith('amsa-') && st.source && typeof st.source === 'object';
  const item = spreadKey({
    id: q.id, stem: m ? m[1] : q.stem, ...(m ? { ask: m[2] } : {}), options: q.options, answer: q.answer,
    explanation: q.why || '', why: q.notes, topic: q.topic || '', tags: ['station-derived', 'diagnosis', `station:${st.id}`],
    provenance: {
      kind: amsa ? 'amsa' : 'ai',
      source: amsa ? { name: `AMSA MedEd OSCEs: ${st.source.title || st.source.file || st.id}`, url: st.source.url || '', licence: 'own', retrieved: String(st.generatedAt || '').slice(0, 10) }
        : { name: `Med-OS station ${st.id} (AI-written)`, url: '', licence: 'own' },
      createdAt: st.generatedAt || '2026-10-01T00:00:00Z',
      generator: { how: 'duel-pack', version: 'duel-pack-1', basis: [st.id] }
    }
  });
  const clean = cleanItem(item);
  return clean ? { item: clean, why: '' } : { item: null, why: `${st.id}: not a valid question` };
}
export function stationItems(stations) {
  const list = [...stations].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)), items = [], dropped = [];
  for (const st of list) { const { item, why } = stationItem(st, list); if (item) items.push(item); else dropped.push(why); }
  return { items, dropped };
}

/* a normalised benchmark row (research/mcq-src/<set>/normalised.jsonl, or data/benchmarks/) as a usmle-resource item */
export const BENCH_TAG = { medqa: 'src:medqa', mmlu: 'src:mmlu', medmcqa: 'src:medmcqa' };
export function benchmarkItem(r) {
  const set = /^medqa/.test(r.id) ? 'medqa' : /^mmlu/.test(r.id) ? 'mmlu' : /^medmcqa/.test(r.id) ? 'medmcqa' : 'bench';
  return cleanItem({
    id: r.id, stem: r.stem, options: r.options, answer: r.answer, explanation: r.explanation || '', why: [], topic: '',
    tags: [BENCH_TAG[set] || 'src:bench', r.meta_info ? `exam:${r.meta_info}` : `exam:${set}`],
    provenance: { kind: 'usmle-resource', source: { name: r.source?.name || set, url: r.source?.url || '', licence: r.source?.licence || '', retrieved: r.source?.retrieved || '' }, createdAt: r.source?.retrieved || '2026-10-25' }
  });
}
/* the same row as a benchmark-only item (the official NBME samples, the GPT-4 look-alikes): kept in memory, never written
   into the repo. Its real source (copyright FSMB/NBME) is one the pool refuses, so in memory it carries a stand-in */
export const benchOnlyItem = r => benchmarkItem({ ...r, source: { name: 'benchmark-only item (not shipped)', url: '', licence: 'MIT', retrieved: r.source?.retrieved || '' } });

export const readJsonl = f => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(l => l.trim()).map(l => JSON.parse(l)) : []);
export const readJson = (f, d) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : d);

/* every candidate on disk: { items, dropped }. root is the repo root */
export function allCandidates(root, { stations } = {}) {
  const pub = path.join(root, 'public'), dropped = [], items = [];
  const st = stations || fs.readdirSync(path.join(pub, 'osce')).filter(f => f.endsWith('.json') && f !== 'index.json').map(f => JSON.parse(fs.readFileSync(path.join(pub, 'osce', f), 'utf8')));
  const s = stationItems(st); items.push(...s.items); dropped.push(...s.dropped);
  for (const q of readJson(path.join(root, 'data', 'mcq', 'generated.json'), { items: [] }).items || []) { const c = cleanItem(q); if (c && c.provenance.kind === 'ai') items.push(c); else dropped.push(`${q?.id}: generated item not valid`); }
  const bdir = path.join(root, 'data', 'benchmarks');
  for (const f of fs.existsSync(bdir) ? fs.readdirSync(bdir).filter(x => x.endsWith('.jsonl')).sort() : []) for (const r of readJsonl(path.join(bdir, f))) { const c = benchmarkItem(r); if (c) items.push(c); else dropped.push(`${r.id}: benchmark row not valid`); }
  for (const q of readJson(path.join(root, 'data', 'mcq', 'submissions.json'), { items: [] }).items || []) items.push(q);   /* checked by the selector, so a bad one gets its reasons */
  const seen = new Set();
  return { items: items.filter(q => (q && !seen.has(q.id) ? seen.add(q.id) : false)), dropped };
}
export const kinds = Object.keys(KINDS);
