import { describe, expect, it } from 'vitest';
import { courses, getCourse } from '#lib/courses/index.ts';
import { readPgn } from '#lib/import/pgn.ts';
import { findDeviation } from '#lib/review/repertoire.ts';

const plies = (moves: string) => readPgn(moves).plies;

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

	it('ignores games that never entered the opening', () => {
		expect(findDeviation(courses, plies('1. e4 e5'), 'w')).toBeUndefined();
		expect(findDeviation(courses, plies('1. d4 d5'), 'b')).toBeUndefined();
	});
});
