# MCQ evals: calibration and the eval of the evals

Written by `node scripts/mcq-evals.mjs` (do not edit by hand). The numbers are in `data/mcq/evals.json`; how the system works is `docs/mcq.md`.

## 1. Calibration on the benchmarks

Flaw score: 100 minus the cost of each failed check in `public/js/mcq/flaws.mjs` (major 20, minor 6, block 100). Quality: 0.4 × flaw score + 0.6 × the model review's score (`scripts/lib/mcq-judge.mjs`), for the items that were reviewed. "Passes" includes the review's hard gates (key judged wrong, unsafe, not a single best answer, solved to another answer both times, rejected).

| Set | Items | Flaw mean | Flaw p5 | Any major (%) | Reviewed | Quality p5 | Quality p25 | Quality median | Solved 2/2 (%) | Passes base bar (%) | Passes AI bar (%) | Passes as selected (%) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| MedQA Step 2&3 | 594 | 97.7 | 88 | 2 | 594 | 69 | 81 | 86 | 96 | 75.3 | 33 | 75.3 |
| MMLU professional medicine | 272 | 96.4 | 80 | 5.1 | 272 | 69 | 83 | 88 | 96.7 | 82.7 | 46 | 82.7 |
| Official USMLE Step 2 CK samples | 41 | 98.5 | 94 | 2.4 | 41 | 81 | 89 | 92 | 97.6 | 95.1 | 75.6 | 95.1 |
| QUEST-AI GPT-4 look-alikes | 43 | 99.2 | 94 | 0 | 43 | 52 | 77 | 85 | 81.4 | 69.8 | 30.2 | 69.8 |
| MedQA Step 1 | 679 | 96.1 | 80 | 9.3 | 0 | – | – | – | – | – | – | – |
| MMLU clinical knowledge + college medicine | 428 | 73.8 | 56 | 65.4 | 30 | 48 | 59 | 66 | 90 | 0 | 0 | 0 |
| MedMCQA dev (Indian PG entrance) | 4091 | 69.5 | 48 | 70.2 | 0 | – | – | – | – | – | – | – |
| Station-derived (AMSA) | 105 | 96.4 | 88 | 1.9 | 105 | 72 | 78 | 81 | 99 | 55.2 | 1.9 | 55.2 |
| Station-derived (AI stations) | 26 | 93.8 | 80 | 11.5 | 26 | 66 | 74 | 77 | 100 | 26.9 | 0 | 0 |
| Generated (generate-mcq.mjs) | 486 | 98.2 | 94 | 0 | 486 | 85 | 91 | 95 | 99.2 | 98.4 | 87.7 | 87.7 |
| Open exam (HEAD-QA, Spanish MIR) | 786 | 78.2 | 54 | 56.4 | 786 | 57 | 68 | 75 | 97.8 | 27.5 | 4.6 | 27.5 |

**Bars:** base 81, AI-written 89 (the official USMLE Step 2 CK samples (n=41): 5th and 25th percentile of quality). "As selected": the bar and gates each kind meets in the selector (ai: the AI bar and two solves; amsa: the base bar and two solves; the rest: the base bar).

Failure rate of each check (% of items):

