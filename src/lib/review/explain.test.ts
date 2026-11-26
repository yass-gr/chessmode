import { expect, it } from 'vitest';
import type { Fen, San, Uci } from '#lib/chess/types.ts';
import { explain } from '#lib/review/explain.ts';
import type { MoveReview } from '#lib/review/types.ts';

const position = '4k3/8/2p5/3p4/8/8/8/3QK3 w - - 0 1' as Fen;
const move = {
	san: 'Qxd5' as San, uci: 'd1d5' as Uci, color: 'w', fenBefore: position,
	classification: 'blunder', best: { san: 'Qh5' as San, uci: 'd1h5' as Uci, pv: ['d1h5' as Uci], score: { cp: 450 } },
	scoreAfter: { cp: -600 }
} satisfies Partial<MoveReview>;

it('names a hung queen only when the reply wins it', () => {
	expect(explain(move, ['c6d5' as Uci])).toEqual({ headline: 'Qxd5 is a blunder.', detail: 'It hangs your queen.' });
	expect(explain(move, [])).toEqual({ headline: 'Qxd5 is a blunder.', detail: 'Stockfish prefers Qh5 here.' });
});

it('names an opponent mate from the White POV score', () => {
	expect(explain({ ...move, scoreAfter: { mate: -3 } }, []).detail).toBe('It allows mate in 3.');
	expect(explain({ ...move, color: 'b', scoreAfter: { mate: 1 } }, []).detail).toBe('It allows mate in 1.');
});

it('names the missed piece and the SAN of the move that wins it', () => {
	const result = explain({
		...move, fenBefore: '4k3/8/8/3n4/8/8/8/3QK3 w - - 0 1' as Fen,
		san: 'Qh5' as San, uci: 'd1h5' as Uci, classification: 'missed',
		best: { san: 'Qxd5' as San, uci: 'd1d5' as Uci, pv: ['d1d5' as Uci], score: { cp: 500 } }
	}, []);
	expect(result.detail).toBe('You missed a chance to win a knight with Qxd5.');
});

it('stores legal, independently described branches with only known scores', async () => {
	const { buildBranches } = await import('./explain.ts');
	const { Chess } = await import('chess.js');
	const branches = buildBranches(move, ['c6d5' as Uci], undefined, true);
	expect(branches.played.steps[0].explanation).toBe('Qxd5 takes the pawn and hangs the queen.');
	expect(branches.recommended.steps[0].explanation).toBe('Qh5+ forks the king and the pawn.');
	expect(JSON.stringify(branches)).not.toContain('continues the line');
	for (const line of Object.values(branches)) {
		for (const step of line.steps) {
			const board = new Chess(step.fenBefore);
			board.move(step.uci);
			expect(board.fen()).toBe(step.fenAfter);
		}
		expect(line.steps[1]?.score).toBeUndefined();
	}
});

it('describes mate, forks, and leaving an opening', async () => {
	const { buildBranches } = await import('./explain.ts');
	const make = (fenBefore: string, uci: string) => buildBranches({
		...move, fenBefore: fenBefore as Fen, uci: uci as Uci,
		best: { ...move.best, pv: [uci as Uci] }
	}, [], undefined, true).played.steps[0].explanation;
	expect(make('7k/5Q2/6K1/8/8/8/8/8 w - - 0 1', 'f7g7')).toBe('Qg7# is checkmate.');
	expect(make('4k3/8/8/8/8/8/8/4K1N1 w - - 0 1', 'g1f3')).toBe('Nf3 leaves the book.');
	expect(make('4k3/8/8/8/r3q3/8/7K/1N6 w - - 0 1', 'b1c3')).toBe('Nc3 forks the queen and the rook.');
});

it('names a promotion, a quiet best move, and a piece that steps out of danger', async () => {
	const { buildBranches } = await import('./explain.ts');
	const promoted = buildBranches({
		...move, fenBefore: '8/k3P3/8/8/8/8/8/4K3 w - - 0 1' as Fen, uci: 'e7e8q' as Uci,
		best: { ...move.best, pv: ['e7e8q' as Uci] }
	}, []).played.steps[0].explanation;
	expect(promoted).toBe('e8=Q promotes the pawn to a queen.');
	const quiet = buildBranches({
		...move, fenBefore: '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1' as Fen, uci: 'e2e4' as Uci,
		best: { ...move.best, san: 'e4' as San, uci: 'e2e4' as Uci, pv: ['e2e4' as Uci] }
	}, []).recommended.steps[0].explanation;
	expect(quiet).toBe('e4 is the best move, placing the pawn on e4.');
	const saved = buildBranches({
		...move, fenBefore: 'r6k/8/8/8/8/8/8/R6K w - - 0 1' as Fen, uci: 'a1b1' as Uci,
		best: { ...move.best, pv: ['a1b1' as Uci] }
	}, []).played.steps[0].explanation;
	expect(saved).toBe('Rb1 steps the rook out of danger.');
});
