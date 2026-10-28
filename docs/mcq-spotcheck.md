# MCQ spot-check

Written by `node scripts/mcq-spotcheck.mjs` on 2026-10-28: 40 questions from the standard pool, spread over its kinds. Every one passed the model review and the bar; this is the check a person makes.

For each question, record a call: `node scripts/mcq-spotcheck.mjs --mark <number> <call> [--note "..."] [--by "your name"]` (or by hand in `data/mcq/spotcheck.json` under `marks`, keyed by its id). The calls:

- `ok`: fine as it is
- `key`: the key is wrong
- `sba`: not a single best answer (another option is as good)
- `unsafe`: unsafe or out of date for Australian practice
- `unclear`: unclear or flawed wording
- `other`: something else (say what in the note)

Then `node scripts/mcq-evals.mjs` reports what the marks say (docs/mcq-evals.md, section 6).

## 1. ai-mcq-8a426199 (ai, General Surgery)

A 74-year-old woman presents to the emergency department with 2 days of colicky abdominal pain, distension and repeated vomiting, which is now faeculent. She has passed no flatus for 24 hours. She has known gallstones and has never had abdominal surgery. Her medicines are perindopril, metformin and ibuprofen. Her temperature is 37.2°C, pulse is 108/min, blood pressure is 112/68 mmHg and respiratory rate is 16/min. Her mucous membranes are dry. Her abdomen is distended, with high-pitched bowel sounds and no peritonism. An abdominal X-ray shows dilated small bowel loops with multiple air-fluid levels. Venous blood results:
pH 7.43 (7.32 to 7.42)
pCO2 46 mmHg (41 to 51)
Bicarbonate 30 mmol/L (22 to 28)
Base excess +6 mmol/L (-2 to +2)
Lactate 1.8 mmol/L (less than 2.0)
Sodium 136 mmol/L (135 to 145)
Potassium 2.8 mmol/L (3.5 to 5.2)
Chloride 93 mmol/L (95 to 110)
Creatinine 128 µmol/L (her baseline is 78) **Which of the following best describes these blood gas findings?**

- A. Respiratory acidosis with renal bicarbonate retention
- B. Lactic acidosis from metformin and kidney injury
- C. Normal anion gap acidosis from small bowel losses
- D. Metabolic alkalosis from gastric acid and volume loss  **(key)**
- E. Mixed high anion gap acidosis and alkalosis

*Explanation:* The pH is at the alkalaemic end, and bicarbonate (30 mmol/L) and base excess (+6) are both raised. That means the main problem is metabolic alkalosis. The low chloride (93 mmol/L) and low potassium (2.8 mmol/L) show it is hypochloraemic and hypokalaemic, the typical picture with vomiting. Losing gastric hydrochloric acid produces the alkalosis. Losing volume then keeps it going: it causes a prerenal acute kidney injury (creatinine 1.6 times her baseline) and switches on aldosterone, so the kidney holds on to bicarbonate and loses potassium. A venous pCO2 of 46 mmHg is within the normal range and fits mild respiratory compensation, not a primary respiratory problem. The anion gap is normal (136 - (93 + 30) = 13) and lactate is normal, so there is no hidden acidosis, although a normal lactate does not rule out bowel ischaemia. In practice she needs IV 0.9% sodium chloride with potassium chloride, magnesium checked, and her perindopril, metformin and ibuprofen withheld.

*Source:* Written by AI from Med-OS station ai-8b37c286

## 2. osce-amsa-204 (amsa, Respiratory Medicine)

A 26-year-old woman in general practice. Six-week progressive productive cough with 5 days of haemoptysis, low-grade fever, fatigue, breathlessness and 5 kg weight loss; born in and travels annually to Cambodia; right upper zone crackles and right upper lobe opacification. **What is the most likely diagnosis?**

- A. Lung cancer
- B. Pulmonary embolism
- C. Melioidosis
- D. Pulmonary tuberculosis  **(key)**

*Explanation:* Pulmonary tuberculosis fits: six-week progressive productive cough with 5 days of haemoptysis, low-grade fever, fatigue, breathlessness and 5 kg weight loss; born in and travels annually to Cambodia; right upper zone crackles and right upper lobe opacification. A cough lasting more than 3 weeks with haemoptysis, fever and weight loss in someone born in or travelling to a country with high TB rates is pulmonary TB until proven otherwise.

*Source:* AMSA MedEd OSCEs: Cough History 3

## 3. headqa-2014-228 (open-exam, Respiratory Medicine)

A 58-year-old woman enters the Short Stay Medical Unit due to a clinical picture that began with an episode of syncope and then presented feeling of dizziness and dyspnea. On physical examination, she is sweaty, afebrile at 126 beats per minute and at 30 breaths per minute, with a blood pressure of 88/46 and an oxygen saturation of 85% while breathing room air. Cardiac auscultation shows tachycardia without murmurs or gallop and pulmonary auscultation is clean. Which, among the following, seems the most likely diagnosis?

- A. Pulmonary embolism.  **(key)**
- B. Acute cerebrovascular accident of posterior territory.
- C. Acute coronary syndrome
- D. Hypovolemic shock.
- E. Acute pulmonary edema secondary to atrial flutter.

*Explanation (AI-written for the bank; mark `other` with a note if it is wrong):* She had sudden syncope, then dyspnoea, tachycardia, tachypnoea, hypotension and marked hypoxaemia (saturation 85%), yet her lungs are clear and there are no murmurs or gallop. Hypoxic shock with clear lungs points to massive (high-risk) pulmonary embolism.

*Source:* HEAD-QA (Vilares and Gómez-Rodríguez, ACL 2019): Spanish MIR exam question, Ministerio de Sanidad, as translated by the dataset's authors; documents last updated 14 January 2019

## 4. medqa-us4-test-0615 (usmle-resource, Psychiatry)

A 31-year-old man, who was hospitalized for substance-induced psychosis two days prior, has had episodic neck stiffness and pain for the past 8 hours. These episodes last for approximately 25 minutes and are accompanied by his neck rotating to the right. During the last episode, he was able to relieve the stiffness by lightly touching his jaw. He has received six doses of haloperidol for auditory hallucinations since his admission. He appears anxious. His temperature is 37.3°C (99.1°F), pulse is 108/min, and blood pressure is 128/86 mm Hg. Examination shows a flexed neck rotated to the right. The neck is rigid with limited range of motion. Which of the following is the most appropriate therapy for this patient's symptoms?

- A. Benztropine  **(key)**
- B. Physical therapy
- C. Dantrolene
- D. Baclofen

*Explanation (AI-written for the bank; mark `other` with a note if it is wrong):* Painful twisting of the neck (torticollis), with a sensory trick that relieves it, within days of starting haloperidol is acute dystonia. Treat it with an anticholinergic such as benztropine; diphenhydramine is an alternative.

*Source:* MedQA (Jin et al. 2020), US, 4-option, test split

