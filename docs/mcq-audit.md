# MCQ audit

Written by `node scripts/mcq-audit.mjs` on 2026-10-26 from the standard pool (`public/mcq/pool.json`) and the duel pack (`public/duel/pack.json`). Every pooled question has passed the flaw checks, the model review and the bar; this looks at the set as a whole. The numbers are in `data/mcq/audit.json`.

## Answer-time formats

A question fits a format when reading it (4 words a second past the first 12, options included) takes at most two thirds of the time, leaving a third to think. The duel deals fitting questions first and gives the rest time to read.

| | Rapid 15 s | Standard 30 s | Long case 90 s | reading, median / 90th |
|---|---|---|---|---|
| pool | 160 of 505 (31.7%) | 217 of 505 (43%) | 501 of 505 (99.2%) | 27 / 46 s |
| duel pack | 714 of 2038 (35%) | 1521 of 2038 (74.6%) | 2037 of 2038 (100%) | 13 / 31 s |

- **Rapid (15 s)**: ai 499, open-exam 206, amsa 9. Thin (under 10 fitting) in 22 of 44 topics: Addiction Medicine, Bioethics, Breast/Endocrine Surgery, Cardiothoracic Surgery, Critical Care Medicine, Gastrointestinal Surgery, Geriatrics, Immunology, Indigenous Health, Medicolegal, Neonatology, Neurosurgery, ….
- **Standard (30 s)**: ai 940, open-exam 518, usmle-resource 7, amsa 56. Thin (under 10 fitting) in 12 of 44 topics: Bioethics, Breast/Endocrine Surgery, Cardiothoracic Surgery, Critical Care Medicine, Indigenous Health, Medicolegal, OMS/Dental, Palliative Care, Pathology, Plastic Surgery, Professionalism, Sexual Health.
- **Long case (90 s)**: ai 1294, open-exam 544, usmle-resource 143, amsa 56. Thin (under 10 fitting) in 11 of 44 topics: Bioethics, Breast/Endocrine Surgery, Cardiothoracic Surgery, Critical Care Medicine, Indigenous Health, Medicolegal, OMS/Dental, Palliative Care, Pathology, Plastic Surgery, Professionalism.

## Every question in the duel, by its categories (mcq/taxonomy.mjs)

2038 questions; every one fully categorised (source, origin, credit, specialty, kind, year, difficulty; `npm test` fails on any gap).

- **Source**: ai 1294, open-exam 544, usmle-resource 144, amsa 56
- **Route**: open-exam 544, ai station 532, ai high-yield 523, ai pool 239, usmle-resource 144, amsa 56
- **Kind**: clinical 1394, physio 337, anatomy 157, skills 150
- **Year**: 1 179, 2 377, 3 812, 4 670
- **Difficulty**: 1 417, 2 1305, 3 316
- **Specialties**: 44; the five largest Gastroenterology 253, Cardiology 188, Neurology 182, Respiratory Medicine 158, Paediatrics 137; the five smallest Medicolegal 1, Professionalism 2, Cardiothoracic Surgery 4, OMS/Dental 4, Bioethics 5

## Cues and residual flaws in the duel, by route

The same checks the pool uses, run over every question the duel can deal, whichever writer made it.

| route | n | key is the longest option | chance | key position | checks firing (share of the route) |
|---|---|---|---|---|---|
| ai high-yield | 523 | 60.2% | 25% | A 357, B 89, C 53, D 24 | schema 100%, vignette 95.4%, stem-length 56.2%, longest-key 23.5% |
| ai pool | 239 | 17.6% | 20% | A 47, B 50, C 44, D 44, E 54 | schema 100%, vignette 51%, absolute-terms 2.9%, units 1.7% |
| ai station | 532 | 50.9% | 25% | A 130, B 127, C 128, D 147 | schema 100%, vignette 98.9%, absolute-terms 11.1%, clang 7.9% |
| amsa | 56 | 28.6% | 25% | A 15, B 17, C 11, D 13 | schema 100%, units 12.5%, longest-key 8.9%, vignette 7.1% |
| open-exam | 544 | 32.4% | 24.6% | A 108, B 118, C 154, D 155, E 9 | schema 100%, vignette 82.7%, stem-length 9.9%, cover-options 9.4% |
| usmle-resource | 144 | 20.1% | 25% | A 38, B 36, C 24, D 46 | schema 100%, explanation 100%, vignette 5.6%, cover-options 4.9% |

Near-duplicate stems in the duel: 71 pairs, 1 of them across routes (two writers making the same case).
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
| open-exam headqa | 786 | 0 | 0 | 622 | 30 | 84 | 0 | 0 | 50 | 30.5% | 6.4% |
| usmle-resource medqa | 594 | 0 | 0 | 0 | 58 | 89 | 0 | 345 | 102 | 75.3% | 17.2% |
| usmle-resource mmlu | 272 | 0 | 1 | 0 | 19 | 27 | 0 | 167 | 58 | 83% | 21.3% |
| ai rapid | 198 | 0 | 0 | 58 | 1 | 10 | 0 | 0 | 129 | 92.1% | 65.2% |
| ai vignette | 159 | 0 | 0 | 0 | 9 | 27 | 0 | 13 | 110 | 77.4% | 69.2% |
| amsa | 105 | 0 | 0 | 0 | 8 | 41 | 0 | 0 | 56 | 53.3% | 53.3% |

## Cues and residual flaws in the pool

| kind | n | key is the longest option | chance | key position | checks still firing (share of the kind) |
|---|---|---|---|---|---|
| ai | 239 | 17.6% | 20% | A 47, B 50, C 44, D 44, E 54 | vignette 10%, absolute-terms 2.9%, units 1.7%, clang 1.7% |
| amsa | 56 | 28.6% | 25% | A 15, B 17, C 11, D 13 | units 12.5%, longest-key 8.9%, vignette 7.1%, clang 1.8% |
| open-exam | 50 | 26% | 20.7% | A 9, B 10, C 10, D 12, E 9 | explanation 100%, vignette 54%, cover-options 14%, absolute-terms 12% |
| usmle-resource | 160 | 22.5% | 25% | A 41, B 39, C 29, D 51 | explanation 100%, cover-options 5.6%, vignette 5%, clang 1.9% |

## Near-duplicate stems

No two pooled questions share 50% of their word triples.

## The model review of the pooled questions

| kind | judged | verdicts | both solves agree | single best | distractors | relevance | accuracy | explanation |
|---|---|---|---|---|---|---|---|---|
| ai | 239 | accept 203, revise 36 | 100% | 5 | 4 | 5 | 5 | 5 |
| amsa | 56 | revise 56 | 100% | 5 | 2 | 3 | 4 | 2 |
| open-exam | 50 | revise 50 | 100% | 4 | 3 | 4 | 4 | 0 |
| usmle-resource | 160 | revise 155, accept 5 | 100% | 5 | 4 | 5 | 5 | 0 |

Rubric scores are medians on the review's 1 to 5 scale.
