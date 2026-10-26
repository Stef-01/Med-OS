/* ranges.mjs — normal ranges beside a question (UWorld and AMBOSS keep lab values a tap away; a stem that says
   "potassium 6.8" means little to a student without 3.5 to 5.2 next to it). Adult and Australian: mostly the ranges
   Med-OS's own stations use (the commonest range for each test across their 433 lab panels, 2026-10-26; both sexes
   where the stations split them); the arterial gas, fasting glucose, HbA1c, serum bicarbonate (RCPA's harmonised
   22-32), the anion gap and the diagnostic cut-offs in the notes are the standard values. Labs differ: the sheet says
   so. Pure: data in, matches out. */

/* g: group · t: the test · r: range · u: units · n: a note · k: what a stem calls it (lowercase, matched as words) */
export const RANGES = Object.freeze([
  { g: 'Full blood count', t: 'Haemoglobin', r: 'Men 130–180, women 115–165', u: 'g/L', k: ['haemoglobin', 'hemoglobin', 'hb'] },
  { g: 'Full blood count', t: 'MCV', r: '80–100', u: 'fL', k: ['mcv', 'mean cell volume'] },
  { g: 'Full blood count', t: 'MCH', r: '27–33', u: 'pg', k: ['mch'] },
  { g: 'Full blood count', t: 'White cell count', r: '4.0–11.0', u: '×10⁹/L', k: ['white cell count', 'white cells', 'wcc', 'white blood cell', 'leucocyte count', 'leukocyte count'] },
  { g: 'Full blood count', t: 'Neutrophils', r: '2.0–7.5', u: '×10⁹/L', k: ['neutrophil', 'neutrophils'] },
  { g: 'Full blood count', t: 'Lymphocytes', r: '1.0–4.0', u: '×10⁹/L', k: ['lymphocyte', 'lymphocytes'] },
  { g: 'Full blood count', t: 'Eosinophils', r: '0.0–0.5', u: '×10⁹/L', k: ['eosinophil', 'eosinophils'] },
  { g: 'Full blood count', t: 'Platelets', r: '150–400', u: '×10⁹/L', k: ['platelet', 'platelets'] },
  { g: 'Full blood count', t: 'ESR', r: '<20', u: 'mm/h', n: 'Rises with age', k: ['esr'] },

  { g: 'Kidney and electrolytes', t: 'Sodium', r: '135–145', u: 'mmol/L', k: ['sodium'] },
  { g: 'Kidney and electrolytes', t: 'Potassium', r: '3.5–5.2', u: 'mmol/L', k: ['potassium'] },
  { g: 'Kidney and electrolytes', t: 'Chloride', r: '95–110', u: 'mmol/L', k: ['chloride'] },
  { g: 'Kidney and electrolytes', t: 'Bicarbonate (serum)', r: '22–32', u: 'mmol/L', k: ['bicarbonate'] },
  { g: 'Kidney and electrolytes', t: 'Urea', r: '3.0–8.0', u: 'mmol/L', k: ['urea'] },
  { g: 'Kidney and electrolytes', t: 'Creatinine', r: 'Men 60–110, women 45–90', u: 'µmol/L', k: ['creatinine'] },
  { g: 'Kidney and electrolytes', t: 'eGFR', r: '>90', u: 'mL/min/1.73 m²', n: 'Below 60 for 3 months or more is chronic kidney disease', k: ['egfr'] },
  { g: 'Kidney and electrolytes', t: 'Calcium (corrected)', r: '2.10–2.60', u: 'mmol/L', k: ['calcium', 'corrected calcium'] },
  { g: 'Kidney and electrolytes', t: 'Ionised calcium', r: '1.12–1.32', u: 'mmol/L', k: ['ionised calcium', 'ionized calcium'] },
  { g: 'Kidney and electrolytes', t: 'Phosphate', r: '0.75–1.50', u: 'mmol/L', k: ['phosphate'] },
  { g: 'Kidney and electrolytes', t: 'Magnesium', r: '0.70–1.10', u: 'mmol/L', k: ['magnesium'] },
  { g: 'Kidney and electrolytes', t: 'Osmolality', r: '275–295', u: 'mOsm/kg', k: ['osmolality'] },
  { g: 'Kidney and electrolytes', t: 'Urine albumin:creatinine ratio', r: 'Men <2.5, women <3.5', u: 'mg/mmol', k: ['albumin:creatinine', 'albumin to creatinine', 'acr'] },

  { g: 'Liver', t: 'Bilirubin', r: '<20', u: 'µmol/L', k: ['bilirubin'] },
  { g: 'Liver', t: 'ALT', r: '<40', u: 'U/L', k: ['alt', 'alanine aminotransferase'] },
  { g: 'Liver', t: 'AST', r: '<40', u: 'U/L', k: ['ast', 'aspartate aminotransferase'] },
  { g: 'Liver', t: 'ALP', r: '30–110', u: 'U/L', k: ['alp', 'alkaline phosphatase'] },
  { g: 'Liver', t: 'GGT', r: '<60', u: 'U/L', k: ['ggt', 'gamma-glutamyl transferase'] },
  { g: 'Liver', t: 'Albumin', r: '35–50', u: 'g/L', k: ['albumin'] },
  { g: 'Liver', t: 'Total protein', r: '60–80', u: 'g/L', k: ['total protein'] },
  { g: 'Liver', t: 'Lipase', r: '<60', u: 'U/L', k: ['lipase'] },

  { g: 'Coagulation', t: 'INR', r: '0.9–1.2', u: '', n: 'On warfarin the target is usually 2–3', k: ['inr'] },
  { g: 'Coagulation', t: 'APTT', r: '25–38', u: 's', k: ['aptt'] },
  { g: 'Coagulation', t: 'Fibrinogen', r: '2.0–4.0', u: 'g/L', k: ['fibrinogen'] },
  { g: 'Coagulation', t: 'D-dimer', r: '<0.50', u: 'mg/L FEU', k: ['d-dimer', 'd dimer'] },

  { g: 'Blood gas', t: 'pH (arterial)', r: '7.35–7.45', u: '', k: ['ph'] },
  { g: 'Blood gas', t: 'PaCO₂', r: '35–45', u: 'mmHg', k: ['paco2', 'pco2', 'paco₂', 'pco₂'] },
  { g: 'Blood gas', t: 'PaO₂ (room air)', r: '80–100', u: 'mmHg', k: ['pao2', 'po2', 'pao₂', 'po₂'] },
  { g: 'Blood gas', t: 'HCO₃ (gas)', r: '22–28', u: 'mmol/L', k: ['hco3', 'hco₃'] },
  { g: 'Blood gas', t: 'Base excess', r: '−2 to +2', u: 'mmol/L', k: ['base excess'] },
  { g: 'Blood gas', t: 'Lactate', r: '<2.0', u: 'mmol/L', k: ['lactate'] },
  { g: 'Blood gas', t: 'pH (venous)', r: '7.32–7.42', u: '', k: ['venous blood gas', 'vbg'] },
  { g: 'Blood gas', t: 'pCO₂ (venous)', r: '37–50', u: 'mmHg', k: ['venous blood gas', 'vbg'] },
  { g: 'Blood gas', t: 'Anion gap', r: '8–16', u: 'mmol/L', n: 'Na − (Cl + HCO₃)', k: ['anion gap'] },
  { g: 'Blood gas', t: 'Ketones (β-hydroxybutyrate)', r: '<0.6', u: 'mmol/L', n: '3.0 or more with acidosis is DKA', k: ['ketone', 'ketones', 'beta-hydroxybutyrate', 'β-hydroxybutyrate'] },

  { g: 'Inflammation and the heart', t: 'CRP', r: '<5', u: 'mg/L', k: ['crp', 'c-reactive protein'] },
  { g: 'Inflammation and the heart', t: 'hs-Troponin', r: 'Below the 99th centile', u: 'ng/L', n: 'Assay-specific (hs-TnT <14); a rise or fall on repeat matters', k: ['troponin'] },
  { g: 'Inflammation and the heart', t: 'BNP', r: '<100', u: 'ng/L', k: ['bnp'] },
  { g: 'Inflammation and the heart', t: 'NT-proBNP', r: '<300', u: 'ng/L', n: 'Below 300 makes acute heart failure unlikely', k: ['nt-probnp', 'probnp'] },
  { g: 'Inflammation and the heart', t: 'Creatine kinase', r: '<200', u: 'U/L', k: ['creatine kinase', 'ck'] },

  { g: 'Hormones and glucose', t: 'TSH', r: '0.4–4.0', u: 'mIU/L', k: ['tsh'] },
  { g: 'Hormones and glucose', t: 'Free T4', r: '10–20', u: 'pmol/L', k: ['free t4', 'ft4', 'thyroxine'] },
  { g: 'Hormones and glucose', t: 'Glucose (fasting)', r: '3.0–5.4', u: 'mmol/L', n: '7.0 or more is diabetes', k: ['glucose', 'blood sugar', 'bsl'] },
  { g: 'Hormones and glucose', t: 'Glucose (random)', r: '3.0–7.7', u: 'mmol/L', n: '11.1 or more is diabetes', k: ['glucose', 'blood sugar', 'bsl'] },
  { g: 'Hormones and glucose', t: 'HbA1c', r: '<6.0 % (<42 mmol/mol)', u: '', n: '6.5 % (48 mmol/mol) or more is diabetes', k: ['hba1c'] },
  { g: 'Hormones and glucose', t: 'β-hCG (serum)', r: '<5', u: 'IU/L', n: 'Not pregnant', k: ['hcg'] },

  { g: 'Iron and vitamins', t: 'Ferritin', r: '30–500', u: 'µg/L', n: 'Below 30 is iron deficiency; inflammation raises it', k: ['ferritin'] },
  { g: 'Iron and vitamins', t: 'Transferrin saturation', r: '15–45', u: '%', k: ['transferrin saturation', 'tsat'] },
  { g: 'Iron and vitamins', t: 'Vitamin B12', r: '150–700', u: 'pmol/L', k: ['b12'] },
  { g: 'Iron and vitamins', t: 'Folate (serum)', r: '>7', u: 'nmol/L', k: ['folate'] },

  { g: 'Lipids', t: 'Total cholesterol', r: '<5.5', u: 'mmol/L', k: ['total cholesterol', 'cholesterol'] },
  { g: 'Lipids', t: 'LDL cholesterol', r: '<3.5', u: 'mmol/L', n: 'Lower with risk: <1.8 after a heart attack', k: ['ldl'] },
  { g: 'Lipids', t: 'HDL cholesterol', r: '>1.0', u: 'mmol/L', k: ['hdl'] },
  { g: 'Lipids', t: 'Triglycerides', r: '<2.0', u: 'mmol/L', k: ['triglyceride', 'triglycerides'] },
]);
export const GROUPS = Object.freeze([...new Set(RANGES.map(x => x.g))]);

