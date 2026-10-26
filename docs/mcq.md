# The MCQ pool: creation, evaluation and selection

A standard pool of single-best-answer questions (`public/mcq/pool.json`) that the duel plays (`public/duel/pack.json` is built from it). Questions arrive from four places. Each is checked in code against the NBME item-writing guide, reviewed by a model that does not know where it came from, scored against a bar calibrated on official USMLE Step 2 CK samples, and admitted only if it clears that bar. Every question carries a tag saying where it came from, and no step rewrites it. The numbers are in `docs/mcq-evals.md`, and the set as a whole (formats, cues, duplicates, what the review said) in `docs/mcq-audit.md`.

```
 stations ──────────── station questions (amsa / ai) ─┐
 stations + MedQA ──── generate-mcq.mjs (ai) ─────────┤
 data/benchmarks ───── MedQA, MMLU (usmle-resource) ──┼─▶ flaws.mjs ─▶ mcq-judge.mjs ─▶ mcq-pool.mjs ─▶ public/mcq/pool.json ─▶ build-duel-pack.mjs ─▶ public/duel/pack.json
 Submit a question ─── mcq-submissions.mjs (user) ────┘   (in code)     (model review)   (bar, dedupe,     public/mcq/status.json (what each submitter sees)
                                                                                         quotas, topics)   data/mcq/selection.json (every decision, with reasons)
```

## 1. The question and its provenance

`public/js/mcq/schema.mjs` is the one definition. The app's submit form, the scripts and the tests all use it.

```
{ id, stem, ask?, options[4..5], answer (0-based), explanation, why[one per option, null for the key], topic, tags[],
  provenance: { kind, source: { name, url, licence, retrieved? }, author?, submittedBy?, createdAt,
                generator?: { how, version, basis[], exemplars[]?, model? } },
  eval?: { flaws[], flawScore, judgeScore, quality, bar, solved, keyCorrect, singleBest, review, judge, verdict, reasons, evaluatedAt, evalVersion } }
```

| kind | What it is | Its source | The duel's chip today |
|---|---|---|---|
| `user` | written by a student, or brought by one from an open resource | "Written by the submitter" (licence `own`), or the resource's name, link and licence | Student |
| `ai` | written by a model (`generate-mcq.mjs`, `generator.how` = `cli` or `api`), or made in code from an AI-written station (`how` = `duel-pack`) | "Written by AI from Med-OS station …" | AI-written |
| `amsa` | made in code from an AMSA MedEd OSCE station's own differential | "AMSA MedEd OSCEs: <case>", with the AMSA page | AI-written (the station text is AI-written) |
| `usmle-resource` | an open, licensed online USMLE-style bank: MedQA (Step 2&3 split), MMLU professional medicine | the bank's name, URL and licence, on every item | USMLE |
| `open-exam` | a real exam's question from an open set the registry says to import (HEAD-QA's Spanish MIR medicine papers 2013 to 2016), as published | the set's citation and the date its terms ask for, as the credit under the explanation | Exam |

- **The tag is never rewritten.** `cleanItem` copies provenance and only cleans it. The selector adds `eval` and fills an empty `topic` from the review (and marks `eval.topicFrom: "review"`). It changes nothing else. A test checks this (`scripts/mcq-pool.test.mjs`, "provenance untouched").
- **A user's question stays the user's.** The reviewer's suggestion for fixing it goes in its verdict (`data/mcq/verdicts.json`, `rubric.suggestion`), not into the question. A submission whose kind is not `user` is refused at intake, not relabelled, and the table's check constraint refuses it too.
- **Tags** add the finer detail: `src:medqa`, `src:mmlu`, `exam:step2&3`, `station-derived`, `generated`, `focus:management`, `station:<id>`. `generator.basis` names the stations a question was made from, and `generator.exemplars` names the MedQA items whose style it followed.
- **Licences**: `own`, CC0, CC BY family, MIT, public domain (`licenceOk`). The pool refuses any source naming a commercial or official bank (UWorld, AMBOSS, Kaplan, NBME/FSMB/usmle.org, …), whatever licence it claims.
- `contentHash` (stem, lead-in, options, key) ties a verdict to the exact text it judged. Edit a question and it is reviewed again.

