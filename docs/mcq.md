# The MCQ pool: creation, evaluation and selection

A standard pool of single-best-answer questions (`public/mcq/pool.json`) that the duel plays (`public/duel/pack.json` is built from it). Questions arrive from four places. Each is checked in code against the NBME item-writing guide, reviewed by a model that does not know where it came from, scored against a bar calibrated on official USMLE Step 2 CK samples, and admitted only if it clears that bar. Every question carries a tag saying where it came from, and no step rewrites it. The numbers are in `docs/mcq-evals.md`.

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
| `user` | written by a student, or brought by one from an open resource | "Written by the submitter" (licence `own`), or the resource's name, link and licence | none |
| `ai` | written by a model (`generate-mcq.mjs`, `generator.how` = `cli` or `api`), or made in code from an AI-written station (`how` = `duel-pack`) | "Written by AI from Med-OS station …" | AI-written |
| `amsa` | made in code from an AMSA MedEd OSCE station's own differential | "AMSA MedEd OSCEs: <case>", with the AMSA page | AI-written (the station text is AI-written) |
| `usmle-resource` | an open, licensed online USMLE-style bank: MedQA (Step 2&3 split), MMLU professional medicine | the bank's name, URL and licence, on every item | none |

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
7. **Quotas and topics**: user questions that pass are always kept, with no cap. Other kinds have caps (`QUOTA`: usmle-resource 160, amsa 110, ai 110), and no topic may hold more than 15% of the non-user pool (at least 6). A question over a cap is **reserve**: it passed and takes a place when one drops out.

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
- **Checks**: one revision if a major or block flaw remains, then the checks again. A question still failing goes to `drafts/mcq/` and is not kept.

Each kept question is `ai` with `generator: { how, version, basis: [station, osce-<station>], exemplars, model }`, and its key is spread by its id's hash. It still has to pass the review (`mcq-judge.mjs --kind ai`) and the AI bar before it reaches the pool.

## 8. The benchmarks and their licences

- `data/benchmarks/medqa-us-step2-3.jsonl` (594) and `mmlu-professional-medicine.jsonl` (272), written by `scripts/import-benchmarks.mjs`. Only MIT rows are copied, with the source and licence on every line. **Caveat**: MedQA's MIT licence is written for its code, and its questions were collected from USMLE-style prep material. MMLU's items were collected from freely available online sources. The founder chose to admit them as `usmle-resource` with their licence shown. Removing a bank is one line in `scripts/import-benchmarks.mjs` `SETS` plus a rebuild.
- The official USMLE samples never enter the repo: no text, no per-item verdicts, only aggregates. `scripts/validate-mcq.mjs` (in `npm test`) checks every text file under `data/`, `docs/`, `scripts/` and `public/` for any 12-word run of their text. It skips runs the open banks also use (stock phrasing such as "which of the following is the most appropriate next step in management"). It runs when the samples are on the machine and says it was skipped otherwise.
- MedMCQA, MedQA Step 1 and MMLU's other subjects are read from the download folder for calibration only.

## Commands

```
node scripts/import-benchmarks.mjs                       # data/benchmarks from the downloads
node scripts/generate-mcq.mjs --sample 64                # new ai questions -> data/mcq/generated.json
node scripts/mcq-submissions.mjs [export.json]           # students' questions -> data/mcq/submissions.json
node scripts/mcq-judge.mjs [--kind user,ai] [--tag src:medqa --sample 50]   # reviews -> data/mcq/verdicts.json
node scripts/mcq-judge.mjs --bench <quest-ai.jsonl> --out <outside the repo> # the official samples
node scripts/mcq-evals.mjs [--wrong-key 16]              # calibration.json, evals.json, docs/mcq-evals.md
node scripts/mcq-pool.mjs [--why <id>]                   # the pool, status.json, selection.json
npm run duel-pack                                        # the duel's questions from the pool
```

## Package follow-up (Pup Duel, `packages/pup-duel/` in Optimus)

The vendored duel knows only `origin: 'ai' | 'human'`. Med-OS now writes `source` (`user`, `ai`, `amsa`, `usmle-resource`) on every question in `pack.json`, but `normQuestion` drops it. To show every source chip:

1. `duel/pack.mjs` `normQuestion`: after the origin line, add
   `if (['user', 'ai', 'amsa', 'usmle-resource'].includes(q.source)) out.source = q.source;`
   and document `source?` in the header comment's question shape.
2. `duel/core.mjs` `makeSetup`: after `if (q.origin) out.origin = q.origin;`, add `if (q.source) out.source = q.source;`. The SQL `pup_challenge` needs no change (it checks options, answer, secs and size only).
3. `ui/duel.mjs`: one map, `const SOURCE_TAG = { ai: 'AI-written', amsa: 'AMSA · AI-written', user: 'Student-written', 'usmle-resource': 'USMLE resource' };` and a `tagOf = q => SOURCE_TAG[q.source] || (q.origin === 'ai' ? 'AI-written' : '')`. Then:
   - in the question card (where `tag.textContent = q.origin === 'ai' ? …` is set, line 740 as vendored now): `const t = tagOf(q); tag.textContent = t; tag.hidden = !t;`
   - in `openReview` (the `const ai = st.setup.questions.some(…)` line, 567 now): replace the one sheet-level AI tag with a tag per question. In each `li`, prepend `<span class="pd-qtag"></span>` with `tagOf(q)` as its text (hidden when empty), so a mixed duel says which question came from where.
4. **Reading time**: pool questions are Step 2 CK vignettes (the pack's stems run to 1200 characters, about 180 words). The lobby offers 15, 20 or 30 seconds. Add 45 and 60, or scale each question's time by its stem's length, e.g. `secs + Math.ceil(words / 4)`. That would need `secs` per question in the setup, plus the same in `pup_challenge` and the server-core rules.
5. **Setup size**: `RULES.maxSetupBytes` (and the SQL's 65,536) could in principle be exceeded by 15 questions at every field's limit (about 7 KB each). Measured on 2026-10-26 over 2,000 random 15-question duels from the 793-question pack, none came near it: the largest was 30,497 bytes. So `makeSetup` has no trimming step; if longer questions ever push a deal past half the cap, it should drop `notes`, then trim `why`, before giving up.

Then vendor again (`scripts/vendor.mjs`). Med-OS needs no change: `pack.json` already carries `source`.
