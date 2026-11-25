import { Chess, type Square } from 'chess.js';
import { START_FEN, posKey, type Fen, type Uci } from '#lib/chess/types.ts';
import type { CourseFile } from '#lib/courses/types.ts';
import { parseCourse } from '#lib/courses/parse.ts';

export const MARK_COLORS = ['G', 'R', 'Y', 'B'] as const;
export type MarkColor = (typeof MARK_COLORS)[number];

/** A Lichess [%cal] arrow or [%csl] circle. A circle has no `to` square. */
export interface BoardMark {
	color: MarkColor;
	from: string;
	to?: string;
}

export interface LinePly {
	san: string;
	uci: Uci;
	comment: string;
	fenBefore: Fen;
	fenAfter: Fen;
}

export interface EditorCursor {
	chapterId: string;
	lineId: string;
	/** 0 is the starting position. */
	ply: number;
}

export interface BoardSpot {
	ply: number;
	fen: Fen;
	note: string;
	marks: BoardMark[];
	lastMove?: [string, string];
	san?: string;
}

type Chapter = CourseFile['chapters'][number];
type Line = Chapter['lines'][number];

const SQUARE = '[a-h][1-8]';

export function splitComment(comment: string): { note: string; marks: BoardMark[] } {
	const marks: BoardMark[] = [];
	const note = comment.replace(/\[%(cal|csl)\s+([^\]]*)\]/gi, (whole, kind: string, body: string) => {
		for (const piece of body.split(/[,\s]+/)) {
			const arrow = piece.match(new RegExp(`^([GRYB])(${SQUARE})(${SQUARE})$`, 'i'));
			const circle = piece.match(new RegExp(`^([GRYB])(${SQUARE})$`, 'i'));
			if (kind.toLowerCase() === 'cal' && arrow) marks.push({ color: arrow[1].toUpperCase() as MarkColor, from: arrow[2].toLowerCase(), to: arrow[3].toLowerCase() });
			else if (kind.toLowerCase() === 'csl' && circle) marks.push({ color: circle[1].toUpperCase() as MarkColor, from: circle[2].toLowerCase() });
		}
		return whole ? ' ' : ' ';
	}).replace(/\s+/g, ' ').trim();
	return { note, marks };
}

export function joinComment(note: string, marks: BoardMark[]): string {
	const arrows = marks.filter((mark) => mark.to);
	const circles = marks.filter((mark) => !mark.to);
	const parts = [note.trim()];
	if (arrows.length) parts.push(`[%cal ${arrows.map((mark) => `${mark.color}${mark.from}${mark.to}`).join(',')}]`);
	if (circles.length) parts.push(`[%csl ${circles.map((mark) => `${mark.color}${mark.from}`).join(',')}]`);
	return parts.filter(Boolean).join(' ');
}

export function readPlies(pgn: string): LinePly[] {
	const game = new Chess();
	const plies: LinePly[] = [];
	let index = 0;
	const text = pgn.trim();
	while (index < text.length) {
		const char = text[index];
		if (/\s/.test(char)) {
			index++;
			continue;
		}
		if (char === '{') {
			const end = text.indexOf('}', index);
			if (end < 0) throw new Error('Unclosed PGN comment.');
			const comment = text.slice(index + 1, end).trim().replace(/\s+/g, ' ');
			const last = plies.at(-1);
			if (!last) throw new Error('A comment comes before any move.');
			last.comment = last.comment ? `${last.comment} ${comment}` : comment;
			index = end + 1;
			continue;
		}
		if (char === '(' || char === ')') throw new Error('Variations belong in separate lines.');
		let end = index;
		while (end < text.length && !/[\s{}()]/.test(text[end])) end++;
		const token = text.slice(index, end).replace(/^\d+\.(\.\.)?/, '').replace(/[!?]+$/, '');
		index = end;
		if (!token || /^(1-0|0-1|1\/2-1\/2|\*)$/.test(token) || token.startsWith('$')) continue;
		const fenBefore = game.fen() as Fen;
		let move;
		try {
			move = game.move(token);
		} catch {
			throw new Error(`Illegal move ${token}.`);
		}
		plies.push({
			san: move.san,
			uci: (move.from + move.to + (move.promotion ?? '')) as Uci,
			comment: '',
			fenBefore,
			fenAfter: game.fen() as Fen
		});
	}
	return plies;
}