## 2. The item-writing checks (in code)

`public/js/mcq/flaws.mjs`: pure functions, each returning `{ check, pass, severity, reason }`. Each failure has a cost: `block` makes the question ineligible, `major` costs 20 and `minor` costs 6. `info` costs nothing. Flaw score = 100 minus the costs.

| check | catches | severity |
|---|---|---|
| `schema` | not a valid question (options, key, provenance, licence) | block |
| `lead-in` | no question asked | major |
| `cover-options` | unfocused ("which is true?"): major; not a closed question (ends with a colon): minor | major / minor |
| `all-none` | all/none of the above, "both A and B", "A and C" | major |
| `negative-stem` | EXCEPT, NOT, least, false, "which … would not" in the lead-in (a negative in the vignette is fine) | major |
| `longest-key` | the key is longest by a clear margin (> 1.3× the longest distractor, 12+ characters, > 1.6× the mean) | minor |
| `grammar-cue` | "… is an" that only the key fits; a plural lead-in only the key matches | major / minor |
| `convergence` | the key shares the most words with the other options (at least twice the next) | minor |
| `absolute-terms` | always/never/only/all in distractors but not in the key | minor |
| `clang` | the key named in the vignette, or all its words there and in no distractor: major; one rare word (7+ letters, once in the stem, in no distractor): minor | major / minor |
| `duplicate-options` | the same option twice: block; the same words reordered or with an article: major (options that differ in a number or a word like high/low are not duplicates) | block / major |
| `vignette` | a clinical item missing age, sex, setting, presentation or findings (2+ missing: major); a non-clinical item: minor | major / minor |
| `stem-length` | under 30 or over 450 words | minor |
| `units` | a lab or vital-sign value with no unit ("blood pressure is 100/70.") | minor |
| `explanation` | none, or under 40 characters | info |

