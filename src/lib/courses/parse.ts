import { Chess } from 'chess.js';
import { posKey, type Fen, type San, type Uci } from '#lib/chess/types.ts';
import type { Course, CourseFile, CourseId, CoursePly, LineKey, RepertoireNode } from '#lib/courses/types.ts';

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

function plies(pgn: string, side: CourseFile['side']): CoursePly[] {
	const game = new Chess();
	return tokenize(pgn).map(({ san, note }) => {
		const fenBefore = game.fen() as Fen;
		const move = game.move(san);
		return { san: move.san as San, uci: (move.from + move.to + (move.promotion ?? '')) as Uci,
			color: move.color, fenBefore, fenAfter: game.fen() as Fen, student: move.color === side, ...(note ? { note } : {}) };
	});
}

export function parseCourse(file: CourseFile): Course {
	const repertoire = new Map<ReturnType<typeof posKey>, RepertoireNode>();
	const chapters = file.chapters.map(chapter => ({ ...chapter,
		lines: chapter.lines.map(line => ({ id: line.id, name: line.name, chapterId: chapter.id,
			key: `${file.id}/${line.id}` as LineKey, plies: plies(line.pgn, file.side) })),
		quiz: (chapter.quiz ?? []).map(quiz => ({ ...quiz, plies: plies(quiz.pgn, file.side) }))
	}));
	const lines = chapters.flatMap(chapter => chapter.lines);
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
	return { id: file.id as CourseId, name: file.name, side: file.side, level: file.level,
		tagline: file.tagline, description: file.description, chapters, lines, repertoire };
}
