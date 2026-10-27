# MCQ audit

Written by `node scripts/mcq-audit.mjs` on 2026-10-27 from the standard pool (`public/mcq/pool.json`) and the duel pack (`public/duel/pack.json`). Every pooled question has passed the flaw checks, the model review and the bar; this looks at the set as a whole. The numbers are in `data/mcq/audit.json`.

## Answer-time formats

A question fits a format when reading it (4 words a second past the first 12, options included) takes at most two thirds of the time, leaving a third to think. The duel deals fitting questions first and gives the rest time to read.

| | Rapid 15 s | Standard 30 s | Long case 90 s | reading, median / 90th |
|---|---|---|---|---|
| pool | 330 of 745 (44.3%) | 415 of 745 (55.7%) | 740 of 745 (99.3%) | 14 / 44 s |
| duel pack | 780 of 2223 (35.1%) | 1645 of 2223 (74%) | 2222 of 2223 (100%) | 13 / 30 s |

- **Rapid (15 s)**: ai 587, open-exam 184, amsa 9. Every topic can deal 10.
- **Standard (30 s)**: ai 1086, open-exam 496, usmle-resource 7, amsa 56. Every topic can deal 10.
- **Long case (90 s)**: ai 1464, open-exam 559, usmle-resource 143, amsa 56. Every topic can deal 10.

## Every question in the duel, by its categories (mcq/taxonomy.mjs)

2223 questions; every one fully categorised (source, origin, credit, specialty, kind, year, difficulty; `npm test` fails on any gap).

- **Source**: ai 1464, open-exam 559, usmle-resource 144, amsa 56
- **Route**: open-exam 559, ai station 532, ai high-yield 523, ai pool 409, usmle-resource 144, amsa 56
- **Kind**: clinical 1536, physio 376, anatomy 161, skills 150
- **Year**: 1 180, 2 404, 3 866, 4 773
- **Difficulty**: 1 513, 2 1363, 3 347
- **Specialties**: 45; the five largest Gastroenterology 253, Cardiology 194, Neurology 183, Respiratory Medicine 168, Paediatrics 137; the five smallest Medicolegal 10, Cardiothoracic Surgery 11, OMS/Dental 12, Occupational/Environmental Medicine 12, Professionalism 12

**Years and difficulties** (`scripts/tag-years.mjs`): the model set the year of 2223 of 2223 and the difficulty of 2223; the rest use the fallback guess. Where both exist, the guessed year matches the model's in 68.6% (within a year in 99.6%) and the guessed difficulty in 54.7%: run the tagger after new questions are written. Of the 724 pooled questions, every one has its kind from the tagger (`tag-years.mjs --kinds`).

## Cues and residual flaws in the duel, by route

The same checks the pool uses, run over every question the duel can deal, whichever writer made it.

| route | n | key is the longest option | chance | key position | checks firing (share of the route) |
|---|---|---|---|---|---|
| ai high-yield | 523 | 0.6% | 25% | A 357, B 89, C 53, D 24 | schema 100%, vignette 95.4%, stem-length 56.2%, absolute-terms 21.4% |
| ai pool | 409 | 9.8% | 20% | A 88, B 82, C 76, D 80, E 83 | schema 100%, vignette 66%, absolute-terms 2.2%, clang 2% |
| ai station | 532 | 0.9% | 25% | A 130, B 127, C 128, D 147 | schema 100%, vignette 98.9%, absolute-terms 12.2%, clang 7.9% |
| amsa | 56 | 25% | 25% | A 18, B 14, C 11, D 13 | schema 100%, units 10.7%, vignette 8.9%, longest-key 7.1% |
| open-exam | 559 | 29.7% | 24.5% | A 106, B 121, C 161, D 157, E 14 | schema 100%, vignette 78.7%, cover-options 9.3%, stem-length 7.7% |
| usmle-resource | 144 | 20.1% | 25% | A 38, B 36, C 24, D 46 | schema 100%, vignette 5.6%, cover-options 4.9%, explanation 2.1% |

