# MCQ audit

Written by `node scripts/mcq-audit.mjs` on 2026-10-26 from the standard pool (`public/mcq/pool.json`) and the duel pack (`public/duel/pack.json`). Every pooled question has passed the flaw checks, the model review and the bar; this looks at the set as a whole. The numbers are in `data/mcq/audit.json`.

## Answer-time formats

A question fits a format when reading it (4 words a second past the first 12, options included) takes at most two thirds of the time, leaving a third to think. The duel deals fitting questions first and gives the rest time to read.

| | Rapid 15 s | Standard 30 s | Long case 90 s | reading, median / 90th |
|---|---|---|---|---|
| pool | 25 of 326 (7.7%) | 63 of 326 (19.3%) | 322 of 326 (98.8%) | 38 / 48 s |
| duel pack | 579 of 1859 (31.1%) | 1367 of 1859 (73.5%) | 1858 of 1859 (99.9%) | 14 / 34 s |

- **Rapid (15 s)**: amsa 9, ai 370, open-exam 200. Thin (under 10 fitting) in 25 of 44 topics: Addiction Medicine, Bioethics, Breast/Endocrine Surgery, Cardiothoracic Surgery, Critical Care Medicine, Gastrointestinal Surgery, General Surgery, Geriatrics, Immunology, Indigenous Health, Medicolegal, Neonatology, ….
- **Standard (30 s)**: usmle-resource 7, amsa 56, ai 811, open-exam 493. Thin (under 10 fitting) in 16 of 44 topics: Bioethics, Breast/Endocrine Surgery, Cardiothoracic Surgery, Critical Care Medicine, Indigenous Health, Medicolegal, Neonatology, Neurosurgery, OMS/Dental, Otorhinolaryngology, Palliative Care, Pathology, ….
- **Long case (90 s)**: ai 1165, usmle-resource 143, amsa 56, open-exam 494. Thin (under 10 fitting) in 11 of 44 topics: Bioethics, Breast/Endocrine Surgery, Cardiothoracic Surgery, Critical Care Medicine, Indigenous Health, Medicolegal, OMS/Dental, Palliative Care, Pathology, Plastic Surgery, Professionalism.

## Every question in the duel, by its categories (mcq/taxonomy.mjs)

1859 questions; every one fully categorised (source, origin, credit, specialty, kind, year, difficulty; `npm test` fails on any gap).

- **Source**: ai 1165, open-exam 494, usmle-resource 144, amsa 56
- **Route**: ai station 532, ai high-yield 523, open-exam 494, usmle-resource 144, ai pool 110, amsa 56
- **Kind**: clinical 1215, physio 337, anatomy 157, skills 150
- **Year**: 1 179, 2 377, 3 722, 4 581
- **Difficulty**: 1 413, 2 1142, 3 304
- **Specialties**: 44; the five largest Gastroenterology 231, Neurology 172, Cardiology 169, Respiratory Medicine 147, Paediatrics 127; the five smallest Medicolegal 1, Cardiothoracic Surgery 2, Professionalism 2, OMS/Dental 4, Bioethics 5

## Cues and residual flaws in the duel, by route

The same checks the pool uses, run over every question the duel can deal, whichever writer made it.

| route | n | key is the longest option | chance | key position | checks firing (share of the route) |
|---|---|---|---|---|---|
| ai high-yield | 523 | 60.2% | 25% | A 357, B 89, C 53, D 24 | schema 100%, vignette 95.4%, stem-length 56.2%, longest-key 23.5% |
| ai pool | 110 | 38.2% | 20% | A 16, B 25, C 24, D 20, E 25 | schema 100%, vignette 8.2%, absolute-terms 4.5%, units 2.7% |
| ai station | 532 | 50.9% | 25% | A 130, B 127, C 128, D 147 | schema 100%, vignette 98.9%, absolute-terms 11.1%, clang 7.9% |
| amsa | 56 | 28.6% | 25% | A 15, B 17, C 11, D 13 | schema 100%, units 12.5%, longest-key 8.9%, vignette 7.1% |
| open-exam | 494 | 33% | 25% | A 99, B 108, C 144, D 143 | schema 100%, vignette 85.6%, stem-length 9.7%, cover-options 8.9% |
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
| ai | 110 | 38.2% | 20% | A 16, B 25, C 24, D 20, E 25 | vignette 8.2%, absolute-terms 4.5%, units 2.7%, clang 0.9% |
| amsa | 56 | 28.6% | 25% | A 15, B 17, C 11, D 13 | units 12.5%, longest-key 8.9%, vignette 7.1%, clang 1.8% |
| usmle-resource | 160 | 22.5% | 25% | A 41, B 39, C 29, D 51 | explanation 100%, cover-options 5.6%, vignette 5%, clang 1.9% |

## Near-duplicate stems

No two pooled questions share 50% of their word triples.

## The model review of the pooled questions

| kind | judged | verdicts | both solves agree | single best | distractors | relevance | accuracy | explanation |
|---|---|---|---|---|---|---|---|---|
| ai | 110 | accept 95, revise 15 | 100% | 5 | 4 | 5 | 5 | 5 |
| amsa | 56 | revise 56 | 100% | 5 | 2 | 3 | 4 | 2 |
| usmle-resource | 160 | revise 155, accept 5 | 100% | 5 | 4 | 5 | 5 | 0 |

Rubric scores are medians on the review's 1 to 5 scale.
