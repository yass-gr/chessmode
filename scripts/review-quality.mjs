import { readFileSync } from 'node:fs';
import { posKey, turnOf } from '../src/lib/chess/types.ts';
import { readPgn } from '../src/lib/import/pgn.ts';
import { classify } from '../src/lib/review/classify.ts';
import { gameAccuracy, lichessWinPercent } from '../src/lib/review/accuracy.ts';

const [resultPath, referencePath = 'tests/fixtures/review-reference.json', pass = 'final'] = process.argv.slice(2);
if (!resultPath) throw new Error('Usage: node scripts/review-quality.mjs <results.json> [reference.json]');
const results = JSON.parse(readFileSync(resultPath, 'utf8'));
const references = JSON.parse(readFileSync(referencePath, 'utf8'));
const book = JSON.parse(readFileSync('static/data/openings.json', 'utf8'));
const serious = new Set(['loose', 'mistake', 'missed', 'blunder', 'find', 'only']);
let all = 0, allMatch = 0, seriousTotal = 0, seriousMatch = 0, seriousReference = 0;
const games = [];
for (const [index, ref] of references.entries()) {
 const result = pass === 'preview' ? results[index]?.preview : results[index]?.review;
 const moves = readPgn(ref.pgn).plies;
 if (!result || result.moves.length !== moves.length || ref.positions.length !== moves.length + 1) throw new Error(`Game ${index + 1}: mismatched length`);
 let inBook = true;
 let gameAllMatch = 0, gameSeriousMatch = 0, gameSeriousTotal = 0, gameSeriousReference = 0;
 let prevRef, prevResult;
 const labels = { reference: [], result: [] };
 const win = { reference: [], result: [] };
 for (const [i, move] of moves.entries()) {
  const before = ref.positions[i], after = ref.positions[i + 1];
  const actual = result.moves[i];
  if (before.fen !== move.fenBefore || after.fen !== move.fenAfter || actual.fenBefore !== move.fenBefore || actual.fenAfter !== move.fenAfter) throw new Error(`Game ${index + 1}, ply ${i + 1}: mismatched position`);
  inBook = inBook && book[posKey(move.fenAfter)] !== undefined;
  const r = classify({ move, before, scoreAfter: after.score, previous: prevRef, inBook });
  const b = classify({ move, before: { fen: move.fenBefore, depth: result.depth, lines: actual.alternatives }, scoreAfter: actual.scoreAfter, previous: prevResult, inBook });
  labels.reference.push(r.classification); labels.result.push(b.classification);
  prevRef = { ...move, loss: r.loss }; prevResult = { ...move, loss: b.loss };
  if (i === 0) {
   win.reference.push(lichessWinPercent(before.score, turnOf(move.fenBefore)));
   win.result.push(lichessWinPercent(actual.best.score, turnOf(move.fenBefore)));
  }
  win.reference.push(lichessWinPercent(after.score, turnOf(move.fenAfter)));
  win.result.push(lichessWinPercent(actual.scoreAfter, turnOf(move.fenAfter)));
  all++; if (r.classification === b.classification) { allMatch++; gameAllMatch++; }
  if (serious.has(r.classification)) { seriousReference++; gameSeriousReference++; }
  if (serious.has(r.classification) || serious.has(b.classification)) {
   seriousTotal++; gameSeriousTotal++; if (r.classification === b.classification) { seriousMatch++; gameSeriousMatch++; }
  }
 }
 const colors = moves.map(move => move.color);
 const accuracyDelta = Object.fromEntries(['w', 'b'].map(color => [color, gameAccuracy(win.result, colors, color) - gameAccuracy(win.reference, colors, color)]));
 games.push({ game: index + 1, ms: pass === 'preview' ? results[index].previewMs : results[index].ms, serious: { matches: gameSeriousMatch, total: gameSeriousTotal, n: gameSeriousReference, percent: gameSeriousTotal ? 100 * gameSeriousMatch / gameSeriousTotal : null }, all: { matches: gameAllMatch, total: moves.length, n: gameSeriousReference, percent: 100 * gameAllMatch / moves.length }, accuracyDelta, labels });
}
console.log(JSON.stringify({ serious: { matches: seriousMatch, total: seriousTotal, n: seriousReference, percent: 100 * seriousMatch / seriousTotal }, all: { matches: allMatch, total: all, n: seriousReference, percent: 100 * allMatch / all }, games }, null, 2));
