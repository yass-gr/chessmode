import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { START_FEN, type Fen, type Ply, type San, type Uci } from '#lib/chess/types.ts';
import { classify, type ClassifyInput } from '#lib/review/classify.ts';
import type { Score } from '#lib/review/types.ts';

function fixture({
	fen = START_FEN, played = 'd2d4', best = 'e2e4', bestScore = { cp: 0 }, next = { cp: 0 },
	second = 'g1f3', secondScore = { cp: -10 }
}: {
	fen?: Fen; played?: string; best?: string; bestScore?: Score; next?: Score; second?: string; secondScore?: Score;
} = {}): ClassifyInput {
	const result = new Chess(fen).move(played);
	const move: Ply = {
		color: result.color, fenBefore: result.before as Fen, fenAfter: result.after as Fen,
		san: result.san as San, uci: result.lan as Uci
	};
	return { move, before: { fen, depth: 16, lines: [
		{ pv: [best as Uci], depth: 16, score: bestScore },
		{ pv: [second as Uci], depth: 16, score: secondScore }
	] }, scoreAfter: next };
}

describe('move labels', () => {
	it.each([
		['best', 0], ['strong', -15], ['good', -40], ['loose', -75], ['mistake', -150], ['blunder', -300]
	])('classifies %s from expected-points loss', (label, cp) => {
		expect(classify(fixture({ next: { cp } })).classification).toBe(label);
	});

	it('gives book precedence when the move is in the contiguous opening', () => {
		expect(classify({ ...fixture(), inBook: true }).classification).toBe('book');
	});

	it('recognises only legal moves', () => {
		const input = fixture({ fen: 'k7/8/2K5/2Q5/8/8/8/8 b - - 0 1' as Fen, played: 'a8b8', best: 'a8b8' });
		input.before.lines.pop();
		expect(classify(input).classification).toBe('only');
	});

	it('recognises a sharp move from the gap to the second line', () => {
		expect(classify(fixture({ played: 'e2e4', secondScore: { cp: -130 }, next: { cp: -300 } })))
			.toEqual({ classification: 'sharp', loss: 0 });
	});

	it('recognises a find when the opponent can take a knight and the position still holds', () => {
		const input = fixture({
			fen: '4k3/8/8/8/4p3/8/8/R3K1N1 w - - 0 1' as Fen, played: 'g1f3', best: 'g1f3', second: 'a1a2'
		});
		expect(classify(input).classification).toBe('find');
	});

	it('calls a missed win when the opponent handed over an advantage and the player stays equal', () => {
		const input = fixture({ bestScore: { cp: 350 } });
		expect(classify({ ...input, previous: { uci: 'e7e5' as Uci, fenBefore: START_FEN, loss: 0.12 } }).classification)
			.toBe('missed');
	});

	it('preserves blunder when missing mate also hands the opponent a winning position', () => {
		expect(classify(fixture({ bestScore: { mate: 2 }, next: { cp: -350 } })).classification).toBe('blunder');
	});

	it('uses the played MultiPV line over the next position evaluation', () => {
		const input = fixture({ second: 'd2d4', secondScore: { cp: -40 }, next: { cp: -300 } });
		expect(classify(input).classification).toBe('good');
	});
});
