import { describe, expect, it } from 'vitest';
import { elo, expected } from '#lib/ratings.ts';
import { nextPuzzle, parsePuzzles, puzzleStep, startPuzzle, type Puzzle, type PuzzleState } from '#lib/puzzles/puzzles.ts';

// After 1.e4 e5 2.Bc4 Nc6 3.Qh5, Black blunders 3...Nf6 and White mates with Qxf7#.
const mateIn1 = parsePuzzles([
	{ id: 'm1', fen: 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3', moves: ['g8f6', 'h5f7'], rating: 800, themes: ['mateIn1'] }
])[0];
// Two solver moves: after 1...a6?? the d1 queen and a fork-free line, used only for sequencing.
const twoStep: Puzzle = {
	id: 't2',
	fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1' as never,
	moves: ['a7a6', 'd2d4', 'b7b6', 'c2c4'] as never,
	rating: 1500,
	themes: [],
	opening: ''
};

describe('puzzleStep', () => {
	it('plays the opponent move, then accepts the solution', () => {
		let s: PuzzleState = startPuzzle(mateIn1);
		s = puzzleStep(mateIn1, s, { type: 'opponent' });
		expect(s.kind).toBe('solving');
		s = puzzleStep(mateIn1, s, { type: 'move', uci: 'h5f7' as never });
		expect(s).toMatchObject({ kind: 'solved', clean: true });
	});

	it('fails on a wrong move, lets the player retry, and marks the solve as not clean', () => {
		let s = puzzleStep(mateIn1, startPuzzle(mateIn1), { type: 'opponent' });
		s = puzzleStep(mateIn1, s, { type: 'move', uci: 'h5h7' as never });
		expect(s).toMatchObject({ kind: 'wrong', played: 'h5h7' });
		s = puzzleStep(mateIn1, s, { type: 'retry' });
		s = puzzleStep(mateIn1, s, { type: 'move', uci: 'h5f7' as never }, true);
		expect(s).toMatchObject({ kind: 'solved', clean: false });
	});

	it('walks a longer solution through the opponent replies', () => {
		let s = puzzleStep(twoStep, startPuzzle(twoStep), { type: 'opponent' });
		s = puzzleStep(twoStep, s, { type: 'move', uci: 'd2d4' as never });
		expect(s).toMatchObject({ kind: 'opponent', index: 2 });
		s = puzzleStep(twoStep, s, { type: 'opponent' });
		s = puzzleStep(twoStep, s, { type: 'move', uci: 'c2c4' as never });
		expect(s.kind).toBe('solved');
	});

	it('ignores illegal moves', () => {
		const s = puzzleStep(mateIn1, startPuzzle(mateIn1), { type: 'opponent' });
		expect(puzzleStep(mateIn1, s, { type: 'move', uci: 'h5h1' as never })).toBe(s);
	});
});

describe('nextPuzzle and ratings', () => {
	const pool = [800, 1000, 1200, 1400, 2000].map((rating, i) => ({ ...twoStep, id: `p${i}`, rating }));

	it('picks an unseen puzzle near the rating and widens when needed', () => {
		expect(nextPuzzle(pool, 1210, new Set(), () => 0)?.id).toBe('p2');
		expect(nextPuzzle(pool, 1210, new Set(['p2']), () => 0)?.rating).toBeGreaterThanOrEqual(1000);
		expect(nextPuzzle(pool, 1900, new Set(), () => 0)?.id).toBe('p4');
		expect(nextPuzzle([], 1200, new Set())).toBeUndefined();
	});

	it('moves the rating by the Elo expectation', () => {
		expect(expected(1200, 1200)).toBeCloseTo(0.5);
		expect(elo(1200, 1200, 1)).toBe(1216);
		expect(elo(1200, 1600, 1)).toBeGreaterThan(elo(1200, 1200, 1));
		expect(elo(1200, 800, 0)).toBeLessThan(elo(1200, 1200, 0));
	});
});
