import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { parseKeyboardMove } from './keyboard.ts';

const start = new Chess().fen();

describe('keyboard move entry', () => {
	it('reads SAN and UCI on the side to move', () => {
		expect(parseKeyboardMove(start, 'e4', 'w')).toEqual({ uci: 'e2e4', kind: 'move' });
		expect(parseKeyboardMove(start, 'Nf3', 'w')).toEqual({ uci: 'g1f3', kind: 'move' });
		expect(parseKeyboardMove(start, 'g1f3', 'w')).toEqual({ uci: 'g1f3', kind: 'move' });
		expect(parseKeyboardMove(start, 'e5', 'w')).toBeUndefined();
		expect(parseKeyboardMove(start, 'e2', 'w')).toBeUndefined();
	});

	it('waits to tell O-O from O-O-O unless the entry is committed', () => {
		const fen = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
		expect(parseKeyboardMove(fen, 'O-O', 'w')).toBeUndefined();
		expect(parseKeyboardMove(fen, 'O-O', 'w', true)).toEqual({ uci: 'e1g1', kind: 'move' });
		expect(parseKeyboardMove(fen, 'O-O-O', 'w')).toEqual({ uci: 'e1c1', kind: 'move' });
	});

	it('promotes to the typed piece and defaults to a queen', () => {
		const fen = '7k/P7/8/8/8/8/8/7K w - - 0 1';
		expect(parseKeyboardMove(fen, 'a7a8', 'w')).toEqual({ uci: 'a7a8q', kind: 'move' });
		expect(parseKeyboardMove(fen, 'a7a8n', 'w')).toEqual({ uci: 'a7a8n', kind: 'move' });
		expect(parseKeyboardMove(fen, 'a8=Q', 'w')).toEqual({ uci: 'a7a8q', kind: 'move' });
	});

	it('queues a premove for the waiting side and refuses promotion', () => {
		const game = new Chess();
		game.move('e4');
		const fen = game.fen();
		expect(parseKeyboardMove(fen, 'Nf3', 'w')).toEqual({ uci: 'g1f3', kind: 'premove' });
		expect(parseKeyboardMove(fen, 'e5', 'b')).toEqual({ uci: 'e7e5', kind: 'move' });
		const promo = '7k/P7/8/8/8/8/8/7K b - - 0 1';
		expect(parseKeyboardMove(promo, 'a7a8', 'w')).toBeUndefined();
		expect(parseKeyboardMove(promo, 'a7a8q', 'w')).toBeUndefined();
	});

	it('uses square names, so the board orientation does not change the move', () => {
		expect(parseKeyboardMove(start, 'e2e4', 'w')?.uci).toBe('e2e4');
	});
});
