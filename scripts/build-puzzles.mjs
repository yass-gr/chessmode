#!/usr/bin/env node
// Picks opening puzzles for each course from the Lichess puzzle database (CC0), streamed, nothing stored:
//   node scripts/build-puzzles.mjs
// A puzzle qualifies when its opening tag names a position the course reaches and the solver plays the
// course's side, so the opponent has just gone wrong in your opening and you find the punishment.
// Writes static/data/puzzles/<courseId>.json.
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { Chess } from 'chess.js';

const URL = 'https://database.lichess.org/lichess_db_puzzle.csv.zst';
const PER_COURSE = 400;
const MIN_RATING = 600;
const MAX_RATING = 2400;
const MAX_MOVE = 20;

const key = (fen) => fen.split(' ').slice(0, 4).join(' ');
/** "Queen's Pawn Game: Accelerated London System, Main" -> ["Queens_Pawn_Game", "Queens_Pawn_Game_Accelerated_London_System"] */
function tagsOf(name) {
	const tag = (s) => s.normalize('NFD').replace(/[\u0300-\u036f']/g, '').replace(/[^A-Za-z0-9-]+/g, '_').replace(/^_|_$/g, '');
	const [family, rest] = name.split(': ');
	const variation = rest?.split(', ')[0];
	return variation ? [tag(family), `${tag(family)}_${tag(variation)}`] : [tag(family)];
}

const openings = JSON.parse(readFileSync('static/data/openings.json', 'utf8'));
const courses = readdirSync('src/lib/courses')
	.filter((f) => f.endsWith('.json'))
	.map((f) => JSON.parse(readFileSync(`src/lib/courses/${f}`, 'utf8')));

// Variation tags name a specific line and always count. A family tag alone counts only when it is not a
// catch-all and names a real share of the course; "Pirc_Defense" from one transposition would pull in
// thousands of Pirc games the course never reaches.
const CATCH_ALL = new Set(['Kings_Pawn_Game', 'Queens_Pawn_Game', 'Indian_Defense']);
const wanted = courses.map((course) => {
	const variations = new Set();
	const families = new Map();
	for (const line of course.chapters.flatMap((ch) => ch.lines)) {
		const chess = new Chess();
		chess.loadPgn(line.pgn);
		const replay = new Chess();
		for (const move of chess.history()) {
			replay.move(move);
			const name = openings[key(replay.fen())]?.split('|')[1];
			if (!name) continue;
			const [family, variation] = tagsOf(name);
			families.set(family, (families.get(family) ?? 0) + 1);
			if (variation) variations.add(variation);
		}
	}
	const total = [...families.values()].reduce((s, n) => s + n, 0);
	const own = [...families].filter(([f, n]) => !CATCH_ALL.has(f) && n / total >= 0.1).map(([f]) => f);
	return { course, families: new Set(own), variations, picked: [] };
});
for (const w of wanted) process.stderr.write(`${w.course.id}: ${[...w.families, ...w.variations].join(' ')}\n`);

const curl = spawn('curl', ['-s', URL]);
const zstd = spawn('zstd', ['-dcq']);
curl.stdout.pipe(zstd.stdin);
zstd.stdout.setEncoding('utf8');

let rows = 0;
let buffer = '';
function row(line) {
	rows++;
	const [id, fen, moves, rating, deviation, popularity, plays, themes, , openingTags] = line.split(',');
	if (!openingTags || Number(popularity) < 80 || Number(plays) < 300 || Number(deviation) > 100) return;
	const r = Number(rating);
	if (r < MIN_RATING || r > MAX_RATING) return;
	const [, turn, , , , fullmove] = fen.split(' ');
	if (Number(fullmove) > MAX_MOVE) return;
	const solver = turn === 'w' ? 'b' : 'w';
	const tags = openingTags.split(' ');
	const specific = tags[tags.length - 1];
	for (const w of wanted) {
		if (w.course.side !== solver || !(w.families.has(tags[0]) || w.variations.has(specific))) continue;
		w.picked.push({ id, fen, moves: moves.split(' '), rating: r, themes: themes.split(' '), opening: specific.replace(/_/g, ' ') });
	}
}

zstd.stdout.on('data', (text) => {
	buffer += text;
	let from = 0;
	let nl;
	while ((nl = buffer.indexOf('\n', from)) !== -1) {
		if (rows > 0 || !buffer.startsWith('PuzzleId', from)) row(buffer.slice(from, nl));
		else rows++;
		from = nl + 1;
	}
	buffer = buffer.slice(from);
	if (rows % 500_000 < 2000) process.stderr.write(`\r${rows.toLocaleString()} puzzles read`);
});

/** Up to PER_COURSE puzzles spread evenly across the rating range, most played first within a bucket. */
function spread(puzzles) {
	const buckets = 18;
	const size = (MAX_RATING - MIN_RATING) / buckets;
	const byBucket = Array.from({ length: buckets }, () => []);
	for (const p of puzzles) byBucket[Math.min(buckets - 1, Math.floor((p.rating - MIN_RATING) / size))].push(p);
	const out = [];
	for (let round = 0; out.length < PER_COURSE; round++) {
		let added = false;
		for (const bucket of byBucket) {
			if (bucket[round] && out.length < PER_COURSE) {
				out.push(bucket[round]);
				added = true;
			}
		}
		if (!added) break;
	}
	return out.sort((a, b) => a.rating - b.rating);
}

zstd.on('close', () => {
	mkdirSync('static/data/puzzles', { recursive: true });
	for (const w of wanted) {
		const chosen = spread(w.picked);
		const json = JSON.stringify(chosen);
		writeFileSync(`static/data/puzzles/${w.course.id}.json`, json);
		process.stderr.write(`\n${w.course.id}: ${w.picked.length} matched, ${chosen.length} kept, ${(json.length / 1024).toFixed(0)} KB`);
	}
	process.stderr.write(`\ndone: ${rows.toLocaleString()} puzzles read\n`);
});
