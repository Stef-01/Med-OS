# The MCQ pool: creation, evaluation and selection

A standard pool of single-best-answer questions (`public/mcq/pool.json`) that the duel plays (`public/duel/pack.json` is built from it). Questions arrive from five places. Each is checked in code against the NBME item-writing guide, reviewed by a model that does not know where it came from, scored against a bar calibrated on official USMLE Step 2 CK samples, and admitted only if it clears that bar. Every question carries a tag saying where it came from, and no step rewrites it. The numbers are in `docs/mcq-evals.md`, and the set as a whole (formats, cues, duplicates, what the review said) in `docs/mcq-audit.md`.

```
 stations ──────────── station questions (amsa / ai) ─┐
 stations + MedQA ──── generate-mcq.mjs (ai) ─────────┤
 data/benchmarks ───── MedQA, MMLU (usmle-resource) ──┤
 fetch-sources.mjs ─── HEAD-QA (open-exam) ───────────┼─▶ flaws.mjs ─▶ mcq-judge.mjs ─▶ mcq-pool.mjs ─▶ public/mcq/pool.json ─▶ build-duel-pack.mjs ─▶ public/duel/pack.json
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

**Close calls get a second review** (2026-10-26). `mcq-evals.mjs --retest 40` reviewed 40 judged questions again from scratch: the key verdict and the solves never changed, the quality moved 2 points on average (5 at the 90th percentile), and 4 of the 40 crossed the bar, every one within 5 points of it. So a question past the gates whose quality is within 5 points of its bar (`CLOSE`) is reviewed once more (`mcq-judge.mjs --close`, kept as `verdict.second`): its judge score is the mean of the two, and either review's gates refuse it. The pool records `eval.reviews`. Run it for the kinds the bar decides (`--kind ai,amsa,open-exam`); behind a full quota, as for `usmle-resource`, a second review changes nothing.

**The human check** (2026-10-27): `node scripts/mcq-spotcheck.mjs` draws a fixed sample of the pool (40, spread over the kinds) as a sheet to mark (`docs/mcq-spotcheck.md`); the calls (fine, wrong key, not single best, unsafe, unclear, other) go in `data/mcq/spotcheck.json`, and `mcq-evals.mjs` section 6 reports the share people accept, by kind: the pool's precision as people judge it, the one number here not made by a model.

**Self-preference.** The same model family writes the generated questions and reviews them, so it may favour its own writing. The reviewer never knows a question is AI-written, and the solves are blind. The code checks are model-free, and AI questions need the higher bar. Still, the generated questions scoring above the official samples is not proof they are better. A physician spot-check of the AI questions in the pool is the honest next step.

**Explanations for questions published without one** (2026-10-27): the USMLE resource set (MedQA) and the HEAD-QA papers publish the key only, so 280 pooled questions (all 160 usmle-resource, all 120 open-exam) showed no "why" in Study or after a duel. `scripts/explain-mcq.mjs` (`lib/mcq-explain.mjs`) asks Claude for one with the key given (why the key is best, naming what in the stem decides it, a clause where Australian practice differs, a note per wrong option), refuses a malformed one (too short or long, a note missing, an option named by letter when the options are shuffled), and keeps it only when a second call, reviewing it with the key, finds it accurate and consistent with the key. The question is never changed; the explanation is its own record in `data/mcq/explanations.json`, tied to the question's content hash. The pack fills a question that has no explanation from it and marks it `whyBy: "ai"`; Study says "Explanation written by AI; the question and its answer are as published", and the duel's review "Explanation written by AI" (Pup Duel keeps the mark).

**A preclinical level for Year 1 and 2** (2026-10-28, the founder's default): the review and its bar were set by the official Step 2 CK samples, so a recall question with no patient was marked down by design (MMLU's anatomy and genetics: 1 of 60 passed). A question tagged `level:preclinical` (`lib/mcq-sources.mjs` `PRECLINICAL_TOPICS`) is now sat and reviewed as a first- or second-year basic-science exam (`SOLVE_PRECLINICAL`, `RUBRIC_PRECLINICAL` in `lib/mcq-judge.mjs`: relevance is core Year 1 or 2 knowledge, recall is fine), the vignette and stem-length checks do not apply (`flaws.mjs` `isPreclinical`), and it has its own quota (`preclinical`, 120) at the base bar. MMLU anatomy and medical genetics (235) filled it: Year 1 questions in the duel went from 188 to 274, anatomy from 161 to 217, and 886 fit 15 s (was 780). Their explanations are written and reviewed like MedQA's.

**The tags, tagged twice** (2026-10-27): every question's year, difficulty and kind come from the model (`scripts/tag-years.mjs`), and the duel's ladder and Study's filters run on them. `tag-years.mjs --retest 80` tags a seeded sample again from scratch and compares (`lib/mcq-tag-retest.mjs`, evals section 8). Year (kappa 0.93) and kind (100%) were steady from the start; difficulty was not (69%, kappa 0.51), every disagreement one step. Two fresh runs on identical batches agreed 85 to 89%, but a differently batched run only about 70 to 79%: the model judges difficulty partly against the other questions it is shown. A tie-break rule, a "judge each on its own" line and mixed batches each changed little; the median of several passes, each in its own batch order, did (two medians of 3 agreed 86%, kappa 0.77). So `tag-years.mjs` now tags with `--passes 3` and keeps the median (`medianTag`).

**One question of a case a duel** (2026-10-27): stems the audit calls near-duplicates (half of one's word triples in the other) are one case asked two ways: MIR's case series in MedExpQA, or two high-yield questions written on one patient. `lib/duel-pack.mjs` `groupCases` gives each such set a `group` (its first id; 14 groups, 30 questions), and Pup Duel's deal (`oneOfEach`) puts a group's second question behind everything else, so a duel holds two only when nothing else is left. MedExpQA's outright repeats (the same case and answer) are left out of the pack altogether (`repeatOf`).

**Station questions' explanation** (2026-10-27): a question made in code from a station (`lib/duel-pack.mjs` `stationQuestion`, kinds `amsa` and `ai`) is the station's findings for its likely diagnosis, with the differential as distractors. Its explanation was the station's first teaching point, often the management rather than why this is the diagnosis, and the review marked these questions' explanations 2 of 5 ("does not justify the key", "off-topic"). It is now why the key fits, from the same findings the stem gives, then the teaching point (`explainKey`). The content hash does not cover the explanation, so the change is reviewed with `mcq-judge.mjs --tag station-derived --redo`. Re-reviewed (131): the median accuracy went from 3 to 4, but the explanation stayed at 2 and the AMSA pass rate held at 53 to 55%, inside the review's noise. The reviewer's remaining reasons are structural: the stem is the list of findings for the diagnosis (so it often hands the answer over), and the distractors' notes cite findings the short stem never gives. Its own suggestion is to write a full vignette, which is what `generate-mcq.mjs` does from the same AMSA stations (77 to 88% pass): the code-built route is near its ceiling.

## 4. Calibration and the bar

`scripts/mcq-evals.mjs` reads the 41 official USMLE Step 2 CK sample items (QUEST-AI's transcription, copyright FSMB/NBME) from where they were downloaded (`$MCQ_BENCH_DIR`, default `../research/mcq-src`). Their verdicts stay there too (`verdicts/quest-ai.json`, written with `mcq-judge.mjs --bench … --out`, which refuses an output path inside the repo for a set that is not all MIT). The script writes only aggregate numbers to `data/mcq/calibration.json`:

- quality = 0.4 × flaw score + 0.6 × judge score;
- **base bar** = the official items' 5th percentile of quality, so about 95% of official items pass it. This bar applies to `user`, `usmle-resource` and `amsa` questions;
- **AI bar** = their 25th percentile: a model-written question (`ai`) must beat a quarter of the official items. `amsa` questions, built in code from an AI-written AMSA station's differential, are held to the same AI bar since 2026-10-28 (they were on the base bar): that route passed 53 to 55% against 77 to 88% for questions the model writes from the same stations, and flipped most on a re-review. At the AI bar 2 of its 56 pooled questions stay; the model-written questions cover those stations.

## 5. Selection

`scripts/lib/mcq-select.mjs` (pure) and `scripts/mcq-pool.mjs` (files). For each candidate, the first step it fails is its reason:

1. schema → 2. flaws (block refuses) → 3. a current verdict (none yet: **pending**) → 4. the review's gates → 5. the bar.

Then, over everything that passed, best first:

6. **Dedupe**: a near-duplicate of an admitted question is refused, with the id it duplicates. Near-duplicate (`flaws.mjs` `DUP`): the whole questions share half their word triples (Jaccard), or one sits 80% inside the other, or **the same case is asked for the same answer**: the stems without their question sentences share 40% of their triples (at least 12) and the keys share half their content words ("IV thiamine", "Intravenous thiamine"). The last rule (2026-10-26) was set on every candidate pair: it finds the nine AI-written twins the first two missed (short stems, other distractors) and no other pair; the case alone would not do, since two MedQA vignettes on different conditions share a template at 50%, and one vignette asked two ways is two questions. Kinds go in the order user, usmle-resource, open-exam, amsa, ai (`PRIORITY`), so a user's question is never displaced by a copy from a bank.
7. **Quotas and topics**: user questions that pass are always kept, with no cap. Other kinds have caps (`QUOTA`: usmle-resource 160, preclinical 120, open-exam 120, amsa 110, ai 110, ai-rapid 300 for AI-written questions in the Rapid form, so short questions and vignettes do not crowd each other out, and ai-open 40 for an open set another team wrote with a model (section 8). Rapid was 80 until 2026-10-26, when it filled with 25 more passing, then 200 until 2026-10-27, when it filled with 35 more passing, 15 of them in topics too thin to deal a Rapid duel; at 260 the topics thin at 15 s went from 14 to 8. A per-topic floor inside the quota was measured first and changed nothing: it only reshuffles a full quota. 300 from later on 2026-10-27, when two more gap passes filled 260 with 19 passing on reserve: every passing Rapid question fits, and one topic is thin at 15 s), and no topic may hold more than 15% of the non-user pool (at least 6). A question over a cap is **reserve**: it passed and takes a place when one drops out.

Every decision records its **route** (the open set it came from by its `src:` tag, or for AI-written questions the form: `usmle-resource medqa`, `open-exam headqa`, `ai rapid`, `ai vignette`) and the **stage** it stopped at (`STAGES`: schema, flaws, pending, review, bar, banned, duplicate, reserve, pool). `stats.funnel` counts them per route, and `docs/mcq-audit.md` reports each route's pass rate (cleared the review and the bar, of those reviewed) and admission rate: where to spend the next generation or import.

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
- **Gaps** (`--gaps 15|30|90`, with `--per 2`: up to two questions per station, focus and form, since the thin topics' stations have used every focus once): the run is aimed at the topics `docs/mcq-audit.md` finds thin at that format (fewer than 10 fitting), the thinnest first, round-robin over topics, each station with each focus in turn. A thin topic with no station (Medicolegal, Bioethics, Indigenous Health…) gets stand-ins (`topicStation`), at least two and enough for its gap at a question per focus each, written from the specialty alone, and so does a thin topic whose stations have too few open slots left for its gap (2026-10-27: the last five thin topics all had stations, every slot full); the item says "Written by AI for <specialty> (no Med-OS station)".
- **The longest-option cue taken out of the older sets** (2026-10-27): the high-yield set and the station questions were written before the writers refused a key that is the single longest option, and carried it in 60% and 51% (the duel shuffles options, so position is no cue there, but length is). `node scripts/rebalance-options.mjs --set hy|station` asks Claude to rewrite the wrong options only, adding the detail a real distractor carries without hinting it is wrong ("Asbestos fibres, causing mesothelioma" gives itself away), keeping the key word for word (or shortening it with its meaning kept, if no distractor can match within the 90-character option limit). A rewrite is kept only if it passes the writer's checks and an independent examiner, answering blind, still picks the key; the question is marked `rebalanced`.
- **No twins kept** (2026-10-27): each question is checked against every candidate there is by the selector's near-duplicate rule as it is written (`twinOf`); a twin is not kept and its slot goes to the next job. The writer is only shown its own station's or topic's questions, so an Oncology stand-in once retold two Palliative Care questions' case, and the pool kept it in their place.
- **Told what is written** (2026-10-26): every job, station or stand-in, is shown the lead-ins and keys already written from its station or for its topic, this run's included (`writtenFrom`), and asked for a different answer. Before this, two jobs on one station wrote the same case for the same key nine times; the selector now refuses those twins (section 5), and the writer is told not to make them.
- **Checks**: one revision if a major or block flaw remains, if the key is the single longest option (a cue: in the pool of 2026-10-26 the AI-written key was the longest 38% of the time against 20% by chance), or if a Rapid question does not fit 15 s by the duel's own reading rule. Then the checks run again. A question still failing goes to `drafts/mcq/` and is not kept.

Each kept question is `ai` with `generator: { how, version, basis: [station, osce-<station>], exemplars, model }`, and its key is spread by its id's hash. It still has to pass the review (`mcq-judge.mjs --kind ai`) and the AI bar before it reaches the pool.

## 8. Finding questions online: the sources registry

`data/sources/registry.json` lists every open MCQ set considered (13 on 2026-10-26, 23 on 2026-10-27), each with its licence as read at its source, whether that licence covers the questions or only a repository's code, and a verdict: **import**, **in-app** (already here by another route), **benchmark-only** or **reject**, each with its reason. `scripts/lib/sources.mjs` checks the file (`npm test`) and holds one adapter per imported set. `node scripts/fetch-sources.mjs` downloads each import, keeps the raw file outside the repo (it is data, never run), adapts it and writes `data/benchmarks/<id>.jsonl`. Nothing rewrites the text: HEAD-QA's terms (Ministerio de Sanidad) forbid changing the meaning and ask for the source and the date of the documents' last update, which travel as the credit. From there each row is a candidate like any other: the flaw checks, the review (`node scripts/mcq-judge.mjs --tag src:headqa --sample 60` for a pilot), and the bar, with an open-exam quota of 120.

The first import: HEAD-QA medicine 2013 to 2016, 788 questions after dropping the 130 that need an image. 2017 is left out: 6 of 9 sampled keys were implausible, the same in the Spanish file, as if taken from another paper's answer sheet. No open Australian or New Zealand set was found; the AMC, NBME and USMLE samples are treated as not redistributable.

The second import tried (2026-10-27), from a search aimed at the topics the duel is thin in: **PrinciplismQA**, bioethics questions with explanations, MIT licensed (the README applies it to the dataset; the notice "Copyright (c) 2025 Freedom AI" travels as the credit). GPT-4o wrote them from ethics textbooks and experts checked them, so they are kind `ai` (`generator.how: "imported"`), face the AI bar and two blind solves, and count against their own quota (`ai-open`, 40) so they never crowd out the questions written from Med-OS's stations. Over half the set asks "which principle is most challenged" with the principles as the options, a recall item far from a clinical single best answer; the adapter leaves those out, so 871 of 2,182 remain. **The pilot failed**: of 110 reviewed, none passed (100 refused at the review's gates, 10 under the AI bar), and the reviewer judged the key wrong in 25 (23%): no patient or decision, items leaning on a textbook passage the student never sees, explanations contradicting their keys. PrinciplismQA is now benchmark-only and its rows are out of `data/benchmarks`; the adapter, the `imported` provenance and the `ai-open` quota stay for a set that earns them. The route funnel (`docs/mcq-audit.md`) is what showed it, at a cost of 110 reviews rather than 871. The same search checked nine more sets (MedEvalArena, MedIWF, SuperGPQA, MedARC-QA, TRIAGE, CUPCase, Humanity's Last Exam, MedEthicsQA, PubHealthBench); each is in the registry with why it is benchmark-only or rejected: a licence the pool does not accept (Apache-2.0, ODC-BY), content copied from commercial banks (MedEthicsQA: Quizlet, Lecturio, Medbullets), or data reachable only on Hugging Face, which this container cannot fetch (PubHealthBench, the best fit for occupational and environmental medicine). Nothing open covers Indigenous health, sexual health, neonatology or the surgical specialties in depth, so the generator stays the route for those.

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
node scripts/mcq-judge.mjs --close --kind ai,amsa,open-exam   # a second review for each close call
node scripts/mcq-judge.mjs --bench <quest-ai.jsonl> --out <outside the repo> # the official samples
node scripts/mcq-evals.mjs [--wrong-key 16] [--retest 40]   # calibration.json, evals.json, docs/mcq-evals.md
node scripts/mcq-pool.mjs [--why <id>]                   # the pool, status.json, selection.json
node scripts/tag-years.mjs                               # year (1-4) and difficulty (1-3) of every untagged pack question -> data/mcq/years.json
node scripts/tag-years.mjs --kinds                       # each pooled question's kind (clinical, physio, anatomy), which the pack otherwise files as clinical
npm run duel-pack                                        # the duel's questions from the pool
node scripts/mcq-audit.mjs                               # the set as a whole -> data/mcq/audit.json, docs/mcq-audit.md
node scripts/mcq-spotcheck.mjs [--n 40]                  # the human check: a fixed sample of the pool to mark -> docs/mcq-spotcheck.md, data/mcq/spotcheck.json
node scripts/mcq-spotcheck.mjs --mark <n> <call> [--note "..."] [--by name]   # record one call (ok, key, sba, unsafe, unclear, other) on sheet question n
node scripts/tag-years.mjs --retest 80 [--passes 3]             # the tags, tagged twice: agreement on year, difficulty and kind -> data/mcq/tag-retest.json
node scripts/explain-mcq.mjs [--kind usmle-resource,open-exam] [--limit n]   # AI explanations, reviewed, for pooled questions published without one -> data/mcq/explanations.json; then npm run duel-pack
```