/* a result: the name as a whole word ("hb" is not in "HbA1c", "ph" not in "phosphate", "alt" not in "alternative")
   with a number after it in the same clause ("potassium is 6.9", "Hb 82"; not "sodium valproate", "calcium gluconate") */
const word = k => new RegExp(`(^|[^a-z0-9])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-z0-9])[^;\\n]{0,40}?\\d`, 'i');
const KEYS = RANGES.map(x => x.k.map(word));

/* the tests a question gives a result for, in the order it gives them (each once) */
export function inText(text) {
  const s = String(text || '');
  return RANGES.map((x, i) => ({ x, at: Math.min(...KEYS[i].map(re => { const m = re.exec(s); return m ? m.index : Infinity; })) }))
    .filter(m => m.at < Infinity).sort((a, b) => a.at - b.at).map(m => m.x);
}
/* the sheet's search: a word of the test's name, or of anything a stem calls it, that starts with what was typed
   ("trop" is troponin, not neutrophils) */
export function find(q) {
  const s = String(q || '').trim().toLowerCase();
  const starts = v => { const l = v.toLowerCase(); return l.startsWith(s) || l.split(/[^a-z0-9₂₃β]+/).some(w => w.startsWith(s)); };
  return s ? RANGES.filter(x => starts(x.t) || x.k.some(starts)) : RANGES;
}
