import { Chess } from 'chess.js';
import type { Color, San, Uci } from '#lib/chess/types.ts';
import type { CourseFile } from '#lib/courses/types.ts';

/** A position in an imported repertoire; children are keyed by UCI so games and variations merge. */
export interface TreeNode {
	children: Map<Uci, TreeEdge>;
}

export interface TreeEdge {
	san: San;
	uci: Uci;
	note?: string;
	node: TreeNode;
}

const node = (): TreeNode => ({ children: new Map() });

type Token = { kind: 'move'; text: string } | { kind: 'comment'; text: string } | { kind: 'open' } | { kind: 'close' } | { kind: 'end' };

function tokens(movetext: string): Token[] {
	const out: Token[] = [];
	let i = 0;
	while (i < movetext.length) {
		const c = movetext[i];
		if (/\s/.test(c)) i++;
		else if (c === '{') {
			const end = movetext.indexOf('}', i);
			if (end < 0) throw new Error('Unclosed PGN comment.');
			const stop = end;
			out.push({ kind: 'comment', text: movetext.slice(i + 1, stop) });
			i = stop + 1;
		} else if (c === ';') {
			const end = movetext.indexOf('\n', i);
			i = end < 0 ? movetext.length : end;
		} else if (c === '(') {
			out.push({ kind: 'open' });
			i++;
		} else if (c === ')') {
			out.push({ kind: 'close' });
			i++;
		} else {
			let end = i;
			while (end < movetext.length && !/[\s{}();]/.test(movetext[end])) end++;
			const word = movetext.slice(i, end);
			i = end;
			if (/^(1-0|0-1|1\/2-1\/2|\*)$/.test(word)) out.push({ kind: 'end' });
			else if (word.startsWith('$')) continue;
			else {
				const san = word.replace(/^\d+\.+/, '').replace(/[!?]+$/, '');
				if (san) out.push({ kind: 'move', text: san });
			}
		}
	}
	return out;
}

/** Splits a multi-game PGN (a Lichess study export, for instance) into header text and movetext per game. */
function games(pgn: string): { headers: Record<string, string>; movetext: string }[] {
	const out: { headers: Record<string, string>; movetext: string }[] = [];
	let headers: Record<string, string> = {};
	let movetext = '';
	const flush = () => {
		if (movetext.trim()) out.push({ headers, movetext });
		headers = {};
		movetext = '';
	};
	for (const line of pgn.replace(/\r/g, '').split('\n')) {
		const header = line.match(/^\s*\[(\w+)\s+"(.*)"\]\s*$/);
		if (header) {
			if (movetext.trim()) flush();
			headers[header[1]] = header[2];
		} else movetext += line + '\n';
	}
	flush();
	return out;
}

const clean = (text: string) =>
	text
		.replace(/\[%(?!cal\b|csl\b)[^\]]*\]/g, '')
		.replace(/\s+/g, ' ')
		.trim();

const START = new Chess().fen().split(' ').slice(0, 4).join(' ');

/** Studies mix in chapters from set-up positions or other variants; those cannot be part of an opening course. */
const standard = (headers: Record<string, string>) =>
	(!headers.Variant || /^(standard|from position)$/i.test(headers.Variant)) &&
	(!headers.FEN || headers.FEN.trim().split(/\s+/).slice(0, 4).join(' ') === START);

/** Reads every standard game and variation in a PGN into one tree; `skipped` counts games from other positions or variants. */
export function readPgnTree(pgn: string): { tree: TreeNode; skipped: number } {
	const root = node();
	const list = games(pgn);
	if (!list.length) throw new Error('The PGN has no moves.');
	const usable = list.filter((g) => standard(g.headers));
	if (!usable.length) throw new Error('Every game starts from a set-up position or another variant. A course starts from the normal starting position.');
	for (const { movetext } of usable) {
		type Frame = { chess: Chess; at: TreeNode; last?: TreeEdge; before?: { chess: Chess; at: TreeNode } };
		let frame: Frame = { chess: new Chess(), at: root };
		const stack: Frame[] = [];
		for (const token of tokens(movetext)) {
			if (token.kind === 'end') break;
			if (token.kind === 'comment') {
				const text = clean(token.text);
				if (text && frame.last && frame.last.note !== text) frame.last.note = frame.last.note ? `${frame.last.note} ${text}` : text;
			} else if (token.kind === 'open') {
				if (!frame.before) throw new Error('A variation starts before any move.');
				stack.push(frame);
				frame = { chess: new Chess(frame.before.chess.fen()), at: frame.before.at };
			} else if (token.kind === 'close') {
				const outer = stack.pop();
				if (!outer) throw new Error('A variation closes that was never opened.');
				frame = outer;
			} else {
				const before = { chess: new Chess(frame.chess.fen()), at: frame.at };
				let move;
				try {
					move = frame.chess.move(token.text);
				} catch {
					throw new Error(`Illegal move ${token.text} after ${frame.chess.history().join(' ') || 'the start'}.`);
				}
				const uci = (move.from + move.to + (move.promotion ?? '')) as Uci;
				let edge = frame.at.children.get(uci);
				if (!edge) {
					edge = { san: move.san as San, uci, node: node() };
					frame.at.children.set(uci, edge);
				}
				frame = { chess: frame.chess, at: edge.node, last: edge, before };
			}
		}
		if (stack.length) throw new Error('Unclosed PGN variation.');
	}
	if (!root.children.size) throw new Error('The PGN has no moves.');
	return { tree: root, skipped: list.length - usable.length };
}

