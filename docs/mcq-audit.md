# MCQ audit

Written by `node scripts/mcq-audit.mjs` on 2026-10-27 from the standard pool (`public/mcq/pool.json`) and the duel pack (`public/duel/pack.json`). Every pooled question has passed the flaw checks, the model review and the bar; this looks at the set as a whole. The numbers are in `data/mcq/audit.json`.

## Answer-time formats

A question fits a format when reading it (4 words a second past the first 12, options included) takes at most two thirds of the time, leaving a third to think. The duel deals fitting questions first and gives the rest time to read.

| | Rapid 15 s | Standard 30 s | Long case 90 s | reading, median / 90th |
|---|---|---|---|---|
| pool | 209 of 607 (34.4%) | 288 of 607 (47.4%) | 602 of 607 (99.2%) | 23 / 45 s |
| duel pack | 763 of 2136 (35.7%) | 1592 of 2136 (74.5%) | 2135 of 2136 (100%) | 13 / 31 s |

- **Rapid (15 s)**: ai 542, open-exam 212, amsa 9. Thin (under 10 fitting) in 22 of 45 topics: Addiction Medicine, Bioethics, Breast/Endocrine Surgery, Cardiothoracic Surgery, Critical Care Medicine, Gastrointestinal Surgery, Geriatrics, Immunology, Indigenous Health, Medicolegal, Neonatology, Neurosurgery, ….
- **Standard (30 s)**: ai 983, open-exam 544, usmle-resource 7, amsa 58. Thin (under 10 fitting) in 9 of 45 topics: Bioethics, Cardiothoracic Surgery, Critical Care Medicine, Indigenous Health, Medicolegal, OMS/Dental, Occupational/Environmental Medicine, Professionalism, Sexual Health.
- **Long case (90 s)**: ai 1337, open-exam 597, usmle-resource 143, amsa 58. Thin (under 10 fitting) in 8 of 45 topics: Bioethics, Cardiothoracic Surgery, Critical Care Medicine, Indigenous Health, Medicolegal, OMS/Dental, Occupational/Environmental Medicine, Professionalism.

## Every question in the duel, by its categories (mcq/taxonomy.mjs)

2136 questions; every one fully categorised (source, origin, credit, specialty, kind, year, difficulty; `npm test` fails on any gap).

- **Source**: ai 1337, open-exam 597, usmle-resource 144, amsa 58
- **Route**: open-exam 597, ai station 532, ai high-yield 523, ai pool 282, usmle-resource 144, amsa 58
- **Kind**: clinical 1492, physio 337, anatomy 157, skills 150
- **Year**: 1 179, 2 377, 3 856, 4 724
- **Difficulty**: 1 417, 2 1393, 3 326
- **Specialties**: 45; the five largest Gastroenterology 255, Cardiology 193, Neurology 186, Respiratory Medicine 161, Paediatrics 140; the five smallest Occupational/Environmental Medicine 1, Medicolegal 4, Cardiothoracic Surgery 4, Professionalism 5, Indigenous Health 7

## Cues and residual flaws in the duel, by route

The same checks the pool uses, run over every question the duel can deal, whichever writer made it.

| route | n | key is the longest option | chance | key position | checks firing (share of the route) |
|---|---|---|---|---|---|
| ai high-yield | 523 | 60.2% | 25% | A 357, B 89, C 53, D 24 | schema 100%, vignette 95.4%, stem-length 56.2%, longest-key 23.5% |
| ai pool | 282 | 14.9% | 20% | A 56, B 57, C 58, D 50, E 61 | schema 100%, vignette 56.4%, absolute-terms 2.5%, units 1.4% |
| ai station | 532 | 50.9% | 25% | A 130, B 127, C 128, D 147 | schema 100%, vignette 98.9%, absolute-terms 11.1%, clang 7.9% |
| amsa | 58 | 27.6% | 25% | A 16, B 17, C 12, D 13 | schema 100%, units 13.8%, longest-key 8.6%, vignette 6.9% |
| open-exam | 597 | 31.3% | 24.2% | A 119, B 131, C 165, D 162, E 20 | schema 100%, vignette 80.6%, explanation 17.3%, cover-options 9.9% |
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
| open-exam headqa | 786 | 0 | 0 | 427 | 60 | 192 | 0 | 0 | 107 | 29.8% | 13.6% |
| usmle-resource medqa | 594 | 0 | 0 | 0 | 58 | 89 | 0 | 345 | 102 | 75.3% | 17.2% |
| usmle-resource mmlu | 272 | 0 | 1 | 0 | 19 | 27 | 0 | 167 | 58 | 83% | 21.3% |
| ai rapid | 200 | 0 | 0 | 0 | 2 | 19 | 7 | 0 | 172 | 89.5% | 86% |
| ai vignette | 159 | 0 | 0 | 0 | 9 | 27 | 0 | 13 | 110 | 77.4% | 69.2% |
| amsa | 105 | 0 | 0 | 0 | 10 | 37 | 0 | 0 | 58 | 55.2% | 55.2% |

## Cues and residual flaws in the pool

| kind | n | key is the longest option | chance | key position | checks still firing (share of the kind) |
|---|---|---|---|---|---|
| ai | 282 | 14.9% | 20% | A 56, B 57, C 58, D 50, E 61 | vignette 13.5%, absolute-terms 2.5%, units 1.4%, clang 1.4% |
| amsa | 58 | 27.6% | 25% | A 16, B 17, C 12, D 13 | units 13.8%, longest-key 8.6%, vignette 6.9%, clang 1.7% |
| open-exam | 107 | 24.3% | 20.3% | A 20, B 24, C 22, D 19, E 22 | explanation 100%, vignette 57%, cover-options 14%, stem-length 12.1% |
| usmle-resource | 160 | 22.5% | 25% | A 41, B 39, C 29, D 51 | explanation 100%, cover-options 5.6%, vignette 5%, clang 1.9% |

## Near-duplicate stems

No two pooled questions share 50% of their word triples.

## The model review of the pooled questions

| kind | judged | verdicts | both solves agree | single best | distractors | relevance | accuracy | explanation |
|---|---|---|---|---|---|---|---|---|
| ai | 282 | accept 242, revise 40 | 100% | 5 | 4 | 5 | 5 | 5 |
| amsa | 58 | revise 58 | 100% | 5 | 2 | 3 | 4 | 2 |
| open-exam | 107 | revise 107 | 100% | 4 | 3 | 4 | 4 | 0 |
| usmle-resource | 160 | revise 155, accept 5 | 100% | 5 | 4 | 5 | 5 | 0 |

Rubric scores are medians on the review's 1 to 5 scale.
