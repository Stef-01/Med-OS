/* imaging/rank.mjs - pure: what an imaging request means as search words, which licences may be shown, and how well a
   search result's metadata fits the request. No network, no files: tested in scripts/imaging.test.js.

   A request (written by the generator, or planned for an existing station) is
     { id, modality: xray|ct|ultrasound|mri|ecg|photo, region, view?, finding, laterality?: left|right|bilateral|none,
       age?: adult|child|infant|neonate, place: part2|stem|patientScript|explanation, caption, alt, terms?: [] }
   Metadata only shortlists: a candidate is accepted only after verify.mjs has looked at the pixels. */

export const MODALITIES = {
  xray: { words: ['x-ray', 'xray', 'radiograph', 'radiography', 'cxr', 'axr', 'plain film', 'röntgen', 'roentgen'], search: 'radiograph', openi: 'x' },
  ct: { words: ['ct', 'computed tomography', 'tomography', 'ctpa', 'cect'], search: 'CT scan', openi: 'c' },
  ultrasound: { words: ['ultrasound', 'ultrasonography', 'sonography', 'sonogram', 'echocardiogram', 'echo', 'pocus', 'fast scan'], search: 'ultrasound', openi: 'u' },
  mri: { words: ['mri', 'magnetic resonance', 't1', 't2', 'flair'], search: 'MRI', openi: 'm' },
  ecg: { words: ['ecg', 'ekg', 'electrocardiogram', '12-lead', '12 lead'], search: 'ECG electrocardiogram', openi: '' },
  photo: { words: ['photo', 'photograph', 'clinical image'], search: 'clinical photograph', openi: 'ph' },
};
export const PLACES = ['part2', 'stem', 'patientScript', 'explanation'];   /* part2: handed over in Part 2 (the usual place for a scan) */

/* licences a study page may show with a credit line: public domain, CC0, the CC BY family (SA, NC, ND: the image is
   shown unchanged, for study, with its credit) and Open Data Commons Attribution (PhysioNet's older databases). Unknown, "all rights reserved", "fair use" and "non-free" never pass. */
export function licenceOk(lic) {
  const s = String(lic || '').replace(/<[^>]*>/g, ' ').toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s || /non ?free|fair use|all rights reserved|copyright(?!ed free)|unknown/.test(s)) return false;
  return /^(public domain|pd\b|cc0|cc zero|cc by\b|creative commons attribution|attribution\b|gfdl|no restrictions|odc by\b|open data commons attribution)/.test(s);
}

/* words that mark a picture we never want in a station: drawings, annotated teaching figures, collages, specimens */
const BAD = [['diagram', 6], ['drawing', 6], ['illustration', 6], ['schematic', 6], ['cartoon', 8], ['animation', 8], ['icon', 6], ['logo', 8],
  ['annotated', 4], ['labelled', 4], ['labeled', 4], ['arrow', 3], ['arrows', 3], ['collage', 5], ['montage', 5], ['comparison', 3], ['before and after', 4],
  ['specimen', 5], ['histology', 6], ['histopathology', 6], ['micrograph', 6], ['microscopy', 6], ['autopsy', 6], ['gross pathology', 6],
  ['model', 2], ['phantom', 5], ['veterinary', 8], ['dog', 6], ['cat', 4], ['horse', 6], ['animal', 5], ['3d rendering', 5], ['volume rendering', 4]];
const CHILD = ['child', 'paediatric', 'pediatric', 'infant', 'toddler', 'neonate', 'newborn', 'baby', 'boy', 'girl', 'year-old', 'month-old'];

