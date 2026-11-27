import { describe, expect, it } from 'vitest';
import { getCourse } from '#lib/courses/index.ts';
import { lazyCourse } from '#lib/courses/parse.ts';
import type { Course } from '#lib/courses/types.ts';
import { readPgn } from '#lib/import/pgn.ts';
import { findDeviation } from '#lib/review/repertoire.ts';

const plies = (moves: string) => readPgn(moves).plies;
/** A fixed catalog, so adding a course to the app does not change what these tests mean. */
const courses = [getCourse('caro-kann')!, getCourse('jobava-london')!];

describe('findDeviation', () => {
	it('finds where the player left the course', () => {
		const game = plies('1. e4 c6 2. d4 d5 3. e5 Bf5 4. Nf3 e6 5. Be2 Nd7');
		const found = findDeviation(courses, game, 'b');
		expect(found).toMatchObject({ kind: 'you', ply: 9, course: getCourse('caro-kann'), expected: { san: 'c5' } });
		expect(found?.kind === 'you' && found.played.san).toBe('Nd7');
		expect(found?.line.startsWith('caro-kann/advance-short')).toBe(true);
	});

	it('finds where the opponent played a move the course does not prepare', () => {
		const found = findDeviation(courses, plies('1. e4 c6 2. a3'), 'b');
		expect(found).toMatchObject({ kind: 'opponent', ply: 2 });
	});

	it('reports a game that followed a whole line', () => {
		const line = getCourse('caro-kann')!.lines.find((l) => l.id === 'advance-short-dxc5')!;
		const moves = line.plies.map((p) => p.san).join(' ');
		const found = findDeviation(courses, plies(moves + ' Nc3'), 'b');
		expect(found).toMatchObject({ kind: 'complete', ply: line.plies.length - 1, line: line.key });
	});

	it('picks the side from the course that matches when the side is unknown', () => {
		const found = findDeviation(courses, plies('1. d4 d5 2. Nc3 Nf6 3. Bf4 e6 4. Nb5 Na6 5. h3'));
		expect(found).toMatchObject({ kind: 'you', course: getCourse('jobava-london'), ply: 8 });
	});

	it('judges the game by the courses the player studies before the rest of the catalog', () => {
		const rival: Course = { ...getCourse('caro-kann')!, id: 'rival' as Course['id'] };
		const game = plies('1. e4 c6 2. d4 d5 3. e5 Bf5');
		expect(findDeviation([rival, ...courses], game, 'b')?.course.id).toBe('rival');
		expect(findDeviation([rival, ...courses], game, 'b', new Set(['caro-kann']))?.course.id).toBe('caro-kann');
		expect(findDeviation(courses, game, 'b', new Set(['jobava-london']))?.course.id).toBe('caro-kann');
	});

	it('matches every first move in a course with multiple opening replies', () => {
		const course = lazyCourse({
			id: 'multiple', name: 'Multiple', side: 'b', level: '', tagline: '', description: '',
			chapters: [{ id: 'main', name: 'Main', intro: '', lines: [
				{ id: 'king', name: 'King', pgn: '1. e4 e5 2. Nf3 Nc6' },
				{ id: 'queen', name: 'Queen', pgn: '1. d4 d5 2. c4 e6' }
			] }]
		});
		expect(findDeviation([course], plies('1. e4 e5 2. Nf3 Nc6'), 'b')?.line).toBe('multiple/king');
		expect(findDeviation([course], plies('1. d4 d5 2. c4 e6'), 'b')?.line).toBe('multiple/queen');
	});

	it('ignores games that never entered the opening', () => {
		expect(findDeviation(courses, plies('1. e4 e5'), 'w')).toBeUndefined();
		expect(findDeviation(courses, plies('1. d4 d5'), 'b')).toBeUndefined();
	});
});
