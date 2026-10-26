# CLAUDE.md

OSCE practice for two medical students: a static site in `public/` (vanilla HTML, CSS and ES modules, no framework, no build step) and Node scripts in `scripts/` that write and check its data. README.md explains the product; this file is how to work on it.

## Commands

```
npm test                    # node:test units + scripts/validate.mjs + scripts/validate-mcq.mjs; must pass with no node_modules
npm run e2e                 # Playwright smoke, phone / 320 px / wide; run after any UI change
npm run index               # rebuild public/osce/index.json after a station file changes
node scripts/mcq-pool.mjs   # rebuild the MCQ pool (public/mcq/pool.json, status.json) after a station, verdict or submission changes; npm test fails on a stale pool
npm run duel-pack           # rebuild public/duel/pack.json (the duel's questions) from the pool; npm test fails on a stale pack
npm run validate            # validator + the quality gates as notes
node scripts/requests.mjs   # the case requests queue: add / show / accept / make / decline (make runs generate-station.mjs)
npx serve public            # local dev
npm run supabase-setup      # SUPABASE_ACCESS_TOKEN set: migrate Med-OS's own Supabase project and fill config.js
```

## Station format

5 min reading, Part 1 (10 min) history and examination, Part 2 (5 min) results handed over, interpretation, management and safety netting. `docs/station-format.md` is the spec; `scripts/lib/station-gates.mjs` enforces it; `node scripts/check-station.mjs <id>` checks one station.

## Rules

1. **Data is written by scripts.** Stations (`public/osce/<id>.json`), `index.json`, `exam.json` and `public/media/` come from `generate-station.mjs`, `fetch-imaging.mjs` and `build-index.mjs`. Fix the writer, not the output; rebuild the index after any station change; `npm test` fails on a stale index.
2. **Provenance stays visible.** Every generated station has `origin: "ai"` and shows the AI tag; exam findings are labelled AI-written; every image carries its author, licence and source page, and only licences `rank.mjs` `licenceOk` accepts may ship.
3. **No image is guessed.** An image enters a station only through `imaging/resolve.mjs` (metadata shortlist, then Claude's pixel check, then `acceptVerdict`'s rules). The script always states imaging results in words.
4. **The HTML allowlist** (`public/js/study-kit/safe.mjs`) is the one sanitiser; station HTML has no attributes.
5. **Pure laws are tested without a browser**: `osce/core.mjs`, `osce/marker.mjs`, `osce/candidate.mjs`, `scripts/lib/*`, `scripts/imaging/*`. A new rule is a pure function with a test before it has a button.
6. **Claude calls** go through `scripts/lib/claude.mjs` (official SDK, streamed, JSON schema output, server-side fallbacks) in Node, and `osce/marker.mjs` (the vendored SDK bundle `public/js/vendor/anthropic-sdk.mjs`) in the browser. Default model `claude-opus-5-5`.
7. **Observation charts are data.** The zones in `public/js/osce/obs-charts.mjs` are written by `scripts/charts/extract_zones.py` from the NSW chart PDFs and checked by `scripts/obs.test.mjs` against the thresholds printed on each chart; never edit them by hand. `obs.mjs` decides the chart and the zone, `obs-chart.mjs` draws it; the candidate never sees the zones or the model interpretation. `docs/obs-charts.md` explains why.
8. **Phones first.** Every screen works at 320 px with no sideways scroll; the e2e checks it.
9. **The MCQ pool keeps every question's provenance** (`docs/mcq.md`): kind user, ai, amsa or usmle-resource, never rewritten by a later step; nothing enters the pool without the flaw checks (`public/js/mcq/flaws.mjs`), a model review (`scripts/mcq-judge.mjs`) and the calibrated bar. The official USMLE samples are benchmark only: never commit their text.
10. **Duel a Mate is a vendored package.** `public/js/vendor/pup-duel/` is Pup Duel (the dog, its wardrobe, live MCQ duels), copied by the package's `scripts/vendor.mjs` with `VERSION.json` holding a hash of every file; `scripts/duel-pack.test.mjs` fails on a hand edit. Change the package (in Optimus, `packages/pup-duel/`, until it has a repository of its own) and vendor again. `supabase/migrations/0002_pup_duel.sql` to `0005_pup_ladder.sql` are the package's four migrations (its 0001 to 0004), checked against the same manifest. `public/js/osce/duel.mjs` is the only Med-OS code: the overlay, the transport from config.js, the pack.
11. **Med-OS has its own Supabase.** Project `pquajwxvlpvaygrkzfkl`, never Optimus's. A schema change is a new idempotent file in `supabase/migrations/`, applied with `npm run supabase-setup`; `.mcp.json` points the Supabase MCP at the same project.
