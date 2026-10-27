# MCQ audit

Written by `node scripts/mcq-audit.mjs` on 2026-10-27 from the standard pool (`public/mcq/pool.json`) and the duel pack (`public/duel/pack.json`). Every pooled question has passed the flaw checks, the model review and the bar; this looks at the set as a whole. The numbers are in `data/mcq/audit.json`.

## Answer-time formats

A question fits a format when reading it (4 words a second past the first 12, options included) takes at most two thirds of the time, leaving a third to think. The duel deals fitting questions first and gives the rest time to read.

| | Rapid 15 s | Standard 30 s | Long case 90 s | reading, median / 90th |
|---|---|---|---|---|
| pool | 313 of 729 (42.9%) | 399 of 729 (54.7%) | 724 of 729 (99.3%) | 15 / 45 s |
| duel pack | 867 of 2257 (38.4%) | 1703 of 2257 (75.5%) | 2256 of 2257 (100%) | 13 / 29 s |

- **Rapid (15 s)**: ai 651, open-exam 207, amsa 9. Every topic can deal 10.
- **Standard (30 s)**: ai 1092, open-exam 546, usmle-resource 7, amsa 58. Every topic can deal 10.
- **Long case (90 s)**: ai 1446, open-exam 609, usmle-resource 143, amsa 58. Every topic can deal 10.

## Every question in the duel, by its categories (mcq/taxonomy.mjs)

2257 questions; every one fully categorised (source, origin, credit, specialty, kind, year, difficulty; `npm test` fails on any gap).

- **Source**: ai 1446, open-exam 609, usmle-resource 144, amsa 58
- **Route**: open-exam 609, ai station 532, ai high-yield 523, ai pool 391, usmle-resource 144, amsa 58
- **Kind**: clinical 1613, physio 337, anatomy 157, skills 150
- **Year**: 1 180, 2 405, 3 913, 4 759
- **Difficulty**: 1 522, 2 1391, 3 344
- **Specialties**: 45; the five largest Gastroenterology 254, Cardiology 195, Neurology 183, Respiratory Medicine 168, Paediatrics 140; the five smallest Medicolegal 10, Cardiothoracic Surgery 11, OMS/Dental 12, Pathology 12, Occupational/Environmental Medicine 12

**Years and difficulties** (`scripts/tag-years.mjs`): the model set the year of 2257 of 2257 and the difficulty of 2257; the rest use the fallback guess. Where both exist, the guessed year matches the model's in 67.6% (within a year in 99.5%) and the guessed difficulty in 44.8%: run the tagger after new questions are written.

## Cues and residual flaws in the duel, by route

The same checks the pool uses, run over every question the duel can deal, whichever writer made it.

| route | n | key is the longest option | chance | key position | checks firing (share of the route) |
|---|---|---|---|---|---|
| ai high-yield | 523 | 60.2% | 25% | A 357, B 89, C 53, D 24 | schema 100%, vignette 95.4%, stem-length 56.2%, longest-key 23.5% |
| ai pool | 391 | 10.2% | 20% | A 82, B 79, C 75, D 74, E 81 | schema 100%, vignette 65.5%, clang 1.8%, absolute-terms 1.8% |
| ai station | 532 | 50.9% | 25% | A 130, B 127, C 128, D 147 | schema 100%, vignette 98.9%, absolute-terms 11.1%, clang 7.9% |
| amsa | 58 | 27.6% | 25% | A 16, B 17, C 12, D 13 | schema 100%, units 13.8%, longest-key 8.6%, vignette 6.9% |
| open-exam | 609 | 30.5% | 24.5% | A 119, B 134, C 176, D 166, E 14 | schema 100%, vignette 79.3%, explanation 18.9%, cover-options 9.4% |
| usmle-resource | 144 | 20.1% | 25% | A 38, B 36, C 24, D 46 | schema 100%, explanation 100%, vignette 5.6%, cover-options 4.9% |

Near-duplicate stems in the duel: 73 pairs, 1 of them across routes (two writers making the same case).
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
| ai rapid | 335 | 0 | 0 | 0 | 3 | 42 | 9 | 0 | 281 | 86.6% | 83.9% |
| usmle-resource mmlu | 272 | 0 | 1 | 0 | 19 | 27 | 0 | 167 | 58 | 83% | 21.3% |
| ai vignette | 159 | 0 | 0 | 0 | 9 | 24 | 0 | 16 | 110 | 79.2% | 69.2% |
| amsa | 105 | 0 | 0 | 0 | 10 | 37 | 0 | 0 | 58 | 55.2% | 55.2% |

## Cues and residual flaws in the pool

| kind | n | key is the longest option | chance | key position | checks still firing (share of the kind) |
|---|---|---|---|---|---|
| ai | 391 | 10.2% | 20% | A 82, B 79, C 75, D 74, E 81 | vignette 18.7%, clang 1.8%, absolute-terms 1.8%, units 1% |
| amsa | 58 | 27.6% | 25% | A 16, B 17, C 12, D 13 | units 13.8%, longest-key 8.6%, vignette 6.9%, clang 1.7% |
| open-exam | 120 | 20% | 22.4% | A 22, B 28, C 32, D 23, E 15 | explanation 100%, vignette 53.3%, cover-options 12.5%, units 4.2% |
| usmle-resource | 160 | 22.5% | 25% | A 41, B 39, C 29, D 51 | explanation 100%, cover-options 5.6%, vignette 5%, clang 1.9% |

## Near-duplicate stems

2 pairs share at least 50% of their word triples:
- ai-mcq-8d498cab and ai-mcq-a2209e4e: 57.1%
- ai-mcq-761a155d and ai-mcq-e80bdd48: 50%

## The model review of the pooled questions

| kind | judged | verdicts | both solves agree | single best | distractors | relevance | accuracy | explanation |
|---|---|---|---|---|---|---|---|---|
| ai | 391 | accept 338, revise 53 | 100% | 5 | 4 | 5 | 5 | 5 |
| amsa | 58 | revise 58 | 100% | 5 | 2 | 3 | 4 | 2 |
| open-exam | 120 | revise 120 | 100% | 4 | 3 | 4 | 4 | 0 |
| usmle-resource | 160 | revise 155, accept 5 | 100% | 5 | 4 | 5 | 5 | 0 |

Rubric scores are medians on the review's 1 to 5 scale.
