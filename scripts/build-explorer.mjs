#!/usr/bin/env node
// Counts what Lichess players play at every course position, by rating band of the player to move.
// Streams a monthly dump straight from Lichess, nothing is written to disk:
//   node scripts/build-explorer.mjs --month 2026-10 --games 10000000 --streams 16
// Lichess serves each connection slowly but the dump is many independent zstd frames, so each stream
// opens a byte range at a different offset, skips to the next frame and decodes from there.
// Writes static/data/explorer/<courseId>.json for every course in src/lib/courses.
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { Chess } from 'chess.js';

const arg = (name, fallback) => {
	const i = process.argv.indexOf(`--${name}`);
	return i > 0 ? process.argv[i + 1] : fallback;
};
const LIMIT = Number(arg('games', 10_000_000));
const MONTH = arg('month', '2026-10');
const STREAMS = Number(arg('streams', 16));
const URL = `https://database.lichess.org/standard/lichess_db_standard_rated_${MONTH}.pgn.zst`;
const BANDS = [800, 1000, 1200, 1400, 1600, 1800, 2000, 2200];
const MIN_SHARE = 0.005;
const MIN_TOTAL = 20;
// Plies past the deepest course position cannot match, so only the start of each game is read.
const MAX_TEXT = 4000;

const key = (fen) => fen.split(' ').slice(0, 4).join(' ');
const clean = (san) => san.replace(/[+#?!]+$/, '');
const band = (elo) => BANDS.findLast((b) => elo >= b) ?? BANDS[0];

const courses = readdirSync('src/lib/courses')
	.filter((f) => f.endsWith('.json'))
	.map((f) => JSON.parse(readFileSync(`src/lib/courses/${f}`, 'utf8')));

/** One shared graph: posKey -> { fen, edges: Map<san, childKey> }. Courses are separated again on output. */
const graph = new Map();
const membership = new Map(courses.map((c) => [c.id, new Set()]));
for (const course of courses) {
	for (const line of course.chapters.flatMap((ch) => ch.lines)) {
		const chess = new Chess();
		chess.loadPgn(line.pgn);
		const replay = new Chess();
		for (const move of chess.history()) {
			const from = key(replay.fen());
			const fen = replay.fen();
			replay.move(move);
			const to = key(replay.fen());
			if (!graph.has(from)) graph.set(from, { fen, edges: new Map() });
			graph.get(from).edges.set(clean(move), to);
			membership.get(course.id).add(from);
		}
	}
}
const START = key(new Chess().fen());

/** posKey -> band -> san -> count */
const counts = new Map();
function record(node, b, san) {
	let bands = counts.get(node);
	if (!bands) counts.set(node, (bands = new Map()));
	let moves = bands.get(b);
	if (!moves) bands.set(b, (moves = new Map()));
	moves.set(san, (moves.get(san) ?? 0) + 1);
}

function walk(movetext, whiteElo, blackElo) {
	const text = movetext.length > MAX_TEXT ? movetext.slice(0, MAX_TEXT) : movetext;
	const tokens = (text.includes('{') ? text.replace(/\{[^}]*\}/g, ' ') : text).split(' ');
	let node = START;
	let white = true;
	for (const raw of tokens) {
		if (!raw || raw.endsWith('.') || raw === '1-0' || raw === '0-1' || raw === '1/2-1/2' || raw === '*') continue;
		if (raw.charCodeAt(0) === 36 /* $ NAG */) continue;
		const san = clean(raw);
		record(node, band(white ? whiteElo : blackElo), san);
		const next = graph.get(node)?.edges.get(san);
		if (!next || !graph.has(next)) return;
		node = next;
		white = !white;
	}
}

let games = 0;
let kept = 0;
const started = Date.now();
const streams = [];

/** Line parser with its own header state, one per stream. */
function reader() {
	let whiteElo = 0;
	let blackElo = 0;
	let fast = false;
	return (l) => {
		if (l.charCodeAt(0) === 91 /* [ */) {
			if (l.startsWith('[WhiteElo ')) whiteElo = Number(l.slice(11, -2));
			else if (l.startsWith('[BlackElo ')) blackElo = Number(l.slice(11, -2));
			else if (l.startsWith('[TimeControl ')) {
				const [base, inc] = l.slice(14, -2).split('+').map(Number);
				fast = !(base + 40 * (inc || 0) >= 180);
			}
			return;
		}
		if (!l.startsWith('1.')) return;
		const counted = whiteElo > 0 && blackElo > 0;
		if (counted) games++;
		if (counted && !fast) {
			kept++;
			walk(l, whiteElo, blackElo);
		}
		whiteElo = blackElo = 0;
		fast = false;
		if (counted && games % 500_000 === 0) {
			const secs = (Date.now() - started) / 1000;
			process.stderr.write(`${games.toLocaleString()} games, ${Math.round(games / secs).toLocaleString()}/s\n`);
			// Lichess throttles downloads, so a long run checkpoints its output.
			if (games % 1_000_000 === 0) write();
		}
		if (games >= LIMIT) finish();
	};
}

const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);

