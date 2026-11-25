# ChessReps web parity

Baseline: Chessmode `a31d263` and the public ChessReps web build inspected on 2026-11-25. The target is the behavior of the web product for the 12 bundled Chessmode courses and for a user's own repertoire. Leaderboards, native apps and expansion of the bundled catalogue are excluded. Public discovery and sharing of the 12 courses count. A larger third-party catalogue does not. Chessmode stays free, static and local-first per [PLAN.md](../../PLAN.md). Guest access already meets or exceeds the reference's first-line sample. Subscriptions, checkout, entitlement gates and upsells have no implementation ticket. Optional sync is tracked as a product dependency because the behavior extends beyond one browser.

## Evidence

- **Public** means visible in a public page or described by ChessReps. I fetched the catalogue, Caro-Kann and Ruy Lopez trainers, Analysis, Endgame Arena, author guide, books index, bot trainer and endgame review entry with curl. I also checked the first-party mode and creator descriptions. [Catalogue](https://www.chessreps.com/) · [Caro-Kann trainer](https://www.chessreps.com/opening/caro-kann) · [Ruy Lopez trainer](https://www.chessreps.com/opening/ruy-lopez) · [Web mode rules](https://www.chessreps.com/compare/chessreps-vs-chessable) · [Practice priority](https://www.chessreps.com/compare/chessreps-vs-chessiverse) · [Creator and copying](https://www.chessreps.com/compare/chessreps-vs-chessbook) · [Author guide](https://www.chessreps.com/course-author-guide)
- **Bundle** means a reachable client path or setting was found by following the public route manifest, fetching its JS and CSS with curl and formatting them for inspection. I retrieved 315 of 394 assets in the initial targeted dependency crawl and retried key missing files directly. The trainer node covers line selection, wrong-move recovery, progress, settings, unlocks and mode clocks. The depth sheet and its CSS cover selection, milestones and interaction timing. Profile, Analysis, opening explorer, editor and endgame nodes were also sampled. No subscription or sign-in was used. [Route manifest](https://www.chessreps.com/_app/immutable/entry/app.zFnKcKpc.js) · [Trainer](https://www.chessreps.com/_app/immutable/nodes/102.CIZKlPqy.js) · [Depth sheet](https://www.chessreps.com/_app/immutable/chunks/pE_ax40R2.js) · [Depth sheet CSS](https://www.chessreps.com/_app/immutable/assets/DepthTierSheet.DjFnvbg8.css) · [Settings](https://www.chessreps.com/_app/immutable/chunks/WbjVR4hX2.js) · [Mode constants](https://www.chessreps.com/_app/immutable/chunks/DesJcakq.js) · [Profile](https://www.chessreps.com/_app/immutable/nodes/114.DS194OxD.js)
- **Unverified** means public evidence is incomplete or conflicts. Each such item identifies what needs confirmation and gives a useful baseline where possible. Route names behind dev, QA, admin or rollout flags are leads only. The comparison below measures behavior and contains no reference code, course lines, notes, artwork or marketing text.

Status is relative to the behavior described in each row. **Done** means Chessmode provides it, **Partial** means related functionality exists, and **Missing** means the flow is absent. The inventory covers observable features at different levels of granularity. A raw ratio of these rows would give a misleading estimate of percentage parity.

## Inventory

### Course entry and depth

| ChessReps behavior | Chessmode status and evidence | Work |
| --- | --- | --- |
| Open a course and start an interactive first line as a guest. **Public** | **Done.** Home and the course page link straight to playable lines. [Home](../../src/routes/+page.svelte) · [Learn](../../src/routes/learn/%5Bcourse%5D/%5Bline%5D/+page.svelte) | |
| On eligible courses, first entry shows a depth sheet with a default first tier, counts, preview selection and a confirm action. Essentials, Advanced and Full Mastery are cumulative prefixes of a course-specific ordering. Two-tier courses have Essentials and Full Mastery. Counts come from the course, including the full count. **Bundle** | **Missing.** The flat course order is always used. [Course types](../../src/lib/courses/types.ts) · [Course page](../../src/routes/course/%5Bid%5D/+page.svelte) | CR-01 |
| Save the choice and whether the chooser was seen per course. Reopen from the rank indicator or settings. Changes preserve all prior line progress, and a directly opened line can be pinned into the active set. **Bundle** | **Missing.** Only the active course ID persists. [Training data](../../src/lib/train/data.ts) | CR-01 |
| Use depth to scope new lessons, learned/perfected totals and the selected/beyond-depth line list. First-time completion and perfection are separate milestones. A sheet is queued at 1,200 ms with a next-tier or stay action. **Bundle** | **Missing.** Learn and course progress use the complete course. [Learn](../../src/routes/learn/%5Bcourse%5D/%5Bline%5D/+page.svelte) · [Stats](../../src/lib/train/stats.ts) | CR-01 |
| Browse started courses, resume, remove a course from the library and find it again through the catalogue. Search and open a course by moves. **Public/Bundle** | **Partial.** Course switching and name/move search exist. Library membership and resumable actions are implicit. [Catalogue](../../src/routes/courses/+page.svelte) · [Home](../../src/routes/+page.svelte) | CR-02 |

### Learn, Practice and spaced repetition

| ChessReps behavior | Chessmode status and evidence | Work |
| --- | --- | --- |
| Play your side with automatic opponent moves and contextual author notes. Leave a wrong move visible, explain the reply and offer takeback. **Public** | **Done.** Learn shows move notes and a tactical or off-repertoire explanation with takeback. [Trainer](../../src/lib/components/train/LineTrainer.svelte) · [Wrong-move judge](../../src/lib/chess/explain.ts) | |
| Learn chooses the next new selected line, moves to Practice when first-pass learning runs out, and also allows explicit replay. Completion can surface a final-position note and a visible course milestone. **Bundle** | **Partial.** Learn proposes the first unlearned line and displays a result sheet. The last line has no direct Practice handoff. [Learn](../../src/routes/learn/%5Bcourse%5D/%5Bline%5D/+page.svelte) | CR-01, CR-03 |
| Practice starts from recall, accepts a hint on demand, and marks a line perfected when played without mistakes or hints. **Public/Bundle** | **Partial.** Clean Practice is tracked and wrong moves can be retried. The hint immediately reveals the answer and there is no stepped hint/solve flow. [Trainer](../../src/lib/components/train/LineTrainer.svelte) · [SRS](../../src/lib/srs.ts) | CR-03, CR-05 |
| Practice chooses among learned lines, gives never-perfected lines first priority, avoids immediately repeating the current line if possible, randomly chooses among up to the three most overdue, or takes the earliest due when none are overdue. Learned lines with no card rank as most overdue. A selected line can also be opened directly. **Bundle** | **Partial.** Due-only sorting prefers never-clean cards, then overdue. Review ahead uses a separate batch capped at 10, and the run uses a frozen queue. [Queue](../../src/lib/train/session.ts) · [Practice run](../../src/routes/practice/run/+page.svelte) | CR-04 |
| FSRS grades whole lines. Schedule updates on finished Practice, Drill and Time attempts. Clean earns Good, one mistake or hint earns Hard, two or more of either count earns Again. Learn records discovery. Confidence begins at 5 and moves up 2 on clean or down by mistake and hint counts, clamped from 1 to 10. **Bundle** | **Partial.** Whole-line FSRS exists, seeds a Good card on Learn, schedules only Practice and gives Again for any mistake. [SRS](../../src/lib/srs.ts) · [Progress storage](../../src/lib/db.ts) | CR-05 |
| Progress counts discoveries and perfect completions separately. Starting over in Practice keeps learned lines and clears perfection. Course reset has its own confirmation. **Bundle** | **Partial.** Local progress, reviews, lapses and a clean flag exist. Reset is global. [Profile](../../src/routes/you/+page.svelte) · [SRS](../../src/lib/srs.ts) | CR-05, CR-06 |
| When wrong, reveal the repertoire move when requested and let the learner repair the sequence. The trainer includes a dedicated Fix flow and can link to a better matching course line. **Bundle** | **Partial.** Takeback resumes at the current move. There is no guided replay or same-course alternative-line transition. [Trainer](../../src/lib/components/train/LineTrainer.svelte) | CR-03 |

### Drill and Time

| ChessReps behavior | Chessmode status and evidence | Work |
| --- | --- | --- |
| After three learned lines, offer Drill and Time and explain how each starts. Practice is offered after one learned line. Puzzle/Arena cards in the public trainer show a two-line gate, while the bundle can celebrate the pair at five learned lines. **Public/Bundle** | **Partial.** Drill and Time can start after one line. Arena is gated at two and Puzzles depend on data. There is no unlock celebration. [Drill hub](../../src/routes/drill/+page.svelte) · [Arena](../../src/routes/arena/%5Bcourse%5D/+page.svelte) | CR-07 |
| Drill draws learned lines randomly without replacement for a pass through the pool. A mistake breaks the streak, as does requesting a hint. Completion advances after 1,000 ms. After seeing the pool there can be an offer to learn more or keep drilling. **Public/Bundle** | **Partial.** First mistake finishes the run. The pool only avoids an immediate repeat and hints do not break the streak at the point of use. [Drill run](../../src/routes/drill/run/+page.svelte) · [Selection](../../src/lib/train/session.ts) | CR-08 |
| Time starts at 60 s and scores correct unassisted player moves. Each clean line adds `floor(line plies / 2)` seconds. The clock drains at 1 + 0.05 × clean lines. A wrong move costs 3 s per mistake, returns to the previous position after 250 ms and reveals a move arrow. Next line at 750 ms. **Bundle** | **Partial.** Starts at 60 s, currently scores by clean line, adds 6 s, deducts 5 s for the first miss on a line and accelerates by 0.04 per point up to 2×. [Drill run](../../src/routes/drill/run/+page.svelte) · [Clock](../../src/lib/train/session.ts) | CR-09 |
| Show score and line count separately, time bonuses/penalties, records, progress within a run and a leave confirmation. **Bundle** | **Partial.** Score/time, timer bumps, all-time best and replay exist. [Drill run](../../src/routes/drill/run/+page.svelte) | CR-08, CR-09, CR-12 |

### Puzzles, Arena and quizzes

| ChessReps behavior | Chessmode status and evidence | Work |
| --- | --- | --- |
| Rated opening puzzles start with the opponent's error, deal near the player's per-course rating and offer correction/recovery after a miss. No repeat until the played pool is exhausted. Show solve streak and rating feedback. **Public/Bundle** | **Partial.** Puzzle flows and ratings exist where static JSON is available. Selection, first-error loss and reveal exist. Check coverage for the entire catalogue and add explicit recovery feedback. [Puzzle page](../../src/routes/puzzles/%5Bcourse%5D/+page.svelte) · [Puzzle logic](../../src/lib/puzzles/puzzles.ts) | CR-10 |
| Weighted opponent replies from rating-matched Lichess games, engine adjudication when book data runs out and per-course rating. Arena also shows evaluation and lets users review the played game, including move history and an evaluation graph. Rating can be tuned before play and caps at 3000. **Public/Bundle** | **Partial.** Weighted replies, rating and adjudication exist, with basic result sheet and no in-context review or rating control. [Arena page](../../src/routes/arena/%5Bcourse%5D/+page.svelte) · [Arena logic](../../src/lib/explorer/arena.ts) · [Ratings](../../src/lib/ratings.ts) | CR-11 |
| Chapter multiple-choice quiz with board, grading and explanations. **Unverified as reference behavior.** The public trainer's mode selector has six modes and shows no chapter quiz. A separate review/Dojo bundle has `data-quiz-card` markers, which do not establish an opening chapter quiz. | **Done as Chessmode functionality.** Course quiz tab is content-dependent and result is logged. [Course quiz entry](../../src/routes/course/%5Bid%5D/+page.svelte) · [Quiz](../../src/routes/quiz/%5Bcourse%5D/%5Bchapter%5D/+page.svelte) | |
| Puzzle auto-advance is on by default and waits 600 ms after completion. Opponent animation for puzzle setup waits 150 ms. **Bundle** | **Partial.** Next puzzle is manual and puzzle setup timing differs. [Puzzle page](../../src/routes/puzzles/%5Bcourse%5D/+page.svelte) | CR-10, CR-14 |

### Stats, onboarding and settings

| ChessReps behavior | Chessmode status and evidence | Work |
| --- | --- | --- |
| Course progress displays discovered versus perfected lines. Profile displays total lines discovered, openings perfected and a one-year activity heatmap, with daily rep count on hover. Colors track 0, 1–3, 4–6, 7–12 and 13+ reps. **Bundle** | **Partial.** You shows one month of binary activity, XP, review counts, streaks and learned totals. [You](../../src/routes/you/+page.svelte) · [Session log](../../src/lib/progress.ts) | CR-12 |
| Mode tops show streak, score and rating results. Personal bests have daily, weekly, monthly and all-time buckets per course. **Bundle** | **Partial.** Local aggregate and course-specific bests are available from logs. Date buckets and per-mode history are absent. [Stats](../../src/lib/train/stats.ts) · [Drill hub](../../src/routes/drill/+page.svelte) · [You](../../src/routes/you/+page.svelte) | CR-12 |
| Guest route into a sample. Onboarding also stores rating bracket, goals and motivation. Rating affects Arena and puzzle starting ratings. **Public/Bundle** | **Partial.** Guest play exists and no first-run rating or goals flow exists. [Home](../../src/routes/+page.svelte) · [Ratings](../../src/lib/ratings.ts) | CR-13 |
| Persist progress and appearance across devices when signed in. Profile supports identity, password recovery, email change, signout and account deletion. **Public/Bundle** | **Missing.** Progress is device-local and the planned optional sync has no implementation. [Database](../../src/lib/db.ts) · [Plan](../../PLAN.md) | CR-22 |
| Notes, arrows, evaluation bar, text size, pace, shared start, next puzzle, feedback and board appearance have real settings. The trainer only exposes relevant controls for its mode. See the values below. **Bundle** | **Partial.** Sound toggles exist. Coach behavior, arrow display and pace are mostly fixed. [Trainer](../../src/lib/components/train/LineTrainer.svelte) · [Board](../../src/lib/components/Board.svelte) · [Sound](../../src/lib/sound.ts) | CR-03, CR-10, CR-14, CR-15 |
| App language selection and localized trainer interface, including the ten languages linked in the public catalogue footer and English as the base language. **Public/Bundle** | **Missing.** UI labels are English literals. [Layout](../../src/routes/+layout.svelte) · [You](../../src/routes/you/+page.svelte) | CR-25 |

### Course page, editing, analysis and small UX

| ChessReps behavior | Chessmode status and evidence | Work |
| --- | --- | --- |
| Course detail displays title, side, opening position/moves, line count and progress. Desktop and compact layouts both expose the six modes and settings. **Public** | **Partial.** Course page, line thumbnails and progress exist, while most mode links live elsewhere. [Course page](../../src/routes/course/%5Bid%5D/+page.svelte) · [Drill hub](../../src/routes/drill/+page.svelte) | CR-02, CR-07 |
| Trainer line chooser shows progress and allows selecting a specific line. When eligible, it distinguishes in-tier and beyond-tier lines. A course can have an author intro video. **Bundle** | **Partial.** Course detail has line links and Ideas. It has no in-trainer picker or video slot. [Course page](../../src/routes/course/%5Bid%5D/+page.svelte) | CR-01, CR-16 |
| Creator makes trainable courses from pasted/dropped PGN and Lichess studies. Edit branches, import/reimport, copy a course, add position notes and annotations and output PGN. **Public/Bundle** | **Partial.** Local paste/study import and deletion exist. There is no file drop, existing-course editor, course copy or export. [Creator](../../src/routes/create/+page.svelte) · [PGN tree](../../src/lib/courses/pgn-tree.ts) · [Custom courses](../../src/lib/courses/custom.ts) | CR-17 |
| Coverage flags unanswered replies at ≥1% conditional frequency, ranks by reach-weighted loss, shows an unbounded points score and offers author tools to investigate and close gaps. **Public** | **Partial.** Bundled courses show a percentage and up to eight gaps. Custom courses skip coverage. [Coverage](../../src/lib/explorer/coverage.ts) · [Course page](../../src/routes/course/%5Bid%5D/+page.svelte) | CR-18 |
| Public opening explorer supports browsing opening positions and seeing real reply frequencies by rating. **Public/Bundle** | **Partial.** Static explorer data is used by Arena and course coverage, with no interactive explorer. The reference explorer route redirected guests to sign-in. [Explorer data](../../src/lib/explorer/types.ts) | CR-19 |
| Standalone Analysis board supports freely trying moves, importing a game and starting game review from the board. Review routes accept a Chess.com game or PGN. **Public/Bundle** | **Partial.** Matches imports games and Review analyzes them, including deviation drills and best lines. There is no standalone editable board, shareable position or user variation tree. [Matches](../../src/routes/matches/+page.svelte) · [Review](../../src/routes/review/%5Bid%5D/+page.svelte) | CR-20 |
| Board move entry supports interaction during the opponent turn through premoves, clears the premove upon a miss, includes visual feedback and permits replay/inspection of move history. **Bundle** | **Partial.** Click/drag, legality, promotion, markers, sound, reduced-motion helpers and some keyboard navigation exist. Trainer history is read-only display and premoves are disabled. [Board](../../src/lib/components/Board.svelte) · [Trainer](../../src/lib/components/train/LineTrainer.svelte) · [Motion](../../src/lib/motion.ts) | CR-03, CR-15 |
| Endgame Arena has endgame-specific opponent play, rating/difficulty, progress and beginner coaching. **Public/Bundle** [Endgame Arena](https://www.chessreps.com/endgames) | **Missing.** [Routes](../../src/routes) | CR-21 |
| Opening review and endgame review have public player-selection entry points. The full signed-in result flows were not observed. **Public/Bundle** [Opening review](https://www.chessreps.com/opening-review) · [Endgame review](https://www.chessreps.com/endgame-review) | **Partial.** Matches has game import and single-game opening deviations. [Repertoire matching](../../src/lib/review/repertoire.ts) | CR-23 |
| The books index links into individual books and sections. **Public/Bundle** [Books](https://www.chessreps.com/books) | **Missing.** The course Ideas tab presents opening introductions. [Course page](../../src/routes/course/%5Bid%5D/+page.svelte) | CR-26 |
| The public bot trainer lets players choose the bot and White, Black or random, with move history and trainer settings. **Public** [Bots](https://www.chessreps.com/cursed-bots) | **Missing.** Course Arena is the closest route. [Arena](../../src/routes/arena/%5Bcourse%5D/+page.svelte) | CR-27 |
| The public community page lists creator courses and Explore redirects there. The manifest also exposes Dojo; the guest response alone did not establish a playable workflow. **Public/Bundle** [Community](https://www.chessreps.com/community) · [Dojo](https://www.chessreps.com/dojo) | **Missing** for shared discovery and Dojo. Chessmode supports its local 12-course catalogue and private creation. [Catalogue](../../src/routes/courses/+page.svelte) · [Creator](../../src/routes/create/+page.svelte) | CR-24 |
| The course editor exposes an author-only bulk mark-learned action. The trainer settings can open the authored course in the editor. **Bundle** | **Missing.** Custom courses support import and delete. [Creator](../../src/routes/create/+page.svelte) | CR-17 |

### Settings reference

These are observed keys and values. Implement Chessmode-owned names in storage. Use the same visible choices where the feature is in scope. [Trainer settings](https://www.chessreps.com/_app/immutable/chunks/WbjVR4hX2.js) · [Settings presentation](https://www.chessreps.com/_app/immutable/chunks/B78bJS4l2.js) · [Profile appearance values](https://www.chessreps.com/_app/immutable/chunks/Df8PqrxD.js)

| Control and reference key | Default and values | Applies to |
| --- | --- | --- |
| Coaching, `learnDialogBehavior` | `default` automatic by context; `always` every move; `tap` on request | Learn |
| Move arrows, `showLearnArrowsV2` | `none`, `withDialog`, `always`. Answer-hiding during a fix takes precedence. | Learn and Practice |
| Evaluation bar, `showEvalBarV2` | On | All trainer modes except Puzzles |
| Fast opponent, `fastDrillMode` | On per course. 150 ms on, 500 ms off. Learn, Practice and Arena use 500 ms. Puzzles use 150 ms. | Drill and Time |
| Skip shared start, `skipSharedOpening` | Off per course. Show only when there are ≥2 lines and a common opening of ≥2 plies. Learn always plays the first finished line from the start. If skipping leaves no player move, play the whole line. | Learn, Practice, Drill |
| Auto-next, `nextPuzzleImmediately` | On. Auto-next after 600 ms. | Puzzles |
| Sound, `shouldPlaySounds`; confetti, `showConfetti`; haptics, `shouldPlayHaptics` | On. Haptics depend on a supported surface. | Trainer |
| Text size | `default`, `large`, `xl`. | Trainer notes |
| Appearance, `chessboard_theme`, `chessboard_pieces` | Themes `default`, `green`, `brown`, `blue`, `dark-blue`. Pieces `default`, `staunty`, `lichess`. Profile and guest fallbacks can differ. | Board, persisted by profile or browser |
| Depth | Per-course choice and chooser-seen flag. Default index 1. | Eligible courses |
| Arena rating | Numeric rating with stored range 100–3000. Values in the settings picker are 400–3000 in steps of 100. | Arena |

## Work items and parallel batches

S is a bounded change within an existing surface, M adds a flow spanning UI and domain logic, and L needs a cross-mode contract, content production or infrastructure. Paths below are relative to the repository root and denote likely write ownership. Each batch has a disjoint write set. Work inside a batch can be serial. Agree on the small interfaces below before starting. A producer owns edits to its files when a later batch needs a change.

- **A · Entry and scope** owns home, course overview, catalogue, Drill landing, depth metadata and persistence, and any schema migration in `db.ts`. It publishes the selected line pool, in-scope counts and unlock status. **CR-01, CR-02, CR-07.**
- **B · Line modes** owns the trainer, Learn and Practice routes, Drill/Time run, and scheduling and line-mode logic. It consumes A's scope, C's settings and E's line picker. **CR-03, CR-04, CR-05, CR-06, CR-08, CR-09.**
- **C · Board and settings** owns the Board/PlayShell components, board assets and a new settings module. It publishes preferences and board APIs. Mode routes apply those via their owners. **CR-14, CR-15.**
- **D · Rated modes** owns Puzzles, Arena, their rating logic and opening puzzle datasets. It consumes C's settings and F's rating baseline. **CR-10, CR-11.**
- **E · Course tools** owns the creator, PGN tree and custom-course modules, coverage domain and new picker/coverage components. A and B mount the exported components in their routes. **CR-16, CR-17, CR-18.**
- **F · Profile and onboarding** owns You, stats and activity aggregation, onboarding and sync modules. A mounts first-run entry on Home and owns any requested storage migrations. **CR-12, CR-13, CR-22.**
- **G · Analysis and explorer** owns Matches, Review, new analysis/explorer/opening-review routes and review/import modules. It supplies deep links for A and E. **CR-19, CR-20, CR-23.**
- **H · Other web training** owns Endgame Arena and any confirmed sibling training surfaces. It consumes shared Board, rating and settings APIs. **CR-21, CR-24, CR-26, CR-27.**
- **I · Localization** owns the locale layer, shared navigation and layout. Each feature owner adopts the locale interface in its files after IDs stabilize. **CR-25.**

### A · Entry and scope

#### CR-01 · Course depth and selective progress · L

**Behavior.** Offer a first-entry depth picker for eligible courses and let users revisit it at any time. Each course uses an original priority order and course-specific cumulative counts. The active scope changes which lines are offered for discovery and perfection.

**Acceptance.** Display two or three valid tiers with counts, preselect tier 1, preview selection and commit only on confirmation. Dismissing keeps the previous/default scope and records that the chooser was seen. Re-entering the course restores its scope, and changes survive reload. Switching smaller → larger → smaller keeps every existing card. A direct line link works even for an out-of-tier line. Show in-tier and beyond-tier rows, separate learned/perfected denominators and a milestone sheet after the first completion of each threshold. The next-tier action changes scope and the stay action preserves it. For the 12 courses, create and validate independent ordering data with stable line IDs. Courses with no usable tier data follow the full course. Keep Arcade eligibility and draw pools distinct where reference evidence does: the inspected Drill/Time draw uses all learned lines, even though completion and record context can be depth-scoped.

**Files.** `src/lib/courses/{types,parse,depth}.ts`, separately authored depth metadata, `src/lib/train/data.ts`, `src/lib/db.ts`, course overview and new depth component. B consumes the scope on session routes.

#### CR-02 · Course library and resume · M

**Behavior.** Give the player a persistent library, clear course metadata, the six modes and an action that resumes training.

**Acceptance.** Opening or starting a course makes it discoverable in the library; removing it hides its card and preserves its progress. Reopening it from search restores the card and counters. Show side, representative board/moves and learned/perfected counts. Choose the next lesson or continue Practice at the selected depth and support an explicit mode choice at mobile and desktop widths.

**Files.** `src/routes/{+page.svelte,courses/+page.svelte,course/[id]/+page.svelte}`, `src/lib/train/data.ts`, new library components.

#### CR-07 · Per-course mode gates and unlocks · M

**Behavior.** Show mode availability and remaining lines in context. Explain unlocked modes before the first run.

**Acceptance.** Fresh course shows Practice after one learned line, Drill and Time after three, and Puzzle/Arena after two when their data is available, as advertised by the public course cards. Handle the separate five-line celebration as a milestone and verify against signed-in behavior before treating it as an access gate. Deep links obey per-course eligibility. Courses without mode data explain the reason. Courses shorter than a threshold receive an explicit usable policy. Chessmode's all-course modes can remain as an extension.

**Files.** `src/routes/{course/[id],drill}/+page.svelte`, new `src/lib/courses/unlocks.ts`. B and D use the same gate on their run routes.

### B · Line modes

#### CR-03 · Coach, hint, fix and replay flow · L

**Behavior.** Use a contextual coach during Learn, teach wrong-move recovery in Learn and Practice and support review of played moves.

**Acceptance.** Under the default coach setting, first encounters and explanatory moments surface notes; every-move and tap-only settings behave as selected. Keep a wrong move on the board until takeback, show relevant explanation, offer a source-square hint before full solve, and count assistance once per position. A fix can replay the missed sequence and offer another valid course line, including a safe return to the original lesson. Practice hides answers at entry. Support keyboard and touch navigation of played history, resume from the live position and confirm leaving active runs. Show final-position coaching and give completed Learn a Practice entry with an explicit replay option. No stale callback moves a board after exit, line switch or takeback.

**Files.** `src/lib/components/train/{LineTrainer,ResultSheet}.svelte`, `src/lib/train/{types,reducer}.ts`, Learn route and new fix logic.

#### CR-04 · Continuous Practice priority · M

**Behavior.** Practice keeps finding the most useful learned line even when no review is currently due.

**Acceptance.** With a fixed timestamp and seed, select never-perfected lines first; exclude the current line when another candidate in the selected pool exists. Choose among at most three overdue candidates and choose the earliest coming review if none are overdue. A missing card in the priority pool is overdue. Recalculate after each finish. Keep course/all-course scope and the explicit-line link working. Show a useful empty state only when there are no eligible learned lines and retain due counts as advisory.

**Files.** `src/lib/train/session.ts`, `src/routes/practice/{+page.svelte,run/+page.svelte}`.

#### CR-05 · One progress model across line modes · L

**Behavior.** Track discovered and perfected separately and feed Practice, Drill and Time completions into the line's FSRS card.

**Acceptance.** First Learn creates a discovery without a reference-style graded repetition. Existing scheduled cards retain due dates on migration. A clean eligible run earns Good and perfection; one mistake or hint earns Hard; two distinct mistakes or two distinct hints earn Again. One mistake plus one hint is Hard in the inspected call path. Count FENs for attempts and confidence, clamp confidence to 1–10, start at 5 and add 2 for clean. Use FSRS 90% target retention, short-term steps of 1 and 10 minutes, relearn step of 10 minutes, no fuzz and 36,500-day maximum as observed in the client. Record each finished line once and skip aborted/unfinished lines. Surface the resulting state to duration and progress summaries.

**Files.** `src/lib/srs.ts`, `src/lib/train/{reducer,types}.ts`, Learn, Practice run and Drill/Time run. Any database schema change goes through A.

#### CR-06 · Scoped reset controls · M

**Behavior.** Offer reset of only Practice or all progress for this course, with separate confirmations.

**Acceptance.** Cancel is inert. A Practice reset clears perfection and returns affected lines to practice priority while keeping discoveries; a course reset clears those discoveries and their line progress. Another course's records and the original custom repertoire survive both. Keep history and rating treatment explicit in the prompt and verify the reference's account-gated reset semantics before expanding what is cleared. Refresh the current counts after reset.

**Files.** `src/lib/srs.ts`, new `src/lib/train/reset.ts`, trainer settings actions and Practice route. A exposes the same actions from course entry if needed.

#### CR-08 · Drill streak and deck · M

**Behavior.** Start a deliberate streak run, cycle learned lines without replacement and offer more learning once the player has gone through the deck.

**Acceptance.** For a three-line pool, all three appear before a repeat. A miss or hint breaks the active streak immediately. Award one point for a clean completed line and show best and run results. After a successful line, wait 1,000 ms and advance unless a learn-more offer is open. Offer learn more or continue when unseen course lines remain and the current deck has been covered. A restart or exit cannot advance a stale run.

**Files.** `src/routes/drill/run/+page.svelte`, `src/lib/train/session.ts`, `src/lib/components/train/LineTrainer.svelte`.

#### CR-09 · Time Trials rules and clock · M

**Behavior.** Start the 60-second challenge with explicit rules and separate move points from clean-line count.

**Acceptance.** Count a point for each correct player move at an unassisted position. Increase the drain multiplier by 0.05 per clean line. A clean 12-ply learned line adds 6 s and a clean 13-ply line also adds 6 s. A hinted or mistaken line grants no bonus. Deduct 3 s on each wrong move, rollback at 250 ms and reveal the expected move. New line at 750 ms unless the timer expired or the player left. Timer clamps to zero, stops cleanly, records one outcome and displays the final points and clean lines. Supply the separate score metric to CR-12 so historic line scores aren't compared with move points as if identical.

**Files.** `src/routes/drill/run/+page.svelte`, `src/lib/train/{session,reducer}.ts`.

### C · Board and settings

#### CR-14 · Persist mode-aware trainer preferences · M

**Behavior.** Provide a trainer settings panel with the controls and defaults in the settings reference.

**Acceptance.** Global settings follow the player across courses in one browser. Fast opponent and shared start persist independently per course. Shared start applies only on supported modes and valid prefixes, including the first-Learn exception. Evaluation bar follows mode and toggle; async evaluations only update the current position. Honor text size and feedback preferences, including reduced motion. Preserve the existing sound preference on migration. Publish a read/write contract and a reusable settings panel so B, D and other owners wire up their own modes.

**Files.** New `src/lib/settings/`, `src/lib/components/settings/`, `src/lib/sound.ts`, `src/lib/motion.ts`, `src/lib/components/play/PlayShell.svelte`.

#### CR-15 · Board appearance and premoves · M

**Behavior.** Preview and choose board colors and piece sets. Allow legal premoves where supported and retain feedback and accessible move entry.

**Acceptance.** A chosen theme and piece set survive refresh and render in both orientations without affecting the application theme. Implement the observed number of choices using original palettes and license-compatible piece art. Queuing a premove during an opponent turn highlights it and plays it only once it is legal. Cancel by changing the move, leaving the position, switching modes or hitting a wrong move; no accidental promotion or move on the next line. Preserve click, drag, keyboard alternatives and reduced motion. The depth sheet's brief transitions are 160 ms for selection motion and 200 ms for color in the inspected CSS; use Chessmode tokens and honor the system motion preference.

**Files.** `src/lib/components/{Board,MiniBoard}.svelte`, board appearance settings and original/licensed assets. B wires trainer premove state, A owns the depth sheet.

### D · Rated modes

#### CR-10 · Complete puzzle coverage and session loop · L

**Behavior.** Offer rated puzzles for each shipped opening, using real games where the opponent leaves the repertoire and makes a punishable mistake.

**Acceptance.** Supply independently sourced, validated puzzles for all 12 courses. Only Caro-Kann and Jobava London have datasets today. Start with the opponent error after 150 ms, choose near the active rating, avoid repeats until exhaustion and show solve, fail and recovered outcomes. First failure charges a single loss, a corrected solution has explicit recovery feedback and repeated clicks cannot pay twice. Auto-next defaults on and advances after 600 ms; the off setting gives a Next action. Cancel pending moves and advance when leaving. Confirm the reference's exact recovery rating delta before claiming numeric parity.

**Files.** `src/routes/puzzles/[course]/+page.svelte`, `src/lib/puzzles/`, `src/lib/ratings.ts`, `static/data/puzzles/`, related offline generation script.

#### CR-11 · Arena setup and post-game analysis · L

**Behavior.** Play against rating-filtered weighted replies, set a course rating baseline, see the engine verdict and replay the game afterward.

**Acceptance.** Fallback Arena start is 950. If there is no course rating, adopt the observed onboarding mapping (750, 1000, 1200, 1400, 1550, 1700 for ascending brackets), or use the reference's regression toward 950 of 65% of the mean difference across other Arena courses with at least 20 attempts. A manual rating can be chosen in 100-point steps from 400 to 3000 and the stored rating stays 100–3000. Show evaluation, prior/new rating, rating-filtered opponent replies and a distinct adjudication state. At game end, inspect moves, engine variations and an evaluation graph and start another game. Engine/data failure is recoverable and cannot silently settle a result twice. Compare adjudication and rating changes against publicly documented cases; the exact server/data thresholds are not prerequisites for the replay UI.

**Files.** `src/routes/arena/[course]/+page.svelte`, `src/lib/explorer/arena.ts`, `src/lib/ratings.ts`, new Arena review wrapper using existing review components.

### E · Course tools

#### CR-16 · Trainer line picker and optional intro · M

**Behavior.** Open a course's line list in the trainer and switch directly to a specific line. Show an intro on courses with an original video.

**Acceptance.** Include course order, selected and beyond-depth groups where applicable, and learned/perfected status. Selecting a new or learned line leads to Learn or Practice respectively. Closing preserves the current line and input. If a course's metadata includes an intro, make it playable on demand and dismissible with captions/transcript support; otherwise keep the existing Ideas entry. On mobile the list fits and scrolls while action controls remain reachable.

**Files.** New `src/lib/components/courses/LinePicker.svelte` and course intro component, custom metadata reader. A owns the course metadata type and B mounts the picker.

#### CR-17 · Course editor, copy and PGN round trip · L

**Behavior.** Maintain a private repertoire with import, edit, copy and export. The player can keep training it after editing.

**Acceptance.** Paste, drop a PGN file or import a Lichess study. Preview legal branches and edits before save; edit side, title, chapter structure, moves, notes and supported board annotations. A copy gets a new identity and progress store. Provide an edit shortcut on owned courses and an explicit bulk mark-learned action for their owners. Reimport reports what will be replaced. Preserve line IDs and progress for equivalent surviving lines; only changed and removed lines lose their prior mapping. PGN export and reimport preserve legal branches and authored notes. A malformed PGN keeps the existing course intact. Run feasible modes for private courses; Arcades that need unavailable data have an explanation, as specified by CR-07.

**Files.** `src/routes/create/`, `src/lib/courses/{custom,pgn-tree}.ts`, new editor and PGN export modules. A owns any course data schema changes.

#### CR-18 · Coverage feedback for a repertoire · L

**Behavior.** See reach-weighted gaps, a points score and the move sequence to each gap while inspecting or editing a repertoire.

**Acceptance.** Use observed conditional threshold ≥1%, order gaps by position reach × reply share and show a zero-gap state only with adequate data. Include rating band and source/sample context. Report an unbounded points score alongside any existing coverage percentage, with different units. Selecting a gap jumps to the right position; adding the supported response removes or relocates that gap when coverage is recalculated. Show an explicit unknown state for positions without data. Confirm the reference score's normalization separately; the public explanation establishes its unit, threshold and relative weighting, but gives no exact formula. Local or free cached data preserves the static deployment.

**Files.** `src/lib/explorer/coverage.ts`, new `src/lib/components/courses/CoveragePanel.svelte`, creator route. A mounts the coverage panel on the overview.

### F · Profile and onboarding

#### CR-12 · Course and profile activity · M

**Behavior.** See discovered and perfected progress, annual training activity and local course/mode records.

**Acceptance.** Count a rep consistently across eligible completed training attempts. Group by local calendar date, including across DST. Show a one-year heatmap with 0, 1–3, 4–6, 7–12, 13+ bands and date/count details accessible by tap, hover and keyboard. Per-course discovered/perfected and perfected-course totals agree with trainer results. Date-window personal records use daily, weekly, monthly and all-time scopes, and Time score versions are distinguishable. Retain Chessmode's streak and XP. No network ranking is needed.

**Files.** `src/routes/you/+page.svelte`, `src/lib/progress.ts`, `src/lib/train/stats.ts`, new activity components. B and D publish mode results.

#### CR-13 · Optional first-run setup and rating seed · M

**Behavior.** Let a new player either start immediately or give rating and training intent to help choose one of the 12 courses.

**Acceptance.** A fresh browser can play as a guest before setup. Offer an optional setup and remember when dismissed/completed. Support unknown, under 400, 400–799, 800–1199, 1200–1599, 1600–1999 and 2000+ rating choices mapped to the observed bracket IDs. Supply seeds only when a course has no rating. Puzzle fallback is 950; the supported brackets from `400-800` through `2000-plus` map to 1050, 1150, 1250, 1350 and 1350. Confirm exact public onboarding prompt order, goal choices and recommendations under current rollout before copying its behavior. Make setup available later and leave existing progress usable.

**Files.** New `src/lib/onboarding/`, `src/routes/onboarding/` and profile preferences. A inserts the Home entry and D applies the seed.

#### CR-22 · Optional web sync and account controls · L

**Behavior.** Continue the same repertoire progress on another browser after optional sign-in.

**Acceptance.** Guest/offline training works and queues local progress. Opt-in under the project's approved free sync architecture merges stable IDs across devices, with conflict rules for latest settings, deletions/resets and distinct completed attempts. Sync errors provide a retry and avoid replacing newer data with stale data. Provide sign-out and confirmed account deletion; identity and recovery follow the adopted provider. The user can see what syncs. This depends on approval of the backing service in [PLAN.md](../../PLAN.md); local backup/export can provide a separately useful checkpoint, but full sync parity requires two browsers.

**Files.** New `src/lib/sync/`, `src/routes/account/` and profile controls. A owns any underlying schema migrations.

### G · Analysis and explorer

#### CR-19 · Interactive opening explorer · L

**Behavior.** Play through an opening position and compare how replies vary across rating bands.

**Acceptance.** Start from a course or shareable position, show legal SAN choices and sample counts, change band to recompute reply shares and navigate back/forward. Draw and label the selected move. Display sparse/unavailable data separately from a true zero. Course coverage and the editor can deep link into the same position. Keep the offline shipped data as a fallback. Confirm what the reference's username-based explorer exposes under sign-in before expanding beyond public-game data.

**Files.** New `src/routes/explorer/`, explorer data reader and components. Existing Arena and coverage algorithms stay under their owners.

#### CR-20 · Standalone analysis board · L

**Behavior.** Explore a position without needing a saved game. Import or play a game and enter the full review from the same context.

**Acceptance.** Play either side, flip, navigate history and add a legal variation. Import suitable PGN and a public Chess.com game, handle a malformed input and give the new board a shareable position or locally saved game link. Start existing engine review while protecting manually created variations. Keep Matches import, Lichess support and current game review usable. Verify share/import types against the Analysis route before claiming additional options.

**Files.** New `src/routes/analysis/`, `src/lib/review/`, reuse `src/lib/import/`, Matches and Review route handoffs.

#### CR-23 · Opening review and game-to-course handoff · M

**Behavior.** Surface opening-specific review from a player's games. The app already detects deviations per reviewed game.

**Acceptance.** Verify the stable public opening-review route and its supported game sources. If enabled, give the player an aggregate view across supported imported games, with course/side filters and a route into each departure position or existing deviation drill. Verify the separately reachable endgame review result after the public player selection and add a phase-based review when that workflow is confirmed. Mark unmatched games explicitly and keep private imported data local. Preserve the full review link. Validate grouped results against a fixture with multiple courses and both colors.

**Files.** New `src/routes/opening-review/`, `src/lib/review/repertoire.ts`, Matches/Review handoff.

### H · Other web training

#### CR-21 · Endgame Arena · L

**Behavior.** Play the separate web endgame mode with rated progression, difficulty and beginner assistance.

**Acceptance.** Validate the public mode selector and session defaults against the [Endgame Arena](https://www.chessreps.com/endgames) and [endgame bundle](https://www.chessreps.com/_app/immutable/nodes/95.db3_k4j2.js). Start a legal endgame position, complete it against a legal opponent, show its outcome and rating/progress, and offer the next position. Beginner coaching includes hint/show and keep-trying actions. Preserve endgame progress separately and keep the opening and analysis boards unaffected. Verify the initial placement and the 850/1200 transitions in their actual direction before exposing automatic tier movement. Independently source or generate positions and use existing chess/engine tooling.

**Files.** New `src/routes/endgames/`, `src/lib/endgames/` and an original endgame position dataset. A reviews shared storage needs with H.

#### CR-24 · Confirm and cover shipped sibling workflows · L

**Behavior.** Establish release eligibility of the residual web tools before adding them to the main navigation. The manifest contains Dojo, public community/creator discovery and creator-specific bot paths. These are separate from the six course modes. Books, the general bot trainer and review entry each have a separate ticket.

**Acceptance.** Record public entry point, sign-in requirement and one complete task for `/bots/[creator]/[[bot]]`, `/dojo`, and `/community`. A route that redirects or has only gated or experimental client markers does not establish a shipping workflow. For confirmed flows, split follow-up tickets by route into independent, original implementations. Limit library browsing/sharing to the 12 shipped courses and capability for private repertoires, and confirm any account/publication requirements with CR-22. No competitor book, bot personality or course assets enter the repo. Treat this as a release-surface verification gate; a 99% claim requires its disposition.

**Files.** `docs/parity/chessreps.md` for verification results, then new route-owned modules for confirmed workflows. A owns navigation into the 12-course library.

#### CR-26 · Sectioned reading and position study · L

**Behavior.** Browse a book or guide and open a specific section from the index or a direct link.

**Acceptance.** Offer a browsable shelf, ordered sections, stable section links, and previous/next navigation. Study positions on a playable board when a section provides one. Validate which interactive controls ship on reference book sections before adding them. Use original or separately verified public-domain text and positions. Keep reading material independent of the 12-course count.

**Files.** New `src/routes/books/`, `src/lib/books/` and independently sourced reading data.

#### CR-27 · Web bot games · L

**Behavior.** Pick a bot and a color and play a full game from the starting position.

**Acceptance.** Pick White, Black or random before play. The selected bot responds legally; game results distinguish checkmate, draw and resignation where supported. Provide restart, move-history inspection, and settings, with no old move firing after switching opponents. Confirm whether the public bot route offers any result-to-review handoff before adding one. Use original bot names and behavior. Piece and board options come from C.

**Files.** New `src/routes/bots/` and `src/lib/bots/`, original bot presets.

### I · Localization

#### CR-25 · Localized navigation and training · L

**Behavior.** Let users choose the interface language and keep it across navigation and reload.

**Acceptance.** Support English and the published language choices Spanish, French, German, Turkish, Italian, Polish, Greek, Portuguese and Indonesian. Show consistent selections and format numbers, dates and plurals for the selected locale. Unknown locale falls back to English. Translate original interface copy and keep SAN and course IDs stable. Existing course notes remain sourced independently. Confirm the current reference locale list in Profile against the footer before calling this exact.

**Files.** New `src/lib/i18n/`, shared navigation and `src/routes/+layout.svelte`; feature owners translate their components using the shared interface.

## Assets to create

- **CR-15:** Up to two additional original or license-compatible chess piece sets, with a single source per set and a clear license. Reuse the existing style as one option. Generate theme previews from rendered boards.
- **CR-01 and CR-07:** Depth and unlock markers can use existing UI primitives or original icons. No raster art is required.
- **CR-16:** An optional intro video and thumbnail per course that gets an original recording. Use the existing board or a generated position for the thumbnail.
- **CR-27:** Use original text or initials for bot avatars. Order new character art only if a later visual brief calls for it.
- **CR-10, CR-21 and CR-26:** Original or independently licensed data assets. Generate independently sourced puzzle and endgame position files, with no new imagery needed to play.

## Release check

Use fresh guest data and existing IndexedDB progress at 390 × 844 and 1440 × 900. For each of the 12 courses, open and switch depth, complete a Learn line, practice it, confirm its state after refresh and exercise every unlocked mode. Test wrong moves, a hint, an early Practice round, timers with a controllable clock, and interrupted async transitions. Use both course colors and at least one private imported repertoire. Verify account-gated details and the residual routes called out above before measuring feature parity. Track milestone, settings persistence and blocked-by-data cases as behaviors in the release checklist.