| Set | schema | lead-in | cover-options | all-none | negative-stem | longest-key | grammar-cue | convergence | absolute-terms | clang | duplicate-options | vignette | stem-length | units |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| MedQA Step 2&3 | 0 | 0.5 | 10.1 | 0 | 0.2 | 4.5 | 0 | 0 | 1.5 | 4 | 0.2 | 9.9 | 0.3 | 2.7 |
| MMLU professional medicine | 0 | 0.7 | 9.9 | 0 | 0.4 | 4.8 | 0 | 0 | 0.4 | 6.6 | 1.1 | 19.9 | 0 | 0 |
| Official USMLE Step 2 CK samples | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 7.3 | 4.9 | 0 | 7.3 | 0 | 0 |
| QUEST-AI GPT-4 look-alikes | 0 | 0 | 2.3 | 0 | 0 | 7 | 0 | 0 | 2.3 | 0 | 0 | 2.3 | 0 | 0 |
| MedQA Step 1 | 0 | 0.1 | 5.4 | 0 | 0.7 | 3.1 | 0 | 0 | 1.6 | 2.5 | 1.3 | 24.2 | 0.7 | 0.7 |
| MMLU clinical knowledge + college medicine | 0 | 41.8 | 15.2 | 1.2 | 7.7 | 6.5 | 0 | 0 | 9.6 | 1.2 | 2.1 | 100 | 84.8 | 0.2 |
| MedMCQA dev (Indian PG entrance) | 0 | 51.8 | 20 | 5.9 | 15.5 | 4.8 | 0 | 0.1 | 3.4 | 0.3 | 1.7 | 98.6 | 89.9 | 0.3 |
| Station-derived (AMSA) | 0 | 0 | 0 | 0 | 0 | 9.5 | 0 | 0 | 0 | 12.4 | 0 | 15.2 | 0 | 18.1 |
| Station-derived (AI stations) | 0 | 0 | 0 | 0 | 0 | 11.5 | 0 | 0 | 0 | 11.5 | 0 | 42.3 | 0 | 11.5 |
| Generated (generate-mcq.mjs) | 0 | 0 | 0 | 0 | 0 | 0.4 | 0 | 0.6 | 3.1 | 3.9 | 0 | 21.8 | 0 | 0.8 |
| Open exam (HEAD-QA, Spanish MIR) | 0 | 25.8 | 21 | 0.1 | 12.7 | 5.7 | 0 | 0.3 | 8.1 | 4.7 | 0.5 | 84 | 44.4 | 2.2 |

## 2. Mutation test: does each check catch the flaw it is for?

582 MedQA Step 2&3 items with no major flaw, each with one flaw injected (`scripts/lib/mcq-mutate.mjs`). Detection: the check meant to catch it fires on the mutant. Base rate: the same check fires on the unmutated items (its false-positive rate on good items).

| Flaw injected | Check | Mutants | Detected (%) | Score drops (%) | Base rate on good items (%) |
| --- | --- | ---: | ---: | ---: | ---: |
| all-of-the-above | all-none | 582 | 100 | 100 | 0 |
| longest-correct | longest-key | 582 | 99.7 | 95.2 | 4.6 |
| negative-stem | negative-stem | 582 | 100 | 100 | 0 |
| key-in-stem | clang | 578 | 96.4 | 96.4 | 3.8 |
| duplicate-options | duplicate-options | 582 | 100 | 100 | 0 |
| missing-lead-in | lead-in | 582 | 96.6 | 100 | 0 |
| truncated-vignette | vignette or stem-length | 578 | 94.1 | 87.7 | 8.6 |
| none-of-the-above | all-none | 582 | 100 | 100 | 0 |

**Wrong key (model review):** 16 reviewed MedQA items that passed, with the key moved to a distractor. Refused: 100%; the reviewer judged the key wrong in 93.8%; an independent solve picked the wrong key in 0%.

## 3. QUEST-AI: official items against GPT-4 look-alikes, and the physicians' labels

41 official USMLE Step 2 CK sample items and 43 GPT-4 items written to look like them (QUEST-AI, Shah lab 2024), all reviewed by the same judge. The official items are read from outside the repo; none of their text is stored here.

- **Separation (AUC, official above GPT-4):** flaw score 0.484; quality 0.826 (0.5 is chance).
- **Pass rates:** official at the base bar 95.1%; GPT-4 at the base bar 69.8%, at the AI bar (what an AI item must clear) 30.2%.
- **Agreement with the physicians' consensus** on whether a GPT-4 item's key is correct (43 labelled: 28 correct, 15 incorrect or 50/50). Refusing at the AI bar: accuracy 51.2%, sensitivity to a bad item 80%, specificity 35.7%, Cohen's kappa 0.13. The reviewer's own key verdict agrees with the physicians on 76.7%.
- Confusion at the AI bar (positive = physicians found a problem; predicted positive = refused): TP 12, FN 3, FP 18, TN 10.
- The same at the base bar: accuracy 76.7%, sensitivity 60%, specificity 85.7%, kappa 0.47. The review's hard gates alone (no bar): accuracy 79.1%, sensitivity 60%, specificity 89.3%, kappa 0.52.

## 4. The review, reviewed twice

