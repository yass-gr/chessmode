import { writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { games } from './review-games.mjs';

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/usr/bin/chromium', headless: true });
const results = [];
try {
 for (const [index, pgn] of games.entries()) {
  if (process.env.BENCH_GAME && Number(process.env.BENCH_GAME) !== index + 1) continue;
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
  const commands = await page.evaluate(() => window.benchmarkCommands);
  results.push({ game: index + 1, ms, environment, commands, review });
  await writeFile(process.argv[2] ?? 'tests/fixtures/review-baseline.json', JSON.stringify(results, null, 2) + '\n');
  console.error(`game ${index + 1}/${games.length}: ${ms} ms`);
  await context.close();
 }
} finally { await browser.close(); }

await writeFile(process.argv[2] ?? 'tests/fixtures/review-baseline.json', JSON.stringify(results, null, 2) + '\n');
