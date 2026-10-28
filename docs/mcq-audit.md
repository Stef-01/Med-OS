# MCQ audit

Written by `node scripts/mcq-audit.mjs` on 2026-10-28 from the standard pool (`public/mcq/pool.json`) and the duel pack (`public/duel/pack.json`). Every pooled question has passed the flaw checks, the model review and the bar; this looks at the set as a whole. The numbers are in `data/mcq/audit.json`.

## Answer-time formats

A question fits a format when reading it (4 words a second past the first 12, options included) takes at most two thirds of the time, leaving a third to think. The duel deals fitting questions first and gives the rest time to read.

| | Rapid 15 s | Standard 30 s | Long case 90 s | reading, median / 90th |
|---|---|---|---|---|
| pool | 422 of 811 (52%) | 481 of 811 (59.3%) | 806 of 811 (99.4%) | 9 / 44 s |
| duel pack | 886 of 2289 (38.7%) | 1711 of 2289 (74.7%) | 2288 of 2289 (100%) | 13 / 29 s |

- **Rapid (15 s)**: ai 587, open-exam 184, usmle-resource 115. Every topic can deal 10.
- **Standard (30 s)**: ai 1086, open-exam 496, usmle-resource 127, amsa 2. Every topic can deal 10.
- **Long case (90 s)**: ai 1464, open-exam 559, usmle-resource 263, amsa 2. Every topic can deal 10.

## Every question in the duel, by its categories (mcq/taxonomy.mjs)

2289 questions; every one fully categorised (source, origin, credit, specialty, kind, year, difficulty; `npm test` fails on any gap).

- **Source**: ai 1464, open-exam 559, usmle-resource 264, amsa 2
- **Route**: open-exam 559, ai station 532, ai high-yield 523, ai pool 409, usmle-resource 264, amsa 2
- **Kind**: clinical 1492, physio 430, anatomy 217, skills 150
- **Year**: 1 274, 2 438, 3 798, 4 779
- **Difficulty**: 1 494, 2 1449, 3 346
- **Specialties**: 45; the five largest Gastroenterology 240, Neurology 191, Cardiology 189, Respiratory Medicine 162, Paediatrics 144; the five smallest Medicolegal 10, Cardiothoracic Surgery 12, Occupational/Environmental Medicine 12, Professionalism 12, Bioethics 13

**Years and difficulties** (`scripts/tag-years.mjs`): the model set the year of 2289 of 2289 and the difficulty of 2289; the rest use the fallback guess. Where both exist, the guessed year matches the model's in 67.8% (within a year in 99.5%) and the guessed difficulty in 57.8%: run the tagger after new questions are written. Of the 790 pooled questions, every one has its kind from the tagger (`tag-years.mjs --kinds`).

## Cues and residual flaws in the duel, by route

The same checks the pool uses, run over every question the duel can deal, whichever writer made it.

| route | n | key is the longest option | chance | key position | checks firing (share of the route) |
|---|---|---|---|---|---|
| ai high-yield | 523 | 0.6% | 25% | A 357, B 89, C 53, D 24 | schema 100%, vignette 95.4%, stem-length 56.2%, absolute-terms 21.4% |
| ai pool | 409 | 9.8% | 20% | A 88, B 82, C 76, D 80, E 83 | schema 100%, vignette 66%, absolute-terms 2.2%, clang 2% |
| ai station | 532 | 0.9% | 25% | A 130, B 127, C 128, D 147 | schema 100%, vignette 98.9%, absolute-terms 12.2%, clang 7.9% |
| amsa | 2 | 50% | 25% | B 1, D 1 | schema 100% |
| open-exam | 559 | 29.7% | 24.5% | A 106, B 121, C 161, D 157, E 14 | schema 100%, vignette 78.7%, cover-options 9.3%, stem-length 7.7% |
| usmle-resource | 264 | 20.1% | 25% | A 66, B 63, C 57, D 78 | schema 100%, vignette 48.5%, stem-length 43.2%, lead-in 14.8% |

Key position is where the writer put the key; no student sees it there: the duel shuffles every question's options and Study moves the key to a place set by the question (`mcq/schema.mjs` `displayOrder`). Length cannot be shuffled away, so the longest-key column is the cue that counts.

