/* requests-store.mjs - where the case writer's pipeline finds case requests and writes their answers.

   Two places, read together:
   - the shared record: the rows osce_state holds as osce / req/<id>, when a Supabase project is named (the environment's
     OSCE_SUPABASE_URL and OSCE_SUPABASE_KEY, else public/config.js). The app syncs them both ways, so an answer written
     here (being written, ready, not made, a note) shows on the student's phone.
   - the inbox: requests/<id>.json, requests pasted or saved from the app when there is no shared database (gitignored:
     it is the writer's queue, not the bank). The student learns a request is ready from the bank itself, once the station
     that carries its id is published.
   fetch is passed in, so the tests run with no network. */
import fs from 'node:fs';
import path from 'node:path';
import { cleanRequest, newerRequest } from '../../public/js/osce/requests.mjs';

const TABLE = 'osce_state', NS = 'osce';

/* the project from config.js's text: { url, key }, or null when it names none */
export function readConfig(text) {
  const get = k => (String(text || '').match(new RegExp(`${k}\\s*:\\s*['"]([^'"]*)['"]`)) || [])[1] || '';
  const url = get('supabaseUrl').replace(/\/+$/, ''), key = get('supabaseAnonKey');
  return url && key ? { url, key } : null;
}
/* the environment first (a writer's machine can point at the project without editing the site), then config.js */
export function projectFrom(env, configText) {
  if (env?.OSCE_SUPABASE_URL === 'none') return null;   // the inbox alone (tests, a writer offline)
  const url = String(env?.OSCE_SUPABASE_URL || '').replace(/\/+$/, ''), key = String(env?.OSCE_SUPABASE_KEY || '');
  return url && key ? { url, key } : readConfig(configText);
}

const headers = key => ({ apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' });
/* every request in the shared record (a withdrawn one is a removed shard, value null, and is left out) */
export async function remoteRequests(project, fetch) {
  const r = await fetch(`${project.url}/rest/v1/${TABLE}?ns=eq.${NS}&id=like.req/*&select=id,value,updated_at`, { headers: headers(project.key) });
  if (!r.ok) throw new Error(`${TABLE}: ${r.status}`);
  return (await r.json()).filter(x => x && String(x.id).startsWith('req/') && x.value).map(x => cleanRequest(x.value)).filter(Boolean);
}
/* one request back into the shared record, stamped now so it wins over the student's older copy */
export async function putRemote(project, req, fetch, now = Date.now()) {
  const r = await fetch(`${project.url}/rest/v1/${TABLE}?on_conflict=ns,id`, { method: 'POST', headers: { ...headers(project.key), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([{ ns: NS, id: `req/${req.id}`, value: req, updated_at: new Date(now).toISOString() }]) });
  if (!r.ok) throw new Error(`${TABLE}: ${r.status}`);
}

export function inboxRequests(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => /^r[a-z0-9]+\.json$/.test(f)).sort().map(f => {
    try { return cleanRequest(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))); } catch { return null; }
  }).filter(Boolean);
}
export function putInbox(dir, req) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${req.id}.json`), `${JSON.stringify(req, null, 1)}\n`);
}

/* both places as one queue: the newest copy of each request, and where it lives (shared, inbox or both) */
export function mergeQueues(remote, inbox) {
  const by = new Map();
  for (const [from, list] of [['shared', remote], ['inbox', inbox]]) for (const r of list || []) {
    const had = by.get(r.id);
    by.set(r.id, had ? { req: newerRequest(had.req, r), from: [...had.from, from] } : { req: r, from: [from] });
  }
  return [...by.values()].sort((a, b) => b.req.at - a.req.at);
}
/* an answer: the request with its new status, note and station, stamped */
export function answer(req, { status, reply, station }, now = Date.now()) {
  return cleanRequest({ ...req, status, ...(reply != null ? { reply } : {}), ...(station ? { station } : {}), updated: now });
}
