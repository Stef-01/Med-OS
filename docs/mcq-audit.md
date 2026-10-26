# MCQ audit

Written by `node scripts/mcq-audit.mjs` on 2026-10-26 from the standard pool (`public/mcq/pool.json`) and the duel pack (`public/duel/pack.json`). Every pooled question has passed the flaw checks, the model review and the bar; this looks at the set as a whole. The numbers are in `data/mcq/audit.json`.

## Answer-time formats

A question fits a format when reading it (4 words a second past the first 12, options included) takes at most two thirds of the time, leaving a third to think. The duel deals fitting questions first and gives the rest time to read.

| | Rapid 15 s | Standard 30 s | Long case 90 s | reading, median / 90th |
|---|---|---|---|---|
| pool | 108 of 422 (25.6%) | 152 of 422 (36%) | 418 of 422 (99.1%) | 33 / 47 s |
| duel pack | 662 of 1955 (33.9%) | 1456 of 1955 (74.5%) | 1954 of 1955 (99.9%) | 13 / 33 s |

- **Rapid (15 s)**: ai 450, open-exam 203, amsa 9. Thin (under 10 fitting) in 23 of 44 topics: Addiction Medicine, Bioethics, Breast/Endocrine Surgery, Cardiothoracic Surgery, Critical Care Medicine, Gastrointestinal Surgery, Geriatrics, Immunology, Indigenous Health, Medicolegal, Neonatology, Neurosurgery, ….
- **Standard (30 s)**: ai 891, open-exam 502, usmle-resource 7, amsa 56. Thin (under 10 fitting) in 15 of 44 topics: Bioethics, Breast/Endocrine Surgery, Cardiothoracic Surgery, Critical Care Medicine, Indigenous Health, Medicolegal, Neonatology, OMS/Dental, Otorhinolaryngology, Palliative Care, Pathology, Plastic Surgery, ….
- **Long case (90 s)**: ai 1245, open-exam 510, usmle-resource 143, amsa 56. Thin (under 10 fitting) in 11 of 44 topics: Bioethics, Breast/Endocrine Surgery, Cardiothoracic Surgery, Critical Care Medicine, Indigenous Health, Medicolegal, OMS/Dental, Palliative Care, Pathology, Plastic Surgery, Professionalism.

## Every question in the duel, by its categories (mcq/taxonomy.mjs)

1955 questions; every one fully categorised (source, origin, credit, specialty, kind, year, difficulty; `npm test` fails on any gap).

- **Source**: ai 1245, open-exam 510, usmle-resource 144, amsa 56
- **Route**: ai station 532, ai high-yield 523, open-exam 510, ai pool 190, usmle-resource 144, amsa 56
- **Kind**: clinical 1311, physio 337, anatomy 157, skills 150
- **Year**: 1 179, 2 377, 3 766, 4 633
- **Difficulty**: 1 417, 2 1232, 3 306
- **Specialties**: 44; the five largest Gastroenterology 243, Cardiology 180, Neurology 178, Respiratory Medicine 152, Paediatrics 134; the five smallest Medicolegal 1, Professionalism 2, Cardiothoracic Surgery 3, OMS/Dental 4, Bioethics 5

## Cues and residual flaws in the duel, by route

The same checks the pool uses, run over every question the duel can deal, whichever writer made it.

| route | n | key is the longest option | chance | key position | checks firing (share of the route) |
|---|---|---|---|---|---|
| ai high-yield | 523 | 60.2% | 25% | A 357, B 89, C 53, D 24 | schema 100%, vignette 95.4%, stem-length 56.2%, longest-key 23.5% |
| ai pool | 190 | 22.1% | 20% | A 32, B 43, C 35, D 40, E 40 | schema 100%, vignette 41.6%, absolute-terms 2.6%, units 2.1% |
| ai station | 532 | 50.9% | 25% | A 130, B 127, C 128, D 147 | schema 100%, vignette 98.9%, absolute-terms 11.1%, clang 7.9% |
| amsa | 56 | 28.6% | 25% | A 15, B 17, C 11, D 13 | schema 100%, units 12.5%, longest-key 8.9%, vignette 7.1% |
| open-exam | 510 | 32.9% | 24.9% | A 104, B 111, C 148, D 145, E 2 | schema 100%, vignette 84.5%, stem-length 10.2%, cover-options 9.2% |
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
| ai | 190 | 22.1% | 20% | A 32, B 43, C 35, D 40, E 40 | vignette 7.4%, absolute-terms 2.6%, units 2.1%, clang 1.1% |
| amsa | 56 | 28.6% | 25% | A 15, B 17, C 11, D 13 | units 12.5%, longest-key 8.9%, vignette 7.1%, clang 1.8% |
| open-exam | 16 | 31.3% | 22.2% | A 5, B 3, C 4, D 2, E 2 | explanation 100%, vignette 50%, stem-length 25%, cover-options 18.8% |
| usmle-resource | 160 | 22.5% | 25% | A 41, B 39, C 29, D 51 | explanation 100%, cover-options 5.6%, vignette 5%, clang 1.9% |

## Near-duplicate stems

No two pooled questions share 50% of their word triples.

## The model review of the pooled questions

| kind | judged | verdicts | both solves agree | single best | distractors | relevance | accuracy | explanation |
|---|---|---|---|---|---|---|---|---|
| ai | 190 | accept 171, revise 19 | 100% | 5 | 4 | 5 | 5 | 5 |
| amsa | 56 | revise 56 | 100% | 5 | 2 | 3 | 4 | 2 |
| open-exam | 16 | revise 16 | 100% | 5 | 3 | 4 | 4 | 0 |
| usmle-resource | 160 | revise 155, accept 5 | 100% | 5 | 4 | 5 | 5 | 0 |

Rubric scores are medians on the review's 1 to 5 scale.
