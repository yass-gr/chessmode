import { describe, expect, it } from 'vitest';
import { goCommand, parseInfo } from '#lib/engine/stockfish.ts';

describe('goCommand', () => {
	it('caps a search with movetime and leaves a plain depth search alone', () => {
		expect(goCommand(12)).toBe('go depth 12');
		expect(goCommand(4, 250)).toBe('go depth 4 movetime 250');
		expect(goCommand(4, 0)).toBe('go depth 4');
	});
});

describe('Stockfish UCI output', () => {
	it('normalises centipawns to White and preserves depth and MultiPV order', () => {
		expect(parseInfo('info depth 16 seldepth 22 multipv 2 score cp -77 nodes 100 pv e7e5 g1f3', 'b'))
			.toEqual({ index: 2, line: { depth: 16, score: { cp: 77 }, pv: ['e7e5', 'g1f3'] } });
	});

	it('normalises mates and ignores bounds and incomplete scores', () => {
		expect(parseInfo('info depth 12 multipv 1 score mate 3 pv h8h1', 'b')?.line.score).toEqual({ mate: -3 });
		expect(parseInfo('info depth 6 score cp 100 lowerbound pv e2e4', 'w')).toBeUndefined();
		expect(parseInfo('info depth 6 score cp 100', 'w')).toBeUndefined();
	});
});
