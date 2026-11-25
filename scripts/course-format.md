# Course file format

Each course is one JSON file in `src/lib/courses/<id>.json`. The app reads it directly, and
`node scripts/validate-course.mjs src/lib/courses/<id>.json` checks it.

```jsonc
{
  "id": "caro-kann",                  // kebab-case, same as the file name
  "name": "Caro-Kann Defence",
  "side": "b",                        // "w" or "b": the side the student plays
  "level": "Beginner to club",
  "tagline": "One short line for the course card.",
  "description": "2–4 sentences: what the repertoire is, why it suits the student, the main ideas.",
  "chapters": [
    {
      "id": "advance",                // kebab-case, unique in the course
      "name": "Advance Variation",
      "moves": "3.e5",                // short label shown under the name
      "intro": "3–6 sentences: the structure, the plans for both sides, what to remember.",
      "lines": [
        {
          "id": "advance-short",      // unique in the course
          "name": "Short System",
          "pgn": "1. e4 c6 2. d4 d5 3. e5 Bf5 { Note on 3...Bf5. } 4. Nf3 e6 5. Be2 c5 { Note. } 6. Be3"
        }
      ],
      "quiz": [
        {
          "pgn": "1. e4 c6 2. d4 d5 3. e5 Bf5 4. Nc3 e6 5. g4",   // moves leading to the quiz position
          "question": "White just played 5.g4, the Bayonet. Where should the bishop go?",
          "options": ["...", "...", "..."],                       // 3 or 4 options
          "answer": 1,                                             // index into options
          "explanation": "1–3 sentences on why."
        }
      ]
    }
  ]
}
```

## Rules

- **PGN**: every line starts from the initial position. Standard SAN with move numbers
  (`1. e4 c6 2. d4`). No variations `( )`, no NAGs, no results. Comments go in `{ }` straight
  after the move they describe.
- **One move per position.** The student's side must always play the same move in the same
  position, across the whole course (positions are compared by FEN, so transpositions count).
  The validator fails on conflicts.
- **Shared prefixes** are normal: lines in a chapter branch off each other. A note only needs to
  be written once; if the same move carries a note in several lines, the notes must be identical
  (or leave it out on all but one line).
- **Line ends** on a move by the student's side, at a position where the student understands the
  plan. Typical length 8–16 full moves.
- **Opponent moves** cover the replies real players at 800–2000 actually make, including common
  bad moves (with the punishment), not only master theory.
- **Notes** explain *why*, in plain English: the plan, the threat, the typical mistake. Put a note
  on every key student move and on every opponent move that changes the plan. 1–3 sentences each.
  No move-order lists inside notes unless they are needed to explain a threat. No claims an engine
  would disagree with.
- **Quiz**: 1–3 per chapter, about plans and ideas, not move-order trivia. Exactly one correct option.
