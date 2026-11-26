import { readFileSync } from 'node:fs';
import { Chess } from 'chess.js';

const lichess = JSON.parse(readFileSync('src/lib/import/fixtures/lichess.ndjson', 'utf8').split('\n')[0]);
const chesscom = JSON.parse(readFileSync('src/lib/import/fixtures/chesscom-month.json', 'utf8')).games[0];
const first = new Chess();
for (const san of lichess.moves.split(' ').slice(0, 50)) first.move(san);
const second = new Chess();
second.loadPgn(chesscom.pgn);
const sans = second.history().slice(0, 60);
second.reset();
for (const san of sans) second.move(san);
const third = new Chess();
third.loadPgn('1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7#');
export const games = [first.pgn(), second.pgn(), third.pgn()];
