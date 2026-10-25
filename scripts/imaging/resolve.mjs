/* imaging/resolve.mjs - one imaging request to one verified, credited local file:
     search (Commons + Open-i, several phrasings) → rank by metadata (licence, finding words, modality, no drawings or
     collages) → download the best few → Claude checks the pixels (verify.mjs) → the first that passes every rule is
     saved as public/media/<station>/<request id>.<ext> and recorded on the station with its credit.
   Nothing passes → the request stays unresolved and the station keeps its text description (the patient script and
   explanation always carry the result in words, so a station never depends on an image).
   planImaging() proposes requests for a station that has none (the 26 written before this pipeline existed). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODALITIES, PLACES, searchQueries, rankCandidates, scoreCandidate, requestProblems } from './rank.mjs';
import { search, UA } from './sources.mjs';
import { imageSize, EXT } from './image-size.mjs';
import { verifyImage, acceptVerdict } from './verify.mjs';
import { claudeJson } from '../lib/claude.mjs';

export const MAX_BYTES = 4.5 * 1024 * 1024;   /* under the API's 5 MB image limit */

/* pure: the station with this entry in media[place], replacing an earlier file for the same request */
export function placeMedia(station, place, entry) {
  const media = { ...(station.media && typeof station.media === 'object' && !Array.isArray(station.media) ? station.media : {}) };
  for (const p of PLACES) if (Array.isArray(media[p])) media[p] = media[p].filter(m => m.req !== entry.req);
  media[place] = [...(media[place] || []), entry];
  for (const p of Object.keys(media)) if (Array.isArray(media[p]) && !media[p].length) delete media[p];
  return { ...station, media };
}
/* pure: the requests that still need a file (or all of them with refresh) */
export const pending = (station, refresh) => (station.imaging || []).filter(r => refresh || !PLACES.some(p => (station.media?.[p] || []).some(m => m.req === r.id)));

export async function download(url, f = fetch) {
  let bytes;
  if (String(url).startsWith('file://')) bytes = new Uint8Array(fs.readFileSync(fileURLToPath(url)));   /* a staged candidate (staged.mjs) */
  else {
    const r = await f(url, { headers: { 'User-Agent': UA } });
    if (!r.ok) throw new Error(`download ${r.status}`);
    bytes = new Uint8Array(await r.arrayBuffer());
  }
  if (bytes.length > MAX_BYTES) throw new Error('larger than 4.5 MB');
  const info = imageSize(bytes);
  if (!info || !EXT[info.mime]) throw new Error('not a PNG, JPEG, GIF or WebP image');
  if (info.width < 360 || info.height < 360) throw new Error(`too small (${info.width}×${info.height})`);
  return { bytes, ...info };
}

/* candidates: staged ones (staged.mjs) in place of the web search; they keep their order (the stage script chose
   them from a collection's own labels) but pass the same licence, type and size rules, and are all looked at */
export async function resolveRequest(req, { stationId, pub, f = fetch, maxVerify = 4, log = () => {}, verify = verifyImage, candidates = null } = {}) {
  const tried = [];
  const cands = candidates || await search(req, searchQueries(req), { fetch: f, modalities: MODALITIES, log });
  const short = candidates ? candidates.filter(c => !scoreCandidate(req, c).reject) : rankCandidates(req, cands, maxVerify * 2);
  if (candidates) maxVerify = short.length;
  log(`  ${req.id}: ${cands.length} ${candidates ? 'staged' : 'results'}, ${short.length} shortlisted`);
  let checked = 0;
  for (const c of short) {
    if (checked >= maxVerify) break;
    let img;
    try { img = await download(c.url, f); } catch (e) { tried.push({ title: c.title, why: [e.message] }); continue; }
    checked++;
    const { verdict, model } = await verify(req, img.bytes, img.mime, c);
    const { ok, why } = acceptVerdict(req, verdict);
    tried.push({ title: c.title, source: c.source, score: c.score, sees: verdict.sees, confidence: verdict.confidence, why });
    log(`    ${ok ? 'accept' : 'reject'} ${c.title.slice(0, 70)} (${verdict.confidence})${ok ? '' : `: ${why.join('; ')}`}`);
    if (!ok) continue;
    const rel = `media/${stationId}/${req.id}.${EXT[img.mime]}`;
    fs.mkdirSync(path.join(pub, 'media', stationId), { recursive: true });
    fs.writeFileSync(path.join(pub, rel), img.bytes);
    return {
      entry: { src: rel, alt: req.alt, w: img.width, h: img.height, caption: req.caption, req: req.id,
        credit: { author: String(c.author || 'Unknown author').slice(0, 160), license: c.license, licenseUrl: c.licenseUrl || '', page: c.page || '', via: c.via },
        ...(verdict.findings ? { findings: String(verdict.findings).slice(0, 300) } : {}),
        verified: { model, confidence: verdict.confidence, sees: String(verdict.sees || '').slice(0, 300) } },
      tried,
    };
  }
  return { entry: null, tried };
}

