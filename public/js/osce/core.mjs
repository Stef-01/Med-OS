/* osce/core.mjs — OSCE Practice's pure laws (plan unit F3, 2026-10-19; from osce.mjs): the browse filter, the checklist
   score, the reading/station clock, the save migration, Add Random, the Fast Run rotations and pool, the station gate
   and the split bank's index rows and bodies. No DOM, no storage, no clock of its own (every law that needs the time
   takes `now`): scripts/osce-core.test.js imports this file alone; osce.mjs re-exports every name for learn.mjs and the
   older tests. The imports are the kit's vocabulary (SOURCES: em | ai) and the observation-chart laws (obs.mjs, pure). */
import { SOURCES, DISCIPLINES, disciplineOf } from '../study-kit/vocab.mjs';
import { cleanDemo, cleanObs } from './obs.mjs';
import { cleanLabs } from './labs.mjs';

export const CX = ['Low', 'Moderate', 'High'];

/* the stations a search + filters leave, in list order.
   f: { status: null|'0'|'1', cx: [], type: [], saved: bool, spec: '' }; att: {id: truthy} attempted; bm: {id: truthy} saved */
export function osceFilter(list, query, f = {}, att = {}, bm = {}) {
  const words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  const types = [].concat(f.type || []).filter(Boolean), cxs = [].concat(f.cx || []).filter(Boolean);
  const status = f.status === 'done' ? '1' : f.status === 'new' ? '0' : f.status;
  return list.filter(s => {
    if (f.spec && !(s.specialty || []).includes(f.spec)) return false;
    if ((f.rot || []).length && !(s.specialty || []).some(x => f.rot.includes(osceRotation(x)))) return false;
    if ((f.origin || []).length && !f.origin.includes(osceOrigin(s))) return false;
    if (types.length && !types.some(t => (s.type || []).includes(t))) return false;
    if (cxs.length && !cxs.includes(s.complexity)) return false;
    if (status === '1' && !att[s.id]) return false;
    if (status === '0' && att[s.id]) return false;
    if (f.saved && !bm[s.id]) return false;
    if (!words.length) return true;
    const hay = [s.title, s.desc, ...(s.specialty || []), ...(s.type || []), ...(s.presentation || []), ...(s.diagnosis || []), ...(s.context || [])].join(' ').toLowerCase();
    return words.every(w => hay.includes(w));
  });
}
/* the tick keys of a checklist's leaves: a checkbox with kids counts through its kids ('parent.kid'), else itself
   (StationMarkingSheet.vue: a parent is checked when all its subitems are) */
export function osceLeaves(check) {
  const out = [];
  for (const i of check || []) {
    if (i.t !== 'checkbox') continue;
    const kids = (i.kids || []).filter(k => k.t === 'checkbox' || !k.t);
    if (kids.length) kids.forEach(k => out.push({ key: `${i.id}.${k.id}`, crit: !!(k.crit || i.crit) }));
    else out.push({ key: String(i.id), crit: !!i.crit });
  }
  return out;
}
/* ticked leaves over all leaves, plus critical items missed */
export function osceScore(check, ticks) {
  const leaves = osceLeaves(check), on = new Set((ticks || []).map(String));
  return { got: leaves.filter(l => on.has(l.key)).length, of: leaves.length, critMissed: leaves.filter(l => l.crit && !on.has(l.key)).length };
}
/* the clock: reading, then Part 1 (history and examination), then Part 2 (the examiner hands over observations,
   investigations or scans; the candidate interprets them, gives a management approach and safety-nets). The timing keys
   are the phases: { reading, station (Part 1), mx (Part 2) } in minutes; mx 0 runs a station with no Part 2.
   A timer is { c: phase, left: seconds at the last resume/pause, at: resumedAt ms | null, done?: true when the last
   phase has run out }. */
export const PHASES = [['reading', 'Reading', 'Reading time', 'Read the instructions'], ['station', 'Part 1', 'Part 1: history and examination', 'History and examination'],
  ['mx', 'Part 2', 'Part 2: interpretation, management and safety netting', 'Interpretation, management and safety netting']];
