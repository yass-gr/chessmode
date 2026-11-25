#!/usr/bin/env node
// Validates a course file: structure, legal moves, one student move per position,
// note conflicts, quizzes, and (unless --no-engine) a Stockfish check of every student move.
//
//   node scripts/validate-course.mjs src/lib/courses/caro-kann.json [--depth 16] [--no-engine] [--workers 4]
//
// Exit code 1 on errors. Engine findings are printed as warnings (review them by hand).

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chess } from 'chess.js';
import { spawn } from 'node:child_process';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--') && a.endsWith('.json'));
const opt = (name, def) => {
	const i = args.indexOf(`--${name}`);
	return i >= 0 ? args[i + 1] : def;
};
const useEngine = !args.includes('--no-engine');
const depth = +opt('depth', 16);
const workers = +opt('workers', 4);
if (!file) {
	console.error('usage: validate-course.mjs <course.json> [--depth 16] [--no-engine]');
	process.exit(2);
}

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

const course = JSON.parse(readFileSync(file, 'utf8'));

// ---------- PGN tokenizer (same rules as src/lib/courses/parse.ts) ----------
export function tokenize(pgn) {
	const out = [];
	let i = 0;
	while (i < pgn.length) {
		const c = pgn[i];
		if (/\s/.test(c)) { i++; continue; }
		if (c === '{') {
			const j = pgn.indexOf('}', i);
			if (j < 0) throw new Error('unclosed {');
			const text = pgn.slice(i + 1, j).trim().replace(/\s+/g, ' ');
			if (!out.length || out[out.length - 1].type !== 'move') throw new Error('comment before any move');
			const last = out[out.length - 1];
			last.note = last.note ? last.note + ' ' + text : text;
			i = j + 1;
			continue;
		}
		if (c === '(' || c === ')') throw new Error('variations are not allowed');
		let j = i;
		while (j < pgn.length && !/[\s{}()]/.test(pgn[j])) j++;
		let tok = pgn.slice(i, j);
		i = j;
		tok = tok.replace(/^\d+\.(\.\.)?/, '');
		if (!tok) continue;
		if (/^(1-0|0-1|1\/2-1\/2|\*)$/.test(tok)) throw new Error('results are not allowed');
		if (tok.startsWith('$')) throw new Error('NAGs are not allowed');
		out.push({ type: 'move', san: tok });
	}
	return out;
}

const posKey = (fen) => fen.split(' ').slice(0, 4).join(' ');

// ---------- structure ----------
const need = (obj, keys, where) => {
	for (const k of keys) if (obj[k] === undefined || obj[k] === '') err(`${where}: missing "${k}"`);
};
need(course, ['id', 'name', 'side', 'tagline', 'description', 'chapters'], 'course');
if (!['w', 'b'].includes(course.side)) err('course.side must be "w" or "b"');
const side = course.side;

const ids = new Set();
const chapterIds = new Set();
const studentMove = new Map(); // posKey -> {san, uci, fen, where}
const noteAt = new Map(); // posKey|san -> note
const oppMoves = new Map(); // posKey -> Set(san)
const lineEnds = [];
let lineCount = 0;
let plyTotal = 0;

