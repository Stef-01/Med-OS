/* imaging/verify.mjs - Claude looks at the downloaded pixels before an image is allowed into a station. It is never
   shown the filename, caption or source (they are often wrong or give the answer away): it first describes what it
   sees, then says whether that is the requested finding. acceptVerdict() then applies hard rules in code (modality,
   laterality, age, single image, no labels that give the diagnosis away where the candidate sees it). The prompt,
   schema and rules are pure and tested; verifyImage() is the call. */
import { claudeJson, imageBlock } from '../lib/claude.mjs';

export const MIN_CONFIDENCE = 0.8;

export const VERIFY_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['observed', 'single_image', 'annotations', 'quality', 'sees', 'matches_request', 'confidence', 'reason'],
  properties: {
    observed: { type: 'object', additionalProperties: false, required: ['modality', 'region', 'view', 'age_group', 'findings', 'laterality'],
      properties: {
        modality: { type: 'string', enum: ['xray', 'ct', 'ultrasound', 'mri', 'ecg', 'photo', 'other'] },
        region: { type: 'string' }, view: { type: 'string' },
        age_group: { type: 'string', enum: ['adult', 'child', 'infant', 'neonate', 'unknown'] },
        findings: { type: 'array', items: { type: 'string' } },
        laterality: { type: 'string', enum: ['left', 'right', 'bilateral', 'none', 'unclear'] },
      } },
    single_image: { type: 'boolean' },
    annotations: { type: 'string', enum: ['none', 'minor_marks', 'labels_or_arrows', 'text_revealing_diagnosis'] },
    quality: { type: 'string', enum: ['good', 'fair', 'poor'] },
    sees: { type: 'string' },
    matches_request: { type: 'boolean' },
    confidence: { type: 'number' },
    reason: { type: 'string' },
  },
};

export const VERIFY_SYSTEM = `You are a consultant radiologist checking whether an image is fit to use in a medical student OSCE station.
Judge only from the pixels. You are not told where the image came from, and its source may have mislabelled it.
Fill "observed" first, from the image alone: modality, body region, view or projection, the patient's apparent age group, every abnormal finding you can see, and the side of the main finding from the patient's point of view (on a standard frontal radiograph the patient's right is on the viewer's left unless a side marker shows otherwise).
single_image is false for a collage, a side-by-side comparison or a multi-panel figure.
annotations: none; minor_marks (a side marker, a scale bar, an anonymised label); labels_or_arrows (arrows, circles or text labels pointing at anatomy or findings); text_revealing_diagnosis (any text that names the diagnosis or finding).
quality is poor if the finding cannot be seen clearly on a phone screen (too dark, too small, heavily cropped, a photo of a screen with glare).
sees is one sentence a radiologist would say about this image.
matches_request is true only if this image clearly shows the requested finding in the requested modality and region, so that a student who reads it well would name that finding. If the finding is subtle, absent, or a different condition, it is false.
confidence is your probability (0 to 1) that matches_request is right.`;

export function verifyText(req) {
  return `Requested image for an OSCE station:
modality: ${req.modality}
region: ${req.region}${req.view ? `\nview: ${req.view}` : ''}
finding it must show: ${req.finding}${req.laterality && req.laterality !== 'none' ? `\nside of the finding (patient's): ${req.laterality}` : ''}${req.age ? `\npatient: ${req.age}` : ''}

Describe what you see first, then judge the match.`;
}

/* the rules a verdict must pass on top of the model's own yes: -> { ok, why[] } */
export function acceptVerdict(req, v, { min = MIN_CONFIDENCE } = {}) {
  const why = [], o = v?.observed || {};
  if (!v || typeof v !== 'object') return { ok: false, why: ['no verdict'] };
  if (o.modality !== req.modality) why.push(`modality is ${o.modality}, wanted ${req.modality}`);
  if (v.matches_request !== true) why.push('does not show the finding');
  if (!(Number(v.confidence) >= min)) why.push(`confidence ${v.confidence} < ${min}`);
  if (v.single_image !== true) why.push('not a single image');
  if (v.quality === 'poor') why.push('poor quality');
  const candidateSees = req.place !== 'explanation';
  if (candidateSees && (v.annotations === 'labels_or_arrows' || v.annotations === 'text_revealing_diagnosis')) why.push(`annotated (${v.annotations}) where the candidate sees it`);
  if (['left', 'right', 'bilateral'].includes(req.laterality) && o.laterality !== req.laterality) why.push(`finding is on the ${o.laterality} side, wanted ${req.laterality}`);
  if (['child', 'infant', 'neonate'].includes(req.age) && o.age_group === 'adult') why.push('an adult, wanted a child');
  if (req.age === 'adult' && ['infant', 'neonate'].includes(o.age_group)) why.push(`an ${o.age_group}, wanted an adult`);
  return { ok: !why.length, why };
}

export async function verifyImage(req, bytes, mime) {
  const { value, model } = await claudeJson({ system: VERIFY_SYSTEM, schema: VERIFY_SCHEMA, effort: 'high', maxTokens: 16000, label: `verify ${req.id}`,
    content: [imageBlock(bytes, mime), { type: 'text', text: verifyText(req) }] });
  return { verdict: value, model };
}
