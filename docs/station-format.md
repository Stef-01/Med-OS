# Station format

Every station runs the same way:

| Phase | Time | What happens |
|---|---|---|
| Reading | 5 min | The candidate reads the Instructions to Candidate |
| Part 1 | 10 min | A focused history from the patient (or parent) and a focused examination. The examiner gives examination findings from the Exam findings as the candidate says what they would examine |
| Part 2 | 5 min | The examiner hands over observations, investigation results or scans. The candidate interprets them, gives a management approach and safety-nets |

The app's clock runs these three phases with a bell at each change (Change Timing can alter them; Part 2 at 0 runs without it). When Part 2 starts, the examiner's view opens the marking sheet at the Part 2 questions and results (each result can be shown to the candidate full screen, without the checklist), and the candidate screen shows the results.

`scripts/check-station.mjs <id>` checks a station against every rule below. `scripts/lib/station-gates.mjs` holds the rules; `scripts/lib/generate.mjs` tells the generator the same thing.

## The station file (`public/osce/<id>.json`)

| Field | Rule |
|---|---|
| `stem` | Instructions to Candidate: setting, the candidate's role, the patient (name or "the child", age) and why they are here. Never the diagnosis. **No times** (the page shows the format). Facts the candidate should find out in the history do not belong here. |
| `tasks` | Exactly 2 (3 at most). Task 1 is Part 1 and ends "(10 minutes)": take a focused history and perform a focused examination, telling the examiner what you are examining. The last task is Part 2 and ends "(5 minutes)": the examiner will give you the named results; interpret them, then outline your management approach and safety netting. Times add to 15. |
| `patient` | The Part 1 script for whoever plays the patient (or parent) and examines: opening line, the history by domain with answers given only when asked, ideas, concerns and expectations, questions to raise, and that examination findings come from the Exam findings. Nothing from Part 2 needs repeating here. |
| `part2.lead` | The examiner's opening line for Part 2, in plain words. |
| `demo` | The patient: `{age, unit, sex, setting, weight?, pregnant?, postpartum?}`; `unit` is days, weeks, months or years; `setting` is one of ed, ward, icu, theatre, recovery, birth suite, clinic, gp, community. It picks the observation chart Part 2 shows (below). |
| `part2.handover` | 2 to 6 results, each `{label, kind, result, model, obs?}`. They follow from the history and examination. `kind` is obs, bloods, gas, ecg, xray, ct, us, mri, ctg, micro, urine, report or other. `result` is what the candidate is handed (HTML allowlist, tables allowed), complete enough to interpret on its own (see "Results" below). `model` is for the examiner only and never shown to the candidate: what a good candidate says about this result, in order. `obs` (kind obs only) holds the observation rows the chart is drawn from. |
| `part2.ask` | 3 to 5 examiner questions in order: what the results show; the most likely diagnosis and what else to consider; the management approach (immediate, definitive, disposition, who to involve); safety netting and follow-up. |
| `check` | Headings in this order: **Professionalism, History, Examination, Interpretation, Management, Safety netting**. Communication items sit under Professionalism or Management. 24 to 52 markable items counting kids, sized to the case: no item restates another or is filler. Examination items match the examination the case needs (and the Exam findings). Interpretation has an item for each result that matters. Safety netting has at least 2 items: specific red flags in plain words, when and where to come back (000, ED, GP), and the follow-up arranged. Critical (`crit: true`) on the items a safe junior doctor must not miss, at least 2 and at most 60%. Ids are integers in order; kid ids start at 1 within their item. |
| `guide` | A short note for the examiner on running and marking the station. |
| `explain` | The teaching: diagnosis and reasoning, the differentials that matter, interpreting the results, management and safety netting as the cited guideline sets them out. |
| `points`, `refs` | 3 to 6 learning points; 2 to 6 references, each a named guideline (RCH Clinical Practice Guidelines by page name for paediatrics and neonates; RANZCOG plus a state guideline for O&G; eTG and the relevant Australian body for adults). |
| `type` | From: History, Examination, Management, Counselling, Emergency, Ward Call, Interpretation, Prescribing, Procedure. |
| `imaging` | Requests for real images (see the README), usually `place: "part2"`. The handover always gives the result in words too. |

## Results (Part 2)