Near-duplicate stems in the duel: 24 pairs, 3 of them across routes (two writers making the same case). They share 17 groups (lib/duel-pack.mjs groupCases), and a duel deals one question of a group unless nothing else is left.
- mxq-613 and mxq-615: 85.3%
- mxq-596 and mxq-619: 85%
- mxq-339 and mxq-340: 67.9%
- mxq-524 and mxq-526: 67.5%
- hy-02e11c8d and hy-133492a2: 66.7%
- hy-089869d5 and hy-3080b493: 66.7%
- mxq-601 and mxq-603: 66%
- ai-mcq-6dea4d62 and mmlu-medical_genetics-081: 57.1% (ai pool / usmle-resource)
- mmlu-anatomy-003 and mmlu-anatomy-117: 57.1%
- mmlu-anatomy-003 and mmlu-anatomy-120: 57.1%

## From candidate to pool, by route

Where each route's candidates stopped (lib/mcq-select.mjs, the stages in order). **Passed** is the share of the reviewed that cleared the review and the bar: what the route's writing is worth. **Admitted** is the share of all its candidates in the pool; a passed question left out is on reserve behind its quota or its topic's cap.

| route | candidates | schema | flaws | pending | review | bar | duplicate | reserve | pool | passed | admitted |
|---|---|---|---|---|---|---|---|---|---|---|---|
| open-exam headqa | 786 | 0 | 0 | 0 | 133 | 434 | 0 | 99 | 120 | 27.9% | 15.3% |
| usmle-resource medqa | 594 | 0 | 0 | 0 | 70 | 72 | 0 | 350 | 102 | 76.1% | 17.2% |
| usmle-resource mmlu | 504 | 0 | 1 | 0 | 54 | 86 | 2 | 183 | 178 | 72.2% | 35.3% |
| ai rapid | 353 | 0 | 0 | 0 | 3 | 42 | 9 | 0 | 299 | 87.3% | 84.7% |
| ai vignette | 159 | 0 | 0 | 0 | 8 | 25 | 0 | 16 | 110 | 79.2% | 69.2% |
| amsa | 105 | 0 | 0 | 0 | 13 | 90 | 0 | 0 | 2 | 1.9% | 1.9% |

## Cues and residual flaws in the pool

| kind | n | key is the longest option | chance | key position | checks still firing (share of the kind) |
|---|---|---|---|---|---|
| ai | 409 | 9.8% | 20% | A 88, B 82, C 76, D 80, E 83 | vignette 19.1%, absolute-terms 2.2%, clang 2%, units 1% |
| amsa | 2 | 50% | 25% | B 1, D 1 | none |
| open-exam | 120 | 20% | 22.4% | A 22, B 28, C 32, D 23, E 15 | explanation 100%, vignette 53.3%, cover-options 12.5%, units 4.2% |
| usmle-resource | 280 | 21.4% | 25% | A 69, B 66, C 62, D 83 | explanation 100%, lead-in 13.9%, cover-options 6.4%, vignette 2.9% |

## Near-duplicate stems

7 pairs share at least 50% of their word triples:
- ai-mcq-8d498cab and ai-mcq-a2209e4e: 57.1%
- mmlu-anatomy-003 and mmlu-anatomy-117: 57.1%
- mmlu-anatomy-003 and mmlu-anatomy-120: 57.1%
- mmlu-anatomy-040 and mmlu-medical_genetics-081: 57.1%
- mmlu-anatomy-060 and mmlu-medical_genetics-014: 57.1%
- mmlu-medical_genetics-076 and mmlu-medical_genetics-081: 57.1%
- ai-mcq-761a155d and ai-mcq-e80bdd48: 50%

## The model review of the pooled questions

| kind | judged | verdicts | both solves agree | single best | distractors | relevance | accuracy | explanation |
|---|---|---|---|---|---|---|---|---|
| ai | 409 | accept 352, revise 57 | 100% | 5 | 4 | 5 | 5 | 5 |
| amsa | 2 | revise 2 | 100% | 4 | 2 | 4 | 4 | 3 |
| open-exam | 120 | revise 120 | 100% | 4 | 3 | 4 | 4 | 0 |
| usmle-resource | 280 | revise 272, accept 8 | 100% | 5 | 4 | 4 | 5 | 0 |

Rubric scores are medians on the review's 1 to 5 scale.