export const phaseWhat = k => (PHASES.find(p => p[0] === k) || [])[3] || '';
export const DEFAULT_TIMING = Object.freeze({ reading: 5, station: 10, mx: 5 });
export const phasesOf = timing => PHASES.map(p => p[0]).filter(k => k === 'reading' || k === 'station' || (timing && timing[k] > 0));
export const phaseName = (k, long) => (PHASES.find(p => p[0] === k) || [k, k, k])[long ? 2 : 1];
export const nextPhase = (c, timing) => { const ps = phasesOf(timing), i = ps.indexOf(c); return i >= 0 && i < ps.length - 1 ? ps[i + 1] : null; };
export function osceLeft(t, now) {
  if (!t) return 0;
  return t.at != null ? t.left - Math.floor((now - t.at) / 1000) : t.left;
}
export const osceFinished = t => !!t && t.done === true;
export const osceStart = (timing, now) => ({ c: 'reading', left: timing.reading * 60, at: now });
export const oscePause = (t, now) => (t && t.at != null ? { ...t, left: osceLeft(t, now), at: null } : t);
export const osceResume = (t, now) => (t && t.at == null && !t.done ? { ...t, at: now } : t);
/* skip on: to the next phase at its full time, or from the last phase to finished */
export function osceNext(t, timing, now) {
  const nx = t && nextPhase(t.c, timing);
  return nx ? { c: nx, left: timing[nx] * 60, at: now } : { c: t?.c || 'station', left: 0, at: null, done: true };
}
/* advance a running timer whose phase has run out (a phase that ran out while away rolls into the next, from the moment
   it ended) */
export function osceTick(t, timing, now) {
  let x = t;
  while (x && x.at != null && osceLeft(x, now) <= 0) {
    const nx = nextPhase(x.c, timing), endAt = x.at + x.left * 1000;
    x = nx ? { c: nx, left: timing[nx] * 60, at: Math.min(endAt, now) } : { c: x.c, left: 0, at: null, done: true };
  }
  return x;
}
/* old saves ({att, ticks, mark}) → v2 ({v, bm, att, hist, timing, details, sess}); `now` stamps a v1 attempt that
   carried no time (the caller passes the clock: this law never reads one) */
export function osceMigrate(old, now) {
  const m = old && typeof old === 'object' ? { ...old } : {};
  if (m.v !== 2) {
    m.bm = { ...(m.mark || {}) };
    m.hist = {};
    for (const [id, a] of Object.entries(m.att || {})) {
      const at = +a?.at || now;
      m.hist[id] = [{ id: `m${id}`, sid: id, at, fin: at, ticks: (m.ticks || {})[id] || [], global: null, fb: '', notes: '' }];
    }
    delete m.mark; delete m.ticks;
    m.v = 2;
  }
  const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  m.bm = obj(m.bm); m.att = obj(m.att); m.hist = obj(m.hist);
  /* a half-synced or hand-edited store must never stop OSCE opening (2026-10-22 edge sweep): every history is a list
     of attempts that each carry an id, ticks are a list, and an AI record is an object */
  for (const [id, list] of Object.entries(m.hist)) {
    const ok = (Array.isArray(list) ? list : []).filter(a => a && typeof a === 'object' && typeof a.id === 'string')
      .map(a => ({ ...a, sid: a.sid || id, ticks: Array.isArray(a.ticks) ? a.ticks : [], ...(a.ai && typeof a.ai !== 'object' ? { ai: undefined } : {}) }));
    if (ok.length) m.hist[id] = ok; else delete m.hist[id];
  }
  if (Array.isArray(m.run?.origin)) m.run.origin = m.run.origin.filter(v => SOURCES.some(([k]) => k === v));   /* the kit's ai | own */
  /* timing: the 5 / 10 / 5 format. A save from before it (2 + 8, no Part 2) moves to the new default; times someone
     chose themselves stay */
  const tm = m.timing || {}, before = m.tv !== 3;
  m.timing = before && (tm.mx == null) && (tm.reading == null || (+tm.reading === 2 && +tm.station === 8)) ? { ...DEFAULT_TIMING }
    : { reading: clampMin(tm.reading, DEFAULT_TIMING.reading), station: clampMin(tm.station, DEFAULT_TIMING.station), mx: clampMin(tm.mx, DEFAULT_TIMING.mx, 0) };
  m.tv = 3;
  if (typeof m.details !== 'boolean') m.details = true;
  if (!m.sess || !Array.isArray(m.sess.queue)) m.sess = { queue: [], idx: null, aid: null, timer: null, done: [] };
  m.sess.done ||= [];
  const tmr = m.sess.timer;   /* a station finished under the old clock (no done flag) stays finished */
  if (tmr && typeof tmr === 'object' && tmr.c === 'station' && tmr.at == null && tmr.left <= 0 && tmr.done == null && before) tmr.done = true;
  m.people = oscePeople(m.people);
  if (m.sess.cand !== 1) m.sess.cand = 0;
  if (typeof m.alt !== 'boolean') m.alt = true;
  return m;
}

