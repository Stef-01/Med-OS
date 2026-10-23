/* osce/requests.mjs - case requests: a student asks for a station the bank does not have, and the case writer turns it
   into a formal station with the pipeline (scripts/requests.mjs runs generate-station.mjs on the request's brief).

   A request lives in the shared record as mem.req[id], one sync shard each (req/<id>): with a Supabase project in
   config.js it reaches the writer, and the writer's status (being written, ready, not made) comes back the same way.
   With no project the student copies or shares it (requestText) and the writer pastes it into the pipeline
   (requestsFrom). A station made from a request carries { request: { id } }, and the index passes the id on, so the bank
   itself tells the requester it is ready (requestState). Pure: shared by the app and the pipeline, tested in
   scripts/requests.test.mjs. */
import { KINDS } from './core.mjs';

export const REQ_SETTINGS = Object.freeze({ any: 'Either', acute: 'Acute: ED or ward', clinic: 'Clinic: GP or outpatients' });
export const REQ_PATIENTS = Object.freeze({ newborn: 'Newborn', child: 'Child', adolescent: 'Adolescent', adult: 'Adult', pregnant: 'Pregnant', older: 'Older adult' });
export const REQ_FOCUS = Object.freeze(['History', 'Examination', 'Interpretation', 'Management', 'Counselling', 'Prescribing', 'Procedure']);   /* the station types a request can ask for */
export const REQ_RESULTS = Object.freeze(['obs', 'bloods', 'gas', 'ecg', 'xray', 'ct', 'us', 'mri', 'ctg', 'micro', 'urine']);   /* the Part 2 result kinds a student can ask to interpret */
export const REQ_STATUS = Object.freeze({ new: 'Requested', accepted: 'Being written', made: 'Ready', declined: 'Not made' });
export const REQ_MAX = Object.freeze({ topic: 200, notes: 1000, reply: 500, by: 40, specialty: 60 });
const ID = /^r[a-z0-9]{6,24}$/, STATION = /^[\w-]{1,64}$/;

const line = (v, n) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : '');
const text = (v, n) => (typeof v === 'string' ? v.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, n) : '');
const pick = (v, ok) => [...new Set((Array.isArray(v) ? v : []).filter(x => ok.includes(x)))];

/* a request id: the time and four random characters, "r" first */
export const newRequestId = (now, rnd = Math.random) => `r${Math.floor(now).toString(36)}${Math.floor(rnd() * 36 ** 4).toString(36).padStart(4, '0')}`;

/* a request as stored and sent, or null: id, topic (3+ characters) and the time asked are required; anything unknown drops */
export function cleanRequest(r) {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return null;
  const id = typeof r.id === 'string' ? r.id : '', topic = line(r.topic, REQ_MAX.topic), at = Math.floor(+r.at);
  if (!ID.test(id) || topic.length < 3 || !(at > 0)) return null;
  const x = { id, topic, setting: Object.hasOwn(REQ_SETTINGS, r.setting) ? r.setting : 'any', at, status: Object.hasOwn(REQ_STATUS, r.status) ? r.status : 'new' };
  const specialty = line(r.specialty, REQ_MAX.specialty); if (specialty) x.specialty = specialty;
  if (Object.hasOwn(REQ_PATIENTS, r.patient)) x.patient = r.patient;
  const focus = pick(r.focus, REQ_FOCUS); if (focus.length) x.focus = focus;
  const results = pick(r.results, REQ_RESULTS); if (results.length) x.results = results;
  const notes = text(r.notes, REQ_MAX.notes); if (notes) x.notes = notes;
  const by = line(r.by, REQ_MAX.by); if (by) x.by = by;
  const reply = text(r.reply, REQ_MAX.reply); if (reply) x.reply = reply;
  if (typeof r.station === 'string' && STATION.test(r.station)) x.station = r.station;
  if (+r.updated > 0) x.updated = Math.floor(+r.updated);
  return x;
}
/* the newer of two copies of one request (the writer's status over the student's original) */
export const newerRequest = (a, b) => ((b?.updated || b?.at || 0) > (a?.updated || a?.at || 0) ? b : a);

