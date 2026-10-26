# OSCE Practice

A study app for two medical students to practise OSCE stations together. One of you is the candidate, the other reads the patient script and marks against the full checklist. It runs as a static site with no build step and no server.

What's in it:

- **26 stations in one format**: 5 minutes reading, then **Part 1** (10 minutes) a focused history and examination, then **Part 2** (5 minutes) where the examiner hands over observations, investigations or scans and the candidate interprets them, gives a management approach and safety-nets. Each station has the instructions, the patient script, examination findings, the Part 2 results and questions, the full marking checklist (History, Examination, Interpretation, Management, Safety netting; Critical items flagged; global impression), an explanation, learning points and references. Every station is AI-generated and tagged **AI** wherever it shows. Check anything you rely on against the current guideline it cites.
- **Observation charts in Part 2**: observations are drawn on the patient's own NSW Health "Between the Flags" chart (adult, or the paediatric chart for their age), marked the way a nurse marks it, with the zones taken from the chart PDFs and checked against the thresholds printed on them. Lab results print the way a pathology system prints them (Test | Result | Ref. Range (Units), an abnormal result red with an asterisk), ECGs and imaging as structured reports, and each result has a model interpretation for the examiner only. See `docs/obs-charts.md`.
- **Partner mode**: your two names, who sits first, an automatic swap after each station, and every attempt saved under the candidate's name.
- **A candidate screen**: a link the candidate opens on their own phone that shows the instructions and the same countdown, so the examiner keeps the main device.
- **AI marking**: paste a transcript of the attempt and Claude marks it item by item against that station's checklist, with quotes as evidence, what was missed, phrasing that would score, and a model handover.
- **A station generator** that writes new stations against the bank's own standard and **finds the right X-rays** (and CTs, ultrasounds, ECGs) from open-licensed sources, with Claude checking the pixels before an image is used.

## Duel a Mate

**Duel a Mate** (Beta, a work in progress: off until you switch it on in **Settings → Games**, then a card on the start screen right after Request a case) is a live quiz between the two of you, with a cartoon dog each: the same questions on both phones against the same clock, right and fast wins, round by round. The questions come from the standard MCQ pool (below): Step 2 CK-style questions from the stations, from the open USMLE-style banks and from you, each admitted only after the item-writing checks and a review against the official samples, and any category questions written for a station (OSCE skills, Clinical, Physiology and pathophysiology, Anatomy). Choose them in two layers: a specialty, then a kind. AI-written ones say so. The game itself stays quiet (a reveal shows who picked what, and the points); after it, **Review** lists every question with its answer and why each wrong pick is wrong. Your dog is yours to dress: 44 dogs of 36 breeds, each breed's real coats, eight collar colours and 104 pieces in four slots (19 sets), eleven of them with a signature move, bought with the bones you earn by playing (nothing to feed, nothing that runs down).

- Sign in with a name and a 4-digit PIN (no email, no password; the same account keeps your OSCE progress, Settings → Account). Challenge the other, or **Practice** with Rex, and choose the questions in two layers, the same for both: a specialty (Paediatrics, Emergency Medicine, ...; a question from a station is under every specialty the station lists), then a kind of question (**OSCE skills**, **Clinical**, **Physiology and pathophysiology**, **Anatomy**), each with how many there are; then 5, 7 or 10 questions and a time for each: Rapid 15 s, Standard 30 s or Long case 1.5 min, with the questions short enough for it dealt first (the setup says how many fit). The pool's questions are all Clinical; the other kinds come from `scripts/generate-duel-mcq.mjs`, one AI-written question of each kind per station (written by Claude, checked by `scripts/lib/mcq.mjs` gates, then `npm run duel-pack`); a kind with none yet shows greyed. A finished duel pays bones: 12 for a win, 8 for a draw, 5 for playing to the end, and 1 for each right answer; practice with Rex pays a bone a right answer, up to 15 a day. You start with 25 bones and every common piece. The server works it all out from the duel itself.
- **Ranked**: Find a ranked match pairs you with the nearest rating (Elo from 1000, Bronze to Diamond after three placing games); the leaderboard shows the week, the month and all time.
- Moves reach the other phone within 5 seconds, even when the realtime connection drops, because both phones read a shared log of the duel (and the e2e times every move).
- **Shop**: your bone count in the lobby. Your dog tries on whatever you tap; one button buys it (and puts it on). A featured bundle (a quarter off the pieces you lack), two featured pieces, six daily pieces with one on a deal, all new at midnight, the sets, then every piece by slot. **Locker**: your dog's shirt badge: three saved outfits, each named as you like, then dog, coat, collar and the pieces in each slot. Your mate only ever sees pieces you own.
- It plays on Med-OS's own Supabase project (`supabaseUrl` and `supabaseAnonKey` in `public/config.js`, the same as progress sync), with the duel's migrations run there (**Supabase**, below). Without a project, **Practice with Rex** plays a bot on your own phone.
- It is the Pup Duel package, vendored in `public/js/vendor/pup-duel/`; see its README for how it works. `npm run duel-pack` rebuilds the questions from the pool (and `public/duel/mcq/`, which `node scripts/generate-duel-mcq.mjs` writes: one question of each kind per station).