/* ---------------------------------------------------------------- two of you: partner mode
   people: the two names ([a, b], '' = not set yet); an attempt's `who` is the index of the candidate (0 | 1), and the
   other one examines. The session's `cand` says who sits the next station; with `alt` on it swaps after each one. */
export const NAME_MAX = 24;
export function oscePeople(p) {
  const two = Array.isArray(p) ? p : [];
  return [0, 1].map(i => (typeof two[i] === 'string' ? two[i].replace(/\s+/g, ' ').trim().slice(0, NAME_MAX) : ''));
}
/* the name to show for person i: their name, else Partner A / Partner B */
export const osceName = (people, i) => (people && people[i]) || `Partner ${i === 1 ? 'B' : 'A'}`;
/* who sits the station after this one */
export const osceNextCand = (cand, alt) => (alt ? (cand === 1 ? 0 : 1) : (cand === 1 ? 1 : 0));
/* an attempt's candidate index, or null for an attempt made before partner mode */
export const osceWho = a => (a && (a.who === 0 || a.who === 1) ? a.who : null);
/* {station id: 1} for the stations person i has a finished attempt at (i null = either of you) */
export function osceAttBy(hist, i) {
  const out = {};
  for (const [id, list] of Object.entries(hist || {})) if ((Array.isArray(list) ? list : []).some(a => a && a.fin && (i == null || osceWho(a) === i))) out[id] = 1;
  return out;
}
/* an exported progress file merged into this record: attempts are kept by id (the one finished later, or AI-marked,
   wins), saved stations are a union, names fill only the empty slots. Returns {mem, added} and never mutates its input. */
export function osceMergeImport(mem, file) {
  const out = { ...mem, hist: { ...(mem.hist || {}) }, bm: { ...(mem.bm || {}) }, people: [...(mem.people || ['', ''])] };
  const src = file && typeof file === 'object' ? file : {};
  let added = 0;
  const better = (x, y) => (y.ai?.status === 'done' && x.ai?.status !== 'done') || (y.fin || 0) > (x.fin || 0);
  for (const [sid, list] of Object.entries(src.hist && typeof src.hist === 'object' ? src.hist : {})) {
    const mine = [...(out.hist[sid] || [])];
    for (const a of Array.isArray(list) ? list : []) {
      if (!a || typeof a !== 'object' || typeof a.id !== 'string' || !a.fin) continue;
      const at = mine.findIndex(x => x.id === a.id);
      if (at < 0) { mine.push({ ...a, sid, ticks: Array.isArray(a.ticks) ? a.ticks : [] }); added++; }
      else if (better(mine[at], a)) mine[at] = { ...a, sid, ticks: Array.isArray(a.ticks) ? a.ticks : [] };
    }
    if (mine.length) out.hist[sid] = mine.sort((x, y) => (x.at || 0) - (y.at || 0));
  }
  for (const [id, v] of Object.entries(src.bm && typeof src.bm === 'object' ? src.bm : {})) if (v) out.bm[id] = 1;
  const theirs = oscePeople(src.people);
  out.people = out.people.map((n, i) => n || theirs[i]);
  return { mem: out, added };
}
/* finished attempts per person: [a, b, unassigned] */
export function osceCounts(hist) {
  const n = [0, 0, 0];
  for (const list of Object.values(hist || {})) for (const a of Array.isArray(list) ? list : []) if (a && a.fin) { const w = osceWho(a); n[w == null ? 2 : w]++; }
  return n;
}
export const clampMin = (v, d, min = 1) => { const n = Math.round(+v); return v !== '' && v != null && n >= min && n <= 99 ? n : d; };
/* a random station from the filtered list that is not queued yet (OscesBrowse "Add Random"), or null */
export function osceRandom(list, queue, rnd = Math.random) {
  const q = new Set(queue), pool = list.filter(s => !q.has(s.id));
  return pool.length ? pool[Math.floor(rnd() * pool.length)] : null;
}
/* Fast run (Stefan 2026-10-19: "fast run through buttons ... practice all of the selected specialities ... then do the
   stations in random order, for example paeds and all of OBSgyn"). eMedici tags 36 fine specialties; a rotation groups
   them the way a medical school rotation does, and a station belongs to every rotation one of its specialties is in. */
