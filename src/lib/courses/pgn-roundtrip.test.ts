import { describe, expect, it } from 'vitest';
import { buildCourse, buildPgnCourse, exportCoursePgn, readPgnTree } from '#lib/courses/pgn-tree.ts';
import { parseCourse } from '#lib/courses/parse.ts';
import { preserveLineIds } from '#lib/courses/custom.ts';

const build = (pgn: string) => buildCourse(readPgnTree(pgn).tree, { id: 'custom-test', name: 'Test', side: 'w' }).file;

describe('course PGN', () => {
	it('round trips branches and notes on both sides', () => {
		const original = build('1. e4 {First} e5 {Reply} 2. Nf3 (2. Bc4) *');
		// Use opponent branches because a repertoire keeps one move for the student.
		const branched = build('1. e4 {First} e5 {Reply} (1... c5 {Sicilian}) 2. Nf3 *');
		const again = build(exportCoursePgn(branched));
		expect(parseCourse(again).lines.map(l => l.plies.map(p => [p.uci, p.note]))).toEqual(parseCourse(branched).lines.map(l => l.plies.map(p => [p.uci, p.note])));
		expect(original.chapters[0].lines).toHaveLength(1);
	});
	it('preserves chapters and board directives through export and reimport', () => {
		const source = '[Chapter "Open"]\n\n1. e4 { Attack [%cal Ge2e4,Re7e5] [%csl Ye4] } e5 *\n\n[Chapter "Sicilian"]\n\n1. e4 c5 { [%cal Gc5c4] } 2. Nf3 *';
		const options = { id: 'custom-test', name: 'Test', side: 'w' as const };
		const original = buildPgnCourse(source, options).file;
		const again = buildPgnCourse(exportCoursePgn(original), options).file;
		expect(again.chapters.map((chapter) => [chapter.name, chapter.lines.map((line) => line.pgn)])).toEqual(original.chapters.map((chapter) => [chapter.name, chapter.lines.map((line) => line.pgn)]));
		expect(again.chapters[0].lines[0].pgn).toContain('[%csl Ye4]');
	});
	it('keeps authored line names and chapter intros', () => {
		const source = '[Chapter "Open"]\n[Line "Center"]\n[Intro "Play e4."]\n\n1. e4 e5 *';
		const options = { id: 'custom-test', name: 'Test', side: 'w' as const };
		const file = buildPgnCourse(source, options).file;
		expect(file.chapters[0].intro).toBe('Play e4.');
		expect(file.chapters[0].lines[0].name).toBe('Center');
		const again = buildPgnCourse(exportCoursePgn(file), options).file;
		expect(again.chapters[0].intro).toBe('Play e4.');
		expect(again.chapters[0].lines[0].name).toBe('Center');
	});
	it('retains IDs only for unchanged move sequences', () => {
		const old = build('1. e4 e5 (1... c5 2. Nf3) 2. Nf3 *');
		const updated = build('1. e4 c5 (1... e5 2. Bc4) 2. Nf3 *');
		const result = preserveLineIds(old, updated);
		expect(result.chapters[0].lines[0].id).toBe(old.chapters[0].lines[1].id);
		expect(result.chapters[0].lines[1].id).not.toBe(old.chapters[0].lines[0].id);
	});
	it('rejects unclosed variations and comments', () => {
		expect(() => readPgnTree('1. e4 (1. d4')).toThrow();
		expect(() => readPgnTree('1. e4 {note')).toThrow();
	});
});