## 5. ai-mcq-75604e12 (ai, General Surgery)

A 21-year-old man comes to a suburban general practice with 16 hours of abdominal pain. It started overnight as a vague ache around his umbilicus and has since moved to the right lower abdomen. He has vomited twice, has not eaten since yesterday, and says the walk from the car park jolted the pain. He has no diarrhoea and no urinary symptoms. He has no past medical history and takes no regular medicines. His temperature is 38.1 °C, heart rate 106/min, blood pressure 122/74 mmHg, respiratory rate 18/min, and oxygen saturation 98% on room air. He lies still on the couch. He is tender at McBurney's point with guarding, and pressing on the left iliac fossa causes pain on the right. Bowel sounds are present. A urine dipstick shows ketones 1+ and is negative for blood, leucocytes and nitrites. He asks if he can go home and see how he feels tomorrow. **Which of the following is the most appropriate next step in management?**

- A. Arrange an outpatient abdominal ultrasound and review the result tomorrow
- B. Start oral amoxicillin with clavulanate and review him in 24 hours
- C. Withhold all analgesia until a surgeon has examined his abdomen
- D. Give analgesia, keep nil by mouth and arrange same-day hospital referral  **(key)**
- E. Request faecal calprotectin and refer him to a gastroenterologist

*Explanation:* This young man most likely has acute appendicitis. He has periumbilical pain that has moved to the right iliac fossa, anorexia, vomiting, fever, tachycardia, pain when jolted, guarding at McBurney's point and a positive Rovsing's sign. A normal urine dipstick does not rule it out. When appendicitis is suspected in general practice, he needs same-day transfer to an emergency department or surgical unit. The GP should phone a handover, keep him nil by mouth in case he needs theatre, give adequate analgesia, record his allergies and arrange safe transport. Giving analgesia does not hide the diagnosis or delay it. If the diagnosis is confirmed, antibiotics are given in hospital under eTG guidance, alongside appendicectomy or, for some patients, supervised non-operative care. Sending him home raises the risk of perforation, peritonitis and abscess.

*Source:* Written by AI from Med-OS station amsa-212

## 6. osce-amsa-268 (amsa, Neurology)

A 30-year-old man in general practice. Strictly left orbital pain at 10/10, lasting 2 to 3 hours, at the same time almost daily for 2 months and waking him, with same-sided tearing, red eye, rhinorrhoea and partial Horner's, restlessness, an earlier bout a year ago with 8 pain-free months, a father with similar headaches, and a normal examination and MRI. **What is the most likely diagnosis?**

- A. Subarachnoid haemorrhage
- B. Cluster headache  **(key)**
- C. Space-occupying lesion or raised intracranial pressure
- D. Carotid artery dissection

*Explanation:* Cluster headache fits: strictly left orbital pain at 10/10, lasting 2 to 3 hours, at the same time almost daily for 2 months and waking him, with same-sided tearing, red eye, rhinorrhoea and partial Horner's, restlessness, an earlier bout a year ago with 8 pain-free months, a father with similar headaches, and a normal examination and MRI. Strictly one-sided orbital pain lasting 15 to 180 minutes, at the same time each day, with tearing, a red eye, a runny or blocked nose on the same side and restlessness, is cluster headache. Patients with migraine lie still, while patients with cluster headache pace.

*Source:* AMSA MedEd OSCEs: Headache History 4

## 7. headqa-2014-229 (open-exam, Rheumatology)

A 69-year-old woman consulted for hemoptotic expectoration. In the two previous months she had low-grade fever, asthenia, anorexia and unquantified weight loss. In the cytological analysis of sputum, hemosiderophages were observed and in the chest radiograph bilateral alveolar infiltrates were observed. Analytically it stood out: Hb 8.2gr / dL, PO2: 58mmHg, creatinine: 5mg / dL, urine: proteinuria +++ microhematuria, cylinders, hematics. ANCAp (antibodies against the cytoplasm of perinuclear neutrophils): positive: anti-glomerular basement membrane antibodies: negative. Antinuclear antibodies: negative. The most likely diagnosis would be:

- A. Idiopathic pulmonary hemosiderosis.
- B. Goodpasture syndrome.
- C. Systemic lupus erythematosus with severe renal involvement.
- D. Classical polyarteritis nodosa.
- E. Microscopic polyarteritis.  **(key)**

*Explanation (AI-written for the bank; mark `other` with a note if it is wrong):* She has a pulmonary-renal syndrome: alveolar haemorrhage with haemosiderophages, plus rapidly progressive glomerulonephritis with red cell casts. Positive p-ANCA (MPO) with negative anti-GBM and ANA points to microscopic polyangiitis, a small-vessel vasculitis with pauci-immune necrotising glomerulonephritis.

*Source:* HEAD-QA (Vilares and Gómez-Rodríguez, ACL 2019): Spanish MIR exam question, Ministerio de Sanidad, as translated by the dataset's authors; documents last updated 14 January 2019

## 8. mmlu-professional_medicine-156 (usmle-resource, Neonatology)

A male neonate, who was born at 36 weeks' gestation 2 hours ago in the labor and delivery unit of the hospital, now shows signs of respiratory difficulty. The mother, an 18-year-old primigravid woman, smoked one pack of cigarettes daily throughout her pregnancy. She received prenatal care during most of the pregnancy. One episode of chlamydial cervicitis was detected during the last trimester and treated with azithromycin. The neonate was born via cesarean delivery due to fetal heart rate decelerations. The amniotic fluid was stained with light particulate meconium. Apgar scores were 9 and 9 at 1 and 5 minutes, respectively. The patient is 50 cm (20 in; 50th percentile) long and weighs 3005 g (6 lb 10 oz; 50th percentile); head circumference is 35 cm (14 in; 50th percentile). The infant's vital signs now are temperature 36.6°C (97.8°F), pulse 150/min, and respirations 70/min. Pulse oximetry on room air shows an oxygen saturation of 95%. Physical examination discloses mild subcostal and intercostal retractions. Chest x-ray shows prominent pulmonary vascular markings and fluid in the intralobar fissures. Which of the following is the most likely diagnosis?

- A. Group B streptococcal sepsis
- B. Meconium aspiration syndrome
- C. Respiratory distress syndrome
- D. Transient tachypnea of newborn  **(key)**

*Explanation (AI-written for the bank; mark `other` with a note if it is wrong):* The baby is late preterm, was born by caesarean, and has mild tachypnoea and retractions with good saturations. The X-ray shows prominent vascular markings and fluid in the fissures. This is the classic picture of transient tachypnoea of the newborn, caused by delayed clearance of lung fluid.

*Source:* MMLU (Hendrycks et al. 2021) professional_medicine test

## 9. ai-mcq-7b3e17cb (ai, Cardiology)

