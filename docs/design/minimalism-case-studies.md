# Minimalism case studies: dense function, quiet UI

2026-10-29. Research for MDosce (phone-first OSCE + MCQ + Duel a Mate PWA). Part 1 studies apps that hide a lot of function behind little chrome. Part 2 distils principles. Part 3 audits MDosce at 393x852 and turns the gaps into a backlog of one-at-a-time items.

Method and limits: web search over the companies' own write-ups and reviews (Firecrawl was out of credits, and no live-app inspection with REA was done, so observations about native apps come from public write-ups and documented behaviour, not fresh screenshots). The MDosce audit is first-hand: `npx serve public -l 5194`, Playwright at 393x852, https blocked, signed out, fresh storage. Screens looked at: Start (top and scrolled), Settings (top and bottom), Your questions (Study, Library, Friends), Playlists, an MCQ card before and after answering, Study Session (empty), Browse Stations, a live OSCE station, Duel a Mate entry.

---

## 1. Per-app findings

### Duolingo: the path
- **One primary action per screen.** The home is a single vertical path (launched 1 Nov 2022) that replaced the skill tree. The next node is the only thing that pulses; tapping it opens a small popover with one button ("Start"). Choice was removed on purpose because learners said they did not know if they were "using the app right" ([Duolingo blog](https://blog.duolingo.com/new-duolingo-home-screen-design)).
- **Practice folded into the path.** Review is placed in the path by spaced repetition, not offered as a separate mode menu. Cost: power users lost choice ([UX Collective critique](https://uxdesign.cc/down-the-wrong-path-the-disaster-of-the-latest-duolingo-ui-update-a4cdd1e6ea1c)), and Duolingo kept a small "Practice hub" tab for them.
- **Gamification lives in a thin top bar**: streak flame, gems, hearts as icon+number, each opening its own sheet on tap. The numbers carry no labels.
- **Lesson screen**: progress bar, close X, content, one bottom "Check" button that becomes "Continue" with a coloured result band sliding up from the bottom. The feedback and the next action share one place.
- **Motion that explains**: the mascot and the result band carry state; nothing else animates.

### Things 3: progressive disclosure, quick entry
- **Magic Plus**: one floating button. Tap gives a new to-do inline; *drag* it to a position in the list, to a day in Upcoming, or to the top to make a heading. One control, several outcomes, no menu ([MacStories review](https://www.macstories.net/reviews/things-3-beauty-and-delight-in-a-task-manager/)).
- **New items need only a title.** Dates, tags, checklists and notes sit behind small icons inside the opened to-do; nothing asks for them up front. MacStories contrasts this with apps whose plus button opens "a comprehensive sheet".
- **Swipe right on a row** to schedule, pull down to search, long-press to multi-select. No visible edit chrome in lists.
- **Typography does the hierarchy**: bold heading, regular rows, grey meta. Very few borders.

### Linear mobile
- Built first for individual contributors' narrow use (their issues, inbox), then widened; custom floating bottom bar that can grow into contextual toolbars rather than a fixed tab bar ([Linear blog, Liquid Glass](https://linear.app/blog/linear-liquid-glass)).
- **Inbox as home**: a single list; swipe to mark done/snooze; long-press for the full action menu. Issue screens put properties as compact chips you tap to change, rather than form fields.
- **Context menus over buttons**: almost every action is in a long-press or "..." menu; the screen itself shows content.

### Spotify: library, playlists, Now Playing
- **Your Library** (2021 redesign): one list, a row of filter chips (Playlists, Artists, Albums, Downloaded) that collapse to the chosen one with an X, a sort control and a grid/list toggle, pinned items at top ([9to5Mac](https://9to5mac.com/2021/04/29/spotify-launches-redesigned-your-library-ios-android/), [XDA](https://www.xda-developers.com/spotify-library-redesign-improved-navigation/)). Filters replace tabs.
- **Playlist page**: big art, title, one green play button, a row of icon-only secondary actions (download, add, share, "...").
- **Mini-player to Now Playing**: a persistent strip expands into a full sheet with a drag; swipe the strip to skip. The state you are in is always one thumb away.
- **Long-press anything** for a context sheet: same sheet everywhere, so users learn it once.

### Apple Music and Fitness+
- **Cards as the unit**: large artwork cards in horizontal shelves; one title, one subtitle, no buttons on the card. Tap opens, long-press previews with actions.
- **Sheets with detents**: Now Playing and workout detail open as sheets you pull down to dismiss; context is never lost. HIG: prefer a sheet for a focused, scoped task.
- **Fitness+ filters** sit as one row of chips (type, trainer, time, music) above a grid; a session starts from a single big button on the detail sheet, with metrics hidden until playback.

### Anki / AnkiMobile and Brainscape
- **Study screen is almost empty**: card, a counter strip, "Show answer", then 4 grading buttons whose labels show the next interval ([AnkiMobile manual, study screen](https://docs.ankiweb.net/ankimobile/study-screen)). Undo, suspend, flag and edit live in a single tools menu.
- **Gestures replace buttons for experts**: configurable swipes and taps per screen region (Preferences > Review). The buttons stay for beginners.
- **Brainscape** cuts grading to a 1-5 confidence row and shows a single "mastery" bar per deck, hiding the scheduler entirely.

### Headspace and Calm
- **Home is "today"**: one recommended session card with a play button, then a gentle shelf of more. Greeting text is time-of-day aware.
- **Low contrast, soft colour, generous spacing**: secondary items are present but quiet. No counts shouting at you; streaks are shown after a session, not before.

### Arc Search / Arc browser
- **Chrome hides while you read**: toolbar collapses on scroll and returns on scroll up or tap at the bottom.
- **Gestures replace buttons**: pull down to close a tab, swipe the bottom bar between tabs. "Browse for me" is one button that does a multi-step task.
- Tabs auto-archive (smart defaults remove housekeeping UI).

### Instagram / TikTok
- **Full-bleed content, overlay controls**: icons in a right-hand rail with counts and no labels; caption truncated with "more".
- **Gesture-first**: swipe up for next, double-tap to like, long-press for options, swipe left on a video to the profile. Each gesture has a visible counterpart for discoverability.
- The tab bar is 5 icons; the create action is the only accent-coloured one (earlier versions).

### Monzo / Revolut
- Monzo: "Simplicity isn't the absence of things, it's bringing order to complexity" ([Monzo blog](https://www.monzo.com/blog/how-we-built-the-new-home-screen)). Home shows balance, one row of 3-4 actions, then a feed. Users choose which pots appear via **Edit layout** ([Monzo blog](https://monzo.com/blog/the-new-and-improved-home-screen)).
- Revolut packs dozens of products behind a home with balance, 4 round action buttons, and a "..." that opens everything else; settings live behind the avatar.
- Lesson from Monzo's own community: sections that cannot be removed make the home "a scrollfest". Customisation is the escape valve for density.

### Superhuman
- **No visible chrome for power actions**: every action has a key and a gesture (swipe to done/remind), discovered via Cmd+K, which also teaches the shortcut.
- **Inbox zero as the design goal**: the empty state is a reward (a photo), not a blank.
- Onboarding is a live session that teaches gestures, so the UI never has to label them.

### Amboss / UWorld / Osmosis (domain)
- **UWorld**: the test interface is famously bare: question, options, a thin top bar (mark, previous, next, lab values, calculator, notes), explanation after submit. Mimics the exam, and students tolerate density because it is familiar.
- **Amboss**: Qbank sessions are built from a **Create Session** sheet with progressive filters; the article reader hides depth behind expandable sections and a "high-yield" toggle that greys out everything else; Anki add-on pops definitions on tap ([iatroX on the Amboss add-on](https://www.iatrox.com/blog/amboss-anki-addon-review-medical-students)).
- **Osmosis**: video-first, a single "Today's study plan" list on home, flashcards with self-rated confidence.
- Shared pattern: a hard separation between **setup** (filters, decks) and **doing** (one question, one action). Setup is a sheet; doing is full screen.

---

## 2. Principles (16)

1. **One primary action per screen, visibly the only filled button.** (Duolingo node, Spotify play, Fitness+ start.)
2. **Home is "today", not the menu.** Show the next thing to do; put the catalogue one tap away. (Duolingo, Headspace, Osmosis.)
3. **Setup lives in a sheet; doing is full screen.** (Amboss Create Session, Apple sheets.)
4. **Ask only for what is required now; reveal the rest when it matters.** (Things title-only; Duolingo never asks for an account before the first lesson.)
5. **Filters, not tabs, for one collection.** One list with chips that collapse to the active one. (Spotify Library.)
6. **One context menu, everywhere.** Long-press or "..." opens the same sheet for any item. (Spotify, Linear, Apple.)
7. **Gestures for experts, buttons for beginners, both for the same action.** (Anki swipes, TikTok, Superhuman.)
8. **Icons + numbers instead of labelled stats.** Flame 3, not "Streak: 3 days". (Duolingo top bar, Instagram rail.)
9. **Feedback and next action share one place.** The result band holds the explanation and the Continue button. (Duolingo, Anki.)
10. **Chrome recedes while you work.** Collapse toolbars on scroll, hide meta during a timed task. (Arc, Fitness+ playback.)
11. **Smart defaults remove questions.** Pick the placement, the deck, the timing; let the user change it later. (Arc auto-archive, Duolingo path.)
12. **Empty states sell the next step, with one button.** Never a paragraph of conditions. (Superhuman, Things.)
13. **Signed-out is not a wall.** Defer account prompts until the user tries something that needs one; then ask inline, once. (Duolingo, Spotify browse.)
14. **Typography and spacing carry hierarchy, not boxes.** Fewer cards and borders; weight and grey do the work. (Things, Linear, Apple.)
15. **Let users trim their own home.** Density becomes optional through Edit layout. (Monzo.)
16. **Motion explains state change only.** Sheets slide from where they came, result bands rise; nothing decorative loops. (Spotify mini-player, Duolingo.)

---

## 3. MDosce audit

### What is already good
- MCQ card is close to the Anki/UWorld bar: thin top bar (close, progress, ranges flask, bookmark), stem, options, keyboard shortcuts, explanation folded with "Read all", 3 grade buttons.
- Your questions/Study tab has a single filled CTA ("Start · 20 cards") and a progress ring: this is the right pattern.
- Live station: timer strip, three segmented tabs (Instructions / Patient Script / Marking), notepad docked at the bottom. The doing-screen is focused.
- Playlists' "MDosce picks" shelf is an Apple-Music-style card shelf.

### What fights minimalism (observed)
| Screen | Observation |
|---|---|
| Start | Header says "OSCE Practice" for an app that is also MCQ and Duel. The first full screen is **Study partners** (two name fields + candidate toggle + swap chip), a setup task, shown before anything to do. Fast Run repeats the specialty chips that Browse and Settings also have; its CTA is disabled ("Pick a rotation to start") although a smart default exists (placement / All). Below the fold: **five equal-weight list cards** (New Study Session, Request a case, Duel a Mate, Your questions, Submit a question). No single primary action; the MCQ product, with the best home (ring + Start), is the fourth link. |
| Start header | "Marked" is a pill with text; Settings an icon. Two different treatments for peer controls. |
| Settings | One long scroll mixing Account (name/PIN form), Placement, Games toggles, Reminders, Special gift code, AI marking API key + model, Progress export/import, with a global **Save** button although toggles "apply straight away". Mixed save semantics, and the account form is the first thing seen. |
| Your questions | Three tabs (Study/Library/Friends). Two of three tabs, signed out, are a paragraph plus "Sign in, in Settings": a wall that sends you to another sheet. Playlists is a row at the bottom of Library rather than a peer. "Goal and exam date" is a loose row under the cards. |
| MCQ card | After answering, **Hard / Next / Easy** sit below the fold at 852 px (clipped in the screenshot); the explanation pushes the next action off screen. Instructional text "Press 1 to 5 to answer. Right-click, or Shift and the number, crosses one out." is permanent on a phone where neither applies. |
| Study Session (empty) | Dashed empty box with instructions, plus a separate "Add Stations" button, plus a disabled "Start Practice". Three elements for one next step. |
| Browse Stations | Header row of two buttons (Add Random, Hide Details), search, 7 specialty chips over three lines, 4 filter dropdowns, a count: about 410 px of controls before the first station. Each station card carries 2-3 specialty chips, a type, 2 source badges, complexity, eye, bookmark, a 4-line summary, status and "Add to Queue": ~11 elements per card. |
| Live station | Header has Save + "..." + close + AMSA/AI badges + candidate name truncated ("Partner ..."). Timer controls (reset, pause, skip) always visible. Reading/Part 1/Part 2 timing appears twice (timer strip and the coloured table inside Instructions). |
| Duel a Mate | Entry shows a **white embedded card "Duke, Rosie and Pip ... Start with one doberman, add the others from the menu"**: looks like the wrong page loaded into the hero frame (a bug, possibly caused by blocked https in this run, but worth checking). Then a Name/PIN form before any play; "Vs AI", the zero-friction option, is the outlined secondary at the bottom. |
| Global | Sign-in is asked in at least five places (Settings, Library, Friends, Playlists, Duel), each with its own wording. |

---

## 4. Backlog (prioritised; each item is one change)

Effort: S < 1 h, M half a day. Files are best guesses from the tree: Start screen is in `public/js/osce.mjs` and `public/js/osce/candidate.mjs`; sheets in `public/js/osce/*.mjs`; styles in `public/css/osce.css` and `public/css/study-kit.css`; duel is vendored from `C:\Users\stefa\optimus-command-center\packages\pup-duel\src\ui` (`duel.mjs`, `duel.css`, `ranked.mjs`, `shop.mjs`).

| # | Screen | Change | Principle / source | Expected effect | Files | Effort |
|---|---|---|---|---|---|---|
| 1 | MCQ card | After answering, pin Hard / Next / Easy in a sticky bottom bar (safe-area aware) so the next action is always on screen; explanation scrolls behind it. | P9 Duolingo result band, Anki grade row | No hunting for Next; faster reps | `public/js/osce/mcq-view.mjs`, `public/css/study-kit.css` | S |
| 2 | Start | Replace the five equal list cards with one **"Today" hero**: ring + "Start · 20 cards" (the Study-tab module) as the only filled button; OSCE and Duel as two smaller tiles under it. | P1, P2 Duolingo, Headspace | One obvious thing to do on open | `public/js/osce.mjs`, `public/css/osce.css` | M |
| 3 | Start | Move **Study partners** out of the home into the Study Session sheet (and the station "..."), defaulting to "Partner A / B" until edited. | P3, P4 Things, Amboss | Removes the first ~330 px of setup from home | `public/js/osce/candidate.mjs`, `public/js/osce.mjs` | S |
| 4 | Start / Fast Run | Make Fast Run's CTA live by default using the placement (or All); chips become a single "Paeds · change" line that opens the chip sheet. | P11 Duolingo path, Arc | Fast Run is one tap; 3 rows of chips gone | `public/js/osce.mjs`, `public/js/osce/run.mjs` | S |
| 5 | MCQ card | Show the keyboard hint only on devices with a fine pointer (`@media (hover:hover) and (pointer:fine)`); on touch, teach strike-out once via a one-time tip on long-press. | P7, P12 Superhuman, Anki | Removes permanent noise from every card | `public/js/osce/mcq-view.mjs`, `public/css/study-kit.css` | S |
| 6 | Global | One sign-in pattern: a single inline "Sign in to sync" sheet (name + PIN) opened from wherever it is needed, then returning to that place. Replace the five "Sign in, in Settings" detours. | P13 Duolingo, Spotify | Fewer dead-end tabs; no context loss | `public/js/osce/account.mjs`, `library-view.mjs`, `playlists-view.mjs`, `settings.mjs` | M |
| 7 | Browse Stations | Collapse filters: one row = search field with a filter icon; specialty chips scroll horizontally on one line; Source/Status/Complexity/Type move into a filter sheet with an active-count badge. Drop "Hide Details" (make compact the default). | P5 Spotify Library, Fitness+ | First station visible above the fold (~410 px of controls to ~110) | `public/js/osce/browse.mjs`, `public/css/osce.css` | M |
| 8 | Browse card | Trim the station card to title, one specialty icon, status dot, and an icon-only "+" add button; summary to 2 lines; badges (AMSA, AI, complexity) and preview/save into a long-press / "..." context sheet. | P6, P8, P14 Spotify, Linear | Cards half as tall; scan twice as many | `public/js/osce/browse.mjs`, `public/css/osce.css` | M |
| 9 | Browse card | Swipe right on a station = add to queue, swipe left = bookmark, with the "+" kept as the visible equivalent. | P7 Things, Linear | Building a queue becomes a fling, not taps | `public/js/osce/browse.mjs` | M |
| 10 | Duel entry | Lead with **Vs AI** as the filled primary (no account needed); Name/PIN collapses to "Play a mate" which opens the sign-in sheet from item 6. Investigate and fix the white "Duke, Rosie and Pip" frame. | P1, P13 Duolingo | Duel playable in one tap; removes a visible bug | vendor `packages/pup-duel/src/ui/duel.mjs`, `duel.css`; `public/js/osce/duel.mjs` | M |
| 11 | Study Session (empty) | Replace dashed box + "Add Stations" with one empty state: short line + two buttons in one row ("Browse", "Add 3 random"); Start appears only when the queue is non-empty. | P12 Superhuman, Things | One step instead of three; no disabled CTA | `public/js/osce/session.mjs`, `public/css/osce.css` | S |
| 12 | Settings | Split into a short root list (Account, Placement, Games, Reminders, AI marking, Progress, Gift code) with each section a pushed sub-page; remove the global Save, all controls apply immediately. | P3, P4 Apple Settings, Revolut | Settings readable at a glance; one save model | `public/js/osce/settings.mjs`, `public/css/osce.css` | M |
| 13 | Start header | Rename "OSCE Practice" to the product name or hide on scroll; turn "Marked" into an icon (bookmark) matching the gear. | P8, P10 Instagram, Arc | Consistent header chrome; honest title | `public/js/osce.mjs`, `public/css/osce.css` | S |
| 14 | Your questions | Drop the Friends tab while signed out (show it after sign-in); promote Playlists to a top shelf in Library ("MDosce picks" cards) instead of a bottom row. | P2, P12 Apple Music shelves | One fewer dead tab; community content visible | `public/js/osce/library-view.mjs`, `playlists-view.mjs` | S |
| 15 | Your questions / Study | Fold "Goal and exam date" into the ring card: tap the ring to edit the goal; show "Exam in 42 days" as the subtitle. | P8, P15 Duolingo goal, Monzo | One fewer loose row; the goal is where progress is | `public/js/osce/library-view.mjs`, `public/js/library/plan.mjs` | S |
| 16 | Live station | Hide timer controls (reset, skip) behind a tap on the timer; keep pause visible. Remove the duplicated timing table from Instructions, or collapse it. | P10 Fitness+, Arc | Header calmer during the 15 minutes that matter | `public/js/osce/session.mjs`, `public/css/osce.css` | S |
| 17 | Live station header | Fold Save into the "..." menu; move AMSA/AI badges into the Instructions body; show candidate as an initial avatar (A/B) instead of truncated name. | P6, P8 Linear | Header fits on one line without truncation | `public/js/osce/session.mjs` | S |
| 18 | Live station | Swipe horizontally between Instructions / Patient Script / Marking (segments stay as the visible control). | P7 Instagram, Apple | Examiner flips tabs one-handed | `public/js/osce/session.mjs` | M |
| 19 | Start | "Request a case" and "Submit a question" leave home: both become entries in a single "+" (Things Magic Plus style) or in the relevant sheets (Browse empty search → Request a case; Library → Upload). | P4, P6 Things | Two fewer home rows; contribution offered in context | `public/js/osce.mjs`, `requests-view.mjs`, `library-view.mjs` | S |
| 20 | Global motion | Ensure every sheet slides from the bottom and dismisses on drag-down at the grabber (grabber is already drawn); respect `prefers-reduced-motion`. | P16 Spotify, Apple sheets | Gestures match the affordance users see | `public/js/study-kit/*`, `public/css/study-kit.css` | M |

Suggested order: 1, 5, 11, 13, 3, 4 (all small, visible wins), then 2, 6, 7, 8, 10, then the rest. Item 2 depends on 3 and 19 to be clean; item 10 and 14 depend on 6.

Verification for each item: re-run the 393x852 Playwright pass and compare the before screenshot; the success test is written in "Expected effect" (for example, item 7: first station card top < 300 px).

---

## 5. Round 2 (REA audit)

Run 2026-10-29: `npx serve public -l 5195`, a dedicated headless Chrome 156 on CDP port 9481, viewport 393x852 (mobile, touch), signed out, nothing submitted. REA (`list_browser_targets`, `capture_web_screenshot`, evidence `ev_2ef2a682…`) bound the target. Flows were driven and measured over the same CDP endpoint, with a DOM probe scoped to the topmost sheet. Counts cover what is inside the viewport (above the fold), not the whole scroll.

Columns: **Ctrls** = visible interactive elements; **Words** = visible copy; **Boxes** = containers with a border, fill or shadow (≥60x30 px, buttons excluded); **Prim** = saturated filled buttons ≥120 px wide; **First y** = top of the first meaningful content (px).

### Scorecard

| Screen | Ctrls | Words | Boxes | Prim | First y | Note |
|---|---|---|---|---|---|---|
| Start | 20 | 82 | 6 | 1 | 80 | Fast Run CTA is live once a rotation is held; the Study partners form is still open on home (2 inputs, swap, candidate toggle) from y≈665 |
| Start, no rotation held | 19 | 77 | 6 | 1 | 80 | The filled CTA reads "Pick a rotation to start" and does nothing |
| New Study Session (empty) | 4 | 28 | 2 | 0 | 120 | Fixed: one empty state with Browse / Add random |
| Browse Stations | 21 | 328 | 5 | 0 | 270 | Filters are now one line each; cards still carry eye, bookmark, summary, status and Add |
| Live station / Instructions | 11 | 178 | 10 | 0 | 192 | Header: close, save, more. Timer row: reset, pause, skip. Timing appears 3 times (strip, coloured bar, Reading/Part list) |
| Live station / Patient Script | 15 | 170 | 8 | 0 | 282 | Adds a 4-chip jump row above the script |
| Live station / Marking | 12 (+40 checkboxes below) | 151 | 6 | 0 | 298 | 3-sentence disclaimer before the first item |
| Settings | 14 | 107 | 1 | 0 | 132 | The Account sign-in form comes first; every section has a helper paragraph |
| Your questions / Study | 15 | 71 | 7 | 1 | 80 | One filled CTA; "Goal and exam date" is still a loose row; 3 mode cards |
| Your questions / Library (signed out) | 7 | 59 | 4 | 1 | 170 | 26-word sign-in paragraph above "No questions yet" |
| Your questions / Friends (signed out) | 5 | 33 | 4 | 0 | 170 | Dead tab: a paragraph and Sign in, nothing else |
| MCQ card, before answer | 8 | 67 | 1 | 0 | 96 | Fixed: the touch hint is one line ("Tap an answer. Hold one to cross it out.") |
| MCQ card, after answer | 11 | 167 | 2 | 1 | 96 | Fixed: Next is sticky at y=714. The explanation box is clipped behind it; "Back in 10 min." and "I knew it, I misread" sit below Next |
| Playlists | 4 | 36 | 5 | 0 | 96 | Each pick shows an "UNLOCK X" badge and a ★; the signed-out community shelf is a paragraph and a button |
| Playlist pick detail | 2 | 120 | 3 | 1 | 302 | Hero art pushes the question list past y=600; the reward box sits between the CTA and the content |
| Duel a Mate entry | 6 | 11 | 1 | 1 | n/a | The filled primary is still **Play** (needs Name and PIN); Vs AI is secondary |

Round 1 items confirmed shipped in the DOM: 1 (sticky Next), 5 (touch hint), 7 (browse filters on one line), 11 (empty session), 13 (header "MDosce", Marked as an icon). Still open from round 1: 2, 3, 10, 12, 14, 15, 16, 17.

### Backlog, round 2 (prioritised)

| # | Screen | Change | Principle | Measured effect | Files | Effort |
|---|---|---|---|---|---|---|
| R1 | Duel entry | Make **Vs AI** the filled primary; Name/PIN fold behind "Play a mate". | P1, P13 | The primary needs no account; Ctrls 6 to 3; playable in 1 tap | `packages/pup-duel/src/ui/duel.mjs`, `duel.css`; `public/js/osce/duel.mjs` | S |
| R2 | Start | Default Study partners to closed, as one row "A · Partner A / B · Partner B ›", placed under New Study Session. | P3, P4 | Ctrls −5; ~200 px of form off home | `public/js/osce/candidate.mjs`, `public/js/osce.mjs` | S |
| R3 | Start | Default Fast Run to the placement or All so the CTA is never the inert "Pick a rotation"; deselecting the last chip snaps back to All. | P11 | No dead filled button | `public/js/osce/run.mjs` | S |
| R4 | Live station | Delete the coloured READING/PART bar and the Reading/Part list from Instructions; the timer strip already shows them. | P10, P14 | Words −20, Boxes −3, Tasks start ~150 px higher | `public/js/osce/session.mjs`, `public/css/osce.css` | S |
| R5 | Live station | Timer row keeps pause; reset and skip move to a long-press on the timer and the "..." menu. | P7, P10 | Ctrls −2 in the always-on band | `public/js/osce/session.mjs` | S |
| R6 | Live station header | Fold Save into "...". | P6 | Header Ctrls 3 to 2 | `public/js/osce/session.mjs` | S |
| R7 | MCQ after answer | Put "Back in 10 min." in Next's subline and move "I knew it, I misread" to a long-press on Next or the card's "...". | P9 | 2 lines below Next to 0; Next becomes the bottom edge | `public/js/osce/mcq-view.mjs`, `public/css/study-kit.css` | S |
| R8 | MCQ after answer | Fold the "How N students answered" caption into the % column (tooltip on tap). | P8 | One line fewer | `public/js/osce/mcq-view.mjs` | S |
| R9 | Marking tab | Replace the 3-sentence disclaimer with one line, "A prompt, not a pass mark ⓘ". | P4, P12 | Words −45; first checklist item ~90 px higher | `public/js/osce/session.mjs` or `marker.mjs` | S |
| R10 | Patient Script | Show the History/Exam/Differentials/Part 2 jump chips only on scroll-up (sticky). | P10 | First script line y 282 to ~230 | `public/js/osce/session.mjs`, `public/css/osce.css` | S |
| R11 | Your questions / Friends | Hide the Friends tab while signed out (3 tabs to 2). | P12, P13 | One dead tab gone; Ctrls −1 | `public/js/osce/library-view.mjs` | S |
| R12 | Library, signed out | Shorten the sign-in paragraph to one inline row, "On this phone only · Sign in to sync". | P13, P4 | Words −20; content y 170 to ~120 | `public/js/osce/library-view.mjs` | S |
| R13 | Study tab | Fold "Goal and exam date" into the ring card (tap the ring to edit the goal). | P8, P15 | Boxes −1, Ctrls −1 | `public/js/osce/library-study.mjs` | S |
| R14 | Study tab | Merge "Smart 10" and "0 to 1" into one row of two chips; "Custom" becomes a text link. | P14 | Boxes 7 to 4; ~120 px saved | `public/js/osce/library-study.mjs`, `public/css/osce.css` | S |
| R15 | Settings | Placement first; Account becomes one "Sign in to sync ›" row; helper paragraphs cut to 8 words or fewer. | P2, P4 | Words 107 to ~45 above the fold | `public/js/osce/settings.mjs`, `account.mjs` | M |
| R16 | Browse card | Drop the eye (preview) icon, since tapping the card opens it; bookmark moves to long-press or swipe. | P6, P7 | Per-card Ctrls 3 to 1 (≈ −4 in the viewport) | `public/js/osce/browse.mjs` | S |
| R17 | Browse card | Summary from 2 lines to 1; the status dot joins the specialty line. | P14 | Card ~210 to ~150 px; 3 cards per screen instead of 2 | `public/js/osce/browse.mjs`, `public/css/osce.css` | S |
| R18 | Browse header | Remove the details toggle (compact is the only mode now) and the shuffle icon (duplicates "Add random" on the session sheet). | P1, P5 | Ctrls −2; search field full width | `public/js/osce/browse.mjs` | S |
| R19 | Start | Fold "Request a case" and "Submit a question" into one "Contribute ›" row. | P4, P6 | Ctrls −1, one row fewer | `public/js/osce.mjs`, `requests-view.mjs` | S |
| R20 | Start | Drop the "133 stations · 2 attempted · Partner A 0 · Partner B 2" line; show attempts as a badge on Marked. | P8 | Words −12; content y 80 to ~56 | `public/js/osce.mjs` | S |
| R21 | Playlists | Remove the "UNLOCK X" badge from shelf cards (keep it on detail); show ★ only when favourited. | P14, P8 | Words −6; 3 badges gone | `public/js/osce/playlists-view.mjs` | S |
| R22 | Playlist detail | Shrink the hero art to a 96 px tile beside the title; move the reward box under the question list. | P1, P9 | First question y 600+ to ~300 | `public/js/osce/playlists-view.mjs`, `public/css/osce.css` | S |
| R23 | Live station | Hide the Notepad bar while Instructions scrolls down; show it on scroll-up. | P10 | 56 px more reading area | `public/js/osce/session.mjs` | S |

Suggested order: R1, R3, R4, R7, R2, R11, R9, R6, R5, then the rest. Verify each with the same 393x852 probe; the Measured effect column is the pass condition.