export function writePlies(plies: Pick<LinePly, 'san' | 'comment'>[]): string {
	return plies.map((ply, index) => {
		const number = index % 2 === 0 ? `${index / 2 + 1}. ` : '';
		const comment = ply.comment.trim().replace(/[{}]/g, '');
		return `${number}${ply.san}${comment ? ` { ${comment} }` : ''}`;
	}).join(' ');
}

export function positionAt(pgn: string, ply: number): BoardSpot {
	const plies = readPlies(pgn);
	const index = Math.max(0, Math.min(ply, plies.length));
	if (index === 0) return { ply: 0, fen: START_FEN, note: '', marks: [] };
	const current = plies[index - 1];
	const { note, marks } = splitComment(current.comment);
	return {
		ply: index,
		fen: current.fenAfter,
		note,
		marks,
		lastMove: [current.uci.slice(0, 2), current.uci.slice(2, 4)],
		san: current.san
	};
}

export function locateFen(file: CourseFile, fen: string): EditorCursor | undefined {
	const key = posKey(fen);
	for (const chapter of file.chapters) {
		for (const line of chapter.lines) {
			if (key === posKey(START_FEN)) return { chapterId: chapter.id, lineId: line.id, ply: 0 };
			const plies = readPlies(line.pgn);
			const index = plies.findIndex((ply) => posKey(ply.fenAfter) === key);
			if (index >= 0) return { chapterId: chapter.id, lineId: line.id, ply: index + 1 };
		}
	}
}

export function playMove(file: CourseFile, cursor: EditorCursor, uci: string): { file: CourseFile; cursor: EditorCursor; error?: string } {
	const chapter = file.chapters.find((item) => item.id === cursor.chapterId) ?? file.chapters[0];
	if (!chapter) return { file, cursor };
	const line = chapter.lines.find((item) => item.id === cursor.lineId);
	const plies = line ? readPlies(line.pgn) : [];
	const ply = Math.max(0, Math.min(cursor.ply, plies.length));
	const fen = ply === 0 ? START_FEN : plies[ply - 1].fenAfter;
	const played = moveUci(fen, uci);
	if (!played) return { file, cursor, error: 'That move is not legal here.' };
	const stay: EditorCursor = { chapterId: chapter.id, lineId: line?.id ?? '', ply };
	const stem = plies.slice(0, ply).map((item) => item.uci).join(' ');
	if (plies[ply]?.uci === played.uci) return { file, cursor: { chapterId: chapter.id, lineId: line!.id, ply: ply + 1 } };
	for (const other of chapter.lines) {
		const otherPlies = other.id === line?.id ? plies : readPlies(other.pgn);
		const sameStem = otherPlies.slice(0, ply).map((item) => item.uci).join(' ') === stem;
		if (sameStem && otherPlies[ply]?.uci === played.uci) return { file, cursor: { chapterId: chapter.id, lineId: other.id, ply: ply + 1 } };
	}
	const nextPlies = [...plies.slice(0, ply), emptyPly(played, fen)];
	const shared = !!line && chapter.lines.some((other) => {
		if (other.id === line.id) return false;
		const otherPlies = readPlies(other.pgn);
		return otherPlies.length >= ply && otherPlies.slice(0, ply).map((item) => item.uci).join(' ') === stem;
	});
	if (line && ply === plies.length) {
		const next = replaceLine(file, chapter.id, line.id, { ...line, pgn: writePlies(nextPlies) });
		return accept(file, next, { chapterId: chapter.id, lineId: line.id, ply: ply + 1 }, stay);
	}
	if (line && !shared) {
		const next = replaceLine(file, chapter.id, line.id, { ...line, pgn: writePlies(nextPlies) });
		return accept(file, next, { chapterId: chapter.id, lineId: line.id, ply: nextPlies.length }, stay);
	}
	const created: Line = { id: nextId(file, 'line'), name: plies.length ? branchName(nextPlies) : 'Main line', pgn: writePlies(nextPlies) };
	const next = mapChapter(file, chapter.id, (item) => ({ ...item, lines: [...item.lines, created] }));
	return accept(file, next, { chapterId: chapter.id, lineId: created.id, ply: nextPlies.length }, stay);
}

