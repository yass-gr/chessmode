import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { posKey, START_FEN, type Fen } from '#lib/chess/types.ts';
import { getCourse } from '#lib/courses/index.ts';
import { courseCoverage } from '#lib/explorer/coverage.ts';
import { adjudicate, arenaStep, bandReplies, sampleReply, sharedPrefix, startArena, updateRating, type ArenaState } from '#lib/explorer/arena.ts';
import { parseExplorer, repliesAt, type Explorer } from '#lib/explorer/types.ts';

const BANDS = [800, 1000, 1200, 1400, 1600, 1800, 2000, 2200];
const after = (moves: string) => {
	const chess = new Chess();
	for (const m of moves.split(' ').filter(Boolean)) chess.move(m);
	return chess.fen() as Fen;
};
const explorer = (nodes: Record<string, Record<string, [string, number][]>>): Explorer =>
	parseExplorer({ games: 1000, month: '2026-10', bands: BANDS, nodes });

describe('parseExplorer and repliesAt', () => {
	it('merges bands and sorts by count', () => {
		const ex = explorer({ [posKey(START_FEN)]: { '1000': [['e2e4', 30], ['d2d4', 10]], '2000': [['d2d4', 40]] } });
		expect(repliesAt(ex, posKey(START_FEN))).toEqual([{ uci: 'd2d4', count: 50 }, { uci: 'e2e4', count: 30 }]);
		expect(repliesAt(ex, posKey(START_FEN), [1000])[0]).toEqual({ uci: 'e2e4', count: 30 });
	});

	it('rejects a file that is not explorer data', () => {
		expect(() => parseExplorer({ nope: true })).toThrow();
	});
});

describe('courseCoverage', () => {
	const caro = getCourse('caro-kann')!;

	it('counts a common unanswered reply as a gap and scores by reach', () => {
		const ex = explorer({ [posKey(after('e4 c6'))]: { '1400': [['d2d4', 90], ['a2a3', 10]] } });
		const { score, gaps } = courseCoverage(caro, ex);
		expect(gaps[0]).toMatchObject({ san: 'a3', share: 0.1, reach: 1, path: ['e4', 'c6'] });
		expect(score).toBeCloseTo(0.9);
	});

	it('ignores replies under 1%', () => {
		const ex = explorer({ [posKey(after('e4 c6'))]: { '1400': [['d2d4', 995], ['h2h4', 5]] } });
		expect(courseCoverage(caro, ex).gaps).toEqual([]);
	});

	it('does not count openings before the course starts as gaps', () => {
		const ex = explorer({ [posKey(START_FEN)]: { '1400': [['e2e4', 50], ['d2d4', 50]] } });
		expect(courseCoverage(caro, ex).gaps).toEqual([]);
	});

	it('weights a deeper gap by the chance of reaching it', () => {
		const ex = explorer({
			[posKey(after('e4 c6'))]: { '1400': [['d2d4', 50], ['b1c3', 50]] },
			[posKey(after('e4 c6 d4 d5'))]: { '1400': [['e4e5', 80], ['a2a3', 20]] }
		});
		const gap = courseCoverage(caro, ex).gaps.find((g) => g.san === 'a3')!;
		expect(gap.reach).toBeCloseTo(0.5);
		expect(gap.path).toEqual(['e4', 'c6', 'd4', 'd5']);
	});
});

describe('arena', () => {
	const start = posKey(START_FEN);
	const ex = explorer({ [start]: { '800': [['e2e4', 10]], '1000': [['d2d4', 100]], '2000': [['c2c4', 100]] } });

	it('samples from the band nearest the rating, widening when it is thin', () => {
		expect(bandReplies(ex, start, 1050)[0].uci).toBe('d2d4');
		expect(bandReplies(ex, start, 2050)[0].uci).toBe('c2c4');
		expect(sampleReply(ex, START_FEN, 1050, () => 0)).toBe('d2d4');
		expect(sampleReply(ex, after('e4'), 1050)).toBeUndefined();
	});

	it('judges by half a pawn against the start and moves the rating', () => {
		expect(adjudicate(20, 80)).toBe('win');
		expect(adjudicate(20, -40)).toBe('loss');
		expect(adjudicate(20, 60)).toBe('draw');
		expect(updateRating(950, 'win')).toBe(966);
		expect(updateRating(950, 'draw')).toBe(950);
		expect(updateRating(950, 'loss')).toBe(934);
	});

	it('starts after the moves every course line shares', () => {
		const caro = sharedPrefix(getCourse('caro-kann')!);
		expect(caro.moves).toEqual(['e2e4', 'c7c6']);
		expect(startArena('b', caro)).toMatchObject({ kind: 'opponent', moves: ['e2e4', 'c7c6'] });
		const jobava = sharedPrefix(getCourse('jobava-london')!);
		expect(jobava.moves[0]).toBe('d2d4');
		expect(startArena('w', jobava).kind).toBe('opponent');
	});

	it('alternates turns, ignores illegal moves and ends when the data runs out', () => {
		let s: ArenaState = startArena('b');
		expect(s.kind).toBe('opponent');
		s = arenaStep(s, { type: 'move', uci: 'e2e4' as never });
		expect(s.kind).toBe('student');
		expect(arenaStep(s, { type: 'move', uci: 'e7e2' as never })).toBe(s);
		s = arenaStep(s, { type: 'move', uci: 'c7c6' as never });
		s = arenaStep(s, { type: 'outOfData' });
		expect(s.kind).toBe('judging');
		s = arenaStep(s, { type: 'judged', startCp: -20, finalCp: 50 });
		expect(s).toMatchObject({ kind: 'done', result: 'win', moves: ['e2e4', 'c7c6'] });
	});
});