A 64-year-old woman with diabetes walks into a general practice with 40 minutes of central chest heaviness spreading to her jaw, with sweating. BP 138/84 mmHg, SpO2 97%. **Most appropriate next investigation?**

- A. 12-lead ECG  **(key)**
- B. Serum troponin
- C. Chest X-ray
- D. Exercise stress test
- E. CT coronary angiography

*Explanation:* Australian ACS guidelines say anyone with possible acute coronary syndrome needs a 12-lead ECG within 10 minutes of first medical contact. The ECG finds STEMI, which needs a 000 call and urgent reperfusion. A troponin or other tests must not delay this.

*Source:* Written by AI from Med-OS station amsa-188

## 10. headqa-2016-203 (open-exam, Orthopaedics)

A 50-year-old patient with a history of gout and chronic use of corticosteroids. He is brought to the emergency room due to inability to ambulate due to knee extension deficit. Radiology shows a low patellar height in relation to the contralateral knee. What is the diagnostic suspicion?

- A. Osteonecrosis of the knee.
- B. Gouty arthritis of the knee.
- C. Patellar tendon rupture.
- D. Quadriceps tendon rupture.  **(key)**

*Explanation (AI-written for the bank; mark `other` with a note if it is wrong):* Loss of active knee extension with a low-lying patella (patella baja) means quadriceps tendon rupture, because the patella is no longer pulled up. Gout and chronic steroids are classic risk factors in older patients.

*Source:* HEAD-QA (Vilares and Gómez-Rodríguez, ACL 2019): Spanish MIR exam question, Ministerio de Sanidad, as translated by the dataset's authors; documents last updated 14 January 2019

## 11. mmlu-professional_medicine-016 (usmle-resource, Immunology)

A 5-year-old boy is admitted to the hospital because of a 1-week history of fever and increasingly severe abdominal discomfort. At the age of 7 months, he was treated for osteomyelitis caused by Aspergillus fumigatus. He has been admitted to the hospital three times during the past 4 years for severe pneumonia. He appears moderately ill. His temperature is 39°C (102.2°F). Abdominal examination shows an enlarged, tender liver. Ultrasonography of the abdomen shows an intrahepatic abscess. Culture of the abscess fluid grows Staphylococcus aureus. Further analysis shows failure of the neutrophils to undergo an oxidative burst when exposed to S. aureus. This patient has an increased susceptibility to infection as a result of which of the following abnormalities?

- A. Failure of leukocytes to migrate between endothelial cells
- B. Failure of leukocytes to roll along the endothelial surface
- C. Inability of leukocytes to ingest microorganisms
- D. Inability of leukocytes to kill intracellular microorganisms  **(key)**

*Explanation (AI-written for the bank; mark `other` with a note if it is wrong):* Neutrophils that fail to mount an oxidative burst point to chronic granulomatous disease, a defect in NADPH oxidase. Phagocytes can still ingest catalase-positive organisms such as S. aureus and Aspergillus, but they cannot kill them once inside. Remember: CGD is a killing defect, not a defect of migration or ingestion.

*Source:* MMLU (Hendrycks et al. 2021) professional_medicine test

## 12. ai-mcq-eb4e07f1 (ai, Sexual Health)

A 26-year-old man has dysuria and urethral discharge. First-pass urine NAAT is positive for Mycoplasma genitalium, with a macrolide resistance mutation detected. Gonorrhoea and chlamydia NAATs are negative. **After doxycycline, which antibiotic is most appropriate?**

- A. Azithromycin
- B. Moxifloxacin  **(key)**
- C. Ceftriaxone
- D. Metronidazole
- E. Pristinamycin

*Explanation:* The resistance result shows macrolide-resistant M. genitalium. Australian STI guidelines recommend resistance-guided therapy: doxycycline 100 mg twice daily for 7 days, then moxifloxacin 400 mg daily for 7 days. A test of cure is done 14 to 21 days after treatment ends.

*Source:* Written by AI for Sexual Health (no Med-OS station)

## 13. headqa-2014-36 (open-exam, General Surgery)

A 76-year-old woman came to the emergency room referring to pain in the right groin and vomiting for about 6 hours. On examination, a hard consistency tumor is palpable just below the line joining the anterosuperior iliac spine and the pubis (which corresponds to the location of the inguinal ligament). Most likely, it is one:

- A. Direct inguinal hernia.
- B. Spiegel hernia.
- C. Indirect inguinal hernia.
- D. Femoral hernia (crural).  **(key)**
- E. Obturator hernia

*Explanation (AI-written for the bank; mark `other` with a note if it is wrong):* A hard, tender groin mass below the inguinal ligament with vomiting in an elderly woman suggests an incarcerated femoral hernia. Femoral hernias lie below and lateral to the pubic tubercle, are most common in older women, and often strangulate because the femoral ring is narrow.

*Source:* HEAD-QA (Vilares and Gómez-Rodríguez, ACL 2019): Spanish MIR exam question, Ministerio de Sanidad, as translated by the dataset's authors; documents last updated 14 January 2019

## 14. mmlu-professional_medicine-153 (usmle-resource, Rheumatology)

A 57-year-old woman comes to the office for a preoperative evaluation 2 weeks before undergoing scheduled laparoscopic cholecystectomy. Medical history is otherwise unremarkable and the patient takes no medications. Family history is significant for stable angina in her father and rheumatoid arthritis in her mother. The patient has a 102-year-old grandmother who resides in a nursing care facility and has Parkinson disease. The patient does not smoke cigarettes or drink alcoholic beverages. During the interview, her face is expressionless. She has a flexed posture and is unable to open her mouth wide. She is 173 cm (5 ft 8 in) tall and weighs 81 kg (179 lb); BMI is 27 kg/m2 . Vital signs are normal. Physical examination discloses thickening and hardening of the skin over the dorsum of the hands and forearms, as well as mild kyphosis. Strength testing shows no abnormalities; muscle tension is normal. Passive and active range of motion of the upper extremities is full. Gait is slow and deliberate. The remainder of the physical examination discloses no abnormalities. Prior to surgery, further evaluation is indicated for which of the following conditions in this patient?

- A. Parkinson disease
- B. Progressive supranuclear palsy
- C. Sarcopenia
- D. Systemic sclerosis (scleroderma)  **(key)**

*Explanation (AI-written for the bank; mark `other` with a note if it is wrong):* Thickened, hardened skin on the hands and forearms, an expressionless face, and limited mouth opening (microstomia) suggest systemic sclerosis. Before surgery it needs evaluation because of the risk of difficult intubation and possible pulmonary, cardiac, renal, and oesophageal involvement.

*Source:* MMLU (Hendrycks et al. 2021) professional_medicine test

## 15. ai-mcq-5515c72d (ai, Paediatrics)