Across a pool: `signature` / `nearDuplicate` (word 3-gram Jaccard ≥ 0.5 or containment ≥ 0.8) and `positionBalance` (the key's position, with χ²).

The thresholds were tuned on the benchmarks until an official Step 2 CK sample item almost never failed a major check (1 of 41: its key is named in its stem). Meanwhile the checks still catch MedMCQA's negative stems and all-of-the-above options, and MMLU's recall items with no vignette (`docs/mcq-evals.md` §1). The mutation test (§2 there) measures each check by injecting its flaw into good items.

## 3. The model review

`scripts/lib/mcq-judge.mjs` makes three calls per question through `ask`, so the flow is testable with a stub:

1. **Solve 1 and solve 2**: an examinee answers without the key, the explanation or the source. The second run sees the options in reverse order, so a position habit cannot match the key twice by chance.
2. **Rubric**: an NBME-style reviewer sees the whole item with its key and scores it. It judges whether the key is correct, which other options are defensible, single best answer (1–5), distractor plausibility and homogeneity (1–5), Step 2 CK relevance (1–5), accuracy (1–5), explanation (0–5) and safety. It also lists the flaws it sees, picks the topic, gives a verdict and its reasons, and writes a suggestion.

The judge never sees provenance: every kind gets the same prompt. Judge score (0–100) = 30 × solves/2 + 20 × single-best + 15 × distractors + 15 × relevance + 20 × accuracy (each 1–5 mapped to 0–1). The explanation is reported but not scored, because the open banks have none. Hard gates refuse a question whatever its score: the key judged wrong, unsafe, single-best ≤ 2, solved to another answer both times, or rejected by the reviewer. AI-written text (`ai`, `amsa`) must be solved to its key both times.

**Which Claude path ran here.** `ANTHROPIC_API_KEY` is not set in this container. A tiny `claude -p` call worked, so every review and every generated question here went through `scripts/lib/claude-cli.mjs` (the Claude Code CLI on the signed-in subscription). Each verdict records `judge: "<model> via the Claude Code CLI"`. With a key set, the same scripts use `scripts/lib/claude.mjs` (the SDK) and record "via the API". No verdict is written without a call that returned. The CLI shares the session's usage limit, and one judging run stopped when it hit that limit (the failed items have no verdict and stay pending). Runs resume where they stopped, and on 2026-10-26 the review reached every one of the 1,061 candidates: 277 in the pool, 512 passed and on reserve (the quotas and topic balance below), 272 rejected.

**Self-preference.** The same model family writes the generated questions and reviews them, so it may favour its own writing. The reviewer never knows a question is AI-written, and the solves are blind. The code checks are model-free, and AI questions need the higher bar. Still, the generated questions scoring above the official samples is not proof they are better. A physician spot-check of the AI questions in the pool is the honest next step.

## 4. Calibration and the bar

`scripts/mcq-evals.mjs` reads the 41 official USMLE Step 2 CK sample items (QUEST-AI's transcription, copyright FSMB/NBME) from where they were downloaded (`$MCQ_BENCH_DIR`, default `../research/mcq-src`). Their verdicts stay there too (`verdicts/quest-ai.json`, written with `mcq-judge.mjs --bench … --out`, which refuses an output path inside the repo for a set that is not all MIT). The script writes only aggregate numbers to `data/mcq/calibration.json`:

- quality = 0.4 × flaw score + 0.6 × judge score;
- **base bar** = the official items' 5th percentile of quality, so about 95% of official items pass it. This bar applies to `user`, `usmle-resource` and `amsa` questions;
- **AI bar** = their 25th percentile: a model-written question (`ai`) must beat a quarter of the official items. `amsa` questions are held to the base bar (with the two-solve gate) because code builds them from AMSA's own case and differential. No model writes them freely, and freely written plausible-but-wrong items are what the higher bar is for.

## 5. Selection

`scripts/lib/mcq-select.mjs` (pure) and `scripts/mcq-pool.mjs` (files). For each candidate, the first step it fails is its reason:

1. schema → 2. flaws (block refuses) → 3. a current verdict (none yet: **pending**) → 4. the review's gates → 5. the bar.

Then, over everything that passed, best first:

6. **Dedupe**: a near-duplicate of an admitted question is refused, with the id it duplicates. Kinds go in the order user, usmle-resource, amsa, ai, so a user's question is never displaced by a copy from a bank.
7. **Quotas and topics**: user questions that pass are always kept, with no cap. Other kinds have caps (`QUOTA`: usmle-resource 160, open-exam 120, amsa 110, ai 110, and ai-rapid 200 for AI-written questions in the Rapid form (80 until 2026-10-26, when it filled with 25 more passing), so short questions and vignettes do not crowd each other out), and no topic may hold more than 15% of the non-user pool (at least 6). A question over a cap is **reserve**: it passed and takes a place when one drops out.

`data/mcq/selection.json` holds every decision with its reasons; `node scripts/mcq-pool.mjs --why <id>` prints one. `public/mcq/status.json` holds one line per submitted question. `npm test` fails when the pool on disk is not what the candidates make now.

## 6. Upload, end to end

1. **In the app**: Start → **Submit a question** (`public/js/osce/mcq-view.mjs`). The form takes the vignette, the lead-in, four or five options with the key marked (44 px targets, works at 320 px), the explanation, the topic, the source (I wrote it / an open resource with its name, link and licence), the author, and who is submitting. **Paste JSON or CSV instead** fills the form from one question, or checks and sends several at once. The checks in §2 run as you type. Each finding is labelled *Must fix* (Submit stays disabled), *Fix* or *Tip*.
2. **Sent**: with a Supabase project in `config.js` and `supabase/migrations/0007_mcq.sql` run once, the question is inserted into `mcq_submissions`. RLS allows select and insert only. The row must be a `user` question whose id matches. With no project, it stays on the phone, and **Export file** / **Copy** give `{ mcqSubmissions: 1, items: [...] }`.
3. **Intake**: `node scripts/mcq-submissions.mjs` pulls the table (`OSCE_SUPABASE_URL`/`OSCE_SUPABASE_KEY`, else `config.js`), or reads exported files given as arguments. New questions go into `data/mcq/submissions.json` exactly as submitted. The first copy of an id is kept, and anything not `user` is refused.
4. **Review and build**: `node scripts/mcq-judge.mjs --kind user`, `node scripts/mcq-pool.mjs`, `npm run duel-pack`, `npm test`, commit, push.
5. **Status**: once deployed, **Your questions** reads `mcq/status.json` and shows each question as *Waiting for review*, *In the pool*, *Passed, on reserve* or *Not taken* with the reasons. A question not in the file yet shows *Waiting for review* if it was sent, or *Not sent* if it was kept on the phone.

The e2e (`scripts/e2e/smoke.mjs`) runs the flow at 393, 320 and 1280 px against a local stand-in for the table, and never against a live project. It sends one question through the stand-in, pulls it with the real intake script into a temp file, and shows a rejection's reason.

## 7. Generation

`node scripts/generate-mcq.mjs --sample 64` (or `--stations a,b --focus management`) runs `scripts/lib/mcq-generate.mjs`:

- **Exemplars**: the three MedQA Step 2&3 items that share the most subject words with the station and have no major flaw. They are examples of style only.
- **Draft**: one five-option question that tests management, investigation, interpretation or a complication. The station's own question already asks the diagnosis, so the focus rotates. The vignette is 80–160 words (the MedQA Step 2&3 median is 137), with units, Australian guidelines, and a reason for every option.
- **Rapid form** (`--form rapid`, 2026-10-26): a compact case of 18 to 32 words before a short lead-in, five options of one to four words, at most 52 words in all, so it reads in about 10 s and fits the duel's Rapid 15 s format. It is tagged `form:rapid`, its stem-length floor is 15 words, not 30, and it counts against its own quota.
- **Gaps** (`--gaps 15|30|90`): the run is aimed at the topics `docs/mcq-audit.md` finds thin at that format (fewer than 10 fitting), the thinnest first, round-robin over topics, each station with each focus in turn. A thin topic with no station (Medicolegal, Bioethics, Indigenous Health…) gets two stand-ins (`topicStation`), each written from the specialty alone and told the lead-ins already written for it; the item says "Written by AI for <specialty> (no Med-OS station)".
- **Checks**: one revision if a major or block flaw remains, if the key is the single longest option (a cue: in the pool of 2026-10-26 the AI-written key was the longest 38% of the time against 20% by chance), or if a Rapid question does not fit 15 s by the duel's own reading rule. Then the checks run again. A question still failing goes to `drafts/mcq/` and is not kept.

Each kept question is `ai` with `generator: { how, version, basis: [station, osce-<station>], exemplars, model }`, and its key is spread by its id's hash. It still has to pass the review (`mcq-judge.mjs --kind ai`) and the AI bar before it reaches the pool.

## 8. Finding questions online: the sources registry

`data/sources/registry.json` lists every open MCQ set considered (13 on 2026-10-26), each with its licence as read at its source, whether that licence covers the questions or only a repository's code, and a verdict: **import**, **in-app** (already here by another route), **benchmark-only** or **reject**, each with its reason. `scripts/lib/sources.mjs` checks the file (`npm test`) and holds one adapter per imported set. `node scripts/fetch-sources.mjs` downloads each import, keeps the raw file outside the repo (it is data, never run), adapts it and writes `data/benchmarks/<id>.jsonl`. Nothing rewrites the text: HEAD-QA's terms (Ministerio de Sanidad) forbid changing the meaning and ask for the source and the date of the documents' last update, which travel as the credit. From there each row is a candidate like any other: the flaw checks, the review (`node scripts/mcq-judge.mjs --tag src:headqa --sample 60` for a pilot), and the bar, with an open-exam quota of 120.

The first import: HEAD-QA medicine 2013 to 2016, 788 questions after dropping the 130 that need an image. 2017 is left out: 6 of 9 sampled keys were implausible, the same in the Spanish file, as if taken from another paper's answer sheet. No open Australian or New Zealand set was found; the AMC, NBME and USMLE samples are treated as not redistributable.

## 9. The benchmarks and their licences

- `data/benchmarks/medqa-us-step2-3.jsonl` (594) and `mmlu-professional-medicine.jsonl` (272), written by `scripts/import-benchmarks.mjs`. Only MIT rows are copied, with the source and licence on every line. **Caveat**: MedQA's MIT licence is written for its code, and its questions were collected from USMLE-style prep material. MMLU's items were collected from freely available online sources. The founder chose to admit them as `usmle-resource` with their licence shown. Removing a bank is one line in `scripts/import-benchmarks.mjs` `SETS` plus a rebuild.
- The official USMLE samples never enter the repo: no text, no per-item verdicts, only aggregates. `scripts/validate-mcq.mjs` (in `npm test`) checks every text file under `data/`, `docs/`, `scripts/` and `public/` for any 12-word run of their text. It skips runs the open banks also use (stock phrasing such as "which of the following is the most appropriate next step in management"). It runs when the samples are on the machine and says it was skipped otherwise.
- MedMCQA, MedQA Step 1 and MMLU's other subjects are read from the download folder for calibration only.

## Commands

```
node scripts/fetch-sources.mjs [--only headqa]           # the registry's imports -> data/benchmarks/<id>.jsonl
node scripts/import-benchmarks.mjs                       # data/benchmarks from the downloads
node scripts/generate-mcq.mjs --sample 64 [--form rapid] [--gaps 15]   # new ai questions -> data/mcq/generated.json
node scripts/mcq-submissions.mjs [export.json]           # students' questions -> data/mcq/submissions.json
node scripts/mcq-judge.mjs [--kind user,ai] [--tag src:medqa --sample 50]   # reviews -> data/mcq/verdicts.json
node scripts/mcq-judge.mjs --bench <quest-ai.jsonl> --out <outside the repo> # the official samples
node scripts/mcq-evals.mjs [--wrong-key 16]              # calibration.json, evals.json, docs/mcq-evals.md
node scripts/mcq-pool.mjs [--why <id>]                   # the pool, status.json, selection.json
npm run duel-pack                                        # the duel's questions from the pool
node scripts/mcq-audit.mjs                               # the set as a whole -> data/mcq/audit.json, docs/mcq-audit.md
```

## In the duel (Pup Duel, `packages/pup-duel/` in Optimus, vendored)

1. **Source tags**: the package keeps each question's `source` (`user`, `ai`, `amsa`, `usmle-resource`) through `normQuestion` and `makeSetup`, and tags it in the match's top bar and on each review line (Student, AI-written, AMSA, USMLE). A pack question without one is tagged AI-written when its origin is ai.
2. **Answer-time formats** (2026-10-26): Rapid 15 s, Standard 30 s, Long case 1.5 min, the whole time a question shows. A question fits when reading it (4 words a second past 12) takes at most two thirds of that; a duel deals the fitting questions first and tops a short pick up with the shortest of the rest, each given time to read. `node scripts/mcq-audit.mjs` reports how many pool and pack questions fit each format, per topic (`docs/mcq-audit.md`). Step 2 CK vignettes (about 150 words) fit only Long case; Rapid needs short questions.
3. **Setup size**: `RULES.maxSetupBytes` (and the SQL's 65,536) could in principle be exceeded by 15 questions at every field's limit (about 7 KB each). Measured on 2026-10-26 over 2,000 random 15-question duels from the 793-question pack, none came near it: the largest was 30,497 bytes. So `makeSetup` has no trimming step; if longer questions ever push a deal past half the cap, it should drop `notes`, then trim `why`, before giving up.