Key position is where the writer put the key; no student sees it there: the duel shuffles every question's options and Study moves the key to a place set by the question (`mcq/schema.mjs` `displayOrder`). Length cannot be shuffled away, so the longest-key column is the cue that counts.

Near-duplicate stems in the duel: 17 pairs, 1 of them across routes (two writers making the same case). They share 14 groups (lib/duel-pack.mjs groupCases), and a duel deals one question of a group unless nothing else is left.
- mxq-613 and mxq-615: 85.3%
- mxq-596 and mxq-619: 85%
- mxq-339 and mxq-340: 67.9%
- mxq-524 and mxq-526: 67.5%
- hy-02e11c8d and hy-133492a2: 66.7%
- hy-089869d5 and hy-3080b493: 66.7%
- mxq-601 and mxq-603: 66%
- osce-ai-b0b61929-physio and hy-32ce7670: 55.6% (ai station / ai high-yield)
- ai-mcq-761a155d and ai-mcq-e80bdd48: 53.8%
- hy-26632397 and hy-bd06c5f3: 53.8%

## From candidate to pool, by route

Where each route's candidates stopped (lib/mcq-select.mjs, the stages in order). **Passed** is the share of the reviewed that cleared the review and the bar: what the route's writing is worth. **Admitted** is the share of all its candidates in the pool; a passed question left out is on reserve behind its quota or its topic's cap.

| route | candidates | schema | flaws | pending | review | bar | duplicate | reserve | pool | passed | admitted |
|---|---|---|---|---|---|---|---|---|---|---|---|
| open-exam headqa | 786 | 0 | 0 | 0 | 133 | 434 | 0 | 99 | 120 | 27.9% | 15.3% |
| usmle-resource medqa | 594 | 0 | 0 | 0 | 58 | 89 | 0 | 345 | 102 | 75.3% | 17.2% |
| ai rapid | 353 | 0 | 0 | 0 | 3 | 42 | 9 | 0 | 299 | 87.3% | 84.7% |
| usmle-resource mmlu | 272 | 0 | 1 | 0 | 19 | 27 | 0 | 167 | 58 | 83% | 21.3% |
| ai vignette | 159 | 0 | 0 | 0 | 8 | 25 | 0 | 16 | 110 | 79.2% | 69.2% |
| amsa | 105 | 0 | 0 | 0 | 13 | 36 | 0 | 0 | 56 | 53.3% | 53.3% |

## Cues and residual flaws in the pool

| kind | n | key is the longest option | chance | key position | checks still firing (share of the kind) |
|---|---|---|---|---|---|
| ai | 409 | 9.8% | 20% | A 88, B 82, C 76, D 80, E 83 | vignette 19.1%, absolute-terms 2.2%, clang 2%, units 1% |
| amsa | 56 | 25% | 25% | A 18, B 14, C 11, D 13 | units 10.7%, vignette 8.9%, longest-key 7.1%, clang 3.6% |
| open-exam | 120 | 20% | 22.4% | A 22, B 28, C 32, D 23, E 15 | explanation 100%, vignette 53.3%, cover-options 12.5%, units 4.2% |
| usmle-resource | 160 | 22.5% | 25% | A 41, B 39, C 29, D 51 | explanation 100%, cover-options 5.6%, vignette 5%, clang 1.9% |

## Near-duplicate stems

2 pairs share at least 50% of their word triples:
- ai-mcq-8d498cab and ai-mcq-a2209e4e: 57.1%
- ai-mcq-761a155d and ai-mcq-e80bdd48: 50%

## The model review of the pooled questions

| kind | judged | verdicts | both solves agree | single best | distractors | relevance | accuracy | explanation |
|---|---|---|---|---|---|---|---|---|
| ai | 409 | accept 352, revise 57 | 100% | 5 | 4 | 5 | 5 | 5 |
| amsa | 56 | revise 56 | 100% | 5 | 2 | 3 | 4 | 2 |
| open-exam | 120 | revise 120 | 100% | 4 | 3 | 4 | 4 | 0 |
| usmle-resource | 160 | revise 155, accept 5 | 100% | 5 | 4 | 5 | 5 | 0 |

Rubric scores are medians on the review's 1 to 5 scale.
