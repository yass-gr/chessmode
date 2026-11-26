# Chessmode

Free, open-source (GPL-3.0) opening trainer with a full game review. Static SvelteKit app, local-first,
no server. Product decisions live in `PLAN.md`; the visual language lives in `design-system/index.html`.

## Stack

- SvelteKit 3 + Svelte 5 runes, `@sveltejs/adapter-static` (SPA, `ssr = false`).
- `chessground` (board, via `src/lib/components/Board.svelte` only), `chess.js` (rules), `ts-fsrs` (SRS),
  `dexie` (IndexedDB), Stockfish 19 lite WASM in a Web Worker (`static/stockfish/`).
- Tests: `vitest` for pure logic. Run `npx vitest run`.

## Conventions

- Imports use the `#lib/...` subpath alias with an explicit extension: `#lib/chess/types.ts`,
  `#lib/components/Board.svelte`. `$lib` does not exist in this SvelteKit version.
- Shared types are the contract between areas. Read them before writing code:
  `src/lib/chess/types.ts`, `src/lib/courses/types.ts`, `src/lib/train/types.ts`,
  `src/lib/review/types.ts`, `src/lib/engine/types.ts`, `src/lib/db.ts`.
- Parse external data (course JSON, Lichess/Chess.com responses, PGN) once at the boundary into these
  types. Trust the types inside.
- Domain logic is pure TypeScript in `src/lib/**` with unit tests next to it (`*.test.ts`).
  Svelte components stay thin.
- Styling: use the tokens and component classes in `src/app.css` (`.btn`, `.btn-primary`, `.card`,
  `.seg`, `.chip`, `.progress`, `.option`, `.field`, `.page`). Dark only. One orange accent for the next
  action, the target square or progress. Mobile first (390px), and every screen must also work on desktop.
- Move labels display Chess.com-style names (Brilliant, Great, Best, Excellent, Good, Book, Forced, Inaccuracy, Mistake, Miss, Blunder); internal keys stay find/sharp/best/strong/good/book/only/loose/mistake/missed/blunder.
- Comments only for a non-obvious why.

## Checks before every commit

```bash
npx svelte-check --tsconfig ./tsconfig.json   # 0 errors
npx vitest run                                 # all green
npx vite build                                 # builds
```

Verify UI in a real browser (`npx vite build && npx vite preview`), at 390x844 and 1440x900.

## Courses

`src/lib/courses/<id>.json`, format in `scripts/course-format.md`, checked by
`node scripts/validate-course.mjs <file>`.