A 22-month-old boy is brought to a general practice in regional Victoria with a 6-week history of cough. The cough is wet and happens by day and by night. It has not improved with 7 days of amoxicillin or with inhaled salbutamol through a spacer. His mother remembers that the cough started on the evening of a family barbecue. While eating popcorn there, he coughed and gagged for a short time and then settled. He has no eczema and no previous wheeze. He is fully immunised and has had no contact with tuberculosis. He is playful. His temperature is 37.3 °C, pulse 120/min, respirations 38/min, and SpO2 96% in room air. On examination there is reduced air entry and a fixed monophonic wheeze over the left lower zone only. A chest X-ray shows a hyperinflated left lung with the mediastinum shifted to the right. No radio-opaque object is seen. **If the underlying cause is not treated, this child is most at risk of which of the following complications?**

- A. Tension pneumothorax
- B. Tracheo-oesophageal fistula
- C. Pulmonary arterial hypertension
- D. Persistent atopic asthma
- E. Left lower lobe bronchiectasis  **(key)**

*Explanation:* This toddler has an inhaled foreign body, most likely a popcorn kernel, in the left lower lobe bronchus. The clues are a choking episode at the start, a cough that has lasted weeks despite antibiotics and bronchodilators, one-sided monophonic wheeze with reduced air entry, and air trapping on the same side with the mediastinum pushed away. Organic objects are radiolucent, so a normal-looking X-ray does not rule out the diagnosis. Organic material left in the bronchus causes ongoing local inflammation, granulation tissue and infection beyond the blockage. This leads to recurrent pneumonia in the same lobe and then permanent damage to the airway: bronchiectasis. The risk goes up the longer the object stays in. This is why the RCH guideline recommends prompt rigid bronchoscopy under general anaesthesia at a paediatric centre, rather than more courses of antibiotics or inhalers. Tension pneumothorax is a rare acute event, not the expected result of an object left in place. Tracheo-oesophageal fistula is a complication of an oesophageal foreign body, especially a button battery, not a bronchial one. Pulmonary arterial hypertension needs widespread lung or vascular disease, not one blocked lobe. Asthma is not caused by a foreign body, and the poor response to salbutamol argues against it.

*Source:* Written by AI from Med-OS station ai-7789e6bf

## 16. headqa-2016-213 (open-exam, Neurology)

59-year-old man, active smoker, with a history of hypertension, dyslipidemia and alcoholism. It refers to progressive picture in the last 2 years of difficulty climbing stairs with weakness in lower and upper limbs that fluctuates during the day and improves slightly with sustained exercise. Occasionally he has presented episodes of diplopia. Lately persistent dry cough has been added. As part of the study an electromyogram is performed that shows incremental increases in muscle action potential in response to repetitive nerve stimulation. A chest CT scan shows subcarinal lymphadenopathy and a 3.1 cm nodule in the left lower lobe. These findings are consistent with primary pulmonary neoplasia. What is the diagnosis of the associated picture?

- A. Paraneoplastic polyneuropathy.
- B. Polymyositis
- C. Myopathy associated with alcoholism.
- D. Eaton-Lambert syndrome.  **(key)**

*Explanation (AI-written for the bank; mark `other` with a note if it is wrong):* Proximal weakness that improves with sustained exercise, increments on repetitive nerve stimulation, and a smoker's lung mass (likely small cell carcinoma) mean Lambert-Eaton myasthenic syndrome, caused by antibodies to presynaptic voltage-gated calcium channels.

*Source:* HEAD-QA (Vilares and Gómez-Rodríguez, ACL 2019): Spanish MIR exam question, Ministerio de Sanidad, as translated by the dataset's authors; documents last updated 14 January 2019

## 17. mmlu-professional_medicine-150 (usmle-resource, Paediatrics)

A 14-year-old boy is brought to the physician for a physical examination prior to participating in sports. He appears reluctant to remove his shirt for the examination, and says that he is embarrassed because he has grown breasts during the past year. He is at the 50th percentile for height and weight. Physical examination shows bilateral 1.5-cm fibroglandular masses located beneath the nipple-areolar complex and normal penis and testes. Pubic hair development is Tanner stage 3. Serum concentrations of gonadotropic hormones, estrogens, and testosterone are within the reference ranges. Which of the following is the most likely cause of this patient's breast enlargement?

- A. Estradiol-secreting Leydig cell tumor
- B. Peutz-Jeghers syndrome
- C. Seminiferous tubule dysgenesis (Klinefelter syndrome)
- D. Normal development  **(key)**

*Explanation (AI-written for the bank; mark `other` with a note if it is wrong):* Mid-puberty (Tanner 3) with small bilateral subareolar fibroglandular tissue, normal genitalia, and normal hormone levels is typical of physiological pubertal gynaecomastia. It reflects a transient oestrogen–androgen imbalance and usually resolves within 1–2 years. Management is reassurance.

*Source:* MMLU (Hendrycks et al. 2021) professional_medicine test

## 18. ai-mcq-e3b1c7c7 (ai, Ophthalmology)

A 63-year-old woman comes to her general practitioner for her annual diabetes review. She has had type 2 diabetes for 14 years. Over the past 4 months, small print has become harder to read with her right eye, even with new reading glasses. She also has hypertension and dyslipidaemia. Her medicines are metformin 1 g twice daily, modified-release gliclazide 60 mg daily, perindopril 5 mg daily and atorvastatin 20 mg daily. Her last eye examination was 2 years ago. Blood pressure is 144/86 mmHg and pulse is 76/min. Visual acuity is 6/18 in the right eye and 6/9 in the left, and the right eye does not improve with a pinhole. Both lenses are clear. Good-quality non-mydriatic retinal photographs show microaneurysms and dot and blot haemorrhages in both eyes, and a ring of hard exudates within one disc diameter of the right fovea. There are no new vessels and no venous beading. HbA1c is 8.8% (73 mmol/mol). **Which of the following is the most appropriate investigation to confirm the cause of the reduced vision in her right eye?**

- A. Fundus fluorescein angiography
- B. Optical coherence tomography  **(key)**
- C. B-scan ocular ultrasonography
- D. Automated visual field perimetry
- E. Dilated repeat retinal photography

*Explanation:* She has non-proliferative diabetic retinopathy in both eyes. In the right eye she has hard exudates near the fovea and slowly worsening central vision that a pinhole does not correct, so a refractive error is not the cause. This pattern points to diabetic macular oedema, which causes most vision loss in diabetes and can occur at any stage of retinopathy. Retinal photographs are two-dimensional and cannot show retinal thickening, so they cannot confirm or exclude macular oedema. The NHMRC diabetic retinopathy guideline and the RACGP handbook advise referral to an ophthalmologist. Optical coherence tomography (OCT) is the non-invasive test that confirms the diagnosis. It measures central retinal thickness, shows intraretinal and subretinal fluid, and is used to decide on and monitor anti-VEGF treatment. Fluorescein angiography is an invasive second-line test. Ultrasound is only needed when the fundus cannot be seen. Visual field testing and repeat photographs cannot assess retinal thickness.

