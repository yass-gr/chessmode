import { describe, expect, it } from 'vitest';
import { parseCourse } from '#lib/courses/parse.ts';
import { buildCourse, readPgnTree } from '#lib/courses/pgn-tree.ts';

const london = `[Event "My London"]
[Site "?"]

1. d4 { Take the centre. } d5 2. Bf4 { The London bishop. } Nf6 (2... c5 3. e3 { Solid. } Nc6 4. c3) 3. e3 e6 4. Nf3 *`;

describe('readPgnTree', () => {
	it('reads variations, comments and NAGs into one tree', () => {
		const { tree } = readPgnTree('1. e4!? $1 e5 (1... c5 2. Nf3) 2. Nf3 { [%clk 0:03:00] develop } *');
		const e4 = tree.children.get('e2e4' as never)!;
		expect(e4.san).toBe('e4');
		expect([...e4.node.children.values()].map((e) => e.san)).toEqual(['e5', 'c5']);
		expect(e4.node.children.get('e7e5' as never)!.node.children.get('g1f3' as never)!.note).toBe('develop');
	});

	it('merges several games, as in a Lichess study export', () => {
		const { tree } = readPgnTree('[Event "a"]\n\n1. e4 e5 *\n\n[Event "b"]\n\n1. e4 c5 *');
		expect(tree.children.size).toBe(1);
		expect(tree.children.get('e2e4' as never)!.node.children.size).toBe(2);
	});

	it('explains an illegal move and rejects non-standard starts', () => {
		expect(() => readPgnTree('1. e4 e5 2. Ke3')).toThrow(/Illegal move Ke3 after e4 e5/);
		expect(() => readPgnTree('[FEN "8/8/8/8/8/8/8/K6k w - - 0 1"]\n\n1. Kb1 *')).toThrow(/starting position/);
		const mixed = '[FEN "8/8/8/8/8/8/8/K6k w - - 0 1"]\n\n1. Kb1 *\n\n[Variant "Crazyhouse"]\n\n1. e4 *\n\n[FEN "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"]\n[SetUp "1"]\n\n1. d4 *';
		const { tree, skipped } = readPgnTree(mixed);
		expect(skipped).toBe(2);
		expect([...tree.children.values()].map((e) => e.san)).toEqual(['d4']);
		expect(() => readPgnTree('')).toThrow();
	});
});

describe('buildCourse', () => {
	it('builds one line per branch with notes on the student side only', () => {
		const { file, conflicts } = buildCourse(readPgnTree(london).tree, { id: 'custom-london', name: 'My London', side: 'w' });
		expect(conflicts).toEqual([]);
		const lines = file.chapters[0].lines;
		expect(lines).toHaveLength(2);
		expect(lines[0].pgn).toBe('1. d4 { Take the centre. } d5 2. Bf4 { The London bishop. } Nf6 3. e3 e6 4. Nf3');
		expect(lines.map((l) => l.name)).toEqual(['2…Nf6 3.e3', '2…c5 3.e3']);

		const course = parseCourse(file);
		expect(course.lines).toHaveLength(2);
		expect(course.lines[0].plies[0]).toMatchObject({ san: 'd4', student: true, note: 'Take the centre.' });
	});

	it('keeps the first student move where the PGN offers two, and reports it', () => {
		const { file, conflicts } = buildCourse(readPgnTree('1. e4 (1. d4 d5) e5 *').tree, { id: 'x', name: 'x', side: 'w' });
		expect(conflicts).toEqual(['the start: e4, d4']);
		expect(file.chapters[0].lines.map((l) => l.pgn)).toEqual(['1. e4 e5']);
	});

	it('refuses a PGN with no move for the chosen side', () => {
		expect(() => buildCourse(readPgnTree('1. e4 *').tree, { id: 'x', name: 'x', side: 'b' })).toThrow(/your side/);
	});
});

describe('line names', () => {
	it('calls a line with no branches the main line', () => {
		const { file } = buildCourse(readPgnTree('1. e4 c6 2. d4 d5 *').tree, { id: 'x', name: 'x', side: 'b' });
		expect(file.chapters[0].lines[0].name).toBe('Main line');
	});
});