for (const ch of course.chapters ?? []) {
	const cw = `chapter ${ch.id}`;
	need(ch, ['id', 'name', 'intro', 'lines'], cw);
	if (chapterIds.has(ch.id)) err(`${cw}: duplicate chapter id`);
	chapterIds.add(ch.id);
	for (const line of ch.lines ?? []) {
		const lw = `${ch.id}/${line.id}`;
		need(line, ['id', 'name', 'pgn'], lw);
		if (ids.has(line.id)) err(`${lw}: duplicate line id`);
		ids.add(line.id);
		lineCount++;
		let toks;
		try {
			toks = tokenize(line.pgn);
		} catch (e) {
			err(`${lw}: ${e.message}`);
			continue;
		}
		const g = new Chess();
		let ok = true;
		for (const [n, t] of toks.entries()) {
			const fenBefore = g.fen();
			const key = posKey(fenBefore);
			const turn = g.turn();
			let mv;
			try {
				mv = g.move(t.san);
			} catch {
				err(`${lw}: illegal move "${t.san}" at ply ${n + 1}`);
				ok = false;
				break;
			}
			if (mv.san !== t.san) warn(`${lw}: "${t.san}" should be written "${mv.san}"`);
			const uci = mv.from + mv.to + (mv.promotion ?? '');
			if (turn === side) {
				const prev = studentMove.get(key);
				if (prev && prev.san !== mv.san)
					err(`${lw}: plays ${mv.san} but ${prev.where} plays ${prev.san} in the same position (${fenBefore})`);
				else if (!prev) studentMove.set(key, { san: mv.san, uci, fen: fenBefore, where: lw, ply: n + 1 });
			} else {
				if (!oppMoves.has(key)) oppMoves.set(key, new Set());
				oppMoves.get(key).add(mv.san);
			}
			if (t.note) {
				const nk = key + '|' + mv.san;
				const prev = noteAt.get(nk);
				if (prev && prev.note !== t.note)
					err(`${lw}: different note on ${mv.san} than ${prev.where} (keep one, or make them identical)`);
				else if (!prev) noteAt.set(nk, { note: t.note, where: lw });
				if (t.note.length > 420) warn(`${lw}: long note on ${mv.san} (${t.note.length} chars)`);
			}
		}
		if (!ok) continue;
		plyTotal += toks.length;
		const lastTurn = g.turn() === 'w' ? 'b' : 'w';
		if (lastTurn !== side) warn(`${lw}: ends on an opponent move`);
		if (toks.length < 8) warn(`${lw}: very short (${toks.length} plies)`);
		const notes = toks.filter((t) => t.note).length;
		if (notes === 0) warn(`${lw}: no notes at all`);
		lineEnds.push({ where: lw, fen: g.fen() });
	}
	for (const [qi, q] of (ch.quiz ?? []).entries()) {
		const qw = `${ch.id}/quiz ${qi + 1}`;
		need(q, ['pgn', 'question', 'options', 'explanation'], qw);
		if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 4) err(`${qw}: 2–4 options`);
		if (!(q.answer >= 0 && q.answer < (q.options?.length ?? 0))) err(`${qw}: answer index out of range`);
		try {
			const g = new Chess();
			for (const t of tokenize(q.pgn)) g.move(t.san);
		} catch (e) {
			err(`${qw}: bad pgn (${e.message})`);
		}
	}
}

// Lines that are strict prefixes of other lines add nothing.
{
	const all = [];
	for (const ch of course.chapters ?? [])
		for (const l of ch.lines ?? []) {
			try {
				all.push({ id: l.id, sans: tokenize(l.pgn).map((t) => t.san).join(' ') });
			} catch {}
		}
	for (const a of all)
		for (const b of all)
			if (a !== b && b.sans.startsWith(a.sans + ' ')) warn(`${a.id} is a prefix of ${b.id}`);
}

console.log(`\n${course.name}: ${course.chapters?.length ?? 0} chapters, ${lineCount} lines, ${plyTotal} plies, ` +
	`${studentMove.size} student positions, ${noteAt.size} notes`);

// ---------- engine ----------
const cachePath = join(here, '.engine-cache.json');
const cache = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf8')) : {};

function makeEngine() {
	const path = require('stockfish').findEngine('single');
	const child = spawn(process.execPath, [path], { stdio: ['pipe', 'pipe', 'inherit'] });
	let resolve = null;
	let lines = [];
	let buf = '';
	child.stdout.on('data', (d) => {
		buf += d;
		let i;
		while ((i = buf.indexOf('\n')) >= 0) {
			const l = buf.slice(0, i).trim();
			buf = buf.slice(i + 1);
			lines.push(l);
			if (l.startsWith('bestmove') && resolve) {
				const r = resolve;
				resolve = null;
				r(lines);
			}
		}
	});
	const send = (c) => child.stdin.write(c + '\n');
	send('uci');
	send('setoption name Hash value 128');
	return {
		run(cmds) {
			return new Promise((res) => {
				lines = [];
				resolve = res;
				for (const c of cmds) send(c);
			});
		},
		quit: () => child.kill()
	};
}

