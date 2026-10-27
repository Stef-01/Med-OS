# MCQ audit

Written by `node scripts/mcq-audit.mjs` on 2026-10-27 from the standard pool (`public/mcq/pool.json`) and the duel pack (`public/duel/pack.json`). Every pooled question has passed the flaw checks, the model review and the bar; this looks at the set as a whole. The numbers are in `data/mcq/audit.json`.

## Answer-time formats

A question fits a format when reading it (4 words a second past the first 12, options included) takes at most two thirds of the time, leaving a third to think. The duel deals fitting questions first and gives the rest time to read.

| | Rapid 15 s | Standard 30 s | Long case 90 s | reading, median / 90th |
|---|---|---|---|---|
| pool | 232 of 648 (35.8%) | 318 of 648 (49.1%) | 643 of 648 (99.2%) | 21 / 45 s |
| duel pack | 786 of 2176 (36.1%) | 1622 of 2176 (74.5%) | 2175 of 2176 (100%) | 13 / 31 s |

- **Rapid (15 s)**: ai 570, open-exam 207, amsa 9. Thin (under 10 fitting) in 17 of 45 topics: Bioethics, Cardiothoracic Surgery, Critical Care Medicine, Geriatrics, Indigenous Health, Medicolegal, Neonatology, Neurosurgery, Occupational/Environmental Medicine, Oncology, Palliative Care, Pathology, ….
- **Standard (30 s)**: ai 1011, open-exam 546, usmle-resource 7, amsa 58. Thin (under 10 fitting) in 7 of 45 topics: Bioethics, Cardiothoracic Surgery, Critical Care Medicine, Medicolegal, Occupational/Environmental Medicine, Professionalism, Sexual Health.
- **Long case (90 s)**: ai 1365, open-exam 609, usmle-resource 143, amsa 58. Thin (under 10 fitting) in 6 of 45 topics: Bioethics, Cardiothoracic Surgery, Critical Care Medicine, Medicolegal, Occupational/Environmental Medicine, Professionalism.

## Every question in the duel, by its categories (mcq/taxonomy.mjs)

2176 questions; every one fully categorised (source, origin, credit, specialty, kind, year, difficulty; `npm test` fails on any gap).

- **Source**: ai 1365, open-exam 609, usmle-resource 144, amsa 58
- **Route**: open-exam 609, ai station 532, ai high-yield 523, ai pool 310, usmle-resource 144, amsa 58
- **Kind**: clinical 1532, physio 337, anatomy 157, skills 150
- **Year**: 1 179, 2 377, 3 885, 4 735
- **Difficulty**: 1 422, 2 1436, 3 318
- **Specialties**: 45; the five largest Gastroenterology 254, Cardiology 195, Neurology 182, Respiratory Medicine 163, Paediatrics 139; the five smallest Cardiothoracic Surgery 4, Professionalism 7, Bioethics 9, Medicolegal 9, Occupational/Environmental Medicine 9

## Cues and residual flaws in the duel, by route

The same checks the pool uses, run over every question the duel can deal, whichever writer made it.

| route | n | key is the longest option | chance | key position | checks firing (share of the route) |
|---|---|---|---|---|---|
| ai high-yield | 523 | 60.2% | 25% | A 357, B 89, C 53, D 24 | schema 100%, vignette 95.4%, stem-length 56.2%, longest-key 23.5% |
| ai pool | 310 | 12.9% | 20% | A 60, B 66, C 57, D 58, E 69 | schema 100%, vignette 59.4%, absolute-terms 1.9%, stem-length 1.3% |
| ai station | 532 | 50.9% | 25% | A 130, B 127, C 128, D 147 | schema 100%, vignette 98.9%, absolute-terms 11.1%, clang 7.9% |
| amsa | 58 | 27.6% | 25% | A 16, B 17, C 12, D 13 | schema 100%, units 13.8%, longest-key 8.6%, vignette 6.9% |
| open-exam | 609 | 30.5% | 24.5% | A 119, B 134, C 176, D 166, E 14 | schema 100%, vignette 79.3%, explanation 18.9%, cover-options 9.4% |
| usmle-resource | 144 | 20.1% | 25% | A 38, B 36, C 24, D 46 | schema 100%, explanation 100%, vignette 5.6%, cover-options 4.9% |

