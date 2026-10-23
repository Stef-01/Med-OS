# Observation charts in Part 2

Part 2 shows a patient's observations on their NSW Health "Between the Flags" chart, marked the way a nurse marks it. This file explains how that works and why it was built this way.

## What "marked like a real nurse" means

A nurse charting on SAGO or SPOC:

- writes the time at the head of the next column, and initials at the foot
- puts a dot at the value for respiratory rate, SpO2, heart rate and temperature, and joins it to the last dot
- marks blood pressure as a "v" at the systolic and a "^" at the diastolic, joined by a vertical line (the systolic is the trigger)
- puts a dot in the row for consciousness (A, C, V, P, U), pain, family concern and, on the paediatric charts, respiratory distress and capillary refill
- writes the oxygen flow and device (RA, NP, FM, NRB, VM, HF) in their boxes, writes a value that runs off the scale beside the dot, and records actions ("Rapid response called") in the interventions box
- reads the colour each mark lands in and responds: blue, more frequent observations (children); yellow, a clinical review; red, a rapid response; on a paediatric chart, 3 or more yellow zone observations at once is a red zone criterion

The chart has to be right in two ways. The zones must be the real thresholds for that age, and the marks must sit at the right place.

## The options, and the one chosen

| Pipeline | For | Against | Verdict |
|---|---|---|---|
| A. The PDF page as an image, marks drawn over it | Looks exactly like the form | An A3 two-page spread is unreadable on a phone; the proofs supplied carry a "DO NOT PRINT" watermark and NSW Health branding; a calibration per chart is fragile; nothing can be checked in code | Rejected |
| B. Fill the PDF itself (form fields or drawn annotations) and show the PDF | The real document | Same phone problem; heavy; a PDF viewer in the app; no zone logic to reuse | Rejected |
| C. Ask an image model to draw the chart | Fast | Invents thresholds and positions; cannot be verified; different every time | Rejected |
| D. Ask Claude to write the SVG for each station | Flexible | The same zones re-derived 26 times, each a chance to be wrong; untestable | Rejected |
| **E. Extract the zones from the PDFs once, keep them as data, draw every chart from that data with one tested renderer** | One source of truth; the zones are checked against independent sources; crisp at any size; the chart for a phone shows only the columns used; the same data drives the examiner's zone summary and the station checks | The extraction has to be right, so it is checked twice (below); the drawing is a faithful re-drawing, not the official form | **Chosen** |

E is what an informatics team would do: treat the chart as data (thresholds per age band) plus a layout, and keep the rendering, the decision support (which zone, which response) and the content checks on the same data so they cannot disagree.

## The pipeline

1. **Extract** (`scripts/charts/extract_zones.py`, PyMuPDF). For each chart's graph page it reads the vector fills (red, yellow, blue) and the scale labels, then samples the fill between each pair of the chart's own scale lines, at the quarter points so the 5-unit sub-rows on the paediatric heart rate and blood pressure graphs are seen. Category rows (concern, consciousness, pain, respiratory distress, capillary refill, lactate) are read beside their own labels, anchored to each section's heading. It writes `public/js/osce/obs-charts.mjs`; that file is never edited by hand.
2. **Check against independent sources** (`scripts/obs.test.mjs`). Every integer value of respiratory rate, heart rate and SpO2 on each paediatric chart is classified and compared with the "Standard Thresholds" table printed on the front of that chart. The adult chart is compared with the NSW CERS red criteria (RR ≤ 5 or ≥ 30, SBP ≤ 90 or ≥ 200, HR ≤ 40 or ≥ 140). All of them agree.
3. **Laws** (`public/js/osce/obs.mjs`, pure):
   - `chartFor(demo)` picks the chart from the patient's age and setting.
   - `zoneOf` places a value in a zone.
   - `escalation` gives the response, including the paediatric 3-yellow rule.
   - `cleanObs` keeps only values the chart takes.
4. **Draw** (`public/js/osce/obs-chart.mjs`, pure):
   - The output is two SVG pages like the paper chart: vitals, then consciousness to initials. They stack on a phone and sit side by side on a wide screen.
   - The marks are in a ballpoint blue and a handwriting face (Caveat, OFL, vendored).
   - The interventions box and the zone key sit underneath.
   - For a patient with no chart in the set, the rows are written out as a table.
5. **Show**:
   - The candidate (the presenter and their own phone) sees only the chart.
   - The examiner's card shows the rows as a compact table, then "The chart calls for" (worked out by `escalation`, never written by hand), then the model interpretation.
6. **Gate** (`scripts/lib/station-gates.mjs`):
   - A charted patient's observations must be rows.
   - Check-station notes any value that sits exactly on a line between two zones.
   - It also notes when the observations reach yellow or red but no Interpretation, Management or Safety netting item asks the candidate to act on it.
   - `node scripts/check-station.mjs <id>` prints each row's zone and response.

## Where the charts are ambiguous, and what was decided

- **A value exactly on a line.** The paediatric charts print yellow as a closed range ("90 - 95") and red as strict ("<90"), so on those charts a red/yellow line is yellow. The adult chart prints no table; the NSW CERS criteria read "≤ 5 or ≥ 30", so on the adult chart a line takes the more severe zone. Stations avoid line values (a check-station note), so this decides only edge cases.
- **Additional calling criteria** that are not graphed (urine output, a new seizure, BGL with a drop in consciousness, "serious concern") are not computed; the model interpretation and the checklist carry them.

## Not covered yet

- **Pregnant and postnatal women:** the NSW maternity observation chart.
- **Babies under 3 months:** the SPOC 0 to 3 months and the newborn chart.

These stations show their observations written out. Adding a chart means putting its PDF in the folder, adding a line to `CHARTS` in the extractor (id, file, title, age band, scale order), rerunning it, and adding its printed thresholds to `scripts/obs.test.mjs`.

## Provenance

The zones and form numbers come from the NSW Health observation charts (SAGO SMR110.010; SPOC SMR110.016 to SMR110.019), published by the Clinical Excellence Commission. The app draws its own version of the chart for study; it is not the official form and carries no NSW Health branding. Check local CERS protocols for practice.