function stream(offset) {
	const curl = spawn('curl', ['-s', '-r', `${offset}-`, URL]);
	const zstd = spawn('zstd', ['-dcq']);
	streams.push(curl, zstd);
	let synced = offset === 0;
	let head = Buffer.alloc(0);
	curl.stdout.on('data', (chunk) => {
		if (synced) return void zstd.stdin.write(chunk);
		head = Buffer.concat([head, chunk]);
		const at = head.indexOf(MAGIC);
		if (at < 0) return;
		synced = true;
		zstd.stdin.write(head.subarray(at));
	});
	curl.stdout.on('end', () => zstd.stdin.end());
	zstd.stdin.on('error', () => {});
	zstd.on('error', () => {});
	const line = reader();
	let buffer = '';
	zstd.stdout.setEncoding('utf8');
	zstd.stdout.on('data', (text) => {
		buffer += text;
		let from = 0;
		let nl;
		while ((nl = buffer.indexOf('\n', from)) !== -1) {
			line(buffer.slice(from, nl));
			from = nl + 1;
		}
		buffer = buffer.slice(from);
	});
	return new Promise((resolve) => zstd.on('close', resolve));
}

function write() {
	mkdirSync('static/data/explorer', { recursive: true });
	for (const course of courses) {
		const nodes = {};
		for (const node of membership.get(course.id)) {
			const bands = counts.get(node);
			if (!bands) continue;
			const fen = graph.get(node).fen;
			const out = {};
			for (const [b, moves] of bands) {
				const total = [...moves.values()].reduce((s, n) => s + n, 0);
				if (total < MIN_TOTAL) continue;
				const kept = [...moves]
					.filter(([, n]) => n / total >= MIN_SHARE)
					.sort((a, b) => b[1] - a[1])
					.map(([san, n]) => {
						const chess = new Chess(fen);
						try {
							const m = chess.move(san);
							return [m.lan, n];
						} catch {
							return undefined;
						}
					})
					.filter(Boolean);
				if (kept.length) out[b] = kept;
			}
			if (Object.keys(out).length) nodes[node] = out;
		}
		const file = `static/data/explorer/${course.id}.json`;
		const json = JSON.stringify({ games: kept, month: MONTH, bands: BANDS, nodes });
		writeFileSync(file, json);
		process.stderr.write(`${file}: ${Object.keys(nodes).length} positions, ${(json.length / 1024).toFixed(0)} KB\n`);
	}
}

function finish() {
	for (const p of streams) p.kill();
	write();
	const secs = (Date.now() - started) / 1000;
	process.stderr.write(`done: ${games.toLocaleString()} games read, ${kept.toLocaleString()} kept, ${secs.toFixed(0)} s, ${Math.round(games / secs).toLocaleString()}/s\n`);
	process.exit(0);
}

const size = Number(
	execFileSync('curl', ['-sI', URL], { encoding: 'utf8' }).match(/content-length:\s*(\d+)/i)?.[1] ?? 0
);
if (!size) throw new Error(`No dump at ${URL}`);
process.stderr.write(`${MONTH}: ${(size / 1e9).toFixed(1)} GB, ${STREAMS} streams\n`);
await Promise.all(Array.from({ length: STREAMS }, (_, i) => stream(Math.floor((i * size) / STREAMS))));
finish();
