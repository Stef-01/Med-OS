# OSCE Practice

A study app for two medical students to practise OSCE stations together. One of you is the candidate, the other reads the patient script and marks against the full checklist. It runs as a static site with no build step and no server.

What's in it:

- **26 stations in one format**: 5 minutes reading, then **Part 1** (10 minutes) a focused history and examination, then **Part 2** (5 minutes) where the examiner hands over observations, investigations or scans and the candidate interprets them, gives a management approach and safety-nets. Each station has the instructions, the patient script, examination findings, the Part 2 results and questions, the full marking checklist (History, Examination, Interpretation, Management, Safety netting; Critical items flagged; global impression), an explanation, learning points and references. Every station is AI-generated and tagged **AI** wherever it shows. Check anything you rely on against the current guideline it cites.
- **Observation charts in Part 2**: observations are drawn on the patient's own NSW Health "Between the Flags" chart (adult, or the paediatric chart for their age), marked the way a nurse marks it, with the zones taken from the chart PDFs and checked against the thresholds printed on them. Lab results print the way a pathology system prints them (Test | Result | Ref. Range (Units), an abnormal result red with an asterisk), ECGs and imaging as structured reports, and each result has a model interpretation for the examiner only. See `docs/obs-charts.md`.
- **Partner mode**: your two names, who sits first, an automatic swap after each station, and every attempt saved under the candidate's name.
- **A candidate screen**: a link the candidate opens on their own phone that shows the instructions and the same countdown, so the examiner keeps the main device.
- **AI marking**: paste a transcript of the attempt and Claude marks it item by item against that station's checklist, with quotes as evidence, what was missed, phrasing that would score, and a model handover.
- **A station generator** that writes new stations against the bank's own standard and **finds the right X-rays** (and CTs, ultrasounds, ECGs) from open-licensed sources, with Claude checking the pixels before an image is used.

## Run it

```
npx serve public          # then open the address it prints
```

To put it online, import the repo into Vercel (it reads `vercel.json`, output directory `public`) or upload `public/` to any static host. Add it to your phone's home screen to use it like an app.

## Practising together

1. On the start screen, type both names and pick who sits first. "Swap each station" alternates the candidate.
2. **New Study Session**: add stations (search, filter by discipline, type, complexity, or Add Random), then Start Practice. **Fast Run** picks whole rotations and runs every station in them in random order.
3. The clock runs **Reading 5 · Part 1 10 · Part 2 5**, with a bell at each change. Change the times under the station queue (Part 2 at 0 runs without it). The header always says who is the candidate and who examines.
4. The examiner runs the station from **Patient Script**, which reads top to bottom in the order of the clock: the patient's history to play in Part 1, then the exam findings to give as the candidate says what they would examine, then **Part 2 · questions and results**. When Part 2 starts, the script opens at Part 2: the line to say, the results, the questions to ask in order, and a model answer under each result. **Marking** holds only the checklist. **Show results to the candidate** (or the expand button on one result) puts the labs, observations or image full screen with no marking on it; Next, Previous, the arrow keys or a swipe move through them, and closing it brings you straight back to the questions. To give the candidate their own screen, open the menu (•••) and choose **Candidate screen**, then send the link to their phone: it shows the instructions and the countdown, and the Part 2 results appear on it when Part 2 starts.
5. When the bell goes, the examiner ticks the checklist and the global impression, and can write feedback. The **Handover add-on** and **Memory aids** sit below the Part 2 questions.
6. **Next Station** shows who sits next (Swap to change it). **End Session** lists every station with whose attempt it was.
7. **Marked** (top right of the start screen) collects every AI-marked attempt.

### AI marking

Record the station (a phone's voice memo with transcription works), paste the transcript into **AI marking** on the marking sheet, then either:

- **Mark with Claude**: add your own Anthropic API key in Settings (gear icon). It is stored only in that browser and sent only to the Anthropic API. Choose the model there (Opus 5.5 marks best).
- **Copy prompt for Claude**: no key needed. Paste the prompt into a Claude chat, then paste Claude's reply back into the page.

Marks that arrive on an attempt nobody ticked yet tick the checklist straight away; otherwise "Tick these on the checklist" applies them. Your own ticks are never overwritten without that button.

### Sharing progress between your devices

Progress lives in each browser. Two ways to share it:

- **Settings → Export progress / Import progress**: a file with attempts, saved stations and names. Importing merges by attempt, so nothing is lost or doubled.
- **Automatic sync**: create a free Supabase project, run `supabase/migrations/0001_osce_state.sql` in its SQL editor, and put the project URL and anon key in `public/config.js`. Attempts, saved stations, names and timing then reach both devices. Anyone with the site's URL can read and write that record, so keep the URL between the two of you.

## Writing new stations

```
npm install                                   # once: the Anthropic SDK and Playwright
export ANTHROPIC_API_KEY=sk-ant-...           # or: ant auth login
npm run generate -- "tension pneumothorax after a fall from a ladder" --acute --specialty "Emergency Medicine"
npm run generate -- "explaining a new diagnosis of type 1 diabetes to a parent" --specialty Paediatrics --notes "sick day rules, DKA signs"
npm run generate -- --revise ai-1337df24     # an existing station through the same examiner and gates
```

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
| `supabase/migrations/` | the table for optional sync |
