import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { mkdir, writeFile } from 'node:fs/promises';
import { Chess } from 'chess.js';
import { games } from './review-games.mjs';

const binary = process.env.STOCKFISH_NATIVE ?? '/tmp/sf-native/stockfish/stockfish-ubuntu-x86-64-avx2';
const engine = spawn(binary, [], { stdio: ['pipe', 'pipe', 'inherit'] });
const lines = createInterface({ input: engine.stdout });
let receive = () => {};
lines.on('line', line => receive(line));
const send = command => engine.stdin.write(command + '\n');
const waitFor = (commands, done) => new Promise((resolve, reject) => {
 const fail = error => { receive = () => {}; reject(error); };
 engine.once('error', fail);
 engine.once('exit', fail);
 receive = line => {
  if (!done(line)) return;
  engine.off('error', fail);
  engine.off('exit', fail);
  receive = () => {};
  resolve();
 };
 for (const command of commands) send(command);
});
try {
 await waitFor(['uci'], line => line === 'uciok');
 await waitFor(['setoption name Threads value 8', 'setoption name Hash value 256', 'setoption name MultiPV value 2', 'isready'], line => line === 'readyok');
 const results = [];
 for (const [index, pgn] of games.entries()) {
  const game = new Chess();
  game.loadPgn(pgn);
  const moves = game.history();
  game.reset();
  const positions = [];
  for (let ply = 0; ply <= moves.length; ply++) {
   const fen = game.fen();
   const terminal = game.isCheckmate() ? { mate: 0 } : game.isDraw() ? { cp: 0 } : undefined;
   if (terminal) positions.push({ fen, depth: 0, lines: [], score: terminal });
   else {
    const byDepth = new Map();
    let bestMove;
    await waitFor(['position fen ' + fen, 'go depth 20'], line => {
     if (line.startsWith('bestmove ')) { bestMove = line.split(' ')[1]; return true; }
     const depth = line.match(/^info depth (\d+)\b/);
     const score = line.match(/\bscore (cp|mate) (-?\d+)(?=\s|$)/);
     const pv = line.match(/\bpv ((?:[a-h][1-8][a-h][1-8][qrbn]?(?:\s|$))+)/);
     if (!depth || !score || !pv || /\b(?:lowerbound|upperbound)\b/.test(line)) return false;
     const d = Number(depth[1]);
     const entry = byDepth.get(d) ?? [];
     const value = Number(score[2]) * (game.turn() === 'w' ? 1 : -1);
     entry[Number(line.match(/\bmultipv (\d+)\b/)?.[1] ?? 1) - 1] = { depth: d, score: { [score[1]]: value }, pv: pv[1].trim().split(/\s+/) };
     byDepth.set(d, entry);
     return false;
    });
    const candidates = [...byDepth.entries()].filter(([, entries]) => entries[0]?.pv[0] === bestMove);
    const [depth, entries] = candidates.at(-1) ?? [];
    if (!entries?.length) throw new Error(`No result for game ${index + 1}, ply ${ply}`);
    positions.push({ fen, depth, lines: entries.filter(Boolean), score: entries[0].score });
   }
   process.stderr.write(`game ${index + 1}/${games.length}, position ${ply + 1}/${moves.length + 1}\n`);
   if (ply < moves.length) game.move(moves[ply]);
  }
  results.push({ pgn, positions });
 }
 await mkdir('tests/fixtures', { recursive: true });
 await writeFile('tests/fixtures/review-reference.json', JSON.stringify(results, null, 2) + '\n');
} finally { send('quit'); }