/* every pending request of a station; returns the updated station and a report line per request */
export async function resolveStation(station, opts = {}) {
  let st = station;
  const report = [];
  for (const req of pending(station, opts.refresh)) {
    const bad = requestProblems(req);
    if (bad.length) { report.push({ id: req.id, ok: false, why: bad }); continue; }
    try {
      const candidates = opts.staged ? opts.staged(station.id, req.id) : null;
      if (candidates && !candidates.length) { report.push({ id: req.id, ok: false, why: ['no staged candidates'], skipped: true }); continue; }
      const { entry, tried } = await resolveRequest(req, { ...opts, candidates, stationId: station.id });
      if (entry) { st = placeMedia(st, req.place, entry); report.push({ id: req.id, ok: true, src: entry.src, license: entry.credit.license }); }
      else report.push({ id: req.id, ok: false, why: tried.length ? tried.map(t => `${t.title}: ${(t.why || []).join('; ')}`) : ['no usable search results'] });
    } catch (e) { report.push({ id: req.id, ok: false, why: [e.message] }); }
  }
  return { station: st, report };
}

/* ---------------------------------------------------------------- planning requests for a station that has none */
export const REQUEST_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['id', 'modality', 'region', 'view', 'finding', 'laterality', 'age', 'place', 'caption', 'alt', 'terms'],
  properties: {
    id: { type: 'string' }, modality: { type: 'string', enum: Object.keys(MODALITIES) }, region: { type: 'string' }, view: { type: 'string' },
    finding: { type: 'string' }, laterality: { type: 'string', enum: ['left', 'right', 'bilateral', 'none'] },
    age: { type: 'string', enum: ['adult', 'child', 'infant', 'neonate'] }, place: { type: 'string', enum: PLACES },
    caption: { type: 'string' }, alt: { type: 'string' }, terms: { type: 'array', items: { type: 'string' } },
  },
};
export const PLAN_SYSTEM = `You add real clinical images to OSCE stations for Australian medical students.
Read the station and decide which images a real examiner would hand the candidate (or show in the explanation afterwards): a chest or abdominal X-ray, a CT, an ultrasound, an ECG, a clinical photograph. Propose an image only when the station's own text already has that investigation and its result, and the finding is visible on that kind of image (a normal or non-specific study is not worth an image). Most history and counselling stations need none; acute stations usually need one or two. Never more than three.
Each request must match the station exactly: the same finding, the same side, the same age group. place is "patientScript" when the examiner shows it on request (the usual case), "stem" when the candidate is given it at the start, "explanation" for a teaching image after the station.
id is short kebab-case (for example "cxr-1"). finding is the radiological finding in plain words (for example "right tension pneumothorax with mediastinal shift"). terms are 1 to 3 short search phrases a radiology library would file it under (for example "tension pneumothorax"). caption tells the examiner when to show it (for example "Chest X-ray: show when the candidate asks for imaging"). alt describes the image without naming the diagnosis.`;

const plainText = h => String(h || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
export function planText(st) {
  const check = (st.check || []).flatMap(i => [i.x, ...(i.kids || []).map(k => k.x)]).map(plainText).join('\n');
  return `Station: ${st.title}\nSpecialty: ${(st.specialty || []).join(', ')}\nType: ${(st.type || []).join(', ')}\n\nCandidate instructions:\n${plainText(st.stem)}\n${(st.tasks || []).map(plainText).join('\n')}\n\nExaminer and patient script:\n${plainText(st.patient)}\n\nMarking checklist:\n${check}\n\nExplanation:\n${plainText(st.explain)}`;
}
export async function planImaging(st) {
  const { value } = await claudeJson({ system: PLAN_SYSTEM, label: `plan ${st.id}`, effort: 'high', maxTokens: 16000,
    schema: { type: 'object', additionalProperties: false, required: ['requests'], properties: { requests: { type: 'array', items: REQUEST_SCHEMA } } },
    content: planText(st) });
  return (value.requests || []).slice(0, 3).filter(r => !requestProblems(r).length);
}