**Year and difficulty** (2026-10-27): every duel question carries both (`mcq/taxonomy.mjs`); `scripts/tag-years.mjs` asks the model for them, and the pack falls back to `guessYear`/`guessDiff` (`public/js/mcq/year.mjs`) for a question tagged since. The audit measures the fallback against the model: on 2,257 questions the guessed year matched in 68% and was within a year in 99.5%, but the guessed difficulty matched only 45%, worse than always guessing 2 (54%). No simple rule over length, options, lead-in or year beat 55%, so `guessDiff` is now that rule (length alone, 55%), and the tagger runs after every generation pass. Before 2026-10-27, 1,472 of the 2,257 had only the guess. The duel's second layer, the kind, is the tagger's too for a pooled question (`--kinds`): until 2026-10-27 the pack filed every one as clinical, though 42 of the 708 test physiology or anatomy.

## In the duel (Pup Duel, `packages/pup-duel/` in Optimus, vendored)

1. **Source tags**: the package keeps each question's `source` (`user`, `ai`, `amsa`, `usmle-resource`) through `normQuestion` and `makeSetup`, and tags it in the match's top bar and on each review line (Student, AI-written, AMSA, USMLE). A pack question without one is tagged AI-written when its origin is ai.
2. **Answer-time formats** (2026-10-26): Rapid 15 s, Standard 30 s, Long case 1.5 min, the whole time a question shows. A question fits when reading it (4 words a second past 12) takes at most two thirds of that; a duel deals the fitting questions first and tops a short pick up with the shortest of the rest, each given time to read. `node scripts/mcq-audit.mjs` reports how many pool and pack questions fit each format, per topic (`docs/mcq-audit.md`). Step 2 CK vignettes (about 150 words) fit only Long case; Rapid needs short questions.
3. **Setup size**: `RULES.maxSetupBytes` (and the SQL's 65,536) could in principle be exceeded by 15 questions at every field's limit (about 7 KB each). Measured on 2026-10-26 over 2,000 random 15-question duels from the 793-question pack, none came near it: the largest was 30,497 bytes. So `makeSetup` has no trimming step; if longer questions ever push a deal past half the cap, it should drop `notes`, then trim `why`, before giving up.
