import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const paths = process.argv.slice(2);
if (paths.length !== 3) throw new Error('Usage: node scripts/review-report.mjs <run1.json> <run2.json> <run3.json>');
const median = values => [...values].sort((a, b) => a - b)[1];
const runs = paths.map(path => {
 const data = JSON.parse(readFileSync(path, 'utf8'));
 const score = pass => JSON.parse(execFileSync(process.execPath, ['--experimental-strip-types', 'scripts/review-quality.mjs', path, 'tests/fixtures/review-reference.json', pass], { encoding: 'utf8' }));
 return { data, preview: score('preview'), final: score('final') };
});
const quality = (items, kind) => ({
 percent: median(items.map(item => item[kind].percent)),
 n: items[0][kind].n,
 runs: items.map(item => item[kind])
});
console.log(JSON.stringify({
 games: runs[0].data.map((game, index) => ({
  game: game.game,
  previewMs: median(runs.map(run => run.data[index].previewMs)),
  finalMs: median(runs.map(run => run.data[index].ms)),
  preview: { serious: quality(runs.map(run => run.preview.games[index]), 'serious'), all: quality(runs.map(run => run.preview.games[index]), 'all') },
  final: { serious: quality(runs.map(run => run.final.games[index]), 'serious'), all: quality(runs.map(run => run.final.games[index]), 'all') }
 })),
 preview: { serious: quality(runs.map(run => run.preview), 'serious'), all: quality(runs.map(run => run.preview), 'all') },
 final: { serious: quality(runs.map(run => run.final), 'serious'), all: quality(runs.map(run => run.final), 'all') }
}, null, 2));
