// @ts-nocheck
// Run after `npx vite build`, with `npx vite preview --host 127.0.0.1` running.
// Save each JSON result and compare its moves against a run from another revision.
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
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
const games = [first.pgn(), second.pgn()];
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/usr/bin/chromium', headless: true });
try {
 for (const [index, pgn] of games.entries()) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.addInitScript(() => {
   window.benchmarkCommands = [];
   const post = Worker.prototype.postMessage;
   Worker.prototype.postMessage = function (message, ...args) {
    if (typeof message === 'string' && /^(setoption|go )/.test(message)) window.benchmarkCommands.push(message);
    return post.call(this, message, ...args);
   };
  });
  await page.goto(`${process.env.BENCH_URL || 'http://127.0.0.1:4173'}/matches`);
  const environment = await page.evaluate(() => ({ isolated: crossOriginIsolated, hardwareConcurrency: navigator.hardwareConcurrency }));
  await page.getByText('Paste a PGN').click();
  await page.getByRole('textbox', { name: 'Game PGN' }).fill(pgn);
  const start = performance.now();
  await page.getByRole('button', { name: 'Review PGN' }).click();
  await page.waitForURL('**/review/**');
  const review = await page.evaluate(async () => {
   const db = await new Promise((resolve, reject) => { const req = indexedDB.open('chessmode'); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
   const deadline = Date.now() + 300000;
   while (Date.now() < deadline) {
    const rows = await new Promise((resolve, reject) => { const req = db.transaction('reviews').objectStore('reviews').getAll(); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
    if (rows.length) return rows[0];
    await new Promise(resolve => setTimeout(resolve, 100));
   }
   throw new Error('Review did not complete within five minutes');
  });
  const ms = Math.round(performance.now() - start);
  const commands = await page.evaluate(() => [...new Set(window.benchmarkCommands)]);
  console.log(JSON.stringify({ game: index + 1, ms, environment, commands, hashMb: 'Stockfish default', depth: review.depth, plies: review.moves.length, whiteAccuracy: review.white.accuracy, blackAccuracy: review.black.accuracy, labels: review.moves.map(move => move.classification) }));
  await context.close();
 }
} finally { await browser.close(); }