/* what the generator is given: the topic, an acute station or not, the specialty and station types, and notes that carry
   the rest (the patient, the setting, the Part 2 results to include, the student's own words) */
export function requestBrief(r) {
  const c = cleanRequest(r); if (!c) return null;
  const notes = [
    c.patient && `Patient: ${REQ_PATIENTS[c.patient].toLowerCase()}.`,
    c.setting === 'clinic' && 'Setting: a clinic (GP or outpatients).',
    c.results && `Part 2 results to include: ${c.results.map(k => KINDS[k]).join(', ')}.`,
    c.notes && `From the student who asked for it: ${c.notes.replace(/\s*\n\s*/g, ' ')}`,
  ].filter(Boolean).join(' ');
  return { topic: c.topic, acute: c.setting === 'acute', specialty: c.specialty ? [c.specialty] : [], types: c.focus || [], notes };
}
/* the same brief as generate-station.mjs arguments, ending with the request it answers */
export function requestArgs(r) {
  const b = requestBrief(r); if (!b) return null;
  return [b.topic, ...(b.acute ? ['--acute'] : []), ...(b.specialty.length ? ['--specialty', b.specialty.join(', ')] : []),
    ...(b.types.length ? ['--type', b.types.join(', ')] : []), ...(b.notes ? ['--notes', b.notes] : []), '--request', r.id];
}

/* a request as a message the student can send when there is no shared database: readable lines, then the request itself
   on one line that requestsFrom finds again */
export function requestText(r) {
  const c = cleanRequest(r); if (!c) return '';
  const meta = [REQ_SETTINGS[c.setting], c.specialty, c.patient && REQ_PATIENTS[c.patient]].filter(Boolean).join(' · ');
  return [`OSCE case request · ${c.id}`, `Case: ${c.topic}`, meta,
    c.focus && `Focus: ${c.focus.join(', ')}`, c.results && `Part 2 results: ${c.results.map(k => KINDS[k]).join(', ')}`,
    c.notes && `Notes: ${c.notes}`, `From ${c.by || 'a student'}, ${new Date(c.at).toISOString().slice(0, 10)}`,
    '', JSON.stringify({ osceRequest: 1, ...c })].filter(x => x !== false && x != null).join('\n');
}
/* every request in what was pasted or saved: request messages (one or many), a request or a list of them as JSON, or an
   exported progress file (its req map); the newest copy of each id */
export function requestsFrom(input) {
  const s = String(input ?? ''), found = [];
  let j; try { j = JSON.parse(s); } catch { j = undefined; }
  if (j !== undefined) found.push(...(Array.isArray(j) ? j : j && typeof j === 'object' && j.req && typeof j.req === 'object' && !Array.isArray(j.req) ? Object.values(j.req) : [j]));
  else for (const l of s.split('\n').map(x => x.trim()).filter(x => x.startsWith('{"osceRequest"'))) { try { found.push(JSON.parse(l)); } catch { /* a line cut short in the paste */ } }
  const by = new Map();
  for (const r of found.map(cleanRequest).filter(Boolean)) by.set(r.id, by.has(r.id) ? newerRequest(by.get(r.id), r) : r);
  return [...by.values()];
}

/* where a request stands: a station in the bank made from it says Ready whatever was stored (the bank reaches every
   device, with or without a shared database); otherwise the stored status and station */
export function requestState(r, rows) {
  const rid = x => (x && typeof x.request === 'object' ? x.request?.id : x?.request);   /* an index row holds the id; a loaded body, { id, at } */
  const st = (Array.isArray(rows) ? rows : []).find(x => x && rid(x) === r.id);
  return st ? { status: 'made', station: String(st.id) } : { status: r.status || 'new', station: r.station || '' };
}