- **Bloods, gases, serology and other lab panels** go in `labs`, never as an HTML table: panels `{title, cols, rows}`, each row `{t: test, v: value, u: units, r: reference range, f: flag, n: note}` (`v` and `f` one per column when `cols` names more than one, e.g. Artery and Vein, or Today and On arrival). The page prints them the way a pathology system does: Test | Result | Ref. Range (Units), the test bold, the result right-aligned, an abnormal result red with an asterisk, the range and units grey ("115-165 (g/L)"). A test reported two ways (a percentage and a count) takes a second row with `t: ""`. `f` is H or L (HH, LL critical; A for an abnormal qualitative result) and must agree with the value and its range: `check-station` fails a station whose flag disagrees. Ranges are for this patient's age, sex and pregnancy ("115-165", "<5", "≥10", "Not detected"; words after the numbers stay with the range). A gas says venous or arterial and gives pH, pCO2, HCO3, base excess and lactate (pO2 only for an arterial gas); `check-station` checks that pH, pCO2 and HCO3 agree. `result` keeps only the lab's comments and sample details.
- **ECG**: a report in this order: rate, rhythm, axis, PR, QRS width, QTc, ST segments and T waves by territory, anything else (Q waves, bundle branch block), and the comparison with an old ECG.
- **X-ray, CT, ultrasound, MRI**: a formal report: the examination and view (or the phase of contrast; a CT says whether contrast was given), the clinical details given, the findings structure by structure (normal structures stated briefly), and a one-line conclusion. A real image is added only by the imaging pipeline; the report always stands on its own.
- **Observations**: `kind: "obs"`, `result` a one-line note if needed ("on 2 L/min nasal prongs since 14:10"), and the numbers in `obs.rows`: 2 to 6 rows, one per time they were taken (`t` "HH:MM"), the first matching the Part 1 vitals, later rows showing the response to treatment or the deterioration. Fields: `rr`, `spo2`, `o2` (L/min) with `dev` (RA, NP, FM, NRB, VM, HF), `sbp`, `dbp`, `hr`, `rhythm` (Reg or Irreg, adults), `temp`, `avpu` (A, C, V, P, U), `pain` (0 to 10), `distress` (normal, mild, moderate, severe; children), `crt` (seconds; children), `bgl`, `lactate`, `concern` (yes, no, na), `init` (the nurse's initials), `note` (an action at that time: "Rapid response called"). Leave out what was not measured.
- **Checked in code**: `check-station` fails any lab flag that disagrees with its value and range, notes a blood gas whose numbers do not add up, and `npm run validate` (with `--quality`) notes Part 1 vitals that differ from the first charted row.
- **The model interpretation** (`model`): a systematic read, then what it means for this patient and what it changes. For observations, name each abnormal value's zone on the patient's chart and the response it calls for.

## The observation chart

Observations are drawn on the NSW Health "Between the Flags" chart for the patient, chosen from `demo` by `public/js/osce/obs.mjs` `chartFor`:

| Patient | Chart |
|---|---|
| 16 years and over, ED or ward | Standard Adult General Observation Chart (SAGO, SMR110.010) |
| 12 to 15 years | Standard Paediatric Observation Chart (SPOC) 12 years and over (SMR110.019) |
| 5 to 11 years | SPOC 5 to 11 years (SMR110.018) |
| 1 to 4 years | SPOC 1 to 4 years (SMR110.017) |
| 3 to 12 months | SPOC 3 to 12 months (SMR110.016) |
| Clinic, GP or community; pregnant or postnatal; under 3 months | No chart in the set: the observations are written out (maternity and newborn charts not yet added) |

The zones come from the chart PDFs themselves (`scripts/charts/extract_zones.py` writes `public/js/osce/obs-charts.mjs`), and `scripts/obs.test.mjs` checks them against the thresholds printed on each chart and the NSW CERS criteria. Every value sits clearly inside one zone, never on a line between two (`check-station` notes it). If the observations reach the yellow or red zone, the checklist asks the candidate to act on it (clinical review or rapid response) under Interpretation, Management or Safety netting. On a paediatric chart, 3 or more yellow zone observations at once is a red zone criterion.

Doses: paediatric doses per kg, with the calculated amount for this child in the same item ("0.3 mg/kg = 3.6 mg for 12 kg"). Fixed-dose drugs are fine where the guideline gives a fixed dose.

Provenance stays: `origin`, `focus`, `basis`, `source` and the envelope fields are never removed. A station rewritten to this format carries `revised: {at, by}`.

## The Exam findings (`public/exam.json`)

Part 1's examination: `vitals`, `general`, 6 to 10 `steps` `{area, do, find}`, `bedside` `{test, find}`, `key`. They describe the patient as the candidate meets them in Part 1. A change that happens later (a deterioration, a reassessment, a result) belongs in Part 2's handover, not here.

## Converting a station written for the old 2 + 8 minute format

Keep the case, the patient, the diagnosis and the teaching; reshape them:

1. Strip times and history facts out of the stem.
2. Write the two tasks.
3. Make the patient script a Part 1 history script (keep its facts; add the history domains a focused history would cover and the answers).
4. Build Part 2 from the results the station already had (observations, bloods, ECG, CTG, imaging reports, a deterioration or reassessment, a test result in a counselling station). Add a result only where the case needs it, consistent with everything else.
5. Rebuild the checklist under the six headings: keep every item that is still right, move it under its heading, add History and Examination items where the old station had none, add Interpretation items for the results and at least 2 Safety netting items. Renumber ids in order.
6. Update `guide` and `explain` for the new shape; keep refs and add a well-known guideline only if the station has fewer than 2.
7. If Part 1's exam findings describe something that now happens in Part 2, take it out of the exam findings.

Counselling stations (a result to explain, advice to give) become: Part 1 a focused history and the relevant examination; Part 2 the result itself to interpret, then the management approach (which carries the explanation and the options) and safety netting.