*Source:* Written by AI from Med-OS station amsa-301

## 19. headqa-2016-192 (open-exam, Rheumatology)

A 38-year-old man consulted for the appearance of red and painful nodules in both lower limbs at the pretibial level of 2 weeks of evolution. In addition, the patient reports that for a few months and recurrently has oral ulcers and ulcers at the genital level. What is the most likely diagnosis?

- A. Sarcoidosis
- B. Dermatomyositis
- C. Behçet syndrome.  **(key)**
- D. Systemic lupus erythematosus.

*Explanation (AI-written for the bank; mark `other` with a note if it is wrong):* Recurrent oral ulcers plus genital ulcers with erythema nodosum-like lesions point to Behçet syndrome. Recurrent oral aphthae are the essential criterion, and genital ulcers, skin lesions, eye and pathergy findings support it.

*Source:* HEAD-QA (Vilares and Gómez-Rodríguez, ACL 2019): Spanish MIR exam question, Ministerio de Sanidad, as translated by the dataset's authors; documents last updated 14 January 2019

## 20. medqa-us4-test-0532 (usmle-resource, Toxicology)

A 38-year-old man is brought to the emergency room by his father because of altered mental status. According to the father, the patient was unable to get out of bed that morning and has become increasingly confused over the past several hours. The father also noticed it was “pretty cold” in his son's apartment because all of the windows were left open overnight. He has a history of hypothyroidism, schizoaffective disorder, type 2 diabetes mellitus, dyslipidemia, and hypertension for which he takes medication. Ten days ago, he was started on a new drug. He appears lethargic. His rectal temperature is 32°C (89.6°F), pulse is 54/min, respirations are 8/min, and blood pressure is 122/80 mm Hg. Examination shows weakness in the lower extremities with absent deep tendon reflexes. Deep tendon reflexes are 1+ in the upper extremities. The pupils are dilated and poorly reactive to light. Throughout the examination, the patient attempts to remove his clothing. Which of the following drugs is the most likely cause of these findings?

- A. Lisinopril
- B. Fluphenazine  **(key)**
- C. Levothyroxine
- D. Atorvastatin
"

*Explanation (AI-written for the bank; mark `other` with a note if it is wrong):* A new drug started 10 days ago plus hypothermia after cold exposure, bradycardia, slowed breathing and paradoxical undressing points to an antipsychotic. Fluphenazine, a typical antipsychotic used here for schizoaffective disorder, disrupts hypothalamic temperature control through dopamine blockade. Antipsychotics can cause hypothermia as well as hyperthermia.

*Source:* MedQA (Jin et al. 2020), US, 4-option, test split

## 21. ai-mcq-e9b74594 (ai, OMS/Dental)

A 10-year-old boy fell off his scooter 15 minutes ago. His upper permanent central incisor was knocked out whole; he holds it by the crown. He is otherwise uninjured. **Most appropriate next step?**

- A. Replant tooth now  **(key)**
- B. Store in milk
- C. Scrub the root
- D. Discard the tooth
- E. Dental review tomorrow

*Explanation:* An avulsed permanent tooth should be replanted as soon as possible, ideally within minutes, because periodontal ligament cells die quickly once the tooth is out of the mouth, especially if it is kept dry. Hold it by the crown, rinse it briefly in milk or saline if it is dirty, push it back into the socket, have the child bite on gauze, then arrange urgent dental splinting.

*Source:* Written by AI for OMS/Dental (no Med-OS station)

## 22. headqa-2016-193 (open-exam, Rheumatology)

Serves a 32-year-old man, computer specialist, who consults for lumbar pain and asymmetric gluteus, predominantly nocturnal, inflammation of the toes, negative rheumatoid factor and C-reactive protein higher than 20mg / dL. What is the most correct attitude?

- A. By age and sex, it is likely that it is gout and would start treatment with allopurinol and colchicine.
- B. I will ask about a family history of psoriasis and would request HLA-B27, it is likely to suffer from a type of spondyloarthritis.  **(key)**
- C. The type of pain in the spine guides the diagnosis to a herniated disc. I refer the patient to Neurosurgery.
- D. I would start treatment with methotrexate that is effective for spinal pain and inflammation of toes.

*Explanation (AI-written for the bank; mark `other` with a note if it is wrong):* A young man with inflammatory nocturnal low back and buttock pain, dactylitis ('sausage toes'), seronegativity and raised CRP has spondyloarthritis. Ask about psoriasis (psoriatic arthritis) and check HLA-B27.

*Source:* HEAD-QA (Vilares and Gómez-Rodríguez, ACL 2019): Spanish MIR exam question, Ministerio de Sanidad, as translated by the dataset's authors; documents last updated 14 January 2019

## 23. mmlu-professional_medicine-151 (usmle-resource, General Practice)

A 37-year-old man comes to the physician because of nonradiating low back pain for 3 days. The pain began after he worked in his yard. He has not had any change in bowel movements or urination. He had one similar episode 3 years ago that resolved spontaneously. Vital signs are within normal limits. Examination of the back shows bilateral paravertebral muscle spasm. Range of motion is limited by pain. Straight-leg raising is negative. In addition to analgesia, which of the following is the most appropriate next step in management?

- A. Bed rest
- B. Regular activity  **(key)**
- C. X-rays of the spine
- D. MRI of the spine

*Explanation (AI-written for the bank; mark `other` with a note if it is wrong):* This is acute nonspecific mechanical low back pain with no red flags: no bowel or bladder changes, normal vital signs, and a negative straight-leg raise. Staying active speeds recovery, and imaging is not indicated. Australian guidelines also recommend reassurance and staying active.

*Source:* MMLU (Hendrycks et al. 2021) professional_medicine test

## 24. ai-mcq-f06ac9bd (ai, Neurosurgery)

A 40-year-old woman with polycystic kidney disease has a sudden severe headache. Her GCS is 15 and BP 148/88 mmHg. CT shows subarachnoid blood, and CT angiography shows an anterior communicating artery aneurysm. **Which drug should be started now?**

- A. Oral nimodipine  **(key)**
- B. IV tranexamic acid
- C. IV dexamethasone
- D. IV levetiracetam
- E. IV labetalol

*Explanation:* This is aneurysmal subarachnoid haemorrhage. eTG recommends starting oral nimodipine 60 mg 4-hourly for 21 days as soon as possible, because it reduces delayed cerebral ischaemia and improves outcome. The patient also needs urgent neurosurgical referral so the aneurysm can be secured.

*Source:* Written by AI from Med-OS station amsa-361

## 25. headqa-2016-191 (open-exam, Rheumatology)