export interface BuiltCourse {
	file: CourseFile;
	/** Positions where the PGN gives the student more than one move; the first one is kept. */
	conflicts: string[];
}

/** One line per leaf of the tree, keeping the first student move wherever the PGN offers several. */
export function buildCourse(tree: TreeNode, options: { id: string; name: string; side: Color; mainLine?: string }): BuiltCourse {
	const lines: { id: string; name: string; pgn: string }[] = [];
	const conflicts: string[] = [];

	/** `split` is the ply where this branch last left its siblings; the line is named from there. */
	function walk(at: TreeNode, path: TreeEdge[], turn: Color, split = -1) {
		let edges = [...at.children.values()];
		if (turn === options.side && edges.length > 1) {
			conflicts.push(`${label(path)}: ${edges.map((e) => e.san).join(', ')}`);
			edges = edges.slice(0, 1);
		}
		if (!edges.length) {
			if (path.some((_, i) => (i % 2 === 0 ? 'w' : 'b') === options.side)) lines.push(line(path, split, lines.length));
			return;
		}
		for (const edge of edges) walk(edge.node, [...path, edge], turn === 'w' ? 'b' : 'w', edges.length > 1 ? path.length : split);
	}

	/** Moves from ply `from` on, numbered as in the game: "3.Bf4 e6 4.Nb5" or "3…e6 4.Nb5". */
	function label(path: TreeEdge[], from = 0): string {
		return (
			path
				.slice(from)
				.map((e, k) => {
					const i = from + k;
					const n = Math.floor(i / 2) + 1;
					return i % 2 === 0 ? `${n}.${e.san}` : k === 0 ? `${n}…${e.san}` : e.san;
				})
				.join(' ') || 'the start'
		);
	}

	function line(path: TreeEdge[], split: number, index: number) {
		const pgn = path
			.map((e, i) => {
				const number = i % 2 === 0 ? `${i / 2 + 1}. ` : '';
				const note = e.note ? ` { ${e.note.replace(/[{}]/g, '')} }` : '';
				return `${number}${e.san}${note}`;
			})
			.join(' ');
		const name = split < 0 ? (options.mainLine ?? 'Main line') : label(path.slice(0, split + 2), split);
		return { id: `line-${index + 1}`, name, pgn };
	}

	walk(tree, [], 'w');
	if (!lines.length) throw new Error('No line has a move for your side.');
	const file: CourseFile = {
		id: options.id,
		name: options.name,
		side: options.side,
		level: 'Your course',
		tagline: `${lines.length} ${lines.length === 1 ? 'line' : 'lines'} imported from PGN.`,
		description: 'A course you built from your own PGN.',
		chapters: [{ id: 'lines', name: 'Lines', intro: 'The lines from your PGN, one per branch.', lines, quiz: [] }]
	};
	return { file, conflicts };
}

/** Export each line as a game; shared prefixes merge again on import. */
export function exportCoursePgn(file: CourseFile): string {
	const escape = (value: string) => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
	return file.chapters.flatMap((chapter) => chapter.lines.map((line) =>
		`[Event "${escape(file.name)}"]\n[Chapter "${escape(chapter.name)}"]\n[Line "${escape(line.name)}"]\n[Intro "${escape(chapter.intro)}"]\n\n${line.pgn} *`
	)).join('\n\n');
}

/** Build separate chapters from named PGN games, merging games with the same chapter header. */
export function buildPgnCourse(pgn: string, options: { id: string; name: string; side: Color }): BuiltCourse & { skipped: number } {
	const list = games(pgn);
	const usable = list.filter((game) => standard(game.headers));
	if (!usable.length) throw new Error('No standard starting-position games found in the PGN.');
	const groups = new Map<string, typeof usable>();
	for (const game of usable) {
		const name = game.headers.Chapter || game.headers.Event || 'Lines';
		const group = groups.get(name) ?? [];
		group.push(game);
		groups.set(name, group);
	}
	let base: CourseFile | undefined;
	const chapters: CourseFile['chapters'] = [];
	const conflicts: string[] = [];
	let serial = 0;
	for (const [name, group] of groups) {
		const result = buildCourse(readPgnTree(group.map((game) => `[Event "game"]\n\n${game.movetext}`).join('\n\n')).tree, { ...options, mainLine: name });
		base ??= result.file;
		conflicts.push(...result.conflicts.map((conflict) => `${name}: ${conflict}`));
		const built = result.file.chapters[0].lines;
		const names = group.map((game) => game.headers.Line).filter((line): line is string => !!line);
		const intro = group.map((game) => game.headers.Intro).find((text) => text?.trim())?.trim();
		chapters.push({
			...result.file.chapters[0],
			id: `chapter-${chapters.length + 1}`,
			name,
			intro: intro || result.file.chapters[0].intro,
			lines: built.map((line, index) => ({ ...line, id: `line-${++serial}`, ...(names.length === built.length ? { name: names[index] } : {}) }))
		});
	}
	if (!base) throw new Error('The PGN has no moves.');
	const count = chapters.reduce((total, chapter) => total + chapter.lines.length, 0);
	const file = { ...base, chapters, tagline: `${count} ${count === 1 ? 'line' : 'lines'} imported from PGN.` };
	return { file, conflicts, skipped: list.length - usable.length };
}