## The MCQ pool and Submit a question

**Submit a question** (on the start screen) takes your own single-best-answer question, or one from an open resource with its licence: the case, the lead-in, four or five options with the key marked, an explanation. The item-writing checks (no "all of the above", no negative stem, no cue that gives the key away, a complete vignette, units on every value…) run as you type and say what to fix. Paste JSON or CSV to send several. With sync set up (`supabase/migrations/0007_mcq.sql`) it goes straight to the pool's review; without, **Export file** sends it. **Your questions** shows each one: waiting for review, in the pool, or not taken with the reasons.

The pool (`public/mcq/pool.json`) takes questions from four places and tags each with where it came from, a tag that is never rewritten: **user** (yours), **ai** (written by Claude from the stations), **amsa** (made from an AMSA MedEd case), **usmle-resource** (MedQA and MMLU, MIT-licensed). Each is checked in code, reviewed by a model that does not know its source (it solves the question twice without the key, then scores it the NBME way), and admitted only above a bar calibrated on the official USMLE Step 2 CK samples, with a higher bar for AI-written questions. Your questions that pass are always kept. `docs/mcq.md` explains it; `docs/mcq-evals.md` has the numbers.

## Run it

```
npx serve public          # then open the address it prints
```

To put it online, import the repo into Vercel (it reads `vercel.json`, output directory `public`) or upload `public/` to any static host. Add it to your phone's home screen to use it like an app.

## Practising together