export const ROTATIONS = DISCIPLINES;   /* the kit's disciplines (vocab.mjs, 2026-10-19): every Learn page filters by the same seven */
export const ORIGINS = SOURCES;   /* the kit's vocabulary: AI generated | AMSA MedEd | Written by you */
/* a specialty the table does not know still lands somewhere: Medicine */
export const osceRotation = disciplineOf;
export const osceOrigin = s => (s && (s.origin === 'ai' || s.origin === 'amsa') ? s.origin : 'own');
/* the stations a fast run covers: any picked specialty (none picked = none), the picked sources and types (none = all) */
export function osceRunPool(list, sel = {}) {
  const specs = new Set(sel.specs || []), origins = new Set(sel.origin || []), types = new Set(sel.type || []);
  if (!specs.size) return [];
  return list.filter(s => (s.specialty || []).some(x => specs.has(x))
    && (!origins.size || origins.has(osceOrigin(s)))
    && (!types.size || (s.type || []).some(t => types.has(t))));
}
/* the pool's ids in random order (Fisher-Yates) */
export function osceShuffle(ids, rnd = Math.random) {
  const a = [...ids];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
/* AI marking (2026-10-19, Stefan: paste a transcript, the fleet marks it against the station's own checklist). The
   result's items carry leaf keys ('2', '5.1'); a key that is not a leaf of this checklist (a parent, a heading, a typo)
   never ticks. -> the tick keys to set */
export function osceAiTicks(check, items) {
  const leaves = new Set(osceLeaves(check).map(l => l.key));
  return [...new Set((Array.isArray(items) ? items : []).filter(i => i && i.done === true && leaves.has(String(i.id))).map(i => String(i.id)))];
}
/* the leaves the AI did not tick, Critical first (then checklist order), each with its label text */
export function osceAiMissed(check, items) {
  const done = new Set(osceAiTicks(check, items)), out = [];
  for (const i of check || []) {
    if (i.t !== 'checkbox') continue;
    const kids = (i.kids || []).filter(k => k.t === 'checkbox' || !k.t);
    if (kids.length) kids.forEach(k => { const key = `${i.id}.${k.id}`; if (!done.has(key)) out.push({ key, x: k.x, of: i.x, crit: !!(k.crit || i.crit) }); });
    else if (!done.has(String(i.id))) out.push({ key: String(i.id), x: i.x, crit: !!i.crit });
  }
  return out.sort((a, b) => Number(b.crit) - Number(a.crit));
}
/* the AI quote per ticked leaf key (≤ 300 chars, strings only) */
export function osceAiQuotes(items) {
  const q = {};
  for (const i of Array.isArray(items) ? items : []) if (i && i.done === true && typeof i.quote === 'string' && i.quote.trim()) q[String(i.id)] = i.quote.trim().slice(0, 300);
  return q;
}
export const AI_FB_HEAD = 'AI feedback';
/* Stefan's own feedback stays; the AI's goes under its heading once (a second apply never doubles it) */
export function osceAiFeedback(own, text) {
  const t = String(text || '').trim(), mine = String(own || '').trimEnd();
  if (!t) return mine;
  const block = `${AI_FB_HEAD}\n${t}`;
  if (mine.includes(block)) return mine;
  return mine ? `${mine}\n\n${block}` : block;
}
/* the shape the table holds: {items: [{id, done, quote}], global 0-3 | null, feedback} or null when it is not a result */
export function osceAiResult(r) {
  if (!r || typeof r !== 'object' || !Array.isArray(r.items)) return null;
  const g = Number.isInteger(r.global) && r.global >= 0 && r.global <= 3 ? r.global : null;
  return { items: r.items.filter(i => i && typeof i === 'object' && i.id != null).map(i => ({ id: String(i.id), done: i.done === true, quote: typeof i.quote === 'string' ? i.quote.slice(0, 300) : '' })),
    global: g, feedback: typeof r.feedback === 'string' ? r.feedback.slice(0, 1500) : '', model: typeof r.model === 'string' ? r.model : '', markedAt: typeof r.markedAt === 'string' ? r.markedAt : '',
    ...osceAiCoach(r) };
}
/* the coaching the marker adds (v3-v4, 2026-10-20): phrasing rewrites, a phone summary, calls for senior help and a model
   handover; every string trimmed and capped, anything malformed dropped (it never decides a mark) */
const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
export const HANDOVER = [['identify', 'I', 'Identify'], ['situation', 'S', 'Situation'], ['background', 'B', 'Background'], ['assessment', 'A', 'Assessment'],
  ['recommendation', 'R', 'Recommendation'], ['management', 'M', 'Management plan'], ['discharge', 'D', 'Discharge plan'], ['safety', 'SN', 'Safety netting']];
export function osceAiCoach(r) {
  const arr = v => (Array.isArray(v) ? v : []);
  const sm = r.summary && typeof r.summary === 'object' ? r.summary : {};
  const ho = r.handover && typeof r.handover === 'object' ? r.handover : {};
  return {
    phrasing: arr(r.phrasing).filter(p => p && str(p.better, 300)).slice(0, 6).map(p => ({ said: str(p.said, 300), better: str(p.better, 300), why: str(p.why, 120) })),
    summary: { missed: arr(sm.missed).map(x => str(x, 160)).filter(Boolean).slice(0, 5), strengths: arr(sm.strengths).map(x => str(x, 160)).filter(Boolean).slice(0, 3), next: str(sm.next, 240) },
    escalation: arr(r.escalation).filter(e => e && str(e.to, 40) && str(e.line, 300)).slice(0, 4).map(e => ({ to: str(e.to, 40), line: str(e.line, 300) })),
    handover: Object.fromEntries(HANDOVER.map(([k]) => [k, str(ho[k], 420)])),
  };
}
export const AI_MAX = 60000;
export const mmss = n => `${Math.floor(Math.max(0, n) / 60)}:${String(Math.max(0, n) % 60).padStart(2, '0')}`;

/* the station gate (pure): a station needs an id and a title; every field the renderer reads gets its shape, so a station
   missing refs, points, check or tasks (the AI file is the usual source) still opens. complexity is Low | Moderate | High
   or ''. Null = not a station. */
export function osceCleanStation(s) {
  if (!s || typeof s !== 'object' || !s.id || !s.title) return null;
  const str = v => (typeof v === 'string' ? v : ''), arr = v => (Array.isArray(v) ? v : []);
  return { ...s, id: String(s.id), title: String(s.title), desc: str(s.desc), specialty: arr(s.specialty), type: arr(s.type),
    complexity: CX.includes(s.complexity) ? s.complexity : '', context: arr(s.context), presentation: arr(s.presentation), diagnosis: arr(s.diagnosis),
    stem: str(s.stem), tasks: arr(s.tasks), patient: str(s.patient), check: arr(s.check), guide: str(s.guide), explain: str(s.explain),
    points: arr(s.points), refs: arr(s.refs), media: s.media && typeof s.media === 'object' && !Array.isArray(s.media) ? s.media : {}, part2: oscePart2(s.part2), demo: cleanDemo(s.demo) };
}
/* Part 2: what the examiner says to open it, what they hand over (observations, investigations, scans: label + result,
   HTML allowlist), and the questions they ask in order. Each result may say what kind it is (KINDS), carry the examiner's
   model interpretation (`model`, HTML, never shown to the candidate) and, for observations, the rows to chart (`obs`,
   obs.mjs cleanObs), for lab results the panels to print (`labs`, labs.mjs cleanLabs). A result may have no text when its
   rows or panels say it all. Anything malformed is dropped. */
export const KINDS = Object.freeze({ obs: 'Observations', bloods: 'Bloods', gas: 'Blood gas', ecg: 'ECG', xray: 'X-ray', ct: 'CT', us: 'Ultrasound', mri: 'MRI',
  ctg: 'CTG', micro: 'Microbiology', urine: 'Urine', report: 'Report', other: 'Result' });
export function oscePart2(p) {
  const o = p && typeof p === 'object' && !Array.isArray(p) ? p : {}, str = v => (typeof v === 'string' ? v.trim() : '');
  return { lead: str(o.lead),
    handover: (Array.isArray(o.handover) ? o.handover : []).map(h => {
      if (!h || !str(h.label)) return null;
      const obs = h.kind === 'obs' ? cleanObs(h.obs) : null, labs = cleanLabs(h.labs);
      if (!str(h.result) && !obs && !labs) return null;
      const x = { label: str(h.label), result: str(h.result) };
      if (KINDS[h.kind]) x.kind = h.kind;
      if (str(h.model)) x.model = str(h.model);
      if (obs) x.obs = obs;
      if (labs) x.labs = labs;
      return x;
    }).filter(Boolean),
    ask: (Array.isArray(o.ask) ? o.ask : []).map(str).filter(Boolean), ...(str(o.patient) ? { patient: str(o.patient) } : {}) };   /* patient: what the patient says or asks in Part 2 (HTML), kept out of the Part 1 script */
}
/* where Part 2 starts on a checklist: the id of its first Interpretation, Management or Safety netting heading (the format's
   order), or null; the marking sheet opens there when Part 2 starts */
export function osceP2Start(check) {
  const h = (Array.isArray(check) ? check : []).find(i => i && i.t === 'heading' && /interpret|manage|safety[- ]?net/i.test(String(i.x || '').replace(/<[^>]+>/g, '')));
  return h ? h.id : null;
}
export const hasPart2 = st => !!st && ((st.part2?.handover || []).length > 0 || (st.media?.part2 || []).length > 0);
/* the bank, then the AI stations, each through the gate; one station per id, the first (eMedici's) wins */
export function osceStations(bank, ai) {
  const seen = new Set(), keep = s => s && !seen.has(s.id) && !!seen.add(s.id);
  return [...(Array.isArray(bank?.stations) ? bank.stations : []).map(osceCleanStation).filter(keep),
    ...(Array.isArray(ai?.stations) ? ai.stations : []).map(osceCleanStation).filter(keep).map(s => ({ ...s, origin: 'ai' }))];
}
/* the split bank (scripts/split-osce.js): an osce/index.json row carries no stem, patient or check; `lazy` says its
   body is osce/<id>.json. osceStations keeps a row's lazy flag through the gate, so a row is browsable before its body. */
export const osceLazy = s => !!s && s.lazy === true;
export const osceIndexRows = index => ({ stations: (Array.isArray(index?.stations) ? index.stations : []).map(r => ({ ...r, lazy: true })) });
/* a fetched body replaces its row: the row's fields (origin, counts) under the cleaned station; null when it is not that station */
export function osceBody(row, body) {
  const s = osceCleanStation(body);
  if (!s || !row || s.id !== String(row.id)) return null;
  const out = { ...row, ...s };
  delete out.lazy;
  return out;
}
