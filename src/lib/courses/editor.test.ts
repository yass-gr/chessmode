import { describe, expect, it } from 'vitest';
import { buildCourse, buildPgnCourse, exportCoursePgn, readPgnTree } from '#lib/courses/pgn-tree.ts';
import { diffReimport } from '#lib/courses/custom.ts';
import { locateFen, playMove, positionAt, readPlies, setAnnotation, truncateAt, writePlies } from '#lib/courses/editor.ts';
import type { CourseFile } from '#lib/courses/types.ts';

const fileFor = (pgn: string, side: 'w' | 'b' = 'w') => buildCourse(readPgnTree(pgn).tree, { id: 'custom-test', name: 'Test', side }).file;
const cursor = (file: CourseFile, ply = 0) => ({ chapterId: file.chapters[0].id, lineId: file.chapters[0].lines[0].id, ply });

describe('board editing', () => {
	it('splits arrows and circles out of a move comment', () => {
		const plies = readPlies('1. e4 { Attack [%cal Ge2e4,Re7e5] [%csl Ye4] } e5');
		expect(writePlies(plies)).toBe('1. e4 { Attack [%cal Ge2e4,Re7e5] [%csl Ye4] } e5');
		expect(positionAt(plies.length ? writePlies(plies) : '', 1).marks).toEqual([
			{ color: 'G', from: 'e2', to: 'e4' },
			{ color: 'R', from: 'e7', to: 'e5' },
			{ color: 'Y', from: 'e4' }
		]);
	});

	it('appends, switches, forks and replaces from the board', () => {
		const file = fileFor('1. e4 e5 (1... c5) *');
		const start = cursor(file);
		const appended = playMove(file, { ...start, ply: 2 }, 'b1c3');
		expect(readPlies(appended.file.chapters[0].lines[0].pgn).map((ply) => ply.san)).toEqual(['e4', 'e5', 'Nc3']);
		const switched = playMove(file, start, 'e2e4');
		const toC5 = playMove(switched.file, { ...switched.cursor, ply: 1 }, 'c7c5');
		expect(toC5.file).toBe(file);
		expect(toC5.cursor.lineId).not.toBe(start.lineId);
		const forked = playMove(file, { ...start, ply: 1 }, 'e7e6');
		expect(forked.file.chapters[0].lines).toHaveLength(3);
		expect(forked.cursor.lineId).toBe('line-3');
		const only = fileFor('1. e4 e5 2. Nf3 *');
		const replaced = playMove(only, { ...cursor(only), ply: 2 }, 'f1c4');
		expect(readPlies(replaced.file.chapters[0].lines[0].pgn).map((ply) => ply.san)).toEqual(['e4', 'e5', 'Bc4']);
	});

	it('refuses a second move for the student and keeps the line', () => {
		const file = fileFor('1. e4 e5 (1... c5) *');
		const result = playMove(file, cursor(file), 'd2d4');
		expect(result.file).toBe(file);
		expect(result.cursor).toEqual(cursor(file));
		expect(result.error).toMatch(/Conflicting student moves/);
	});

	it('writes annotations onto every line through that position', () => {
		const file = fileFor('1. e4 e5 (1... c5) *');
		const marked = setAnnotation(file, { ...cursor(file), ply: 1 }, 'Open', [{ color: 'G', from: 'e2', to: 'e4' }, { color: 'Y', from: 'e4' }]);
		for (const line of marked.chapters[0].lines) expect(line.pgn).toContain('[%cal Ge2e4]');
		expect(positionAt(marked.chapters[0].lines[0].pgn, 1).note).toBe('Open');
		expect(setAnnotation(file, cursor(file), 'Start', [])).toBe(file);
	});

	it('finds a gap position and drops the moves after the cursor', () => {
		const file = fileFor('1. e4 e5 2. Nf3 *');
		const fen = readPlies(file.chapters[0].lines[0].pgn)[1].fenAfter;
		expect(locateFen(file, fen)).toEqual({ ...cursor(file), ply: 2 });
		const cut = truncateAt(file, { ...cursor(file), ply: 1 });
		expect(readPlies(cut.file.chapters[0].lines[0].pgn).map((ply) => ply.san)).toEqual(['e4']);
	});
});

describe('reimport report', () => {
	it('counts added, changed and removed lines against kept progress', () => {
		const old = fileFor('1. e4 e5 (1... c5 2. Nf3) 2. Nf3 *');
		const updated = fileFor('1. e4 c5 (1... e5 2. Bc4) 2. Nf3 *');
		const keptId = old.chapters[0].lines[1].id;
		const report = diffReimport(old, updated, [`${old.id}/${keptId}`, `${old.id}/missing`]);
		expect(report.kept.map((line) => line.id)).toEqual([keptId]);
		expect(report.changed).toHaveLength(1);
		expect(report.added).toHaveLength(0);
		expect(report.removed).toHaveLength(0);
		expect(report.progressKept).toBe(1);
		expect(report.progressTotal).toBe(2);
		const replaced = diffReimport(fileFor('1. e4 e5 *'), fileFor('1. d4 d5 *'), [`custom-test/line-1`]);
		expect(replaced.added).toHaveLength(1);
		expect(replaced.removed).toHaveLength(1);
		expect(replaced.changed).toHaveLength(0);
		expect(replaced.progressKept).toBe(0);
	});

	it('round trips an edited annotation through chapter export', () => {
		const file = fileFor('1. e4 e5 *');
		const marked = setAnnotation(file, { ...cursor(file), ply: 2 }, '', [{ color: 'B', from: 'f3' }]);
		const again = buildPgnCourse(exportCoursePgn(marked), { id: file.id, name: file.name, side: 'w' }).file;
		expect(again.chapters[0].lines[0].pgn).toContain('[%csl Bf3]');
	});
});
