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