export function setAnnotation(file: CourseFile, cursor: EditorCursor, note: string, marks: BoardMark[]): CourseFile {
	if (cursor.ply < 1) return file;
	const chapter = file.chapters.find((item) => item.id === cursor.chapterId);
	const line = chapter?.lines.find((item) => item.id === cursor.lineId);
	if (!chapter || !line) return file;
	const source = readPlies(line.pgn);
	if (cursor.ply > source.length) return file;
	const key = source.slice(0, cursor.ply).map((ply) => ply.uci).join(' ');
	const comment = joinComment(note, marks);
	return mapChapter(file, chapter.id, (item) => ({
		...item,
		lines: item.lines.map((entry) => {
			const plies = entry.id === line.id ? source : readPlies(entry.pgn);
			if (plies.length < cursor.ply || plies.slice(0, cursor.ply).map((ply) => ply.uci).join(' ') !== key) return entry;
			const next = plies.map((ply, index) => index === cursor.ply - 1 ? { ...ply, comment } : ply);
			return { ...entry, pgn: writePlies(next) };
		})
	}));
}

export function truncateAt(file: CourseFile, cursor: EditorCursor): { file: CourseFile; cursor: EditorCursor } {
	const chapter = file.chapters.find((item) => item.id === cursor.chapterId);
	const line = chapter?.lines.find((item) => item.id === cursor.lineId);
	if (!chapter || !line) return { file, cursor };
	const kept = readPlies(line.pgn).slice(0, cursor.ply);
	if (!kept.length) {
		const lines = chapter.lines.filter((item) => item.id !== line.id);
		const next = mapChapter(file, chapter.id, (item) => ({ ...item, lines }));
		const fallback = lines[0];
		return { file: next, cursor: { chapterId: chapter.id, lineId: fallback?.id ?? '', ply: 0 } };
	}
	return { file: replaceLine(file, chapter.id, line.id, { ...line, pgn: writePlies(kept) }), cursor: { ...cursor, ply: kept.length } };
}

export function addChapter(file: CourseFile): { file: CourseFile; cursor: EditorCursor } {
	const id = nextId(file, 'chapter');
	const chapter: Chapter = { id, name: `Chapter ${file.chapters.length + 1}`, intro: 'Lines you add on the board.', lines: [] };
	return { file: { ...file, chapters: [...file.chapters, chapter] }, cursor: { chapterId: id, lineId: '', ply: 0 } };
}

export function deleteChapter(file: CourseFile, chapterId: string): { file: CourseFile; cursor: EditorCursor } {
	const chapters = file.chapters.filter((chapter) => chapter.id !== chapterId);
	const next = chapters.length ? chapters : [{ id: 'chapter-1', name: 'Lines', intro: 'Lines you add on the board.', lines: [] }];
	const chapter = next.find((item) => item.lines.length) ?? next[0];
	return { file: { ...file, chapters: next }, cursor: { chapterId: chapter.id, lineId: chapter.lines[0]?.id ?? '', ply: 0 } };
}

export function renameChapter(file: CourseFile, chapterId: string, name: string): CourseFile {
	const trimmed = name.trim();
	if (!trimmed) return file;
	return mapChapter(file, chapterId, (chapter) => ({ ...chapter, name: trimmed }));
}

export function setIntro(file: CourseFile, chapterId: string, intro: string): CourseFile {
	return mapChapter(file, chapterId, (chapter) => ({ ...chapter, intro: intro.trim() }));
}

