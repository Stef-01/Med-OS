# MCQ audit

Written by `node scripts/mcq-audit.mjs` on 2026-10-26 from the standard pool (`public/mcq/pool.json`) and the duel pack (`public/duel/pack.json`). Every pooled question has passed the flaw checks, the model review and the bar; this looks at the set as a whole. The numbers are in `data/mcq/audit.json`.

## Answer-time formats

A question fits a format when reading it (4 words a second past the first 12, options included) takes at most two thirds of the time, leaving a third to think. The duel deals fitting questions first and gives the rest time to read.

| | Rapid 15 s | Standard 30 s | Long case 90 s | reading, median / 90th |
|---|---|---|---|---|
| pool | 25 of 326 (7.7%) | 63 of 326 (19.3%) | 322 of 326 (98.8%) | 38 / 48 s |
| duel pack | 14 of 842 (1.7%) | 351 of 842 (41.7%) | 841 of 842 (99.9%) | 22 / 45 s |

- **Rapid (15 s)**: amsa 9, ai 5. Thin (under 10 fitting) in 36 of 36 topics: Addiction Medicine, Bioethics, Breast/Endocrine Surgery, Cardiology, Cardiothoracic Surgery, Critical Care Medicine, Dermatology, Emergency Medicine, Endocrinology, Gastroenterology, Gastrointestinal Surgery, General Practice, ….
- **Standard (30 s)**: usmle-resource 7, amsa 56, ai 288. Thin (under 10 fitting) in 28 of 36 topics: Addiction Medicine, Bioethics, Breast/Endocrine Surgery, Cardiothoracic Surgery, Critical Care Medicine, Dermatology, Emergency Medicine, Endocrinology, Gastrointestinal Surgery, General Surgery, Geriatrics, Gynaecology, ….
- **Long case (90 s)**: ai 642, usmle-resource 143, amsa 56. Thin (under 10 fitting) in 22 of 36 topics: Addiction Medicine, Bioethics, Breast/Endocrine Surgery, Cardiothoracic Surgery, Critical Care Medicine, Dermatology, Gastrointestinal Surgery, Geriatrics, Haematology, Immunology, Neonatology, Nephrology, ….

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
