import { describe, expect, it } from 'vitest';
import { judgeWrongMove } from '#lib/chess/explain.ts';
import { START_FEN, type Fen, type Uci } from '#lib/chess/types.ts';

const judge = (fen: string, uci: string) => judgeWrongMove(fen as Fen, uci as Uci);

describe('judgeWrongMove', () => {
	it('calls a quiet developing move playable', () => {
		expect(judge(START_FEN, 'g1f3')).toEqual({ kind: 'playable' });
	});

	it('finds the mate a move allows', () => {
		const afterF3 = 'rnbqkbnr/pppp1ppp/8/4p3/8/5P2/PPPPP1PP/RNBQKBNR w KQkq - 0 2';
		expect(judge(afterF3, 'g2g4')).toEqual({ kind: 'mated', reply: 'Qh4#' });
	});

	it('reports a piece left hanging', () => {
		const verdict = judge('rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', 'f1a6');
		expect(verdict).toMatchObject({ kind: 'loses', piece: 'bishop', material: 3 });
	});

	it('does not count a defended piece as lost', () => {
		const verdict = judge('rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', 'd2d4');
		expect(verdict).toEqual({ kind: 'playable' });
	});

	it('nets a defended piece only when the trade wins material', () => {
		const verdict = judge('rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 2', 'd1e2');
		expect(verdict).toEqual({ kind: 'playable' });
	});

	it('sees a long-range attacker and ignores a free pawn grab', () => {
		const verdict = judge('rnbqkbnr/ppp2ppp/8/3pp3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3', 'f3g5');
		expect(verdict).toEqual({ kind: 'loses', piece: 'knight', material: 3, reply: 'Qxg5' });
		const sac = judge('rnbqkbnr/ppp2ppp/8/3pp3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3', 'f3e5');
		expect(sac).toEqual({ kind: 'playable' });
	});

	it('rejects an illegal move', () => {
		expect(judge(START_FEN, 'e1e5')).toEqual({ kind: 'illegal' });
	});
});

describe('judgeWrongMove pawn pushes', () => {
	it('accepts a quiet pawn move', () => {
		expect(judge(START_FEN, 'a2a3')).toEqual({ kind: 'playable' });
	});

	it('accepts an explicit promotion', () => {
		expect(judge('8/P6k/8/8/8/8/8/K7 w - - 0 1', 'a7a8q')).toEqual({ kind: 'playable' });
	});
});
