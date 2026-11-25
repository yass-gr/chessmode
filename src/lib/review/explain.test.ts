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