60-year-old diabetic patient. Hospital admission 2 weeks ago due to hyperosmolar decompensation. Consult the Emergency Department for pain and swelling in the right knee. Physical examination: Tº 37.2ºC, heart rate 100 beats / minute, respiratory rate 18 / minute, signs of arthritis in the referred joints. Analytical: blood count with 18,000 leukocytes / mm3, uric acid 8.11 mg / dL, creatinine 1.4 mg / dL. Synovial fluid: 20,000 leukocytes / mm3 with 85% polynuclear, no microcrystals are observed and the gram stain does not show germs. What would be the most correct attitude?

- A. Practice intra-articular infiltration with triamcinolone of the affected joint.
- B. Start outpatient treatment with amoxicillin plus clavulanic acid and assess the response in a week.
- C. Indicate admission and immediate parenteral antibiotic treatment until the result of the culture.  **(key)**
- D. Treatment with corticoids at low doses and allopurinol.

*Explanation (AI-written for the bank; mark `other` with a note if it is wrong):* Synovial fluid with 20,000 white cells/mm3, 85% neutrophils and no crystals, in a diabetic patient recently in hospital who now has leucocytosis, should be treated as septic arthritis. A negative Gram stain does not exclude infection. Admit, give IV antibiotics until the culture result is back, and drain the joint. In Australia, eTG suggests IV flucloxacillin, adding vancomycin if MRSA is a risk.

*Source:* HEAD-QA (Vilares and Gómez-Rodríguez, ACL 2019): Spanish MIR exam question, Ministerio de Sanidad, as translated by the dataset's authors; documents last updated 14 January 2019

## 26. medqa-us4-test-0522 (usmle-resource, General Surgery)

A 54-year-old man comes to the emergency department because of a 2-day history of increasingly severe abdominal pain, nausea, and bilious vomiting. His last bowel movement was yesterday and he has not passed flatus since then. He underwent appendectomy at the age of 39. He has psoriasis, hypertension, type 2 diabetes mellitus, and chronic back pain. He drinks two beers daily. He takes a topical corticosteroid, ramipril, metformin, and ibuprofen daily. He is 176 cm (5 ft 9 in) tall and weighs 108 kg (240 lb); BMI is 35.4 kg/m2. His temperature is 36.8°C (98.4°F), respirations are 15/min, pulse is 90/min, and blood pressure is 112/67 mm Hg. Examination shows thick, scaly, plaques over both elbows and knees. Abdominal examination shows three well-healed laparoscopic scars. The abdomen is distended and there are frequent, high-pitched bowel sounds on auscultation. Digital rectal examination shows an empty rectum. Laboratory studies show:
Hematocrit 44%
Leukocyte count 9,000/mm3
Platelet count 225,000/mm3
Serum
Na+ 139 mEq/L
K+ 4.1 mEq/L
Cl− 101 mEq/L
HCO3− 26 mEq/L
Glucose 95 mg/dL
Creatinine 1.1 mg/dL
Alkaline phosphatase 78 U/L
Aspartate aminotransferase (AST, GOT) 19 U/L
Alanine aminotransferase (ALT, GPT) 14 U/L
γ-Glutamyltransferase (GGT) 52 U/L (N=5–50 U/L)
Hemoglobin A1C 6.4%
Abdominal ultrasound shows nonpropulsive peristalsis of the small bowel. Which of the following is the most likely cause of this patient's condition?"

- A. Chronic inflammatory bowel disease
- B. Ibuprofen
- C. History of abdominal surgery  **(key)**
- D. Alcohol

*Explanation (AI-written for the bank; mark `other` with a note if it is wrong):* Colicky pain, bilious vomiting, obstipation, distension and high-pitched bowel sounds point to mechanical small bowel obstruction. In a patient with previous appendectomy and laparoscopic scars, the likely cause is adhesions. Remember that adhesions are the most common cause of small bowel obstruction in adults.

*Source:* MedQA (Jin et al. 2020), US, 4-option, test split

## 27. ai-mcq-ce657f94 (ai, Neurosurgery)

A 79-year-old woman on apixaban fell and hit her head four days ago. Apixaban has been reversed. CT: 12 mm acute right subdural haematoma, 7 mm midline shift. GCS 14. **Most appropriate definitive management?**

- A. Surgical evacuation  **(key)**
- B. Repeat CT next morning
- C. IV dexamethasone
- D. Tranexamic acid
- E. Mannitol infusion

*Explanation:* An acute subdural haematoma more than 10 mm thick or with more than 5 mm of midline shift needs surgical evacuation, whatever the GCS. After reversal of the anticoagulant, a rural ED should arrange urgent neurosurgical referral and retrieval for craniotomy.

*Source:* Written by AI from Med-OS station amsa-429

## 28. headqa-2015-32 (open-exam, Pathology)

A 59-year-old woman presented with chronic watery diarrhea of ​​4 months evolution. In the endoscopy, the mucosa did not show relevant aspects. In particular, no ulcers or friable areas were observed. A transverse colon biopsy was performed. In the histopathological study, a thickened area was recognized below the surface coating epithelium, which was more evident by Masson's trichrome technique and involved epithelial atrophy and denudation. There was also a clear increase in the density of intraepithelial lymphocytes. Is the diagnosis of the intestinal lesion?

- A. Chronic ulcerative colitis.
- B. Pseudomembranous colitis.
- C. Collagenous colitis  **(key)**
- D. Fibrosing Crohn's disease.

*Explanation (AI-written for the bank; mark `other` with a note if it is wrong):* Chronic watery diarrhoea with normal-looking mucosa points to microscopic colitis. A thickened subepithelial band that stains with Masson trichrome (collagen, over 10 µm), with surface epithelial damage and more intraepithelial lymphocytes, defines collagenous colitis.

*Source:* HEAD-QA (Vilares and Gómez-Rodríguez, ACL 2019): Spanish MIR exam question, Ministerio de Sanidad, as translated by the dataset's authors; documents last updated 14 January 2019

## 29. medqa-us4-test-0519 (usmle-resource, Trauma Surgery)

A 36-year-old man is brought to the emergency department 40 minutes after being involved in a shooting. He sustained a gunshot wound in an altercation outside of a bar. On arrival, he is oriented to person but not to place or time. His temperature is 37.3°C (99.1°F), pulse is 116/min, respirations are 18/min, and blood pressure is 79/42 mm Hg. Pulse oximetry on room air shows an oxygen saturation of 97%. Examination shows multiple abrasions over the arms and thorax. There is a 1-cm (0.4-in) entry wound with minimal bleeding on the right side of the chest in the 6th intercostal space at the midclavicular line. Cardiopulmonary examination shows no abnormalities. Abdominal examination shows diffuse mild tenderness to palpation with no guarding or rebound. A focused assessment with sonography shows no obvious free fluid in the pericardium; assessment of the abdomen is equivocal. An x-ray of the chest shows mild opacification of the right lower lobe. Two large-bore cannulas are inserted and intravenous fluid resuscitation is begun. The patient is intubated and mechanical ventilation is begun. Which of the following is the most appropriate next step in management?

