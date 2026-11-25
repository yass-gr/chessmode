# Free ChessReps Alternative — Plan

_Last updated: 2026-11-24_

A free, open-source opening-repertoire trainer with close to all of ChessReps' features, plus a full game-review tab. It costs nothing for players and nothing to run.

Source research: [`chessreps-market-review.html`](./chessreps-market-review.html) (product and market review of ChessReps). APK files in [`chessreps/`](./chessreps/) are for studying the product only. Never copy ChessReps code, course content or branding.

---

## 1. What ChessReps is (from the review)

- Sells **ready-made opening repertoires**: 1,000+ openings and 60+ courses by titled players. Annual plan $34.99. The first line of each course is free, and there's a 7-day trial.
- **Six training modes:**

| Mode | What the player does |
|---|---|
| Learn | Play through a line written by the course author, with notes on key moves |
| Practice | Spaced-repetition review of whole lines, scheduled with FSRS |
| Drill | Play lines back to back and keep a streak going without mistakes |
| Time | Start with 60 s and earn time back for every line played without a mistake |
| Puzzles | Tactics taken from games where the opponent left a course line and blundered |
| Arena | Short rated games where opponent replies are weighted by how often players at your rating play them. Stockfish judges the final position when the recorded replies run out |

- **Coverage tool:** compares course lines against Lichess games and flags replies played at least 1% of the time that the course doesn't answer.
- Leaderboards for Drill and Time. Progress syncs across web, Android and iOS.
- **Architecture:** one Svelte web app (chessreps.com). The Android app is a thin native wrapper that loads it in a WebView and adds push notifications, Google sign-in, sharing and in-app purchases (RevenueCat). iOS works the same way.
- **What it hasn't solved yet** (according to the review): comparing imported games with your repertoire, teaching the ideas behind moves rather than only the move order, helping players choose a first repertoire, and showing how long a repertoire takes to learn.

---

## 2. What each feature costs, and the free replacement