Near-duplicate stems in the duel: 72 pairs, 1 of them across routes (two writers making the same case).
- mxq-619 and mxq-620: 100%
- mxq-558 and mxq-559: 93.2%
- mxq-308 and mxq-309: 86.7%
- mxq-604 and mxq-605: 85.4%
- mxq-95 and mxq-96: 85.4%
- mxq-613 and mxq-615: 85.3%
- mxq-596 and mxq-619: 85%
- mxq-596 and mxq-620: 85%
- mxq-304 and mxq-305: 83.3%
- mxq-346 and mxq-347: 83.3%

## From candidate to pool, by route

Where each route's candidates stopped (lib/mcq-select.mjs, the stages in order). **Passed** is the share of the reviewed that cleared the review and the bar: what the route's writing is worth. **Admitted** is the share of all its candidates in the pool; a passed question left out is on reserve behind its quota or its topic's cap.

| route | candidates | schema | flaws | pending | review | bar | duplicate | reserve | pool | passed | admitted |
|---|---|---|---|---|---|---|---|---|---|---|---|
| open-exam headqa | 786 | 0 | 0 | 0 | 133 | 434 | 0 | 99 | 120 | 27.9% | 15.3% |
| usmle-resource medqa | 594 | 0 | 0 | 0 | 58 | 89 | 0 | 345 | 102 | 75.3% | 17.2% |
| usmle-resource mmlu | 272 | 0 | 1 | 0 | 19 | 27 | 0 | 167 | 58 | 83% | 21.3% |
| ai rapid | 258 | 0 | 0 | 0 | 3 | 29 | 7 | 19 | 200 | 87.6% | 77.5% |
| ai vignette | 159 | 0 | 0 | 0 | 9 | 24 | 0 | 16 | 110 | 79.2% | 69.2% |
| amsa | 105 | 0 | 0 | 0 | 10 | 37 | 0 | 0 | 58 | 55.2% | 55.2% |

## Cues and residual flaws in the pool

| kind | n | key is the longest option | chance | key position | checks still firing (share of the kind) |
|---|---|---|---|---|---|
| ai | 310 | 12.9% | 20% | A 60, B 66, C 57, D 58, E 69 | vignette 16.8%, absolute-terms 1.9%, units 1.3%, clang 1% |
| amsa | 58 | 27.6% | 25% | A 16, B 17, C 12, D 13 | units 13.8%, longest-key 8.6%, vignette 6.9%, clang 1.7% |
| open-exam | 120 | 20% | 22.4% | A 22, B 28, C 32, D 23, E 15 | explanation 100%, vignette 53.3%, cover-options 12.5%, units 4.2% |
| usmle-resource | 160 | 22.5% | 25% | A 41, B 39, C 29, D 51 | explanation 100%, cover-options 5.6%, vignette 5%, clang 1.9% |

## Near-duplicate stems

No two pooled questions share 50% of their word triples.

## The model review of the pooled questions

| kind | judged | verdicts | both solves agree | single best | distractors | relevance | accuracy | explanation |
|---|---|---|---|---|---|---|---|---|
| ai | 310 | accept 277, revise 33 | 100% | 5 | 4 | 5 | 5 | 5 |
| amsa | 58 | revise 58 | 100% | 5 | 2 | 3 | 4 | 2 |
| open-exam | 120 | revise 120 | 100% | 4 | 3 | 4 | 4 | 0 |
| usmle-resource | 160 | revise 155, accept 5 | 100% | 5 | 4 | 5 | 5 | 0 |

Rubric scores are medians on the review's 1 to 5 scale.
