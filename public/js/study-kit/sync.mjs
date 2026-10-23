/* study-kit/sync.mjs - every practice record on both of your devices, when a Supabase project is set in config.js.

   With no project set this module does nothing and everything stays in this browser (localStorage). With one set, the
   OSCE record (localStorage osce.practice.v1) is shared through one table, osce_state (supabase/migrations/0001): a row
   per shard id, value jsonb, updated_at. Both of you see the same attempts, saved stations and partner names.

   A SHARD is the unit of merge, chosen so two devices rarely touch the same one: one station's history (`hist/<station>`),
   one saved station (`bm/<station>`), or one small settings object (`k/timing`, `k/people`). SPEC says how the record
   splits: `perId` keys shard per sub-key, `whole` keys are one shard each, everything else (the running session, the
   filters, Fast Run's picks) stays on the device, so two of you can run different sessions at the same time. Merge is
   last-write-wins per shard by updated_at; a shard removed on a device is written as value null so the deletion travels.

   Flow: the OSCE module calls changed(ns) after its own save(); the shards that differ from the last synced copy are
   stamped now and queued (one upsert per 400 ms, retried on the next trigger if it fails). pull(ns) reads the namespace,
   applies every remote shard newer than this device's stamp into the live record (the module's `mem` when open, else the
   localStorage blob), then pushes what this device is ahead on. Triggers: opening OSCE, 'online', the tab becoming
   visible, and every write. Nothing here waits on the network; a failed call sets state.unsynced and the next trigger
   retries. */
import { lsGet, lsSet, lsGetRaw, lsSetRaw } from './store.mjs';

export const TABLE = 'osce_state';
const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);
const STAMPS = 'osce.sync.v1';          /* { ns: { shardId: updated_at } } — what this device last agreed with the server on */
export const SPEC = {
  osce: { ls: 'osce.practice.v1', perId: ['hist', 'bm'], whole: ['timing', 'people'], derive: osceAtt },
};
/* the start view's count reads mem.att (one key per attempted station); osce/state.mjs rebuilds it with scores on every
   save(), but a pull with the module closed must rebuild the keys itself or the other device's attempts stay invisible
   until OSCE opens. Scores already there are kept; a station new to this device gets its time. */
function osceAtt(mem) {
  const m = obj(mem); if (!m) return;
  const att = {}, hist = obj(m.hist) || {};
  for (const [id, list] of Object.entries(hist)) {
    const fin = (Array.isArray(list) ? list : []).filter(a => a && a.fin);
    if (fin.length) att[id] = { ...(obj(m.att) || {})[id], at: fin[fin.length - 1].fin };
  }
  m.att = att;
}
export const state = { unsynced: false, lastSync: 0 };   /* for the Settings dialog's one line */
const D = {};                                             /* { sbUrl, sbKey } */
const live = {};                                          /* ns -> { mem, onRemote } while a module is open */
const last = {};                                          /* ns -> { shardId: JSON string } the server agreed on (this page load) */
let queue = {}, flushT = 0, pulling = null;

export function configureSync(deps) { if (deps && deps.sbUrl) { D.sbUrl = deps.sbUrl; D.sbKey = deps.sbKey; } }
export const enabled = () => !!D.sbUrl;

/* ---------- pure: a record <-> its shards (tested in scripts/sync.test.js) ---------- */
export function shardsOf(spec, mem) {
  const out = {}, m = obj(mem) || {};
  if (spec.raw) { for (const [k, lsKey] of Object.entries(spec.raw)) { const v = m[k]; if (v != null && v !== '') out[`raw/${k}`] = v; } return out; }
  for (const k of spec.perId || []) for (const [id, v] of Object.entries(obj(m[k]) || {})) if (v !== undefined) out[`${k}/${id}`] = v;
  for (const [k, idKey] of Object.entries(spec.byId || {})) for (const el of Array.isArray(m[k]) ? m[k] : []) if (obj(el) && el[idKey] != null) out[`${k}/${el[idKey]}`] = el;
  for (const k of spec.whole || []) if (m[k] !== undefined && m[k] !== null) out[`k/${k}`] = m[k];
  return out;
}
/* put one shard (or its tombstone) into the record; returns the record */
export function applyShard(spec, mem, sid, value) {
  const m = obj(mem) || {}, i = sid.indexOf('/'), k = sid.slice(0, i), id = sid.slice(i + 1);
  if (i < 0) return m;
  if (k === 'raw') { if (value == null) delete m[id]; else m[id] = value; return m; }
  if ((spec.perId || []).includes(k)) { const o = (m[k] = obj(m[k]) || {}); if (value == null) delete o[id]; else o[id] = value; return m; }
  if (spec.byId && spec.byId[k]) {
    const idKey = spec.byId[k], arr = Array.isArray(m[k]) ? m[k] : (m[k] = []), at = arr.findIndex(e => obj(e) && String(e[idKey]) === id);
    if (value == null) { if (at >= 0) arr.splice(at, 1); } else if (at >= 0) arr[at] = value; else arr.push(value);
    return m;
  }
  if (k === 'k' && (spec.whole || []).includes(id)) { if (value == null) delete m[id]; else m[id] = value; }
  return m;
}
/* which shards changed since the server copy; `prev` = { sid: JSON } */
export function diffShards(prev, shards) {
  const out = [];
  for (const [sid, v] of Object.entries(shards)) { const j = JSON.stringify(v); if (prev[sid] !== j) out.push({ id: sid, value: v, json: j }); }
  for (const sid of Object.keys(prev)) if (!(sid in shards)) out.push({ id: sid, value: null, json: 'null' });
  return out;
}
/* merge decision per shard: remote wins when strictly newer than this device's stamp (none = 0) */
export const newer = (remoteAt, localAt) => (Date.parse(remoteAt) || 0) > (Date.parse(localAt) || 0);