| Feature | Free approach |
|---|---|
| Board, move rules | `chessground` + `chess.js`, running in the browser |
| FSRS scheduling | `ts-fsrs` (MIT licence), running in the browser |
| Learn / Drill / Time | Code that runs in the browser |
| Puzzles tied to openings | **Lichess puzzle database (CC0)**, which already tags each puzzle with its opening |
| Arena | Lichess game dumps (CC0) processed offline into static JSON, plus Stockfish in the browser |
| Coverage / gap finding | The same offline processing |
| Accounts + sync | Progress stored on the device, plus optional Lichess sign-in syncing to a free-tier database |
| Leaderboards | Cut for v1 (it's the only feature that needs a write-heavy server) |
| Mobile apps | PWA first; Capacitor wrappers later |
| **Course content** | **The hard part.** See decision 2 |

Hosting is static files on Cloudflare Pages, so the server bill is **$0**.

---

## 3. Decisions

### 1. Who "free" is for
**$0 for players and $0 to run, open source (GPL).** `chessground` and Stockfish are GPL-3, which already requires the app's code to be open source.

### 2. Content source
**Move trees generated from data, with notes drafted by an LLM and reviewed by a person.**
- Trees are built from Lichess game data (CC0). For your own moves, pick the popular move unless Stockfish says it's bad. For the opponent, include every common reply.
- Notes come from an LLM and are reviewed before they ship. Wikibooks *Chess Opening Theory* (CC BY-SA, must credit it and keep the same licence) can be used as reference material.
- **Caveats we accepted:**
  - Data tells you *what* people play, not *why*. The notes carry the explanation.
  - LLMs make chess mistakes (illegal moves, invented plans). **Every note must be reviewed.**
  - "Answer every reply played ≥1%" makes the tree explode. Keep a line only if enough games actually reach that position, and stop each line at a maximum depth.
  - Wikibooks coverage is patchy beyond the main lines.

### 3. How LLM notes are produced
**Generated once, offline, then saved with the app.** The notes are generated on your own machine, using a local model (Ollama) or an existing AI subscription. The model is given the Stockfish evaluations and Lichess statistics so it doesn't invent moves. After review, the notes are saved as static JSON, so there's no AI cost while the app runs.

### 4. Catalogue size at launch
**About 20 courses: 10 for White and 10 for Black.** Must include **Jobava London** and **Caro-Kann**. You know these openings well, so they're the accuracy check.

### 5. Platform
**PWA now, Capacitor later.** This copies ChessReps' pattern of one web app inside thin native wrappers. Google Play costs $25 once. The App Store costs $99 a year, so only add it if donations cover the fee. No RevenueCat, since nothing is for sale.

### 6. Accounts and sync
**Progress stored on the device first, with optional Lichess sign-in to sync it.** Progress lives in IndexedDB (Dexie) and works offline without an account. Signing in with Lichess (free OAuth) syncs it to a free-tier database (Supabase or Cloudflare D1).

### 7. Arena data
**Calculated in advance for each course.** Process the Lichess monthly game dumps offline, only for positions that appear in the courses, split by rating band. Ship the results as small static JSON files. That means no rate limits, it works offline, and it costs only your own disk space and CPU time.

### 8. Leaderboards
**Cut for v1; personal bests and streaks only**, stored on the device.

### 9. Headline feature
**Game import, deviation drills, and a full game-review "Matches" tab.**
- Load games from the Chess.com public data API (`/pub/player/{user}/games/archives`) and the Lichess game export API. Both are free and need no login.
- The Matches tab lists games; clicking one opens a full review:
  - an evaluation graph
  - move labels (best, good, inaccuracy, mistake, blunder, brilliant…)
  - accuracy %
  - arrows showing the best move
- Labels and accuracy build on Lichess's public win-chance and accuracy formulas, tuned to our own thresholds. **Use our own names and icons, not Chess.com's.**
- The review marks where you or your opponent left your repertoire. One tap adds that line to Practice.

### 10. Review speed
**Full depth with a progress bar; you wait once.** Stockfish runs on the user's device. Expect 30–90 s for a 40-move game on a phone. Results are cached on the device, so each game is analysed only once. Running Stockfish on several cores needs special headers from the web host (COOP/COEP), and Cloudflare Pages lets us set them.

### 11. Stack
**SvelteKit with its static adapter**, plus:
- `chessground` (board)
- `chess.js` (move rules)
- `ts-fsrs` (spaced repetition)
- Stockfish compiled for the browser (WASM)
- Dexie (IndexedDB)
- Capacitor later

### 12. Scope
**All modes and the game review ship in v1.** The build order still puts the two known openings first.

---

## 4. Build order (agreed)

Everything ships together at launch. It's built in this order so the riskiest assumption, LLM note quality, gets tested first.

1. **Content pipeline.** Lichess data, Stockfish and LLM notes for **Jobava London** and **Caro-Kann**. The user checks them for accuracy. If the notes are poor, the content strategy changes now.
2. **Learn + Practice (FSRS)** on those 2 courses, saved on the device, running as a PWA.
3. **Drill, Time, Puzzles** (puzzles from the Lichess puzzle database, filtered by opening tag).
4. **Matches tab, full game review, deviation drills.**
5. **Arena** (precomputed reply frequencies plus Stockfish to judge the final position).
6. **The remaining ~18 courses** through the tested pipeline.
7. **Lichess sign-in sync**, then **Capacitor wrappers**.

---

## 5. Legal and licensing notes

- The app is GPL-3 open source.
- Lichess game database and puzzle database: CC0, free to use.
- Wikibooks text: CC BY-SA. Credit it and keep notes derived from it under the same licence.
- **Do not** copy ChessReps' course content, annotations, code, name or branding.
- **Do not** use Chess.com's review names or icons. Write our own.
- Be considerate of free APIs (Lichess is a nonprofit). Prefer precomputed data and caching.

---

## 6. Expected costs

| Item | Cost |
|---|---|
| Hosting (Cloudflare Pages) | $0 |
| Sync database (free tier) | $0 until it gets large |
| LLM notes | $0 (local model or existing subscription, one-time) |
| Google Play (later) | $25 once |
| Apple App Store (later, optional) | $99/year, only if donations cover it |

---

## 7. Working notes

- Context compaction in Claude Code happens automatically near the context limit. You can also run it manually with `/compact <what to keep>`, and `/context` shows how full the context is. Good moments to compact are right after a milestone.
- These decisions are also saved in Claude's project memory, so they carry over between sessions.
