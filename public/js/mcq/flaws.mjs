/* mcq/flaws.mjs - the item-writing flaws a question can be checked for in code, after the NBME item-writing guide
   (Paniagua & Swygert, "Constructing written test questions for the basic and clinical sciences"): a focused lead-in
   that can be answered with the options covered, no "all/none of the above", no negative stem, no cue that gives the
   key away to a test-wise student (length, grammar, convergence, absolute terms, a word repeated from the stem), no two
   options alike, a complete vignette, a stem of sensible length, units on every measurement, and (across a pool) no
   near-duplicate and a key spread over the positions.

   Each check returns { check, pass, severity, reason }. severity says what a failure costs:
     block   the question cannot enter the pool at all
     major   a flaw the NBME guide says to fix before use (-20)
     minor   a cue or omission worth fixing (-6)
     info    recorded, costs nothing
   flawScore = 100 minus the cost of every failed check, at least 0. The thresholds were set on the benchmarks
   (docs/mcq-evals.md): an official Step 2 CK item almost never fails a major or block check. Pure, and identical in the
   app's submit form, the scripts and the tests. */
import { fullStem, itemProblems } from './schema.mjs';

export const EVAL_VERSION = 'flaws-1';
export const COST = Object.freeze({ block: 100, major: 20, minor: 6, info: 0 });

/* ------------------------------------------------------------------ text */
const STOP = new Set(('a an the of in on at to for from by with without and or but nor not no is are was were be been being has have had do does did ' +
  'this that these those it its he she his her him they them their there then than which what who whom whose when where why how ' +
  'following most likely best next step appropriate patient patients diagnosis management treatment therapy explanation finding findings cause ' +
  'condition year years old month months week weeks day days man woman boy girl child infant shows show showed reveals revealed would should could may might ' +
  'can will one two three four five first second also into over under about after before during while because due other others any all some such each ' +
  'very more less mg dl ml mm hg min per').split(' '));