export function renameLine(file: CourseFile, cursor: EditorCursor, name: string): CourseFile {
	const trimmed = name.trim();
	if (!trimmed) return file;
	const chapter = file.chapters.find((item) => item.id === cursor.chapterId);
	const line = chapter?.lines.find((item) => item.id === cursor.lineId);
	if (!chapter || !line) return file;
	return replaceLine(file, chapter.id, line.id, { ...line, name: trimmed });
}

export function deleteLine(file: CourseFile, cursor: EditorCursor): { file: CourseFile; cursor: EditorCursor } {
	const chapter = file.chapters.find((item) => item.id === cursor.chapterId);
	if (!chapter) return { file, cursor };
	const lines = chapter.lines.filter((line) => line.id !== cursor.lineId);
	const fallback = lines[0];
	return {
		file: mapChapter(file, chapter.id, (item) => ({ ...item, lines })),
		cursor: { chapterId: chapter.id, lineId: fallback?.id ?? '', ply: 0 }
	};
}

export function moveLine(file: CourseFile, cursor: EditorCursor, chapterId: string): { file: CourseFile; cursor: EditorCursor; error?: string } {
	if (cursor.chapterId === chapterId) return { file, cursor };
	let moving: Line | undefined;
	const stripped = file.chapters.map((chapter) => {
		const line = chapter.lines.find((item) => item.id === cursor.lineId);
		if (!line) return chapter;
		moving = line;
		return { ...chapter, lines: chapter.lines.filter((item) => item.id !== line.id) };
	});
	if (!moving || !stripped.some((chapter) => chapter.id === chapterId)) return { file, cursor };
	const next = { ...file, chapters: stripped.map((chapter) => chapter.id === chapterId ? { ...chapter, lines: [...chapter.lines, moving!] } : chapter) };
	const checked = accept(file, next, { ...cursor, chapterId }, cursor);
	return { file: checked.file, cursor: checked.cursor, error: checked.error };
}

function accept(previous: CourseFile, file: CourseFile, cursor: EditorCursor, stay: EditorCursor) {
	try {
		parseCourse(file);
		return { file, cursor };
	} catch (error) {
		return { file: previous, cursor: stay, error: error instanceof Error ? error.message : String(error) };
	}
}

function emptyPly(played: { san: string; uci: Uci; fen: Fen }, fenBefore: Fen): LinePly {
	return { san: played.san, uci: played.uci, comment: '', fenBefore, fenAfter: played.fen };
}

function moveUci(fen: string, uci: string) {
	try {
		const game = new Chess(fen);
		const promotion = uci[4] as 'q' | 'r' | 'b' | 'n' | undefined;
		const move = game.move({ from: uci.slice(0, 2) as Square, to: uci.slice(2, 4) as Square, promotion: promotion || undefined });
		return { san: move.san, uci: (move.from + move.to + (move.promotion ?? '')) as Uci, fen: game.fen() as Fen };
	} catch {
		return undefined;
	}
}

function branchName(plies: LinePly[]) {
	const start = Math.max(0, plies.length - 2);
	return plies.slice(start).map((ply, index) => {
		const at = start + index;
		const number = Math.floor(at / 2) + 1;
		if (at % 2 === 0) return `${number}.${ply.san}`;
		return index === 0 ? `${number}…${ply.san}` : ply.san;
	}).join(' ');
}

function nextId(file: CourseFile, prefix: 'line' | 'chapter') {
	const used = new Set(prefix === 'line'
		? file.chapters.flatMap((chapter) => chapter.lines.map((line) => line.id))
		: file.chapters.map((chapter) => chapter.id));
	let serial = 1;
	while (used.has(`${prefix}-${serial}`)) serial++;
	return `${prefix}-${serial}`;
}

function mapChapter(file: CourseFile, chapterId: string, update: (chapter: Chapter) => Chapter): CourseFile {
	return { ...file, chapters: file.chapters.map((chapter) => chapter.id === chapterId ? update(chapter) : chapter) };
}

function replaceLine(file: CourseFile, chapterId: string, lineId: string, line: Line) {
	return mapChapter(file, chapterId, (chapter) => ({ ...chapter, lines: chapter.lines.map((item) => item.id === lineId ? line : item) }));
}
