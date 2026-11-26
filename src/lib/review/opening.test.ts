import { describe, expect, it } from 'vitest';
import { getCourse } from '#lib/courses/index.ts';
import { readPgn } from '#lib/import/pgn.ts';
import { reviewOpenings, selectOpenings, trainHref, type OpeningGame } from '#lib/review/opening.ts';

const game = (id: string, moves: string, userColor?: OpeningGame['userColor']): OpeningGame => ({
	id,
	plies: readPgn(moves).plies,
	userColor
});

const courses = [getCourse('caro-kann')!, getCourse('jobava-london')!];

describe('reviewOpenings', () => {
	const rows = reviewOpenings(
		[
			game('black-game', '1. e4 c6 2. d4 d5 3. e5 Bf5 4. Nf3 e6 5. Be2 Nd7', 'b'),
			game('white-game', '1. d4 d5 2. Nc3 Nf6 3. Bf4 e6 4. Nb5 Na6 5. h3', 'w'),
			game('other', '1. e4 e5 2. Nf3 Nc6', 'w'),
			game('empty', '1. e4 e5', 'b')
		],
		courses
	);

	it('matches both colours and keeps games outside every course', () => {
		expect(rows.map((row) => row.status)).toEqual(['matched', 'matched', 'unmatched', 'unmatched']);
		expect(rows[0]).toMatchObject({ courseId: 'caro-kann', side: 'b', kind: 'you', playedSan: 'Nd7', expectedSan: 'c5' });
		expect(rows[1]).toMatchObject({ courseId: 'jobava-london', side: 'w', kind: 'you' });
		expect(rows[0]).toMatchObject({
			reviewHref: '/review/black-game',
			explorerHref: expect.stringContaining('course=caro-kann')
		});
	});

	it('filters by course and side without dropping unmatched games of that side', () => {
		const caro = selectOpenings(rows, { courseId: 'caro-kann' });
		expect(caro.matched.map((row) => row.gameId)).toEqual(['black-game']);
		expect(caro.unmatched.map((row) => row.gameId)).toEqual(['other', 'empty']);
		const white = selectOpenings(rows, { side: 'w' });
		expect(white.matched.map((row) => row.gameId)).toEqual(['white-game']);
		expect(white.unmatched.map((row) => row.gameId)).toEqual(['other']);
	});

	it('sends a learned line to practice and a new line to learn', () => {
		const match = selectOpenings(rows, { courseId: 'caro-kann' }).matched[0];
		expect(trainHref(match, false)).toBe(`/learn/caro-kann/${match.line.slice('caro-kann/'.length)}`);
		expect(trainHref(match, true)).toBe(`/practice/run?line=${encodeURIComponent(match.line)}`);
	});
});