function lastScore(lines, pv = 1) {
	let s = null;
	for (const l of lines) {
		const m = l.match(/ depth (\d+) .*?multipv (\d+) score (cp|mate) (-?\d+).* pv (\S+)/);
		if (m && +m[2] === pv) s = { depth: +m[1], cp: m[3] === 'cp' ? +m[4] : (+m[4] > 0 ? 100000 - +m[4] : -100000 - +m[4]), move: m[5] };
	}
	return s;
}
const winPct = (cp) => 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * Math.max(-1000, Math.min(1000, cp)))) - 1);
const fmt = (cp) => (Math.abs(cp) > 50000 ? (cp > 0 ? '#' : '-#') : (cp / 100).toFixed(2));

async function analyse(fen, uci) {
	const k = `${depth}|${fen}|${uci ?? ''}`;
	if (cache[k]) return cache[k];
	const eng = pool.pop() ?? makeEngine();
	const cmds = [`position fen ${fen}`, `go depth ${depth}${uci ? ' searchmoves ' + uci : ''}`];
	const out = lastScore(await eng.run(cmds));
	pool.push(eng);
	cache[k] = out;
	return out;
}
const pool = [];

if (useEngine && errors.length === 0) {
	const jobs = [...studentMove.values()];
	console.log(`engine: checking ${jobs.length} student moves at depth ${depth} with ${workers} workers…`);
	let done = 0;
	const findings = [];
	const queue = jobs.slice();
	await Promise.all(
		Array.from({ length: workers }, async () => {
			while (queue.length) {
				const j = queue.shift();
				const best = await analyse(j.fen, null);
				const played = await analyse(j.fen, j.uci);
				done++;
				if (done % 20 === 0) process.stdout.write(`  ${done}/${jobs.length}\n`);
				if (!best || !played) continue;
				const loss = winPct(best.cp) - winPct(played.cp);
				if (loss > 4 && best.move !== j.uci) {
					const g = new Chess(j.fen);
					let bestSan = best.move;
					try { bestSan = g.move({ from: best.move.slice(0, 2), to: best.move.slice(2, 4), promotion: best.move[4] }).san; } catch {}
					findings.push({ loss, msg: `${j.where} ply ${j.ply}: ${j.san} ${fmt(played.cp)} vs engine ${bestSan} ${fmt(best.cp)} (−${loss.toFixed(1)}% win chance)` });
				}
			}
		})
	);
	findings.sort((a, b) => b.loss - a.loss);
	for (const f of findings) warn(`engine: ${f.msg}`);

	// Final positions, from the student's point of view.
	const endQueue = lineEnds.slice();
	const ends = [];
	await Promise.all(
		Array.from({ length: workers }, async () => {
			while (endQueue.length) {
				const le = endQueue.shift();
				const s = await analyse(le.fen, null);
				if (!s) continue;
				const turn = le.fen.split(' ')[1];
				const forStudent = turn === side ? s.cp : -s.cp;
				ends.push({ ...le, cp: forStudent });
			}
		})
	);
	for (const e of ends.sort((a, b) => a.cp - b.cp))
		if (e.cp < -80) warn(`engine: ${e.where} ends at ${fmt(e.cp)} for the student`);
	console.log('\nline-end evals (student POV):');
	for (const e of ends.sort((a, b) => a.where.localeCompare(b.where))) console.log(`  ${fmt(e.cp).padStart(6)}  ${e.where}`);
	pool.forEach((e) => e.quit());
	writeFileSync(cachePath, JSON.stringify(cache));
}

for (const w of warnings) console.log('WARN  ' + w);
for (const e of errors) console.log('ERROR ' + e);
console.log(`\n${errors.length} errors, ${warnings.length} warnings`);
process.exit(errors.length ? 1 : 0);
