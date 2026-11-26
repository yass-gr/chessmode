import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { START_FEN, type Fen, type Ply, type San, type Uci } from '#lib/chess/types.ts';
import { arenaPgn, pgnResult, seriesMoves, variationSan } from '#lib/explorer/arena-review.ts';
import { readPgn } from '#lib/import/pgn.ts';

function line(moves: string): Ply[] {
	const chess = new Chess();
	return moves.split(' ').filter(Boolean).map((san) => {
		const fenBefore = chess.fen() as Fen;
		const move = chess.move(san);
		return {
			san: move.san as San,
			uci: move.lan as Uci,
			color: move.color,
			fenBefore,
			fenAfter: chess.fen() as Fen
		};
	});
}

describe('arena review', () => {
	it('names the student on their side and keeps a result the review route can read', () => {
		expect(pgnResult('b', 'win')).toBe('0-1');
		expect(pgnResult('w', 'draw')).toBe('1/2-1/2');
		const pgn = arenaPgn(['e2e4', 'c7c6'] as Uci[], { side: 'b', result: 'win', rating: 1200, course: 'Caro-Kann' });
		const parsed = readPgn(pgn);
		expect(parsed.headers.Black).toBe('You');
		expect(parsed.headers.White).toBe('Arena');
		expect(parsed.headers.Result).toBe('0-1');
		expect(parsed.plies.map((ply) => ply.san)).toEqual(['e4', 'c6']);
	});

	it('prints an engine line and a white-side evaluation series', () => {
		expect(variationSan(START_FEN, ['e2e4', 'e7e5', 'g1f3'])).toBe('e4 e5 Nf3');
		expect(variationSan(START_FEN, ['e2e9'])).toBe('');
		const plies = line('e4 e5');
		const moves = seriesMoves(plies, [30, -10]);
		expect(moves.map((move) => move.scoreAfter.cp)).toEqual([30, -10]);
		expect(moves[1].ply).toBe(2);
		expect(moves[0].classification).toBe('book');
	});
});
