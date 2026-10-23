# CLAUDE.md

OSCE practice for two medical students: a static site in `public/` (vanilla HTML, CSS and ES modules, no framework, no build step) and Node scripts in `scripts/` that write and check its data. README.md explains the product; this file is how to work on it.

## Commands

```
npm test                    # node:test units + scripts/validate.mjs; must pass with no node_modules
npm run e2e                 # Playwright smoke, phone / 320 px / wide; run after any UI change
npm run index               # rebuild public/osce/index.json after a station file changes
npm run validate            # validator + the quality gates as notes
npx serve public            # local dev
```

## Rules

1. **Data is written by scripts.** Stations (`public/osce/<id>.json`), `index.json`, `exam.json` and `public/media/` come from `generate-station.mjs`, `fetch-imaging.mjs` and `build-index.mjs`. Fix the writer, not the output; rebuild the index after any station change; `npm test` fails on a stale index.
2. **Provenance stays visible.** Every generated station has `origin: "ai"` and shows the AI tag; exam findings are labelled AI-written; every image carries its author, licence and source page, and only licences `rank.mjs` `licenceOk` accepts may ship.
3. **No image is guessed.** An image enters a station only through `imaging/resolve.mjs` (metadata shortlist, then Claude's pixel check, then `acceptVerdict`'s rules). The script always states imaging results in words.
4. **The HTML allowlist** (`public/js/study-kit/safe.mjs`) is the one sanitiser; station HTML has no attributes.
5. **Pure laws are tested without a browser**: `osce/core.mjs`, `osce/marker.mjs`, `osce/candidate.mjs`, `scripts/lib/*`, `scripts/imaging/*`. A new rule is a pure function with a test before it has a button.
6. **Claude calls** go through `scripts/lib/claude.mjs` (official SDK, streamed, JSON schema output, server-side fallbacks) in Node, and `osce/marker.mjs` (the vendored SDK bundle `public/js/vendor/anthropic-sdk.mjs`) in the browser. Default model `claude-opus-5-5`.
7. **Phones first.** Every screen works at 320 px with no sideways scroll; the e2e checks it.
