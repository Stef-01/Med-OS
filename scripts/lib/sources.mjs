/* lib/sources.mjs - pure: open MCQ sources and how one becomes pool candidates. data/sources/registry.json lists every
   source considered, with its licence read at its source and a verdict; an "import" source names an adapter here that
   turns its download into normalised rows (the shape data/benchmarks/*.jsonl holds and lib/mcq-sources.mjs reads):
     { id, stem, options, answer, explanation, topic, exam, source: { name, url, licence, retrieved } }
   scripts/fetch-sources.mjs downloads, adapts and writes them; from there every row is a candidate like any other and
   faces the flaw checks, the model review and the bar. Nothing here rewrites a question's text: a source whose terms
   forbid changing the meaning (HEAD-QA) arrives as published. */

export const VERDICTS = Object.freeze(['import', 'in-app', 'benchmark-only', 'reject']);

/* what is wrong with the registry: [] when every source is described well enough to act on */
export function registryProblems(reg) {
  const out = [], seen = new Set();
  for (const s of reg?.sources || []) {
    const at = s?.id || '?';
    if (!/^[a-z0-9-]{3,40}$/.test(s?.id || '')) out.push(`${at}: id`);
    if (seen.has(s?.id)) out.push(`${at}: repeated`); seen.add(s?.id);
    for (const k of ['name', 'licence', 'verdict', 'why']) if (!String(s?.[k] ?? '').trim()) out.push(`${at}: no ${k}`);
    if (!VERDICTS.includes(s?.verdict)) out.push(`${at}: verdict ${s?.verdict}`);
    if (typeof s?.coversContent !== 'boolean') out.push(`${at}: say whether the licence covers the questions (coversContent)`);
    if (s?.verdict === 'import') {
      if (!ADAPTERS[s.adapter]) out.push(`${at}: an import needs an adapter (${Object.keys(ADAPTERS).join(', ')})`);
      if (!/^https:\/\//.test(s.url || '')) out.push(`${at}: an import needs an https url`);
      if (!s.credit) out.push(`${at}: an import carries the credit its terms ask for`);
      if (!s.kind) out.push(`${at}: an import says its pool kind`);
    }
  }
  return out;
}

const text = v => String(v ?? '').replace(/\s+/g, ' ').trim();
/* HEAD-QA's JSON: { exams: { Cuaderno_<year>_1_<cat>: { name, category, year, data: [{ qid, qtext, ra, answers: [{ aid, atext }], image }] } } }.
   keep: { category, years, noImage }. The exam's own letters become 0-based answers; ids are headqa-<year>-<qid> */
function headqa(json, { keep = {}, source, retrieved }) {
  const rows = [], dropped = [];
  for (const [key, e] of Object.entries(json?.exams || {})) {
    const year = Number(e.year ?? (key.match(/_(\d{4})_/) || [])[1]), cat = String(e.category ?? (/_M$/.test(key) ? 'medicine' : '')).toLowerCase();
    if (keep.category && cat !== keep.category) continue;
    if (keep.years && !keep.years.includes(year)) continue;
    for (const q of e.data || []) {
      const id = `headqa-${year}-${q.qid}`;
      if (keep.noImage && String(q.image || '').trim()) { dropped.push(`${id}: needs its image`); continue; }
      const opts = (q.answers || []).slice().sort((a, b) => a.aid - b.aid), answer = opts.findIndex(a => String(a.aid) === String(q.ra));
      if (answer < 0 || opts.length < 4) { dropped.push(`${id}: no key or too few options`); continue; }
      rows.push({ id, stem: text(q.qtext), options: opts.map(a => text(a.atext)), answer, explanation: '', topic: '', exam: `MIR ${year}`,
        source: { name: source.credit, url: source.url, licence: source.licence, retrieved } });
    }
  }
  return { rows, dropped };
}
export const ADAPTERS = Object.freeze({ headqa });
export const adapt = (source, raw, retrieved) => ADAPTERS[source.adapter](raw, { keep: source.keep || {}, source, retrieved });