const norm = s => String(s || '').toLowerCase().replace(/<[^>]*>/g, ' ').replace(/[_|]+/g, ' ').replace(/\.(jpe?g|png|gif|tiff?|webp)\b/g, ' ').replace(/\s+/g, ' ');
const has = (hay, w) => new RegExp(`(^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'i').test(hay);
const tokens = s => norm(s).split(/[^a-z0-9-]+/).filter(w => w.length > 2 && !STOP.has(w));
const STOP = new Set(['the', 'and', 'with', 'from', 'showing', 'shows', 'left', 'right', 'sided', 'side', 'view', 'image', 'film', 'plain', 'large', 'small', 'acute', 'new', 'of', 'in', 'on', 'a', 'an']);

/* the search strings to try, most specific first: the finding's own words with the modality and region */
export function searchQueries(req) {
  const m = MODALITIES[req.modality] || MODALITIES.xray, terms = (req.terms || []).filter(Boolean);
  const finding = String(req.finding || '').replace(/\b(left|right)[- ]sided\b/gi, '').trim();
  const qs = [
    `${finding} ${req.region || ''} ${m.search}`,
    ...terms.slice(0, 3).map(t => `${t} ${m.search}`),
    `${finding} ${m.search}`,
  ].map(q => q.replace(/\s+/g, ' ').trim()).filter(Boolean);
  return [...new Set(qs)];
}

/* -> { score, reasons, reject } for one candidate {title, description, categories, license, width, height, mime} */
export function scoreCandidate(req, c) {
  const hay = norm(`${c.title} ${c.description} ${(c.categories || []).join(' ')} ${(c.mesh || []).join(' ')}`), reasons = [];
  const m = MODALITIES[req.modality] || MODALITIES.xray;
  if (!licenceOk(c.license)) return { score: -Infinity, reasons: [`licence ${c.license || 'unknown'}`], reject: 'licence' };
  if (c.mime && !/^image\/(jpeg|png|webp|gif)$/i.test(c.mime)) return { score: -Infinity, reasons: [`type ${c.mime}`], reject: 'type' };
  if ((c.width && c.width < 360) || (c.height && c.height < 360)) return { score: -Infinity, reasons: ['too small'], reject: 'size' };
  let score = 0;
  const findWords = [...new Set([...tokens(req.finding), ...(req.terms || []).flatMap(tokens)])];
  const hit = findWords.filter(w => has(hay, w));
  score += hit.length * 6; if (hit.length) reasons.push(`finding: ${hit.join(', ')}`);
  if (findWords.length && hit.length === findWords.length) { score += 6; reasons.push('every finding word'); }
  if (!hit.length) { score -= 12; reasons.push('no finding word'); }
  const mod = m.words.filter(w => has(hay, w));
  if (mod.length) { score += 8; reasons.push(`modality: ${mod[0]}`); }
  else score -= 4;
  for (const [k, other] of Object.entries(MODALITIES)) if (k !== req.modality && other.words.some(w => w.length > 3 && has(hay, w)) && !mod.length) { score -= 8; reasons.push(`looks like ${k}`); break; }
  const reg = tokens(req.region).filter(w => has(hay, w));
  if (reg.length) { score += 4; reasons.push(`region: ${reg.join(', ')}`); }
  if (req.view && has(hay, String(req.view).toLowerCase())) { score += 2; reasons.push(`view ${req.view}`); }
  for (const [w, pen] of BAD) if (has(hay, w)) { score -= pen; reasons.push(`-${w}`); }
  const childish = CHILD.some(w => has(hay, w)), wantChild = ['child', 'infant', 'neonate'].includes(req.age);
  if (wantChild && childish) { score += 4; reasons.push('paediatric'); }
  if (wantChild && !childish) score -= 2;
  if (!wantChild && childish) { score -= 5; reasons.push('-paediatric'); }
  if (c.width && c.height) score += Math.min(3, Math.floor(Math.min(c.width, c.height) / 400));
  return { score, reasons, reject: null };
}

/* the shortlist: no rejects, no duplicates (same URL or the same title), best first, at most n */
export function rankCandidates(req, cands, n = 4) {
  const seen = new Set();
  return cands.map(c => ({ ...c, ...scoreCandidate(req, c) }))
    .filter(c => !c.reject && c.score > 0)
    .sort((a, b) => b.score - a.score)
    .filter(c => { const t = norm(c.title); if (seen.has(c.url) || seen.has(t)) return false; seen.add(c.url); seen.add(t); return true; })
    .slice(0, n);
}

/* a request as the generator wrote it, checked: -> [problems] */
export function requestProblems(r) {
  const p = [];
  if (!r || typeof r !== 'object') return ['not an object'];
  if (!/^[a-z0-9-]{1,32}$/.test(String(r.id || ''))) p.push('id must be short kebab-case');
  if (!MODALITIES[r.modality]) p.push(`modality ${r.modality} is not one of ${Object.keys(MODALITIES).join(', ')}`);
  if (!PLACES.includes(r.place)) p.push(`place ${r.place} is not one of ${PLACES.join(', ')}`);
  for (const k of ['region', 'finding', 'caption', 'alt']) if (!String(r[k] || '').trim()) p.push(`${k} is empty`);
  if (r.laterality && !['left', 'right', 'bilateral', 'none'].includes(r.laterality)) p.push('laterality must be left, right, bilateral or none');
  return p;
}
