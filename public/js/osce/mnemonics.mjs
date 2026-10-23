/* Memory aids (2026-10-20, founder: "make each of the acronyms to help remember as a toggle all the way at the bottom ...
   for PPH is CRAVIOPSH ... for shoulder dystocia it is HELPERR"). A hand-curated library, checked against Geeky Medics,
   Zero To Finals, Oxford Medical Education and TeachMePaediatrics (2026-10-20), in Australian usage (DRSABCD, ISBAR).
   `when` matches a station's own words (title, diagnoses, presenting problems); `spec` limits an aid to stations of
   that specialty; `types` orders the rest by the station's eMedici types. No drug doses: they stay "per local guideline", as everywhere in Learn. */
export const GROUPS = [['station', 'This station'], ['history', 'History taking'], ['exam', 'Examination'], ['acute', 'Acute and emergency'],
  ['obs', 'Obstetrics'], ['paeds', 'Paediatrics'], ['comms', 'Communication and handover']];

export const MNEMONICS = [
  // ---- history
  { id: 'socrates', name: 'SOCRATES', what: 'Any pain or symptom', group: 'history', types: ['History'], when: /pain|ache|colic|headache|cough|breath/i,
    letters: [['S', 'Site'], ['O', 'Onset'], ['C', 'Character'], ['R', 'Radiation'], ['A', 'Associated symptoms'], ['T', 'Timing'], ['E', 'Exacerbating and relieving factors'], ['S', 'Severity (0 to 10)']] },
  { id: 'ice', name: 'ICE', what: 'The patient’s perspective, every history', group: 'history', types: ['History', 'Counselling'],
    letters: [['I', 'Ideas: what do you think is going on?'], ['C', 'Concerns: what worries you most?'], ['E', 'Expectations: what were you hoping we could do today?']] },
  { id: 'mjthreads', name: 'MJ THREADS', what: 'Past medical history screen', group: 'history', types: ['History'],
    letters: [['M', 'Myocardial infarction and heart disease'], ['J', 'Jaundice and liver disease'], ['T', 'Tuberculosis'], ['H', 'Hypertension'], ['R', 'Rheumatic fever'], ['E', 'Epilepsy'], ['A', 'Asthma and COPD'], ['D', 'Diabetes'], ['S', 'Stroke and TIA']] },
  { id: 'sample', name: 'SAMPLE', what: 'Focused history in an emergency', group: 'acute', types: ['Emergency', 'Ward Call', 'Management'],
    letters: [['S', 'Signs and symptoms'], ['A', 'Allergies'], ['M', 'Medications'], ['P', 'Past history (and pregnancy)'], ['L', 'Last meal or oral intake'], ['E', 'Events leading up to this']] },
  { id: 'alarms', name: 'ALARMS', what: 'Red flags in dyspepsia: endoscopy', group: 'history', when: /dyspeps|gastritis|reflux|epigastric|peptic|helicobacter|indigestion/i,
    letters: [['A', 'Anaemia (iron deficiency)'], ['L', 'Loss of weight'], ['A', 'Anorexia'], ['R', 'Recent onset, especially age 50 or more'], ['M', 'Melaena or haematemesis'], ['S', 'Swallowing difficulty (dysphagia)']] },
  { id: 'cage', name: 'CAGE', what: 'Screening for problem drinking (with AUDIT-C)', group: 'history', when: /alcohol|drink|liver|withdraw/i,
    letters: [['C', 'Ever felt you should Cut down?'], ['A', 'Annoyed by people criticising your drinking?'], ['G', 'Felt Guilty about drinking?'], ['E', 'Eye-opener: a drink first thing in the morning?']] },
  { id: '5as', name: 'The 5As', what: 'Brief intervention: alcohol, smoking, weight (RACGP)', group: 'history', when: /alcohol|smok|nicotine|weight|obes|5 ?as|lifestyle/i,
    letters: [['A', 'Ask: about use, every patient'], ['A', 'Assess: amount, dependence (AUDIT-C), readiness to change'], ['A', 'Advise: clear, personal, non-judgemental'], ['A', 'Assist: set a goal, pharmacotherapy, resources'], ['A', 'Arrange: follow-up and referral']] },
  { id: 'travel', name: 'Pre-travel: WHERE', what: 'Travel history', group: 'history', when: /travel|vaccin|immunis|malaria|returned/i,
    letters: [['W', 'Where: countries, rural or urban'], ['H', 'How long and when: duration, departure date'], ['E', 'Exposures and activities: food, water, animals, sex, adventure'], ['R', 'Record of vaccines: routine and travel'], ['E', 'Existing conditions: pregnancy, immunosuppression, medicines']] },
  { id: 'seizure', name: 'Seizure history: before, during, after', what: 'Witness account of a fit', group: 'history', when: /seizure|fit|convuls|epilep/i,
    letters: [['B', 'Before: trigger, warning or aura, what they were doing'], ['D', 'During: what it looked like, duration, colour, incontinence, tongue biting'], ['A', 'After: drowsiness, confusion, weakness, how long to recover'], ['F', 'First? Fever? Family history? Driving and safety']] },
  // ---- examination
  { id: 'wiper', name: 'WIPER', what: 'Opening any examination', group: 'exam', types: ['Examination'],
    letters: [['W', 'Wash hands'], ['I', 'Introduce yourself, confirm identity'], ['P', 'Permission: consent, offer a chaperone'], ['E', 'Expose appropriately'], ['R', 'Reposition (e.g. 45° for cardiac and respiratory)']] },
  { id: 'ipp', name: 'Inspect, palpate, percuss, auscultate', what: 'The order of a system examination', group: 'exam', types: ['Examination'],
    letters: [['I', 'Inspection: end of bed, hands, face, then the region'], ['P', 'Palpation'], ['P', 'Percussion'], ['A', 'Auscultation'], ['+', 'Finish with special tests, and say what you would do to complete it']] },
  { id: 'leopold', name: 'Leopold’s manoeuvres', what: 'Abdominal palpation in pregnancy', group: 'exam', when: /antenatal|weeks pregnant|weeks.? gestation|third trimester|fundal height|breech|malpresentation|unstable lie|hypertension in pregnancy|pre-?eclampsia|reduced fetal/i,
    letters: [['1', 'Fundal grip: which pole is in the fundus (lie)'], ['2', 'Lateral grips: back versus limbs (position)'], ['3', 'Pawlik’s grip: presenting part above the pelvis'], ['4', 'Pelvic grip: engagement, in fifths palpable'], ['+', 'Symphysis-fundal height in cm ≈ weeks of gestation from 24 weeks']] },
  { id: 'bishop', name: 'Bishop score: DPESC', what: 'Cervix before induction (score 0 to 13)', group: 'exam', when: /cervi|induction|dilat|bishop|prolonged labour|post-?dates|hypertension in pregnancy/i,
    letters: [['D', 'Dilatation (cm)'], ['P', 'Position (posterior, mid, anterior)'], ['E', 'Effacement (%) or length'], ['S', 'Station (relative to the ischial spines)'], ['C', 'Consistency (firm, medium, soft)'], ['+', '8 or more: favourable for induction']] },
  { id: 'turner', name: 'Turner syndrome features', what: 'What to look for and test (45,X)', group: 'exam', when: /turner|short stature|delayed puberty|webbed neck/i,
    letters: [['S', 'Short stature (below mid-parental range)'], ['W', 'Webbed neck, low hairline, low-set ears'], ['C', 'Cubitus valgus, shield chest, widely spaced nipples'], ['L', 'Lymphoedema of hands and feet in infancy'], ['H', 'Heart: bicuspid aortic valve, coarctation (echo)'], ['K', 'Kidney: horseshoe kidney (renal ultrasound)'], ['O', 'Ovarian failure: raised LH and FSH, karyotype']] },
  // ---- acute
  { id: 'drsabcd', name: 'DRSABCD', what: 'Basic life support (ANZCOR)', group: 'acute', types: ['Emergency'], when: /\barrest|unresponsive|resuscitat|\bcollapsed?\b(?! on)/i,
    letters: [['D', 'Danger'], ['R', 'Response'], ['S', 'Send for help'], ['A', 'Airway'], ['B', 'Breathing'], ['C', 'CPR: 30 compressions to 2 breaths'], ['D', 'Defibrillation: attach an AED']] },
  { id: 'abcde', name: 'ABCDE', what: 'Assessing any unwell patient', group: 'acute', types: ['Emergency', 'Ward Call', 'Management'],
    letters: [['A', 'Airway: patent, protected?'], ['B', 'Breathing: RR, SpO2, work of breathing, auscultate'], ['C', 'Circulation: HR, BP, CRT, access, bloods, fluids'], ['D', 'Disability: AVPU or GCS, pupils, glucose'], ['E', 'Exposure: temperature, rash, bleeding, full look'], ['+', 'Reassess after every intervention; escalate early']] },
  { id: '4h4t', name: '4 Hs and 4 Ts', what: 'Reversible causes in cardiac arrest', group: 'acute', when: /\barrest|resuscitat|\bcollapsed?\b(?! on)/i,
    letters: [['H', 'Hypoxia'], ['H', 'Hypovolaemia'], ['H', 'Hypo/hyperkalaemia and metabolic'], ['H', 'Hypothermia'], ['T', 'Tension pneumothorax'], ['T', 'Tamponade'], ['T', 'Toxins'], ['T', 'Thrombosis (coronary or pulmonary)']] },
  { id: 'pat', spec: ['Paediatrics'], name: 'Paediatric Assessment Triangle', what: 'The from-the-door look at a sick child', group: 'paeds', when: /child|infant|toddler|baby|paed|neonat|croup|bronchiol/i,
    letters: [['A', 'Appearance: tone, interaction, consolability, look or gaze, speech or cry (TICLS)'], ['B', 'Work of breathing: noises, posture, recession, nasal flaring'], ['C', 'Circulation to skin: pallor, mottling, cyanosis']] },
  // ---- obstetrics
  { id: 'craviopsh', name: 'CRAVIOPSH', what: 'Managing primary postpartum haemorrhage', group: 'obs', when: /postpartum ha|\bpph\b|haemorrhage after|boggy uterus|atony/i,
    letters: [['C', 'Call for help and declare a PPH early; share roles among everyone in the room'], ['R', 'Rub up the fundus and expel clots; look for the cause with the 4 Ts at the same time'], ['A', 'ABC: lie her flat, keep her warm, give oxygen'], ['V', 'Venous access: two large-bore cannulas, bloods (FBC, group and crossmatch, coagulation), fluid resuscitation'], ['I', 'Indwelling catheter to empty the bladder'], ['O', 'Oxytocin stepwise, reassessing between steps; uterotonics per local guideline; IV tranexamic acid early, within 3 hours of birth'], ['P', 'Placenta and membranes complete? Assess and repair genital tract trauma'], ['S', 'Surgical measures: bimanual compression and balloon tamponade while arranging theatre; theatre if bleeding is uncontrolled'], ['H', 'Haemodynamically unstable with ongoing bleeding: activate the massive transfusion protocol']] },
  { id: '4ts', name: 'The 4 Ts', what: 'Causes of postpartum haemorrhage', group: 'obs', when: /postpartum ha|\bpph\b|haemorrhage after|boggy uterus|atony/i,
    letters: [['T', 'Tone: uterine atony (most common)'], ['T', 'Tissue: retained placenta or membranes'], ['T', 'Trauma: tears, rupture, inversion'], ['T', 'Thrombin: coagulopathy, DIC']] },
  { id: 'partum', name: 'PARTUM', what: 'Risk factors for postpartum haemorrhage (Oxford Medical Education, via Agent-Reach)', group: 'obs', when: /postpartum ha|\bpph\b|haemorrhage after|boggy uterus|atony/i,
    letters: [['P', 'Prolonged labour, polyhydramnios, previous caesarean'], ['A', 'Antepartum haemorrhage'], ['R', 'Recent history of bleeding (previous PPH)'], ['T', 'Twins (multiple pregnancy)'], ['U', 'Uterine fibroids'], ['M', 'Multiparity; macrosomia']] },
  { id: 'hipapa', name: 'HI PAPA', what: 'Complications of multiple pregnancy (Oxford Medical Education, via Agent-Reach)', group: 'obs', when: /twin|multiple pregnan/i,
    letters: [['H', 'Hydramnios (polyhydramnios)'], ['I', 'Intrauterine growth restriction'], ['P', 'Preterm labour'], ['A', 'Antepartum haemorrhage'], ['P', 'Pre-eclampsia'], ['A', 'Abortion (miscarriage)']] },
  { id: 'helperr', name: 'HELPERR', what: 'Shoulder dystocia', group: 'obs', when: /shoulder dystocia/i,
    letters: [['H', 'Help: call for it; note the time of the head’s birth'], ['E', 'Evaluate for episiotomy (to make room for internal manoeuvres)'], ['L', 'Legs: McRoberts (hyperflex the thighs onto the abdomen)'], ['P', 'Pressure: suprapubic, from behind the anterior shoulder'], ['E', 'Enter: internal rotational manoeuvres (Rubin II, Woods screw)'], ['R', 'Remove the posterior arm'], ['R', 'Roll onto all fours'], ['+', 'No fundal pressure; neonatal team at the birth; document the head-to-body interval']] },
  { id: 'drcbravado', name: 'DR C BRAVADO', what: 'Reading a CTG', group: 'obs', when: /\bctg\b|cardiotoco|fetal heart|labour|decelerat|hypertension in pregnancy|reduced fetal/i,
    letters: [['DR', 'Define risk: why is she being monitored?'], ['C', 'Contractions: per 10 minutes'], ['BRa', 'Baseline rate: 110 to 160 bpm'], ['V', 'Variability: 6 to 25 bpm'], ['A', 'Accelerations'], ['D', 'Decelerations: early, variable, late, prolonged'], ['O', 'Overall impression: normal or abnormal, and your plan']] },
  { id: 'gtpal', name: 'G T P A L', what: 'Obstetric history', group: 'obs', when: /pregnan|antenatal|obstetric|gravid|booking|pre-?eclampsia|labour/i,
    letters: [['G', 'Gravidity: number of pregnancies'], ['T', 'Term births'], ['P', 'Preterm births'], ['A', 'Abortions and miscarriages'], ['L', 'Living children']] },
  { id: 'preeclampsia', name: 'Pre-eclampsia warning symptoms', what: 'Ask every pregnant woman with high BP', group: 'obs', when: /pre-?eclampsia|eclampsia|hypertension in pregnancy|gestational hypertension/i,
    letters: [['H', 'Headache, severe or persistent'], ['V', 'Visual disturbance: flashing lights, blurring'], ['E', 'Epigastric or right upper quadrant pain'], ['S', 'Swelling: sudden, face and hands'], ['N', 'Nausea and vomiting'], ['F', 'Fetal movements reduced'], ['+', 'Thresholds: BP 140/90; severe 160/110; urine PCR 30 mg/mmol']] },
  { id: 'apgar', name: 'APGAR', what: 'Newborn at 1 and 5 minutes (0 to 10)', group: 'obs', when: /neonat|newborn|apgar|not breathing at birth/i,
    letters: [['A', 'Appearance: colour'], ['P', 'Pulse'], ['G', 'Grimace: reflex irritability'], ['A', 'Activity: tone'], ['R', 'Respiration']] },
  { id: 'nls', name: 'Newborn life support (ANZCOR 13)', what: 'A baby not breathing at birth', group: 'obs', when: /neonatal resus|newborn resus|not breathing at birth|newborn life support|apnoe/i,
    letters: [['1', 'Dry, warm, stimulate; assess tone, breathing, heart rate'], ['2', 'Airway: neutral position, clear if needed'], ['3', 'Not breathing or HR below 100: start positive-pressure ventilation in air; SpO2 probe on the right hand'], ['4', 'Check chest rise; correct mask, position, pressure'], ['5', 'HR below 60 despite 30 s of effective ventilation: compressions 3:1, increase oxygen'], ['6', 'Call the neonatal team early; reassess every 30 seconds']] },
  // ---- paediatrics
  { id: 'binds', spec: ['Paediatrics'], name: 'BINDS', what: 'Paediatric history add-ons', group: 'paeds', when: /child|infant|toddler|baby|paed|adolesc/i,
    letters: [['B', 'Birth: gestation, delivery, neonatal problems'], ['I', 'Immunisations: up to date?'], ['N', 'Nutrition: feeding, growth, weight'], ['D', 'Development: milestones, school'], ['S', 'Social: who is at home, siblings, childcare, safety']] },
  { id: 'headsss', spec: ['Paediatrics'], name: 'HEADSSS', what: 'Adolescent psychosocial history (confidential)', group: 'paeds', when: /adolesc|teen|young person|1[3-9][ -]year/i,
    letters: [['H', 'Home'], ['E', 'Education and employment'], ['A', 'Activities'], ['D', 'Drugs and alcohol'], ['S', 'Sexuality'], ['S', 'Suicide, depression, self-harm'], ['S', 'Safety and social media']] },
  { id: 'hsp', spec: ['Paediatrics'], name: 'HSP tetrad', what: 'IgA vasculitis (Henoch-Schönlein purpura)', group: 'paeds', when: /henoch|schonlein|schönlein|iga vasculitis|\bhsp\b|purpur/i,
    letters: [['P', 'Palpable purpura: legs and buttocks, normal platelets'], ['A', 'Arthralgia or arthritis'], ['A', 'Abdominal pain (watch for intussusception)'], ['R', 'Renal: haematuria and proteinuria; urinalysis and BP for 6 months']] },
  { id: 'kawasaki', spec: ['Paediatrics'], name: 'CRASH and burn', what: 'Kawasaki disease', group: 'paeds', when: /kawasaki|prolonged fever|fever .*5 days/i,
    letters: [['C', 'Conjunctivitis (non-purulent)'], ['R', 'Rash'], ['A', 'Adenopathy (cervical)'], ['S', 'Strawberry tongue, cracked lips'], ['H', 'Hands and feet: swelling, later peeling'], ['Burn', 'Fever for 5 days or more']] },
  { id: 'croup', spec: ['Paediatrics'], name: 'Croup severity', what: 'What to look at in a child with stridor', group: 'paeds', when: /croup|stridor|laryngotrach/i,
    letters: [['S', 'Stridor at rest or only when upset'], ['R', 'Recession: chest wall and tracheal tug'], ['A', 'Agitation or drowsiness'], ['C', 'Colour and SpO2 (low SpO2 is a late sign)'], ['+', 'Keep the child calm on the parent; never examine the throat']] },
  { id: 'dev', spec: ['Paediatrics'], name: 'Developmental domains', what: 'Milestone history', group: 'paeds', when: /develop|milestone|delay|speech/i,
    letters: [['G', 'Gross motor'], ['F', 'Fine motor and vision'], ['S', 'Speech, language and hearing'], ['S', 'Social, emotional and self-care']] },
  // ---- communication and handover
  { id: 'isbar', name: 'ISBAR', what: 'Handing over or calling a senior', group: 'comms', types: ['Emergency', 'Ward Call', 'Management'],
    letters: [['I', 'Identify yourself, your role and the patient'], ['S', 'Situation: what is happening now'], ['B', 'Background: relevant history'], ['A', 'Assessment: obs, findings, what you think'], ['R', 'Recommendation: what you need, and by when']] },
  { id: 'spikes', name: 'SPIKES', what: 'Breaking bad news', group: 'comms', when: /bad news|diagnosis of|cancer|malignan|stillbirth|death|died|metasta|terminal|palliat/i,
    letters: [['S', 'Setting: private, sitting, support person, no interruptions'], ['P', 'Perception: what do you understand so far?'], ['I', 'Invitation: how much would you like to know?'], ['K', 'Knowledge: warning shot, plain words, small chunks'], ['E', 'Emotions: pause, acknowledge, empathise'], ['S', 'Strategy and summary: plan, questions, follow-up']] },
  { id: 'bran', name: 'BRAN', what: 'Informed consent', group: 'comms', types: ['Counselling'], when: /consent|procedure|operation|surgery|lumbar puncture/i,
    letters: [['B', 'Benefits'], ['R', 'Risks: common and serious'], ['A', 'Alternatives'], ['N', 'Nothing: what if we do nothing?']] },
  { id: 'safetynet', name: 'Safety netting', what: 'Closing any consultation or discharge', group: 'comms', types: ['History', 'Counselling', 'Management'],
    letters: [['W', 'What to watch for: specific red flags in plain words'], ['W', 'When to come back or call 000'], ['W', 'Where: GP, ED, the ward number'], ['F', 'Follow-up: who, when, what results to review'], ['+', 'Check understanding (teach-back) and give written information']] },
  // ---- expansion 2026-10-22: established teaching mnemonics for the remaining station families
  { id: 'snoop', name: 'SNOOP', what: 'Headache red flags', group: 'history', when: /headache|raised intracranial|brain (tumou?r|met)|subarachnoid|meningitis/i,
    letters: [['S', 'Systemic: fever, weight loss, cancer, immunosuppression'], ['N', 'Neurological signs or confusion'], ['O', 'Onset sudden: thunderclap, worst ever'], ['O', 'Older: new headache over 50'], ['P', 'Pattern change, positional, papilloedema, pregnancy']] },
  { id: 'sigecaps', name: 'SIG E CAPS', what: 'Depression screen (with mood and suicide risk)', group: 'history', when: /depress|low mood|postnatal mood|suicid/i,
    letters: [['S', 'Sleep change'], ['I', 'Interest lost (anhedonia)'], ['G', 'Guilt or worthlessness'], ['E', 'Energy low'], ['C', 'Concentration poor'], ['A', 'Appetite change'], ['P', 'Psychomotor slowing or agitation'], ['S', 'Suicidal thoughts: ask directly']] },
  { id: 'digfast', name: 'DIG FAST', what: 'Mania', group: 'history', when: /mania|manic|bipolar|psychosis/i,
    letters: [['D', 'Distractibility'], ['I', 'Impulsivity, indiscretion'], ['G', 'Grandiosity'], ['F', 'Flight of ideas'], ['A', 'Activity increased'], ['S', 'Sleep need decreased'], ['T', 'Talkative, pressured speech']] },
  { id: 'bathe', name: 'BATHE', what: 'Psychosocial check-in, any GP consult', group: 'history', types: ['Counselling', 'History'],
    letters: [['B', 'Background: what is going on in your life?'], ['A', 'Affect: how do you feel about it?'], ['T', 'Trouble: what troubles you most?'], ['H', 'Handling: how are you handling it?'], ['E', 'Empathy: that sounds really hard']] },
  { id: 'snap', name: 'SNAP', what: 'Lifestyle risk factors (RACGP)', group: 'history', when: /lifestyle|prevent|health check|cardiovascular risk|alcohol|smok|obes/i,
    letters: [['S', 'Smoking'], ['N', 'Nutrition'], ['A', 'Alcohol'], ['P', 'Physical activity']] },
  { id: 'frames', name: 'FRAMES', what: 'Brief intervention for alcohol', group: 'comms', when: /alcohol|drink|5 ?as/i,
    letters: [['F', 'Feedback on their risk'], ['R', 'Responsibility for change is theirs'], ['A', 'Advice to cut down, clearly given'], ['M', 'Menu of options'], ['E', 'Empathy, no judgement'], ['S', 'Self-efficacy: they can do this']] },
  { id: 'gals', name: 'GALS', what: 'Musculoskeletal screen', group: 'exam', when: /arthr|joint|limp|back pain|musculoskeletal/i, types: ['Examination'],
    letters: [['G', 'Gait'], ['A', 'Arms'], ['L', 'Legs'], ['S', 'Spine']] },
  { id: 'reflexes', name: 'One, two, buckle my shoe', what: 'Reflex roots', group: 'exam', types: ['Examination'], when: /neurolog|reflex|weakness|cord compress|radiculop/i,
    letters: [['S1-2', 'Ankle'], ['L3-4', 'Knee'], ['C5-6', 'Biceps and supinator'], ['C7-8', 'Triceps']] },
  { id: '5fs', name: 'The 5 Fs', what: 'Abdominal distension', group: 'exam', when: /distension|distended|bloat|ascites/i,
    letters: [['F', 'Fat'], ['F', 'Fluid'], ['F', 'Faeces'], ['F', 'Flatus'], ['F', 'Fetus']] },
  { id: '6ps', name: 'The 6 Ps', what: 'Acute limb ischaemia or compartment syndrome', group: 'exam', when: /limb ischaem|compartment|cold leg|embol/i,
    letters: [['P', 'Pain (out of proportion)'], ['P', 'Pallor'], ['P', 'Pulselessness'], ['P', 'Paraesthesia'], ['P', 'Paralysis'], ['P', 'Perishingly cold']] },
  { id: 'fast', name: 'FAST', what: 'Stroke recognition', group: 'acute', when: /stroke|\btia\b|facial droop|hemipleg/i,
    letters: [['F', 'Face drooping'], ['A', 'Arm weakness'], ['S', 'Speech slurred or lost'], ['T', 'Time: note onset, call the stroke team now']] },
  { id: 'aeioutips', name: 'AEIOU TIPS', what: 'Causes of reduced consciousness', group: 'acute', when: /unconscious|reduced consciousness|\bgcs\b|coma|unresponsive/i,
    letters: [['A', 'Alcohol and other toxins'], ['E', 'Epilepsy, electrolytes, encephalopathy'], ['I', 'Insulin: hypo- or hyperglycaemia'], ['O', 'Opiates, oxygen (hypoxia)'], ['U', 'Uraemia'], ['T', 'Trauma, temperature'], ['I', 'Infection'], ['P', 'Psychiatric, poisoning'], ['S', 'Stroke, shock, space-occupying lesion']] },
  { id: 'pinchme', name: 'PINCH ME', what: 'Reversible causes of delirium', group: 'acute', when: /delirium|confus|agitat/i,
    letters: [['P', 'Pain'], ['I', 'Infection'], ['N', 'Nutrition'], ['C', 'Constipation'], ['H', 'Hydration'], ['M', 'Medication'], ['E', 'Environment']] },
  { id: 'mudpiles', name: 'MUDPILES', what: 'Raised anion gap acidosis', group: 'acute', when: /\bdka\b|ketoacidosis|acidosis|overdose|anion gap/i,
    letters: [['M', 'Methanol'], ['U', 'Uraemia'], ['D', 'Diabetic (and alcoholic, starvation) ketoacidosis'], ['P', 'Paracetamol, propylene glycol'], ['I', 'Iron, isoniazid'], ['L', 'Lactic acidosis'], ['E', 'Ethylene glycol'], ['S', 'Salicylates']] },
  { id: 'aeiou', name: 'AEIOU', what: 'Indications for urgent dialysis', group: 'acute', when: /renal failure|kidney injury|\baki\b|hyperkal|dialysis/i,
    letters: [['A', 'Acidosis, refractory'], ['E', 'Electrolytes: refractory hyperkalaemia'], ['I', 'Intoxication (dialysable toxins)'], ['O', 'Overload: fluid, refractory'], ['U', 'Uraemia: pericarditis, encephalopathy']] },
  { id: 'chest', name: '33 92 CHEST', what: 'Life-threatening asthma', group: 'acute', when: /asthma|wheez/i,
    letters: [['33', 'PEF under 33% of best or predicted'], ['92', 'SpO2 under 92%'], ['C', 'Cyanosis'], ['H', 'Hypotension'], ['E', 'Exhaustion, altered consciousness'], ['S', 'Silent chest'], ['T', 'Tachyarrhythmia or bradycardia']] },
  { id: 'sepsis6', name: 'Sepsis Six', what: 'Within the first hour', group: 'acute', when: /sepsis|septic|neutropen|rigor/i,
    letters: [['1', 'Oxygen to target saturations'], ['2', 'Blood cultures before antibiotics'], ['3', 'IV antibiotics per local protocol'], ['4', 'IV fluid if hypotensive or lactate raised'], ['5', 'Lactate (venous gas)'], ['6', 'Urine output: hourly']] },
  { id: 'renalred', name: 'Renal colic: refer today if', what: 'When a stone needs a urologist now', group: 'acute', when: /renal colic|kidney stone|ureteric|nephrolith|urolith/i,
    letters: [['F', 'Fever or sepsis: an infected obstructed kidney'], ['A', 'AKI, or a solitary or transplant kidney'], ['P', 'Pain not controlled, or vomiting with no oral intake'], ['L', 'Large stone (over about 5 to 10 mm), unlikely to pass'], ['+', 'Exclude AAA in an older man with a "first renal colic"']] },
  { id: 'gibleed', name: 'Upper GI bleed: high risk', what: 'Glasgow-Blatchford in words', group: 'acute', when: /gastritis|peptic|ulcer|haematemesis|melaena|upper gi/i,
    letters: [['U', 'Urea raised'], ['H', 'Haemoglobin low'], ['B', 'BP low, pulse 100 or more'], ['M', 'Melaena or syncope'], ['L', 'Liver or heart failure'], ['+', 'NSAIDs, alcohol, H. pylori, anticoagulants: ask every time']] },
  { id: '5ws', name: 'The 5 Ws', what: 'Postoperative or postpartum fever', group: 'obs', when: /postpartum fever|puerper|post-?op.*fever|fever after (surgery|caesarean|birth)/i,
    letters: [['W', 'Wind: atelectasis, pneumonia'], ['W', 'Water: urinary tract infection'], ['W', 'Wound infection'], ['W', 'Walking: DVT and PE'], ['W', 'Womb (endometritis) and wonder drugs']] },
  { id: 'torch', spec: ['Paediatrics', 'Obstetrics'], name: 'TORCH', what: 'Congenital infections', group: 'paeds', when: /congenital infection|torch|microcephal|rash in pregnancy/i,
    letters: [['T', 'Toxoplasmosis'], ['O', 'Other: syphilis, varicella, parvovirus B19, Zika'], ['R', 'Rubella'], ['C', 'Cytomegalovirus'], ['H', 'Herpes simplex (and HIV, hepatitis B)']] },
  { id: 'ten4', spec: ['Paediatrics'], name: 'TEN-4', what: 'Bruising that raises concern for abuse', group: 'paeds', when: /bruis|non-?accidental|abuse|safeguard|child protection/i,
    letters: [['T', 'Torso'], ['E', 'Ears'], ['N', 'Neck'], ['4', 'Any bruise in a baby under 4 months, or on TEN under 4 years']] },
  { id: 'urwc', name: 'Capacity: U R W C', what: 'Can they decide this?', group: 'comms', when: /capacity|refus|discharge against|competen/i,
    letters: [['U', 'Understand the information'], ['R', 'Retain it long enough'], ['W', 'Weigh it up'], ['C', 'Communicate a choice']] },
];

/* the station's own words, for matching */
const words = st => [st.title, ...(st.diagnosis || []), ...(st.presentation || [])].map(x => String(x || '')).join(' ');   /* not the
   description: its incidental words ("a big baby", "including consent") pulled in aids the case is not about */

/* -> [{group, label, items}] with "This station" first: the aids whose `when` names this case; then every other aid by
   group, the ones that fit the station's type ordered first */
export function mnemonicsFor(st) {
  const text = words(st), types = new Set(st.type || []);
  const spec = new Set(st.specialty || []);
  const hits = MNEMONICS.filter(m => m.when && m.when.test(text) && (!m.spec || m.spec.some(x => spec.has(x))));
  const fit = m => (m.types || []).some(t => types.has(t));
  const hitIds = new Set(hits.map(m => m.id));
  const out = hits.length ? [{ group: 'station', label: 'This station', items: hits }] : [];
  for (const [g, label] of GROUPS) {
    if (g === 'station') continue;
    const items = MNEMONICS.filter(m => m.group === g && !hitIds.has(m.id)).sort((a, b) => fit(b) - fit(a));
    if (items.length) out.push({ group: g, label, items });
  }
  return out;
}
