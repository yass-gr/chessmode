import { describe, expect, it } from 'vitest';
import { parseCourse, tokenize } from './parse.ts';
import type { CourseFile } from './types.ts';
import fixture from './fixtures/test-course.json';
import { posKey } from '#lib/chess/types.ts';

const file: CourseFile = { ...fixture, side: 'w' };
describe('course parsing', () => {
	it('parses moves, notes and replies', () => {
		const course = parseCourse(file);
		expect(course.lines[0].plies[0]).toMatchObject({ san: 'e4', uci: 'e2e4', student: true, note: 'Claim the centre.' });
		const node = course.repertoire.get(posKey(course.lines[0].plies[1].fenBefore));
		expect(node?.replies.map(p => p.san)).toEqual(['e5', 'c5']);
	});
	it('merges transpositions and rejects conflicting moves', () => {
		const base = file.chapters[0];
		const transposed = { ...file, chapters: [{ ...base, lines: [
			{ id: 'a', name: 'a', pgn: '1. Nf3 Nf6 2. g3 g6 3. Bg2' },
			{ id: 'b', name: 'b', pgn: '1. Nf3 g6 2. g3 Nf6 3. Bg2' }
		] }] };
		const course = parseCourse(transposed);
		expect(course.repertoire.get(posKey(course.lines[0].plies[4].fenBefore))?.lines).toHaveLength(2);
		transposed.chapters[0].lines[1].pgn = '1. Nf3 g6 2. g3 Nf6 3. d3';
		expect(() => parseCourse(transposed)).toThrow('Conflicting');
	});
	it('rejects unsupported PGN constructs', () => {
		expect(() => tokenize('1. e4 (1. d4)')).toThrow();
		expect(() => tokenize('1. e4 {oops')).toThrow();
	});
});
