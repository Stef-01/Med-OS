# Station format

Every station runs the same way:

| Phase | Time | What happens |
|---|---|---|
| Reading | 5 min | The candidate reads the Instructions to Candidate |
| Part 1 | 10 min | A focused history from the patient (or parent) and a focused examination. The examiner gives examination findings from the Exam findings as the candidate says what they would examine |
| Part 2 | 5 min | The examiner hands over observations, investigation results or scans. The candidate interprets them, gives a management approach and safety-nets |

The app's clock runs these three phases with a bell at each change (Change Timing can alter them; Part 2 at 0 runs without it). When Part 2 starts, the examiner's view opens the Part 2 tab and the candidate screen shows the results.

`scripts/check-station.mjs <id>` checks a station against every rule below. `scripts/lib/station-gates.mjs` holds the rules; `scripts/lib/generate.mjs` tells the generator the same thing.

## The station file (`public/osce/<id>.json`)

| Field | Rule |
|---|---|
| `stem` | Instructions to Candidate: setting, the candidate's role, the patient (name or "the child", age) and why they are here. Never the diagnosis. **No times** (the page shows the format). Facts the candidate should find out in the history do not belong here. |
| `tasks` | Exactly 2 (3 at most). Task 1 is Part 1 and ends "(10 minutes)": take a focused history and perform a focused examination, telling the examiner what you are examining. The last task is Part 2 and ends "(5 minutes)": the examiner will give you the named results; interpret them, then outline your management approach and safety netting. Times add to 15. |
| `patient` | The Part 1 script for whoever plays the patient (or parent) and examines: opening line, the history by domain with answers given only when asked, ideas, concerns and expectations, questions to raise, and that examination findings come from the Exam findings. Nothing from Part 2 needs repeating here. |
| `part2.lead` | The examiner's opening line for Part 2, in plain words. |
| `part2.handover` | 2 to 6 results, each `{label, result}`: observations, bedside tests, bloods (units, and reference ranges where they matter), ECG, imaging reports in words, a reassessment. They follow from the history and examination. `result` may use the HTML allowlist (a `<table>` suits bloods). |
| `part2.ask` | 3 to 5 examiner questions in order: what the results show; the most likely diagnosis and what else to consider; the management approach (immediate, definitive, disposition, who to involve); safety netting and follow-up. |
| `check` | Headings in this order: **Professionalism, History, Examination, Interpretation, Management, Safety netting**. Communication items sit under Professionalism or Management. 20 to about 48 markable items counting kids. Examination items match the examination the case needs (and the Exam findings). Interpretation has an item for each result that matters. Safety netting has at least 2 items: specific red flags in plain words, when and where to come back (000, ED, GP), and the follow-up arranged. Critical (`crit: true`) on the items a safe junior doctor must not miss, at least 2 and at most 60%. Ids are integers in order; kid ids start at 1 within their item. |
| `guide` | A short note for the examiner on running and marking the station. |
| `explain` | The teaching: diagnosis and reasoning, the differentials that matter, interpreting the results, management and safety netting as the cited guideline sets them out. |
| `points`, `refs` | 3 to 6 learning points; 2 to 6 references, each a named guideline (RCH Clinical Practice Guidelines by page name for paediatrics and neonates; RANZCOG plus a state guideline for O&G; eTG and the relevant Australian body for adults). |
| `type` | From: History, Examination, Management, Counselling, Emergency, Ward Call, Interpretation, Prescribing, Procedure. |
| `imaging` | Requests for real images (see the README), usually `place: "part2"`. The handover always gives the result in words too. |

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
