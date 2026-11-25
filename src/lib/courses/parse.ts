import { Chess } from 'chess.js';
import { posKey, START_FEN, type Fen, type San, type Uci } from '#lib/chess/types.ts';
import type { Chapter, Course, CourseFile, CourseId, CoursePly, Line, LineKey, RepertoireNode } from '#lib/courses/types.ts';

export function tokenize(pgn: string): { san: string; note?: string }[] {
	const moves: { san: string; note?: string }[] = [];
	let i = 0;
	while (i < pgn.length) {
		const c = pgn[i];
		if (/\s/.test(c)) { i++; continue; }
		if (c === '{') {
			const end = pgn.indexOf('}', i);
			if (end < 0) throw new Error('unclosed {');
			const last = moves.at(-1);
			if (!last) throw new Error('comment before any move');
			const note = pgn.slice(i + 1, end).trim().replace(/\s+/g, ' ');
			last.note = last.note ? `${last.note} ${note}` : note;
			i = end + 1;
			continue;
		}
		if (c === '(' || c === ')') throw new Error('variations are not allowed');
		let end = i;
		while (end < pgn.length && !/[\s{}()]/.test(pgn[end])) end++;
		const token = pgn.slice(i, end).replace(/^\d+\.(\.\.)?/, '');
		i = end;
		if (!token) continue;
		if (/^(1-0|0-1|1\/2-1\/2|\*)$/.test(token)) throw new Error('results are not allowed');
		if (token.startsWith('$')) throw new Error('NAGs are not allowed');
		moves.push({ san: token });
	}
	return moves;
}

type Step = Pick<CoursePly, 'san' | 'uci' | 'color' | 'fenBefore' | 'fenAfter'>;

/**
 * Course lines share long opening prefixes, so each (position, move) is played through chess.js once
 * and reused; replaying every line from move one made startup grow with the catalog.
 */
const steps = new Map<string, Step>();

function plies(pgn: string, side: CourseFile['side']): CoursePly[] {
	let fen = START_FEN;
	/** In sync with `fen` while defined; a cache hit moves `fen` on without it. */
	let game: Chess | undefined = new Chess();
	return tokenize(pgn).map(({ san, note }) => {
		const key = `${fen}|${san}`;
		let step = steps.get(key);
		if (step) game = undefined;
		else {
			game ??= new Chess(fen);
			const move = game.move(san);
			step = { san: move.san as San, uci: (move.from + move.to + (move.promotion ?? '')) as Uci, color: move.color, fenBefore: fen, fenAfter: game.fen() as Fen };
			steps.set(key, step);
		}
		fen = step.fenAfter;
		return { ...step, student: step.color === side, ...(note ? { note } : {}) };
	});
}

/** Defines `key` on `obj` as computed on first read, then stored. */
function later<T extends object, K extends PropertyKey, V>(obj: T, key: K, make: () => V): T & Record<K, V> {
	Object.defineProperty(obj, key, {
		configurable: true,
		enumerable: true,
		get() {
			const value = make();
			Object.defineProperty(obj, key, { value, enumerable: true });
			return value;
		}
	});
	return obj as T & Record<K, V>;
}

function buildRepertoire(lines: Line[]): Course['repertoire'] {
	const repertoire = new Map<ReturnType<typeof posKey>, RepertoireNode>();
	for (const line of lines) for (const ply of line.plies) {
		const key = posKey(ply.fenBefore);
		const node = repertoire.get(key) ?? { replies: [], lines: [] };
		if (ply.student) {
			if (node.student && node.student.uci !== ply.uci) throw new Error(`Conflicting student moves at ${key}`);
			node.student ??= ply;
		} else if (!node.replies.some(reply => reply.uci === ply.uci)) node.replies.push(ply);
		if (!node.lines.includes(line.key)) node.lines.push(line.key);
		repertoire.set(key, node);
	}
	return repertoire;
}

/**
 * A course whose moves are replayed only when something reads them: a line's `plies` on first use,
 * the `repertoire` when a feature needs every position. Bundled courses load this way, so startup
 * does not grow with the catalog; `scripts/validate-course.mjs` and the tests check them strictly.
 */
export function lazyCourse(file: CourseFile): Course {
	const chapters: Chapter[] = file.chapters.map(chapter => {
		const lines = chapter.lines.map(line => later(
			{ id: line.id, name: line.name, chapterId: chapter.id, key: `${file.id}/${line.id}` as LineKey },
			'plies', () => plies(line.pgn, file.side)));
		const quiz = (chapter.quiz ?? []).map(({ pgn, ...rest }) => later(rest, 'plies', () => plies(pgn, file.side)));
		return { id: chapter.id, name: chapter.name, intro: chapter.intro, ...(chapter.moves ? { moves: chapter.moves } : {}), lines, quiz };
	});
	const lines = chapters.flatMap(chapter => chapter.lines);
	const course = { id: file.id as CourseId, name: file.name, side: file.side, level: file.level,
		tagline: file.tagline, description: file.description, chapters, lines };
	return later(course, 'repertoire', () => buildRepertoire(lines));
}

/** Replays every move now and rejects conflicting student moves; for data the student supplies. */
export function parseCourse(file: CourseFile): Course {
	const course = lazyCourse(file);
	void course.repertoire;
	for (const chapter of course.chapters) for (const quiz of chapter.quiz) void quiz.plies;
	return course;
}
