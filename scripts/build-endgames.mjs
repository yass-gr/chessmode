#!/usr/bin/env node
// Endgame positions from the Lichess puzzle database (CC0):
//   node scripts/build-endgames.mjs
// Streams https://database.lichess.org/lichess_db_puzzle.csv.zst and keeps a small spread of
// endgame-tagged puzzles. The player to move is the solver, after the puzzle's setup ply.
// Writes static/data/endgames.json. Nothing else from the dump is stored.
import { mkdirSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { Chess } from 'chess.js';

const URL = 'https://database.lichess.org/lichess_db_puzzle.csv.zst';
const MIN_RATING = 600;
const MAX_RATING = 2400;
const BAND = 300;
const PER_BAND = 8;
const bands = Math.ceil((MAX_RATING - MIN_RATING) / BAND);

const picked = Array.from({ length: bands }, () => []);

function pieces(fen) {
	return fen.split(' ')[0].replace(/[0-9/]/g, '').length;
}

function take(line) {
	const [id, fen, movesField, rating, deviation, popularity, plays, themes, gameUrl] = line.split(',');
	if (!themes?.split(' ').includes('endgame')) return;
	if (Number(popularity) < 70 || Number(plays) < 200 || Number(deviation) > 120) return;
	const r = Number(rating);
	if (r < MIN_RATING || r > MAX_RATING) return;
	if (pieces(fen) > 12) return;
	const moves = movesField.split(' ');
	if (moves.length < 2) return;
	let chess;
	try {
		chess = new Chess(fen);
		chess.move({ from: moves[0].slice(0, 2), to: moves[0].slice(2, 4), promotion: moves[0][4] });
	} catch {
		return;
	}
	const idea = moves[1];
	const legal = chess.moves({ verbose: true }).some((move) => move.from + move.to + (move.promotion ?? '') === idea);
	if (!legal) return;
	const band = Math.min(bands - 1, Math.floor((r - MIN_RATING) / BAND));
	if (picked[band].length >= PER_BAND) return;
	picked[band].push({
		id,
		fen: chess.fen(),
		player: chess.turn(),
		rating: r,
		themes: themes.split(' ').filter((theme) => theme !== 'endgame').slice(0, 4),
		idea,
		game: gameUrl || undefined
	});
}

function full() {
	return picked.every((band) => band.length >= PER_BAND);
}

const curl = spawn('curl', ['-fsSL', URL]);
const zstd = spawn('zstd', ['-dcq']);
curl.stdout.pipe(zstd.stdin);
curl.stdout.on('error', () => {});
zstd.stdin.on('error', () => {});
curl.stderr.on('data', () => {});
zstd.stdout.setEncoding('utf8');

let rows = 0;
let buffer = '';
let stopped = false;

function stop() {
	if (stopped) return;
	stopped = true;
	write();
	curl.kill('SIGTERM');
	zstd.kill('SIGTERM');
}

zstd.stdout.on('data', (text) => {
	buffer += text;
	let from = 0;
	let nl;
	while ((nl = buffer.indexOf('\n', from)) !== -1) {
		const line = buffer.slice(from, nl);
		from = nl + 1;
		if (rows === 0 && line.startsWith('PuzzleId')) {
			rows++;
			continue;
		}
		rows++;
		take(line);
		if (full()) {
			stop();
			break;
		}
	}
	buffer = buffer.slice(from);
	if (rows % 200_000 < 4000) process.stderr.write(`\r${rows.toLocaleString()} puzzles read`);
});

let wrote = false;
function write() {
	if (wrote) return;
	wrote = true;
	const positions = picked.flat().sort((a, b) => a.rating - b.rating || a.id.localeCompare(b.id));
	const file = {
		source: 'Lichess puzzle database',
		url: URL,
		license: 'CC0',
		positions
	};
	mkdirSync('static/data', { recursive: true });
	writeFileSync('static/data/endgames.json', JSON.stringify(file));
	process.stderr.write(`\nkept ${positions.length} endgames from ${rows.toLocaleString()} rows\n`);
	if (positions.length < PER_BAND) process.exitCode = 1;
}

zstd.on('close', write);
curl.on('error', (error) => {
	process.stderr.write(`${error.message}\n`);
	process.exitCode = 1;
});