- A. CT scan of the chest, abdomen, and pelvis
- B. Local wound exploration
- C. Exploratory laparotomy  **(key)**
- D. Video-assisted thoracoscopic surgery

*Explanation (AI-written for the bank; mark `other` with a note if it is wrong):* A gunshot wound below the nipple line (6th intercostal space) is thoracoabdominal and likely to have crossed the diaphragm into the abdomen, probably injuring the liver. With persistent hypotension and abdominal tenderness, a haemodynamically unstable penetrating injury needs immediate laparotomy, not more imaging.

*Source:* MedQA (Jin et al. 2020), US, 4-option, test split

## 30. ai-mcq-53a4f097 (ai, Addiction Medicine)

A 52-year-old man who drinks heavily daily is brought in confused and unsteady, with no head injury. He has horizontal nystagmus and a broad-based ataxic gait. Capillary glucose is 5.8 mmol/L. **Most appropriate next step?**

- A. Oral diazepam loading
- B. Intravenous glucose
- C. Intravenous thiamine  **(key)**
- D. Non-contrast CT brain
- E. Oral thiamine

*Explanation:* Confusion, nystagmus and ataxia in a heavy drinker point to Wernicke encephalopathy. This is a medical emergency, and eTG advises giving high-dose parenteral thiamine straight away (for example 500 mg IV three times daily) to prevent permanent Korsakoff syndrome. Do not wait for imaging or other tests before giving it.

*Source:* Written by AI for Addiction Medicine (no Med-OS station)

## 31. headqa-2015-170 (open-exam, Cardiology)

An 80-year-old man came to his office to evaluate a cholecystectomy program by laparoscopy. He has a history of hypertension in treatment for 10 years. Denies heart or lung disease. No chest pain She has an active life and daily goes to the gym where she alternates swimming and walking the treadmill for at least an hour. Usual treatment: nebivolol 5 mg every 24 hours and hydrochlorothiazide 12.5 mg daily. Physical examination: weight 73 kgs; size 179 cms; blood pressure 138/80 mmHg; heart rate 60 beats / minute. No murmurs are heard. Which of the following is the most appropriate preoperative approach?

- A. Perform an effort test.
- B. Perform an echocardiogram.
- C. Perform a scintigraphy with thallium and dipyridamole.
- D. Perform electrocardiogram.  **(key)**

*Explanation (AI-written for the bank; mark `other` with a note if it is wrong):* Laparoscopic cholecystectomy is low-to-intermediate risk, and he has excellent functional capacity (more than 4 METs) with no cardiac symptoms. No stress testing or imaging is needed, but a baseline ECG is reasonable given his age and hypertension.

*Source:* HEAD-QA (Vilares and Gómez-Rodríguez, ACL 2019): Spanish MIR exam question, Ministerio de Sanidad, as translated by the dataset's authors; documents last updated 14 January 2019

## 32. mmlu-professional_medicine-010 (usmle-resource, Geriatrics)

While you are on rounds at a local nursing facility, the nurse mentions that your patient, a 79-year-old woman, appears to be a "poor eater." She was admitted to the nursing facility 3 months ago from the hospital where she was treated for congestive heart failure. Her daughter had moved away from the area, and nursing home placement was necessary because the patient could no longer function independently. Her present medications include furosemide and digoxin. Physical examination is normal except for a weight loss of 3.5 kg (7 lb) during the past 3 months. In your conversation with the patient, she says, "No, I'm not depressed, I just don't have an appetite anymore. Nothing tastes good to me. I have a little bit of nausea most of the time." Which of the following is the most appropriate initial diagnostic study?

- A. Chest x-ray
- B. Complete blood count
- C. Determination of serum albumin concentration
- D. Determination of serum digoxin level  **(key)**

*Explanation (AI-written for the bank; mark `other` with a note if it is wrong):* An elderly woman on digoxin with furosemide, which can cause hypokalaemia, who has loss of appetite, nausea and a changed sense of taste most likely has digoxin toxicity. A serum digoxin level is the targeted first test. Remember to check potassium and renal function as well.

*Source:* MMLU (Hendrycks et al. 2021) professional_medicine test

## 33. ai-mcq-ecb71b7c (ai, Paediatrics)

A 2-year-old boy has wheeze and breathlessness overnight after 3 days of coryza. He has bilateral expiratory wheeze, equal air entry and SpO2 95% on room air, improving with salbutamol. **Most appropriate next investigation?**

- A. Chest X-ray
- B. Venous blood gas
- C. Full blood count
- D. No investigation  **(key)**
- E. Spirometry

*Explanation:* This is a moderate episode of viral-induced (preschool) wheeze. The diagnosis is clinical, and RCH and Queensland guidelines advise against routine X-ray, bloods or blood gas. Severity is graded at the bedside and treatment is salbutamol by spacer.

*Source:* Written by AI from Med-OS station amsa-631

## 34. headqa-2015-177 (open-exam, Oncology)

A 57-year-old patient diagnosed with stage T3N1M0 colon adenocarcinoma. He was treated with resection followed by postoperative FOLFOX chemotherapy (fluorouracil, leucovorin and oxaliplatin) for six months. In a routine control, two years later, elevation of carcinoembryonic antigen (CEA) was detected at 30 ng / mL (previous to less than 2 ng / mL). He has no symptoms, the physical examination is bland, the chest radiograph is normal. On CT, a mass of 3 cm is seen in the right hepatic lobe, which is captured in PET. No other alterations were observed in CT or PET. What attitude seems more correct?

- A. Chemotherapy with FOLFIRI (fluorouracil, leucovorin and irinotecan) plus bevacizumab.
- B. Monochemotherapy with capecitabine.
- C. Evaluation by resection surgery of the hepatic lesion.  **(key)**
- D. Liver radiation therapy.

*Explanation (AI-written for the bank; mark `other` with a note if it is wrong):* He has a single 3 cm liver metastasis with no other disease on CT and PET. Isolated metachronous colorectal liver metastases should be assessed for resection first, because surgery offers a chance of long-term cure.

*Source:* HEAD-QA (Vilares and Gómez-Rodríguez, ACL 2019): Spanish MIR exam question, Ministerio de Sanidad, as translated by the dataset's authors; documents last updated 14 January 2019

## 35. mmlu-professional_medicine-088 (usmle-resource, Neurology)

A 36-year-old man comes to the office because of headaches that began 2 weeks ago. The headaches are moderately severe, are present when he awakens in the morning, and are relieved with over-the-counter analgesics. He has no prior history of headaches. He tells you he was promoted to an upper-level managerial position in his accounting firm about 8 months ago, which necessitated relocating. Physical examination now discloses no abnormalities except for blurring of the optic disc margins bilaterally. Which of the following is the most appropriate next step?

- A. Begin a trial of a β-blocking medication
- B. Order CT scan of the head  **(key)**
- C. Order EEG
- D. Refer him for consultation with a neurologist