export const words = s => (String(s ?? '').toLowerCase().match(/[a-z0-9]+(?:'[a-z]+)?/g) || []);
export const content = s => words(s).filter(w => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w));
const stemOf = s => String(s ?? '').replace(/ /g, ' ');
/* the stem's sentences; a number's decimal point, "mm Hg." and "Dr." do not end one */
export function sentences(s) {
  const t = stemOf(s).replace(/\s+/g, ' ').trim();
  return t.split(/(?<=[.?!:])\s+(?=[A-Z(“"'])/).map(x => x.trim()).filter(Boolean);
}
/* the lead-in: the item's ask, or the stem's last sentence
   (a question followed by a lab table or "(Round to ...)" still counts: the last sentence that asks one) */
const asks = s => /\?/.test(s);
function leadAt(ss) { for (let i = ss.length - 1; i >= Math.max(0, ss.length - 4); i--) if (asks(ss[i])) return i; return ss.length - 1; }
export function leadIn(q) {
  if (q.ask && String(q.ask).trim()) return String(q.ask).trim();
  const ss = sentences(q.stem); return ss[leadAt(ss)] || '';
}
/* the vignette: the stem without its lead-in */
export function vignette(q) {
  if (q.ask && String(q.ask).trim()) return stemOf(q.stem).trim();
  const ss = sentences(q.stem), i = leadAt(ss); return ss.filter((_, j) => j !== i).join(' ');
}
const QWORD = /\b(which|what|how|why|where|when|who|whom)\b/i;
const LEAD = /\b(most likely|most appropriate|best (?:next|initial)|next (?:best )?step|best explains|most accurate|most consistent|most effective|most important|is indicated|should be|most at risk|at greatest risk|is likely|is caused by|is due to)\b/i;
const norm = o => words(o).join(' ');
const jaccard = (a, b) => { const A = new Set(a), B = new Set(b); if (!A.size && !B.size) return 1; let n = 0; for (const x of A) if (B.has(x)) n++; return n / (A.size + B.size - n); };

const ok = (check, severity) => ({ check, pass: true, severity, reason: '' });
const fail = (check, severity, reason) => ({ check, pass: false, severity, reason });

/* ------------------------------------------------------------------ the checks, one question at a time */
export function checkSchema(q) {
  const p = itemProblems(q);
  return p.length ? fail('schema', 'block', p.join('; ')) : ok('schema', 'block');
}

/* a lead-in that asks something: a question word, or "the most likely ...", in the last sentence */
export function checkLeadIn(q) {
  const l = leadIn(q);
  if (!l || !(QWORD.test(l) || LEAD.test(l) || /\?\s*$/.test(l))) return fail('lead-in', 'major', 'No lead-in: the stem never asks a question (end it with one, e.g. "Which of the following is the most likely diagnosis?").');
  return ok('lead-in', 'major');
}

/* "cover the options": a student should be able to answer from the stem alone. An unfocused lead-in ("Which of the
   following is true?") fails it; one that is not a closed question (ends in a colon or runs on into the options) is a
   minor flaw */
const UNFOCUSED = /\b(?:which|what)\b[^?]*\b(?:statements?|of the following)\b[^?]*\b(?:is|are)\s+(?:true|correct|false|incorrect|accurate|right|wrong)\b|\b(?:true|correct)\s+(?:about|regarding|of|concerning)\b|\bwhich of the following (?:is|are) (?:true|correct)\b/i;
export function checkCover(q) {
  const l = leadIn(q);
  if (UNFOCUSED.test(l)) return fail('cover-options', 'major', 'Unfocused lead-in: "which is true" cannot be answered with the options covered; ask one specific question.');
  if (l && !/\?\s*$/.test(l) && (QWORD.test(l) || LEAD.test(l))) return fail('cover-options', 'minor', 'The lead-in is not a closed question: end it with a question mark so it can be answered before the options are read.');
  return ok('cover-options', 'major');
}

const ALLNONE = /^(?:all|none) of (?:the )?(?:above|following|these|them)\b|^(?:both|neither)\b.*\b(?:and|nor)\b|^(?:options? )?[a-e] (?:and|&) [a-e]\b|^(?:all|none) are (?:correct|true)\b|^all of these\b/i;
export function checkAllNone(q) {
  const i = (q.options || []).findIndex(o => ALLNONE.test(String(o).trim()));
  return i >= 0 ? fail('all-none', 'major', `Option ${'ABCDE'[i]} is "${String(q.options[i]).trim()}": "all/none of the above" and option combinations reward partial knowledge; use one best answer.`) : ok('all-none', 'major');
}

const NEG = /\b(?:EXCEPT|NOT|LEAST)\b|\b(?:except|least likely|least appropriate|not (?:true|correct|associated|seen|a feature|consistent|indicated|recommended|likely|appropriate|a cause|used|found|characteristic|typical|expected|part)|false|incorrect|untrue|contraindicated)\b|\b[Ww]hich [^?]*\b(?:is|are|would|does|do|should) not\b/;
export function checkNegative(q) {
  const l = leadIn(q), m = l.match(NEG);
  return m ? fail('negative-stem', 'major', `Negative lead-in ("${m[0]}"): ask for the best answer, not the exception.`) : ok('negative-stem', 'major');
}

/* the key is the longest option by a clear margin: test-wise students pick it */
export function checkLongest(q) {
  const o = (q.options || []).map(x => String(x).trim()), k = o[q.answer] ?? '', rest = o.filter((_, i) => i !== q.answer);
  if (!rest.length) return ok('longest-key', 'minor');
  const maxD = Math.max(...rest.map(x => x.length)), mean = rest.reduce((n, x) => n + x.length, 0) / rest.length;
  if (k.length > maxD * 1.3 && k.length - maxD >= 12 && k.length >= mean * 1.6) return fail('longest-key', 'minor', `The key is the longest option by far (${k.length} characters against at most ${maxD}): make the options similar in length and detail.`);
  return ok('longest-key', 'minor');
}

/* grammar that only the key fits: "... is an" before options of which only the key starts with a vowel, or a plural
   lead-in ("are") with only the key plural */
const vowel = s => /^[aeiou]/i.test(String(s).trim()) && !/^(?:uni|use|usu|eu|one|ur[aei])/i.test(String(s).trim());
export function checkGrammar(q) {
  const l = leadIn(q).trim(), o = (q.options || []).map(x => String(x).trim()), k = q.answer;
  const art = l.match(/\b(a|an)\s*[:.…]?$/i);
  if (art && o.length) {
    const fits = o.map(x => (art[1].toLowerCase() === 'an' ? vowel(x) : !vowel(x)));
    if (fits[k] && fits.filter(Boolean).length === 1) return fail('grammar-cue', 'major', `The lead-in ends "${art[1]}", which only the key fits: end the lead-in with a question instead.`);
  }
  if (/\bwhich\b[^?]*\bare\b[^?]*\?$/i.test(l) && o.length) {
    const plural = o.map(x => /(?:s|ae|i|a)\b$/i.test(x.split(/[,(]/)[0].trim()) && /\b(?:and)\b|s\b/i.test(x));
    if (plural[k] && plural.filter(Boolean).length === 1) return fail('grammar-cue', 'minor', 'The lead-in asks in the plural and only the key is plural.');
  }
  return ok('grammar-cue', 'major');
}

/* convergence: the key is built from the parts the distractors share (the "centroid" a test-wise student picks) */
export function checkConvergence(q) {
  const o = (q.options || []).map(content); if (o.length < 3) return ok('convergence', 'minor');
  const shared = o.map((ws, i) => { const s = new Set(ws); let n = 0; o.forEach((other, j) => { if (j !== i) for (const w of new Set(other)) if (s.has(w)) n++; }); return n; });
  const k = shared[q.answer], next = Math.max(...shared.filter((_, i) => i !== q.answer));
  if (k >= 3 && k >= 2 * Math.max(1, next) && o.filter(ws => ws.length >= 2).length >= 3) return fail('convergence', 'minor', 'Convergence cue: the key shares the most words with the other options, so it can be found by elimination.');
  return ok('convergence', 'minor');
}

/* absolute terms in the distractors only: "always", "never" mark an option as false */
const ABS = /\b(?:always|never|only|all|none|every|completely|entirely|absolutely|must|cannot|invariably|guaranteed|certainly)\b/i;
export function checkAbsolutes(q) {
  const o = (q.options || []).map(String), k = o[q.answer] ?? '';
  const hit = o.map((x, i) => (i !== q.answer && ABS.test(x) && !ALLNONE.test(x.trim()) ? i : -1)).filter(i => i >= 0);   /* "none of the above" is its own flaw */
  if (hit.length && !ABS.test(k)) return fail('absolute-terms', 'minor', `Absolute terms only in distractors (${hit.map(i => `${'ABCDE'[i]}: "${o[i].match(ABS)[0]}"`).join(', ')}): they mark those options as wrong.`);
  return ok('absolute-terms', 'minor');
}

/* clang: the key repeats the stem's words when no distractor does. The whole key in the vignette gives the answer away
   (major); one distinctive word of six letters or more is a cue (minor) */
const GENERIC = new Set(('acute chronic disease syndrome infection disorder deficiency failure injury test serum level levels blood therapy oral intravenous ' +
  'dose daily history examination normal increased decreased elevated high risk start begin continue order obtain perform immediate ' +
  'left right bilateral upper lower primary secondary pain clinical medical surgical evaluation assessment physical hospital emergency department ' +
  'continuous abdomen abdominal chest heart cardiac renal kidney liver hepatic lung pulmonary brain head neck thyroid skin breast pelvic pelvis ' +
  'stomach bowel urine urinary spine spinal joint muscle bone gland vaginal rectal ultrasonography ultrasound radiography imaging measurement ' +
  'administer administration counsel counseling reassurance discharge admit admission refer referral care home family mother father parents').split(' '));
export function checkClang(q) {
  const v = vignette(q) || '', vw = new Set(content(v)), o = (q.options || []).map(String), k = o[q.answer] ?? '';
  const kw = content(k).filter(w => !GENERIC.has(w)); if (!kw.length) return ok('clang', 'major');
  const others = new Set(o.filter((_, i) => i !== q.answer).flatMap(content));
  const phrase = norm(k);
  if (kw.length >= 1 && phrase.split(' ').length >= 2 && ` ${norm(v)} `.includes(` ${phrase} `)) return fail('clang', 'major', `The stem names the key ("${k.trim()}"): a student can match it without knowing the medicine.`);
  if (kw.length >= 2 && kw.every(w => vw.has(w)) && !kw.some(w => others.has(w))) return fail('clang', 'major', `Every word of the key ("${k.trim()}") is in the stem and in no distractor.`);
  const once = w => (content(v).filter(x => x === w).length === 1);
  const cue = kw.find(w => w.length >= 7 && vw.has(w) && once(w) && !others.has(w));
  return cue ? fail('clang', 'minor', `Clang cue: "${cue}" is in the stem and in the key, and in no distractor.`) : ok('clang', 'major');
}

const SMALL = new Set('the a an of in on at to for with and or by from as its their this that is are be'.split(' '));
/* two options alike: the same text is not a question at all (block); nearly the same wording (major) */
export function checkDuplicates(q) {
  const o = (q.options || []).map(String);
  for (let i = 0; i < o.length; i++) for (let j = i + 1; j < o.length; j++) {
    const a = norm(o[i]), b = norm(o[j]);
    if (a === b) return fail('duplicate-options', 'block', `Options ${'ABCDE'[i]} and ${'ABCDE'[j]} are the same.`);
    /* nearly the same: the same content words in any order, differing only in small words ("the", "a", "of") */
    const wa = new Set(words(o[i])), wb = new Set(words(o[j])), diff = [...wa].filter(w => !wb.has(w)).concat([...wb].filter(w => !wa.has(w)));
    if (diff.every(w => SMALL.has(w)) && [...wa].some(w => wb.has(w) && !SMALL.has(w))) return fail('duplicate-options', 'major', `Options ${'ABCDE'[i]} and ${'ABCDE'[j]} say the same thing in other words.`);
  }
  return ok('duplicate-options', 'block');
}

/* a clinical vignette has the patient's age and sex, the setting, the presenting problem and the findings */
const CLINICAL = /\b\d+[- ](?:year|month|week|day|hour)s?[- ]old\b|\b(?:patient|man|woman|boy|girl|infant|child|neonate|newborn|baby|toddler|adolescent|gravida)\b/i;
const PARTS = {
  age: /\b\d+[- ](?:year|month|week|day|hour)s?[- ]old\b|\baged? \d+|\b(?:newborn|neonate|infant|toddler|adolescent|teenager|elderly)\b|\b\d+ (?:years?|months?|weeks?) of age\b/i,
  sex: /\b(?:man|woman|male|female|boy|girl|he|she|his|her|gravida|pregnant|primigravida|mother|father|husband|wife)\b/i,
  setting: /\b(?:emergency|department|clinic|office|hospital|ward|physician|doctor|presents?|presented|comes? to|came to|brought|admitted|visit|practi[cs]e|unit|icu|appointment|follow-up|evaluation|consult|nursing home|home|school|labou?r|delivery|postoperative|surgery|paramedics?|ambulance)\b/i,
  presentation: /\b(?:history of|complain|presents? with|because of|pain|fever|symptoms?|cough|for the past|since|reports?|noticed|onset|developed|worsening|progressive|episodes?|\d+[- ](?:hour|day|week|month|year)s?\b|weakness|fatigue|nausea|vomiting|rash|swelling|bleeding|dyspnoea|dyspnea|headache|seizure|confusion|lump|unable|difficulty|concerned|routine|screening|asymptomatic|well-child|check-up|counsel)\b/i,
  findings: /\b(?:diaphoretic|distress|appears?|titers?|titres?|serolog\w*|positive|negative|reflexes|karyotype|smear|culture|examinations?|exam|temperature|pulse|blood pressure|respirations?|laborator\w*|serum|shows?|showed|reveals?|revealed|auscultation|palpation|palpable|ecg|electrocardiogram|x-ray|radiograph|ct|mri|ultrasound|ultrasonography|biopsy|count|level|saturation|tender|tenderness|bp|heart rate|spo2|°c|°f|mm hg|\/min|murmur|crackles|wheez\w*|oedema|edema|bruising|pale|jaundice|afebrile|febrile|normal|unremarkable|noted|observed|inspection|bmi|weight|height|percentile|results?)\b/i
};
export const isClinical = q => CLINICAL.test(fullStem(q));
export function checkVignette(q) {
  const s = fullStem(q);
  if (!isClinical(q)) return fail('vignette', 'minor', 'Not a clinical vignette: Step 2 CK items put a patient in front of the student (age, sex, setting, presentation, findings).');
  const missing = Object.entries(PARTS).filter(([, re]) => !re.test(vignette(q) || s)).map(([k]) => k);
  if (missing.length >= 2) return fail('vignette', 'major', `The vignette is missing ${missing.join(' and ')}.`);
  if (missing.length === 1) return fail('vignette', 'minor', `The vignette is missing the ${missing[0]}.`);
  return ok('vignette', 'major');
}

/* the stem's length: long enough to be a case, short enough to read in an exam's 90 seconds; a question written for the
   duel's Rapid 15 s format (tag form:rapid) is a compact case, so its floor is lower */
export const STEM_WORDS = Object.freeze({ min: 30, max: 450, rapid: 15 });
export function checkLength(q) {
  const n = words(fullStem(q)).length, rapid = Array.isArray(q.tags) && q.tags.includes('form:rapid'), min = rapid ? STEM_WORDS.rapid : STEM_WORDS.min;
  if (n < min) return fail('stem-length', 'minor', rapid ? `The stem is ${n} words: even a 15-second case needs ${min}.` : `The stem is ${n} words: a Step 2 CK vignette is usually ${STEM_WORDS.min} to ${STEM_WORDS.max}.`);
  if (n > STEM_WORDS.max) return fail('stem-length', 'minor', `The stem is ${n} words: cut what the question does not need (at most ${STEM_WORDS.max}).`);
  return ok('stem-length', 'minor');
}

/* a measurement without its unit: a value after a lab or vital-sign name, not followed by a unit */
const MEASURE = /\b(?:sodium|potassium|chloride|bicarbonate|calcium|magnesium|phosphate|glucose|creatinine|urea(?: nitrogen)?|bun|haemoglobin|hemoglobin|hematocrit|haematocrit|albumin|bilirubin|platelets?|platelet count|leukocyte count|white (?:blood )?cell count|wcc|crp|esr|troponin|lactate|ferritin|tsh|ph|pco2|po2|pao2|paco2|inr|alt|ast|alp|ggt|lipase|amylase|temperature|pulse|heart rate|respirations|respiratory rate|blood pressure|oxygen saturation|spo2|weight|height|bmi|hba1c|cholesterol|ldl|hdl|triglycerides|osmolality|ammonia|cortisol|prolactin|psa|beta-hcg|hcg|d-dimer|fibrinogen|egfr|gfr)\b/gi;
const UNIT = /^\s*(?:[%°º˚℃℉‰+]|[a-zµμ]{0,5}\/|\/|(?:mm|mmhg|mg|g|kg|lb|lbs|mmol|mol|meq|µ\w*|μ\w*|u|iu|miu|mu|cm|m|ml|l|dl|ng|pg|nmol|pmol|fl|sec|s|bpm|kpa|mosm|units?|cells|mcg|times|seconds|minutes|beats|breaths|copies|in|inches|ft|feet|percent|st|nd|rd|th|x|×)\b|x\s*10|×\s*10|·\s*10|on room air|percentile)/i;
const SKIP_UNITLESS = /^(?:ph|inr|bmi)$/i;
export function checkUnits(q) {
  const s = fullStem(q), bad = [];
  for (const m of s.matchAll(MEASURE)) {
    if (SKIP_UNITLESS.test(m[0])) continue;
    const after = s.slice(m.index + m[0].length, m.index + m[0].length + 40);
    const num = after.match(/^\s*(?:(?:is|was|of|at|level|levels|concentration|count|measured|reading|value|:|=|,)\s*){0,3}(\d+(?:,\d{3})*(?:\.\d+)?)(?:\s*(?:\/|to|-|–)\s*\d+(?:\.\d+)?)?/i);
    if (!num) continue;
    const rest = after.slice(num.index + num[0].length);
    if (/^\s*(?:years?|months?|weeks?|days?|hours?|-year|-month|-week|-day|-hour)/i.test(rest)) continue;
    if (!UNIT.test(rest)) bad.push(`${m[0]} ${num[1]}`);
  }
  return bad.length ? fail('units', 'minor', `A measurement without its unit: ${bad.slice(0, 3).join(', ')}.`) : ok('units', 'minor');
}

export function checkExplanation(q) {
  return String(q.explanation || '').trim().length >= 40 ? ok('explanation', 'info') : fail('explanation', 'info', 'No explanation: say why the key is right and why each distractor is wrong.');
}

export const CHECKS = Object.freeze([checkSchema, checkLeadIn, checkCover, checkAllNone, checkNegative, checkLongest, checkGrammar, checkConvergence,
  checkAbsolutes, checkClang, checkDuplicates, checkVignette, checkLength, checkUnits, checkExplanation]);
export const CHECK_IDS = Object.freeze(['schema', 'lead-in', 'cover-options', 'all-none', 'negative-stem', 'longest-key', 'grammar-cue', 'convergence',
  'absolute-terms', 'clang', 'duplicate-options', 'vignette', 'stem-length', 'units', 'explanation']);

/* every check on one question: { results, failed, score, blocked } */
export function flawReport(q) {
  const safe = { ...q, options: Array.isArray(q?.options) ? q.options : [], stem: String(q?.stem ?? '') };
  const results = CHECKS.map(c => { try { return c(safe); } catch (e) { return fail(c.name, 'block', `check failed: ${e.message}`); } });
  const failed = results.filter(r => !r.pass);
  const score = Math.max(0, 100 - failed.reduce((n, r) => n + COST[r.severity], 0));
  return { results, failed, score, blocked: failed.some(r => r.severity === 'block') };
}

/* ------------------------------------------------------------------ across a pool */
/* word 3-gram shingles of the whole question, for near-duplicates: two stems about the same case share many */
export function shingles(s, n = 3) { const w = words(s), out = new Set(); for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(' ')); if (!out.size && w.length) out.add(w.join(' ')); return out; }
export function similarity(a, b) { let n = 0; const [x, y] = a.size < b.size ? [a, b] : [b, a]; for (const s of x) if (y.has(s)) n++; return n / ((a.size + b.size - n) || 1); }
/* containment: how much of the smaller question sits inside the bigger one (a stem copied with a sentence added) */
export function containment(a, b) { let n = 0; const [x, y] = a.size < b.size ? [a, b] : [b, a]; for (const s of x) if (y.has(s)) n++; return n / (x.size || 1); }
export const DUP = Object.freeze({ jaccard: 0.5, containment: 0.8 });
export const signature = q => shingles(`${fullStem(q)} ${(q.options || []).join(' ')}`);
export function nearDuplicate(sa, sb) { const j = similarity(sa, sb), c = containment(sa, sb); return { dup: j >= DUP.jaccard || c >= DUP.containment, jaccard: j, containment: c }; }

/* the key's position across a pool: counts, and the chi-square of a uniform spread (df = k - 1; above ~7.8 for 4
   positions the spread is uneven at p < 0.05) */
export function positionBalance(items) {
  const by = new Map();
  for (const q of items) { const k = (q.options || []).length; if (!by.has(k)) by.set(k, Array(k).fill(0)); by.get(k)[q.answer]++; }
  const out = {};
  for (const [k, counts] of by) { const n = counts.reduce((a, b) => a + b, 0), e = n / k; out[k] = { counts, n, chi2: Math.round(counts.reduce((s, c) => s + (c - e) ** 2 / (e || 1), 0) * 100) / 100 }; }
  return out;
}