/* ---------- the device record behind a namespace ---------- */
function readRecord(ns) {
  const sp = SPEC[ns];
  if (live[ns]) return live[ns].mem;
  if (sp.raw) { const o = {}; for (const [k, lsKey] of Object.entries(sp.raw)) { const v = lsGetRaw(lsKey, ''); if (v) o[k] = v; } return o; }
  return lsGet(sp.ls, {}) || {};
}
function writeRecord(ns, mem) {
  const sp = SPEC[ns];
  if (sp.raw) { for (const [k, lsKey] of Object.entries(sp.raw)) lsSetRaw(lsKey, mem[k] || null); return; }
  lsSet(sp.ls, mem);   /* the live module's mem is this same object: the device copy follows at once, repaint or not */
}
const stamps = () => lsGet(STAMPS, {}) || {};
const setStamps = s => { lsSet(STAMPS, s); };

/* a module announces its open record (and how to repaint after a remote merge); null on close */
export function attach(ns, mem, onRemote) { if (mem) live[ns] = { mem, onRemote }; else delete live[ns]; }

/* ---------- push ---------- */
async function rest(path, init) {
  const r = await fetch(`${D.sbUrl}/rest/v1/${path}`, { ...init, headers: { apikey: D.sbKey, Authorization: `Bearer ${D.sbKey}`, 'Content-Type': 'application/json', ...(init.headers || {}) } });
  if (!r.ok) throw new Error(`${TABLE} ${r.status}`);
  return r;
}
const upsert = rows => rest(`${TABLE}?on_conflict=ns,id`, { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
  body: JSON.stringify(rows.map(r => ({ ns: r.ns, id: r.id, value: r.value, updated_at: r.updated_at }))) });

/* after a module's save(): stamp what changed, queue it. Returns the number of changed shards (tests, and nothing else). */
export function changed(ns) {
  const sp = SPEC[ns]; if (!sp) return 0;
  const shards = shardsOf(sp, readRecord(ns)), prev = (last[ns] ||= seed(ns, shards));
  const d = diffShards(prev, shards); if (!d.length) return 0;
  const st = stamps(), s = (st[ns] ||= {}), at = new Date().toISOString();
  for (const x of d) { prev[x.id] = x.json; if (x.value == null) delete prev[x.id]; s[x.id] = at; queue[`${ns}\n${x.id}`] = { ns, id: x.id, value: x.value, updated_at: at }; }
  setStamps(st);
  schedule();
  return d.length;
}
/* first sight of a namespace this page load: the shards the server already agreed on are "last"; the rest are new and go up */
function seed(ns, shards) {
  const s = stamps()[ns] || {}, prev = {};
  for (const sid of Object.keys(shards)) if (s[sid]) prev[sid] = JSON.stringify(shards[sid]);
  return prev;
}
function schedule() { if (!enabled()) return; clearTimeout(flushT); flushT = setTimeout(flush, 400); }
export async function flush() {
  clearTimeout(flushT); flushT = 0;
  const rows = Object.values(queue); if (!rows.length || !enabled()) return;
  queue = {};
  try { await upsert(rows); state.unsynced = false; }
  catch { for (const r of rows) queue[`${r.ns}\n${r.id}`] ||= r; state.unsynced = true; }   /* back in the queue; the next trigger retries */
}

/* ---------- pull ---------- */
export function pull(ns, signal) {
  if (!enabled() || !SPEC[ns]) return Promise.resolve(0);
  return (async () => {
    const r = await rest(`${TABLE}?ns=eq.${ns}&select=id,value,updated_at`, { method: 'GET', signal });
    const rows = await r.json(), st = stamps(), s = (st[ns] ||= {}), prev = (last[ns] ||= seed(ns, shardsOf(SPEC[ns], readRecord(ns))));
    const mem = readRecord(ns); let n = 0;
    for (const row of Array.isArray(rows) ? rows : []) {
      if (!row || typeof row.id !== 'string' || row.id.length > 200) continue;
      if (!newer(row.updated_at, s[row.id])) continue;
      applyShard(SPEC[ns], mem, row.id, row.value);
      if (row.value == null) delete prev[row.id]; else prev[row.id] = JSON.stringify(row.value);
      s[row.id] = row.updated_at; n++;
    }
    setStamps(st);
    if (n) { if (SPEC[ns].derive) SPEC[ns].derive(mem); writeRecord(ns, mem); if (live[ns] && live[ns].onRemote) { try { live[ns].onRemote(n); } catch {} } }
    changed(ns);                   /* what this device is ahead on goes up now */
    await flush();
    state.lastSync = Date.now();
    return n;
  })().catch(() => { state.unsynced = true; return 0; });
}
export function pullAll(signal) {
  return pulling || (pulling = Promise.all(Object.keys(SPEC).map(ns => pull(ns, signal))).finally(() => { pulling = null; }));
}

/* 'online' and a visible tab: pull everything, push the queue. Installed once. */
let wired = false;
export function wire() {
  if (wired || typeof window === 'undefined') return; wired = true;
  window.addEventListener('online', () => { pullAll(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pullAll(); else flush(); });
  window.addEventListener('pagehide', () => { flush(); });
}
