# MCQ audit

Written by `node scripts/mcq-audit.mjs` on 2026-10-26 from the standard pool (`public/mcq/pool.json`) and the duel pack (`public/duel/pack.json`). Every pooled question has passed the flaw checks, the model review and the bar; this looks at the set as a whole. The numbers are in `data/mcq/audit.json`.

## Answer-time formats

A question fits a format when reading it (4 words a second past the first 12, options included) takes at most two thirds of the time, leaving a third to think. The duel deals fitting questions first and gives the rest time to read.

| | Rapid 15 s | Standard 30 s | Long case 90 s | reading, median / 90th |
|---|---|---|---|---|
| pool | 136 of 455 (29.9%) | 183 of 455 (40.2%) | 451 of 455 (99.1%) | 30 / 47 s |
| duel pack | 690 of 1988 (34.7%) | 1487 of 1988 (74.8%) | 1987 of 1988 (99.9%) | 13 / 31 s |

- **Rapid (15 s)**: ai 477, open-exam 204, amsa 9. Thin (under 10 fitting) in 23 of 44 topics: Addiction Medicine, Bioethics, Breast/Endocrine Surgery, Cardiothoracic Surgery, Critical Care Medicine, Gastrointestinal Surgery, Geriatrics, Immunology, Indigenous Health, Medicolegal, Neonatology, Neurosurgery, ….
- **Standard (30 s)**: ai 918, open-exam 506, usmle-resource 7, amsa 56. Thin (under 10 fitting) in 14 of 44 topics: Bioethics, Breast/Endocrine Surgery, Cardiothoracic Surgery, Critical Care Medicine, Indigenous Health, Medicolegal, Neonatology, OMS/Dental, Palliative Care, Pathology, Plastic Surgery, Professionalism, ….
- **Long case (90 s)**: ai 1272, open-exam 516, usmle-resource 143, amsa 56. Thin (under 10 fitting) in 11 of 44 topics: Bioethics, Breast/Endocrine Surgery, Cardiothoracic Surgery, Critical Care Medicine, Indigenous Health, Medicolegal, OMS/Dental, Palliative Care, Pathology, Plastic Surgery, Professionalism.

## Every question in the duel, by its categories (mcq/taxonomy.mjs)

1988 questions; every one fully categorised (source, origin, credit, specialty, kind, year, difficulty; `npm test` fails on any gap).

- **Source**: ai 1272, open-exam 516, usmle-resource 144, amsa 56
- **Route**: ai station 532, ai high-yield 523, open-exam 516, ai pool 217, usmle-resource 144, amsa 56
- **Kind**: clinical 1344, physio 337, anatomy 157, skills 150
- **Year**: 1 179, 2 377, 3 788, 4 644
- **Difficulty**: 1 417, 2 1264, 3 307
- **Specialties**: 44; the five largest Gastroenterology 247, Cardiology 186, Neurology 178, Respiratory Medicine 154, Paediatrics 137; the five smallest Medicolegal 1, Professionalism 2, Cardiothoracic Surgery 3, OMS/Dental 4, Bioethics 5

## Cues and residual flaws in the duel, by route

The same checks the pool uses, run over every question the duel can deal, whichever writer made it.

| route | n | key is the longest option | chance | key position | checks firing (share of the route) |
|---|---|---|---|---|---|
| ai high-yield | 523 | 60.2% | 25% | A 357, B 89, C 53, D 24 | schema 100%, vignette 95.4%, stem-length 56.2%, longest-key 23.5% |
| ai pool | 217 | 19.4% | 20% | A 40, B 45, C 41, D 42, E 49 | schema 100%, vignette 46.5%, absolute-terms 3.2%, units 1.8% |
| ai station | 532 | 50.9% | 25% | A 130, B 127, C 128, D 147 | schema 100%, vignette 98.9%, absolute-terms 11.1%, clang 7.9% |
| amsa | 56 | 28.6% | 25% | A 15, B 17, C 11, D 13 | schema 100%, units 12.5%, longest-key 8.9%, vignette 7.1% |
| open-exam | 516 | 32.8% | 24.9% | A 106, B 111, C 149, D 147, E 3 | schema 100%, vignette 83.9%, stem-length 10.3%, cover-options 9.3% |
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

## Cues and residual flaws in the pool

| kind | n | key is the longest option | chance | key position | checks still firing (share of the kind) |
|---|---|---|---|---|---|
| ai | 217 | 19.4% | 20% | A 40, B 45, C 41, D 42, E 49 | vignette 8.8%, absolute-terms 3.2%, units 1.8%, clang 1.8% |
| amsa | 56 | 28.6% | 25% | A 15, B 17, C 11, D 13 | units 12.5%, longest-key 8.9%, vignette 7.1%, clang 1.8% |
| open-exam | 22 | 27.3% | 21.6% | A 7, B 3, C 5, D 4, E 3 | explanation 100%, vignette 45.5%, stem-length 22.7%, cover-options 18.2% |
| usmle-resource | 160 | 22.5% | 25% | A 41, B 39, C 29, D 51 | explanation 100%, cover-options 5.6%, vignette 5%, clang 1.9% |

## Near-duplicate stems

No two pooled questions share 50% of their word triples.

## The model review of the pooled questions

| kind | judged | verdicts | both solves agree | single best | distractors | relevance | accuracy | explanation |
|---|---|---|---|---|---|---|---|---|
| ai | 217 | accept 186, revise 31 | 100% | 5 | 4 | 5 | 5 | 5 |
| amsa | 56 | revise 56 | 100% | 5 | 2 | 3 | 4 | 2 |
| open-exam | 22 | revise 22 | 100% | 5 | 3 | 4 | 4 | 0 |
| usmle-resource | 160 | revise 155, accept 5 | 100% | 5 | 4 | 5 | 5 | 0 |

Rubric scores are medians on the review's 1 to 5 scale.