81 judged candidates, spread over the kinds, reviewed a second time from scratch (`--retest`, `scripts/lib/mcq-retest.mjs`). A flip is a question that passes the selector's checks and bar on one review and not the other: the share of the pool's membership that is the reviewer's noise.

| Kind | Retested | Same verdict (%) | Same key verdict (%) | Same solves (%) | Quality drift mean | Drift p90 | Drift max | Pass first / second | Flips (%) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ai | 21 | 85.7 | 100 | 100 | 1.6 | 3 | 8 | 19 / 19 | 0 (0) |
| amsa | 20 | 85 | 100 | 100 | 1.6 | 3 | 6 | 10 / 10 | 2 (10) |
| open-exam | 20 | 80 | 95 | 100 | 1.7 | 3 | 8 | 5 / 5 | 2 (10) |
| usmle-resource | 20 | 95 | 100 | 100 | 1.7 | 5 | 5 | 17 / 16 | 1 (5) |
| **all** | 81 | 86.4 | 98.8 | 100 | 1.6 | 5 | 8 | 51 / 50 | 5 (6.2) |

Flipped: osce-amsa-307 (81 then 78, passed on the first); osce-amsa-375 (75 then 81, passed on the second); headqa-2015-82 (80 then 82, passed on the second); headqa-2016-92 (84 then 79, passed on the first); mmlu-professional_medicine-097 (82 then 79, passed on the first).

## 5. The pool as selected

Candidates by kind: {"ai":512,"amsa":105,"open-exam":786,"usmle-resource":866}. Decisions: {"pool":745,"rejected":888,"reserve":636}. In the pool: {"ai":409,"open-exam":120,"usmle-resource":160,"amsa":56}. Topic cap 112. Key positions: 4 options 73/66/60/74 (χ² 1.89); 5 options 96/97/88/93/98 (χ² 0.69).

## 6. The human spot-check

Not marked yet: the 40 questions in `docs/mcq-spotcheck.md` wait for a person's calls in `data/mcq/spotcheck.json`. Until then every number above is a model judging.

## 7. Explanations written for published questions

280 pooled questions were published with the key only (open-exam 120, usmle-resource 160). `scripts/explain-mcq.mjs` wrote one with the key given and kept it only when a second review, with the key, found it accurate and consistent: **276 have one (98.6%)**; 4 do not (2 refused by the review, 2 by the format checks, the rest not yet written). Study and the duel mark them AI-written. The review is the same model family checking itself; a person's spot-check of the explanations is the next step.

What the review still refuses:

- The gout note says allopurinol is 'never' started during an acute attack, but current guidance (ACR 2020) allows urate-lowering therapy to be started during a flare with anti-inflammatory cover.
- The delusional disorder note says it requires non-bizarre delusions, but DSM-5 removed that requirement and allows bizarre delusions (with the 'with bizarre content' specifier); the real reasons to exclude it here are the disorganised thinking and negative symptoms.

## 8. The tags, tagged twice

Every question's year, difficulty and (pooled) kind come from the model (`scripts/tag-years.mjs`); the duel's 0 to 1 ladder climbs by year and Study filters by all three. `--retest` tags a seeded 160 again from scratch, as the tagger does (the median of 3 passes, each in its own batch order), and compares (2026-10-28):

| Tag | Items | Same (%) | Within one step (%) | Kappa |
| --- | ---: | ---: | ---: | ---: |
| year (1 to 4) | 160 | 96.3 | 99.4 | 0.94 |
| difficulty (1 to 3) | 160 | 83.1 | 100 | 0.72 |
| kind | 95 | 100 | – | 1 |

Difficulty is the soft one: the model judges it partly against the other questions in the batch, so one pass and a differently batched one disagree by a step about a quarter of the time. The tag is the median of several passes for that reason.

## Limits

- The judge is one model family; MedQA and MMLU items may be in its training data, so its solve rate on them is an upper bound.
- The generated questions are written and reviewed by the same model family, which may favour its own writing: their scores above the official samples' are not proof they are better. The blind solves, the code checks and the higher bar are the guard; a person's spot-check of the pool (section 6, scripts/mcq-spotcheck.mjs) is the ground truth.
- The official sample is small (41 text items), so the bars move by a few points with each item.
- The physicians' labels cover only the GPT-4 half of QUEST-AI.