*Explanation (AI-written for the bank; mark `other` with a note if it is wrong):* A new morning headache with bilateral blurred optic disc margins (papilloedema) suggests raised intracranial pressure from a mass lesion until proven otherwise. Urgent neuroimaging is needed before attributing the headache to stress or tension.

*Source:* MMLU (Hendrycks et al. 2021) professional_medicine test

## 36. ai-mcq-aa50ea7f (ai, Rheumatology)

A 71-year-old woman presents to the emergency department with two days of new left temporal headache, pain on chewing, and transient visual loss today. Her temporal artery is tender; ESR 92 mm/h. **Most appropriate next step?**

- A. Oral prednisolone 50 mg
- B. Temporal artery biopsy
- C. Urgent CT brain
- D. Aspirin 300 mg
- E. IV methylprednisolone  **(key)**

*Explanation:* She has a new headache after age 50, jaw claudication, a tender temporal artery, a very high ESR and transient visual loss. This is giant cell arteritis with visual involvement, which threatens her sight. Give IV methylprednisolone (500 mg to 1 g daily for 3 days) straight away and arrange same-day ophthalmology review, without waiting for a biopsy.

*Source:* Written by AI from Med-OS station amsa-246

## 37. headqa-2016-181 (open-exam, Paediatrics)

A 2-month-old girl who was referred to the pediatric urology clinic due to grade-III bilateral vesicoureteral reflux. Background: prenatal diagnosis of bilateral pyelic ectasia. Acute pyelonephritis, one month after diagnostic cystourethrography. Of the following options, what would be the most advisable indication?

- A. Do nothing; since the reflux can disappear spontaneously.
- B. Endoscopic treatment of reflux.
- C. Request renal scintigraphy (DMSA) and perform a monthly urine culture.
- D. Antibiotic prophylaxis with amoxicillin and request renal scintigraphy (DMSA).  **(key)**

*Explanation (AI-written for the bank; mark `other` with a note if it is wrong):* A young infant with bilateral grade III reflux who has had pyelonephritis is at risk of repeat infection and kidney scarring. Give continuous antibiotic prophylaxis and do a DMSA scan to look for scarring. Australian practice usually uses trimethoprim or cefalexin for prophylaxis.

*Source:* HEAD-QA (Vilares and Gómez-Rodríguez, ACL 2019): Spanish MIR exam question, Ministerio de Sanidad, as translated by the dataset's authors; documents last updated 14 January 2019

## 38. medqa-us4-test-1109 (usmle-resource, Infectious Diseases)

A 46-year-old man comes to the emergency department because of a 4-week history of fatigue and headache that have gotten progressively worse. He has allergic asthma treated with inhaled salbutamol. He immigrated to the USA from Thailand 9 years ago. He lives by himself and works as a waiter in a restaurant. He has had 6 lifetime male sexual partners and uses condoms inconsistently. He drinks 1–2 beers daily. His temperature is 38.2°C (100.8°F), pulse is 88/min, and blood pressure is 128/76 mm Hg. Examination of the mouth shows several white patches on the tongue and oral mucosa that can be easily scraped off with a tongue blade. On mental status examination, the patient is somnolent and has short-term memory deficits. The remainder of the examination shows no abnormalities. Laboratory studies show:
Hemoglobin 13.6 g/dL
Leukocyte count 9,600/mm3
Segmented neutrophils 80%
Eosinophils 1%
Lymphocytes 17%
Monocytes 2%
CD4+ T-lymphocytes 80/mm3 (Normal ≥ 500)
Platelet count 328,000/mm3
Serum
pH 7.36
Na+ 135 mEq/L
Cl- 101 mEq/L
K+ 4.8 mEq/L
HCO3- 22 mEq/L
Glucose 95 mg/dL
Creatinine 0.9 mg/dL
BUN 16 mg/dL
Bilirubin, total 0.7 mg/dL
AST 13 U/L
ALT 15 U/L
Erythrocyte sedimentation rate 10 mm/hour
HIV test positive
A lumbar puncture is performed and an opening pressure of 150 mm H2O is noted. Cerebrospinal fluid analysis shows a leukocyte count of 25/mm3 (60% lymphocytes), protein concentration of 52 mg/dL, and a glucose concentration of 37 mg/dL. India ink stain shows organisms with prominent capsules. Blood cultures are drawn. Which of the following is the most appropriate pharmacotherapy for this patient's neurological symptoms?"

- A. Pyrimethamine, sulfadiazine, and folinic acid
- B. Amphotericin B and flucytosine  **(key)**
- C. Fluconazole
- D. Vancomycin and meropenem

*Explanation (AI-written for the bank; mark `other` with a note if it is wrong):* A CD4 count of 80, subacute headache, confusion and India ink showing encapsulated yeasts point to cryptococcal meningitis. Induction treatment is amphotericin B plus flucytosine for at least 2 weeks, followed by fluconazole consolidation. Liposomal amphotericin is usually preferred.

*Source:* MedQA (Jin et al. 2020), US, 4-option, test split

## 39. ai-mcq-6f672845 (ai, Bioethics)

A 34-year-old man with severe traumatic brain injury has fixed dilated pupils and no brainstem reflexes. He received a thiopentone infusion until yesterday; serum levels remain high. **Which test best confirms brain death?**

- A. Electroencephalography
- B. Radionuclide perfusion scan  **(key)**
- C. Transcranial Doppler ultrasound
- D. MRI brain
- E. Somatosensory evoked potentials

*Explanation:* High levels of a sedative like thiopentone mean the clinical brain death tests cannot be relied on. The ANZICS Statement on Death and Organ Donation then requires imaging that shows no blood flow to the brain, such as radionuclide perfusion scintigraphy or four-vessel catheter angiography. Sedatives do not change cerebral blood flow, so these tests still work.

*Source:* Written by AI for Bioethics (no Med-OS station)

## 40. headqa-2016-131 (open-exam, Public Health)

It is desired to know the degree of association that exists between the metabolic syndrome and the vitamin D deficit in the general population. To do this, a sample of a health center is selected from among patients older than 18 years of age, they are scheduled and at the visit a clinical examination is performed to determine if they meet the metabolic syndrome criteria and blood is drawn to measure the concentrations Serum levels of 25 hidoxivitamin D. What is the design of this study ?:

- A. Prospective cohort study.
- B. Cross-sectional study.  **(key)**
- C. Cases and controls study.
- D. Case-crossover study (or "case-crossover").

*Explanation (AI-written for the bank; mark `other` with a note if it is wrong):* Exposure (vitamin D level) and outcome (metabolic syndrome) are both measured once, at the same visit, in a sample of the population. That is a cross-sectional design. It estimates prevalence and association but cannot show which came first.

*Source:* HEAD-QA (Vilares and Gómez-Rodríguez, ACL 2019): Spanish MIR exam question, Ministerio de Sanidad, as translated by the dataset's authors; documents last updated 14 January 2019
