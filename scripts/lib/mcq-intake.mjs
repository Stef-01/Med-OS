/* lib/mcq-intake.mjs - students' submitted questions into the pool's pipeline (scripts/mcq-submissions.mjs).

   From the shared table mcq_submissions (supabase/migrations/0007_mcq.sql) when a project is named, and from files
   exported by the app (Your questions → Export file: { mcqSubmissions: 1, items: [...] }) or pasted. Each becomes an
   entry of data/mcq/submissions.json exactly as submitted: a submission is a "user" question, and anything else is
   refused, not relabelled; an id already there keeps its first text (a later copy that differs is reported, never
   merged in). fetch is passed in, so the tests run with no network. */
const TABLE = 'mcq_submissions';
const headers = key => ({ apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' });

export async function remoteSubmissions(project, fetch) {
  const r = await fetch(`${project.url}/rest/v1/${TABLE}?select=id,item,submitted_by,created_at&order=created_at.asc`, { headers: headers(project.key) });
  if (!r.ok) throw new Error(`${TABLE}: ${r.status}`);
  return (await r.json()).map(x => x?.item).filter(Boolean);
}

/* the submissions in a file's text: an export, a list, or one question */
export function submissionsFrom(text) {
  let j; try { j = JSON.parse(String(text ?? '')); } catch { return []; }
  const list = Array.isArray(j) ? j : Array.isArray(j?.items) ? j.items : j && typeof j === 'object' ? [j] : [];
  return list.map(x => (x && x.item && !x.stem ? x.item : x)).filter(x => x && typeof x === 'object');
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/* existing (the file's items) + incoming -> { items, added[], conflicts[], refused[] } */
export function mergeSubmissions(existing, incoming) {
  const by = new Map((existing || []).map(q => [q.id, q])), added = [], conflicts = [], refused = [];
  for (const q of incoming || []) {
    const id = typeof q?.id === 'string' ? q.id : '';
    if (!/^u-[a-z0-9]{6,24}$/.test(id)) { refused.push(`${id || '(no id)'}: not a submission id (u-…)`); continue; }
    if (q.provenance?.kind !== 'user') { refused.push(`${id}: a submission must be a user question (kind "${q.provenance?.kind || 'none'}")`); continue; }
    if (!by.has(id)) { by.set(id, q); added.push(id); continue; }
    if (!same(by.get(id), q)) conflicts.push(`${id}: a different copy arrived; the first one is kept`);
  }
  return { items: [...by.values()].sort((a, b) => (a.id < b.id ? -1 : 1)), added, conflicts, refused };
}
