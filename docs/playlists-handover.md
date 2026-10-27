# Playlists: hand-over (2026-10-26)

Not started: no code and no migration yet. This note is everything the next session needs to begin.

## What the founder asked for

Relayed by the Pup Duel session, in the founder's words: "have a seperate button on the standard question selection ui called playlist where people can click to see more creative spotify styled community playlist style library for Questions where people can make their personal questions live and they can get favourited and can see trending questions. remmebner this is a completley different set to the games standard question library set".

In short, a community library of question playlists:
- people publish their own decks live;
- others browse it Spotify-style, favourite playlists and see what's trending;
- it is kept apart from the standard bank (`public/duel/pack.json`).

## Who does what (agreed with the Pup Duel session)

- **Pup Duel package (that session's, done):** the Playlists row in the duel's question-picker sheet, and its hook. It is vendored into Med-OS at `public/js/vendor/pup-duel` (commit 6446708).
- **Med-OS (this side, to build):**
  - the playlist library and its UI;
  - the migration;
  - the wiring in `public/js/osce/duel.mjs`;
  - the tests.

## The hook contract (already in `public/js/vendor/pup-duel/ui/duel.mjs`)

- `mountDuel(root, { …, onPlaylists })`: when `onPlaylists` is set, the setup sheet shows a "Community · Playlists" row. A tap closes the sheet and calls `onPlaylists({ mate })`. `mate` is `null` for Vs AI, or `{ id, name, look }` for a challenge.
- `ui.playlist(questions, name, { mate })`:
  - plays that set in place of the bank, and the sheet shows "Playlist: name" with "Standard questions" to go back;
  - takes questions in the duel pack's shape: `id`, `stem`, `options`, `answer`, and optionally `why`, `topic`, `cat`, `source`;
  - returns `false` if none is playable.
- In `osce/duel.mjs`: `mountDuel(…, { onPlaylists: ({ mate }) => openPlaylists({ onPlay: (qs, name) => ui.playlist(qs, name, { mate }) }) })`.

## Proposed build

**Migration `0011_playlists.sql`** on Med-OS's own Supabase project, `pquajwxvlpvaygrkzfkl` (never Optimus's). Follow 0008's pattern: tables closed to the public key, and every function security-definer and token-checked through `pup_me`.

Tables:
- `lib_playlists`: id, owner, owner_name, title (1–60), blurb (≤200), a cover seed, a questions snapshot (jsonb, at most 100, the same checks as `lib_items`), n, favs, plays, hidden, created_at, updated_at. A snapshot keeps a playlist stable if its deck changes; republishing refreshes it.
- `lib_playlist_favs (playlist, player, at)`.
- `lib_playlist_plays (playlist, player, day)`: one play per player per day.
- `lib_playlist_reports (playlist, player, reason, at)`: three different reporters hide a playlist.

Functions:
- `pl_publish(p_token, p_deck, p_title, p_blurb)`: copies the owner's deck server-side.
- `pl_unpublish`.
- `pl_list(p_token, p_sort trending|new|top|faves|mine, p_q, p_limit, p_offset)`. Trending is favourites ×3 plus plays over the last 7 days.
- `pl_get(p_id)`, `pl_fav(p_token, p_id, p_on)`, `pl_play`, `pl_report`.
- Refuse NDIS and grant content on publish (the founder's ban).
- Smoke-test in a DO block that ends in `raise exception`, so it rolls back.

**UI:** `public/js/osce/playlists-view.mjs`, opened with `openPlaylists({ onPlay })`.
- **Browse:**
  - search;
  - chips for Trending, New, Top, Favourites and Yours;
  - a "Trending this week" carousel of square gradient covers (seeded from the id), then a list;
  - each row shows the title, by whom, n questions and ♥ n.
- **Detail** (a pushed page):
  - a big cover, the blurb and the stats;
  - Play (in the duel, `onPlay`; or a Study session in Your questions, keyed `p:<playlist>:<qid>` so FSRS tracks it);
  - ♥, Report, and the first stems.
- **Library tab:** each deck gets "Publish as a playlist" (title, blurb). Signed out, it asks you to sign in.
- **Your questions:** a Playlists entry, so the library opens without the duel.
- Reuse the study kit (overlay stack, `safe`, `icons`, the spring tokens) and `openDialog`. Nothing new of its own.

**Tests:**
- `scripts/library.test.mjs`: the migration's function list, and a trending-order helper if it is pure.
- The fake backend `scripts/e2e/library-fake.mjs`: add the `pl_*` RPCs.
- The e2e: publish a deck, see it under New and Trending, favourite it from another phone, play it in the duel (ONLY=library); Chromium and WebKit; 320 px screenshots.

## State at hand-over

- Med-OS `main` has all of this session's work (Exam mode, Normal ranges, the screen critique fixes, crossing out, runs, pushed pages). Production is at 746b93c, verified by file hash. The MCQ-pool commits after it (96d1dc4, 47a95fe) ship with the next deploy; a Pup Duel session deploy loop deploys whatever HEAD is when it wakes.
- `npm test`: 218 of 218 unit tests pass. It still exits 1 on a HEAD-QA row with a non-MIT licence in `data/benchmarks/headqa.jsonl`, owned by the cloud MCQ-pool session.
