/* imaging/staged.mjs - candidates prepared on this machine, and the pixel check done by a reviewer reading each one.
   Some of the best open images are not on Commons or Open-i: PhysioNet's ECGs (drawn from the recording), and open
   radiology and ultrasound collections hosted as files (InRad, the COVID-19 image collection, the clinical ultrasound
   repository). A stage script writes each candidate under <stage>/<station>/<request>/ with its credit in
   <stage>/manifest.json; a reviewer (Claude, in a session with the images in front of it) writes one verdict per
   candidate in <stage>/verdicts.json in verify.mjs's schema, plus `findings`, the sentence shown under the image.
   fetch-imaging.mjs --staged runs them through resolveRequest: the same licence and size rules, the same
   acceptVerdict, the same credit on the station. A candidate without a verdict is never accepted.

   stagedKey(station, req, name) -> "<station>/<req>/<name>"
   addStaged(stage, entry) writes the file and its manifest entry (replacing one with the same key)
   stagedCandidates(stage, station, req) -> candidates for resolveRequest, in the order staged
   verdictProblems(v) -> [problems] for one verdict as written; sessionVerify(verdicts) -> verify(req, bytes, mime, c) */
import fs from 'node:fs';
import path from 'node:path';
import { imageSize } from './image-size.mjs';
import { VERIFY_SCHEMA } from './verify.mjs';

export const REVIEWER = 'claude (session review)';
export const stagedKey = (station, req, name) => `${station}/${req}/${name}`;
const manifestFile = stage => path.join(stage, 'manifest.json');
export const readManifest = stage => (fs.existsSync(manifestFile(stage)) ? JSON.parse(fs.readFileSync(manifestFile(stage), 'utf8')) : []);

export function addStaged(stage, { station, req, name, bytes, ...meta }) {
  if (!/^[\w-]+$/.test(station) || !/^[a-z0-9-]+$/.test(req) || !/^[\w.-]+$/.test(name)) throw new Error(`bad staged name ${station}/${req}/${name}`);
  const info = imageSize(bytes); if (!info) throw new Error(`${name}: not an image`);
  const rel = path.join(station, req, name);
  fs.mkdirSync(path.join(stage, station, req), { recursive: true });
  fs.writeFileSync(path.join(stage, rel), bytes);
  const key = stagedKey(station, req, name), list = readManifest(stage).filter(e => e.key !== key);
  list.push({ key, station, req, file: rel, width: info.width, height: info.height, mime: info.mime, ...meta });
  fs.writeFileSync(manifestFile(stage), `${JSON.stringify(list, null, 1)}\n`);
  return key;
}

/* pure: manifest entries -> candidates (the shape sources.mjs gives), for one request */
export function candidatesFrom(list, stage, station, req) {
  return list.filter(e => e.station === station && e.req === req).map(e => ({
    source: e.source || 'staged', via: e.via || '', title: e.title || e.key, description: e.description || '', categories: [],
    url: `file://${path.resolve(stage, e.file)}`, original: '', page: e.page || '', width: e.width, height: e.height, mime: e.mime,
    license: e.license || '', licenseUrl: e.licenseUrl || '', author: e.author || '', key: e.key,
  }));
}
export const stagedCandidates = (stage, station, req) => candidatesFrom(readManifest(stage), stage, station, req);

/* pure: a verdict as the reviewer wrote it, checked against verify.mjs's schema and the findings sentence */
export function verdictProblems(v) {
  const p = [];
  if (!v || typeof v !== 'object') return ['not an object'];
  for (const k of VERIFY_SCHEMA.required) if (!(k in v)) p.push(`${k} is missing`);
  const o = v.observed || {}, props = VERIFY_SCHEMA.properties.observed.properties;
  for (const k of VERIFY_SCHEMA.properties.observed.required) if (!(k in o)) p.push(`observed.${k} is missing`);
  for (const k of ['modality', 'age_group', 'laterality']) if (o[k] !== undefined && !props[k].enum.includes(o[k])) p.push(`observed.${k} ${o[k]} is not allowed`);
  if (v.annotations !== undefined && !VERIFY_SCHEMA.properties.annotations.enum.includes(v.annotations)) p.push(`annotations ${v.annotations} is not allowed`);
  if (v.quality !== undefined && !VERIFY_SCHEMA.properties.quality.enum.includes(v.quality)) p.push(`quality ${v.quality} is not allowed`);
  if (v.confidence !== undefined && !(Number(v.confidence) >= 0 && Number(v.confidence) <= 1)) p.push('confidence must be 0 to 1');
  const f = String(v.findings ?? v.sees ?? '').trim();
  if (!f) p.push('findings is empty');
  else if (f.length > 300) p.push('findings is longer than 300 characters');
  return p;
}

/* the verify step for staged candidates: the reviewer's verdict for this exact candidate, or a refusal */
export function sessionVerify(verdicts) {
  return async (req, bytes, mime, c) => {
    const v = c && verdicts[c.key];
    if (!v) return { verdict: { matches_request: false, confidence: 0, observed: {}, sees: '', reason: 'not reviewed' }, model: REVIEWER };
    const bad = verdictProblems(v);
    if (bad.length) return { verdict: { ...v, matches_request: false, reason: bad.join('; ') }, model: REVIEWER };
    return { verdict: { ...v, findings: String(v.findings ?? v.sees).trim() }, model: REVIEWER };
  };
}
export const readVerdicts = file => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {});