1. On the start screen, type both names and pick who sits first. "Swap each station" alternates the candidate.
2. **New Study Session**: add stations (search, filter by discipline, type, complexity, or Add Random), then Start Practice. **Fast Run** picks whole rotations and runs every station in them in random order.
3. The clock runs **Reading 5 · Part 1 10 · Part 2 5**, with a bell at each change. Change the times under the station queue (Part 2 at 0 runs without it). The header always says who is the candidate and who examines.
4. The examiner runs the station from **Patient Script**, which reads top to bottom in the order of the clock: the patient's history to play in Part 1, then the exam findings to give as the candidate says what they would examine, then **Part 2 · questions and results**. A bar at the top (**History · Exam · Part 2**) jumps between the three and lights the one on screen. When Part 2 starts, the script opens at Part 2: the line to say, the results, the questions to ask in order, what the patient says in Part 2, and a model answer under each result. **Marking** holds only the checklist; after the Part 2 bell it opens at Interpretation, and **Mark Part 2** in the Part 2 card goes there too. **Show results to the candidate** (or the expand button on one result) puts the labs, observations or image full screen with no marking on it; Next, Previous, the arrow keys or a swipe move through them, the time left in Part 2 shows at the top, and closing it brings you straight back to the questions. To give the candidate their own screen, open the menu (•••) and choose **Candidate screen**, then send the link to their phone: it shows the instructions and the countdown, and the Part 2 results appear on it when Part 2 starts.
5. When the bell goes, the examiner ticks the checklist and the global impression, and can write feedback. The **Handover add-on** and **Memory aids** sit below the Part 2 questions.
6. **Next Station** shows who sits next (Swap to change it). **End Session** lists every station with whose attempt it was.
7. **Marked** (top right of the start screen) collects every AI-marked attempt.
8. **Request a case** (on the start screen, or **Request this case** when a search finds nothing) asks for a station the bank does not have: the case in a line, and if you like the setting, specialty, patient, the results you want to interpret in Part 2, the focus and a note. Your requests list shows where each stands: Requested, Being written (with the writer's note), Ready (open it from there) or Not made (with the reason). With sync set up the request goes by itself; without it, **Copy** or **Share** it to whoever writes your cases.

### Your account

**Settings → Account**: sign in with a name and a 4-digit PIN (the same as Duel a Mate's; **New account** makes one). Signed in, your OSCE progress (attempts, saved stations, case requests, names, which games are on) is kept on your account, and Settings shows it next to your Duel a Mate progress (rating, record, bones). Sign in on another device and it picks up where you left off. Signed out, progress is shared through the site's one record, as before. `supabase/migrations/0006_osce_accounts.sql` keeps account rows apart: the public key cannot read them; only `osce_pull` and `osce_push`, with your sign-in, can.

### AI marking

Record the station (a phone's voice memo with transcription works), paste the transcript into **AI marking** on the marking sheet, then either:

- **Mark with Claude**: add your own Anthropic API key in Settings (gear icon). It is stored only in that browser and sent only to the Anthropic API. Choose the model there (Opus 5.5 marks best).
- **Copy prompt for Claude**: no key needed. Paste the prompt into a Claude chat, then paste Claude's reply back into the page.

Marks that arrive on an attempt nobody ticked yet tick the checklist straight away; otherwise "Tick these on the checklist" applies them. Your own ticks are never overwritten without that button.

### Sharing progress between your devices

Progress lives in each browser. Two ways to share it:

- **Settings → Export progress / Import progress**: a file with attempts, saved stations and names. Importing merges by attempt, so nothing is lost or doubled.
- **Automatic sync**: Med-OS has its own Supabase project (`pquajwxvlpvaygrkzfkl`), separate from Optimus. `SUPABASE_ACCESS_TOKEN=sbp_... npm run supabase-setup` runs every file in `supabase/migrations/` against it and writes its URL and publishable key into `public/config.js`. A different project works the same way with `--ref <project_ref>`. Attempts, saved stations, names, timing and case requests then reach both devices, and the case writer's pipeline. Anyone with the site's URL can read and write that record, so keep the URL between the two of you.

### Supabase: bringing Med-OS's project up to this code (2026-10-26)

Med-OS's project is `pquajwxvlpvaygrkzfkl` (never Optimus's Casa). Already run there, per the commits that made them:
`0001_osce_state.sql`, and the duel's `0002_pup_duel.sql` to `0005_pup_ladder.sql` as they were before 2026-10-26.
The merge of the Pup Duel and MCQ branch changed two of those and added one, so run these, **in this order**, each pasted
whole into the SQL editor (https://supabase.com/dashboard/project/pquajwxvlpvaygrkzfkl/sql/new) and Run; every file is
idempotent:

1. `supabase/migrations/0002_pup_duel.sql` (the package's 0001, changed): `pup_log` returns the server's time with the
   rows (`now`), so a phone whose clock is off ages a duel on the server's clock after a reload; `pup_challenge` keeps
   one open challenge between two players (a per-pair advisory lock: crossed rematches and rematch storms settle on one
   duel), the ranked queue's own duel exempt.
2. `supabase/migrations/0003_pup_shop.sql` (the package's 0002, changed): the catalogue rows `pup_items` for the 104-piece
   wardrobe (52 before), and every common piece owned, the new ones too, by a wallet made before (`pup_wallet_of`,
   `pup_fit_look`).
3. `supabase/migrations/0006_osce_accounts.sql`, only if it is not in yet (its commit does not say it was applied):
   `select to_regprocedure('public.osce_pull(uuid,text)');` answers null when it is missing.
4. `supabase/migrations/0007_mcq.sql` (new; it was `0003_mcq.sql` on the MCQ branch): the `mcq_submissions` table that
   Submit a question writes to (insert and read only, never update or delete).

`0004_pup_ranked.sql` and `0005_pup_ladder.sql` are unchanged: leave them (run alone, 0004 would put back the
leaderboard 0005 replaced; `npm run supabase-setup` is safe, as it runs every file in order). Checks afterwards:
`select count(*) from public.pup_items;` gives 104, `select to_regclass('public.mcq_submissions');` names the table, and
`select pg_get_functiondef('public.pup_log(uuid,uuid,bigint)'::regprocedure) like '%''now'', now()%';` is true. The same
upgrade (main's six files, then these) ran clean in a scratch Postgres 16 on 2026-10-26; it was not run on the project
itself, which this machine cannot reach.

## Writing new stations

```
npm install                                   # once: the Anthropic SDK and Playwright
export ANTHROPIC_API_KEY=sk-ant-...           # or: ant auth login
npm run generate -- "tension pneumothorax after a fall from a ladder" --acute --specialty "Emergency Medicine"
npm run generate -- "explaining a new diagnosis of type 1 diabetes to a parent" --specialty Paediatrics --notes "sick day rules, DKA signs"
npm run generate -- --revise ai-1337df24     # an existing station through the same examiner and gates
```

### From a request to a station

Requests from the app are the writer's queue. `scripts/requests.mjs` reads them from the shared record (when `public/config.js`, or `OSCE_SUPABASE_URL` and `OSCE_SUPABASE_KEY`, name the project) and from the inbox `requests/` (gitignored), and answers each one where it came from:

```
node scripts/requests.mjs                          # the open requests (--all: every one)
node scripts/requests.mjs add [file]               # a request copied or shared from the app, or a progress file (no file: paste, then Ctrl-D)
node scripts/requests.mjs show r1k3                # the request, the brief it becomes, the generate command
node scripts/requests.mjs accept r1k3 "This week"  # Being written, with your note
node scripts/requests.mjs make r1k3                # the pipeline below on the request's brief; on success, Ready
node scripts/requests.mjs make --all               # every open request in turn, oldest first
node scripts/requests.mjs decline r1k3 "Already in the bank as acute coronary syndrome"
```

`make` runs `generate-station.mjs` with the topic, `--acute` for an acute setting, the specialty and focus, and notes that carry the patient, the Part 2 results asked for and the student's own words; the station carries the request's id (`request: { id, at }`). It runs the way the AMSA import does: Claude through the API when `ANTHROPIC_API_KEY` is set, else through the Claude Code CLI on your subscription; 4 examiner rounds (`--rounds` to change); images found when the API is there, else left on the station for `node scripts/fetch-imaging.mjs <id>`. Then `npm test`, commit and push as for any station. Through the shared record the student sees each step; from the inbox they see Ready once the station is published, because the bank's index carries the id.

Each station goes through:

1. **Draft** (Claude Opus 5.5) against three stations of the same kind from the bank, so new stations match the existing depth and checklist style.
2. **Gates in code** (`scripts/lib/station-gates.mjs`, the format in `docs/station-format.md`): two tasks timed 10 and 5 minutes and no times in the stem; a Part 2 with an opening line, at least two results and at least two questions; the checklist under Professionalism, History, Examination, Interpretation, Management and Safety netting, with at least two safety-netting items; 24 to 52 items, at least two Critical and no more than 60%; a full patient script; named Australian guidelines (RCH Clinical Practice Guidelines for paediatrics, RANZCOG and a state guideline for O&G); the HTML allowlist; valid imaging requests.
3. **An independent examiner pass** that checks every checklist item against the cited guideline and the station against itself (same patient, same side, same numbers), with paediatric doses checked per kg.
4. **One revision** on everything found, then the gates and the examiner again. A station ships only when both pass; otherwise it goes to `drafts/` with the problems listed.
5. **Exam findings** (Part 1), shown under the patient's history and consistent with it.
6. **Imaging** (next section).

The index, the exam findings and the validator are updated for you.

## Getting the right images

```
npm run imaging -- ai-8b37c286                # resolve one station's imaging requests
npm run imaging -- --all --plan               # first run on the existing stations: propose and resolve imaging
```

For each imaging request (modality, region, finding, side, age, where it goes):

1. **Search** Wikimedia Commons and Open-i (US National Library of Medicine) with several phrasings.
2. **Shortlist** on metadata: an acceptable licence (public domain, CC0 or CC BY family; anything unknown or restricted is dropped), the finding's words, the right modality, a decent size, and nothing that looks like a drawing, collage, specimen or animal.
3. **Check the pixels**: Claude is shown the image without its filename or caption, describes what it sees first, then judges the match. Code then refuses anything with the wrong modality, the finding on the wrong side, an adult film for a child, more than one panel, poor quality, or labels and arrows that give the answer away where the candidate sees it.
4. **Save** the first image that passes to `public/media/<station>/` with its author, licence and source page. The page prints the credit under the image.

If nothing passes, the station keeps the result in words in the patient script, so a station never shows a wrong image or depends on one.

This needs network access to `commons.wikimedia.org`, `upload.wikimedia.org` and `openi.nlm.nih.gov`, and Claude credentials.

Under each image the student can open **Findings**: one sentence saying what the image shows, written by the reviewer who checked it and labelled AI-written. It stays closed until tapped, so the image is read first. Tapping the image opens it full size, which helps when zooming into an ECG on a phone.

### Images from open collections (staged)

Some of the best open images are not on Commons or Open-i, and a session may be unable to reach those sites. `--staged` takes candidates from a folder that a stage script fills, and takes the pixel check from a reviewer's verdicts:

```
node scripts/imaging/stage-ecg.mjs <stage> picks.json                           # real ECGs drawn from PhysioNet recordings
node scripts/fetch-imaging.mjs --staged <stage> amsa-187 amsa-188 …            # licence and size rules, verdicts, acceptVerdict, save
```

- **ECGs.** These come from PTB-XL: 21,799 clinical 12-lead ECGs, each read by a cardiologist, CC BY 4.0. The monitor strips come from the CU Ventricular Tachyarrhythmia Database (ODC-BY). Both are downloaded from PhysioNet's open bucket. `scripts/imaging/ecg.mjs` draws each recording sample for sample, the way a machine prints it: 25 mm/s, 10 mm/mV, a 1 mm grid and a calibration pulse. The 12 leads sit in the standard 3 by 4 layout, with lead II as a 10 s rhythm strip.
- **Choosing a record.** Records are shortlisted by PTB-XL's diagnostic statements and its 12SL measurements (rate, PR, QRS, axis, and the J-point ST level in every lead) against the station's own report.
- **Chest radiographs.** Normal films come from InRad (University of São Paulo, CC BY 4.0) and hyperinflated ones from LIDC-IDRI (TCIA, CC BY 3.0); both are windowed for display and resized, nothing else. Pneumonias are Radiopaedia and Eurorad cases from the COVID-19 image data collection (CC BY-NC-SA). `scripts/imaging/stage-files.mjs` stages a prepared file with its credit.
- **The review.** Every shortlisted image is then looked at. `<stage>/verdicts.json` holds one verdict per candidate, in `verify.mjs`'s schema plus `findings`, written by Claude with the image in front of it (`verified.model` says so). A candidate without a verdict is never accepted, and `acceptVerdict` applies the same rules as for a web image.

## Checks

```
npm test          # unit tests (no install needed) and the bank validator
npm run e2e       # the whole two-person flow in Chromium at 393, 320 and 1280 px
npm run validate  # the validator plus each station's gaps against the generator's bar
node scripts/check-station.mjs <id>   # one station against every gate
```

## Layout

| Where | What |
|---|---|
| `public/index.html`, `config.js` | the page and the optional sync settings |
| `public/js/osce.mjs`, `public/js/osce/` | the app: start and Fast Run, study session, a station on the clock, marking, AI marking, partners, candidate screen, settings |
| `public/js/study-kit/` | shared pieces: overlay, dialogs, icons, the HTML sanitiser, storage, sync, figures |
| `public/css/` | the theme and styles |
| `public/osce/` | one file per station plus `index.json`; `public/exam.json` the exam findings; `public/media/` the images |
| `scripts/` | generator, imaging pipeline, index builder, validator and tests |
| `supabase/migrations/` | the table for optional sync (case requests ride it as `req/<id>` rows) |
| `requests/` | the case writer's inbox of pasted requests (gitignored) |
