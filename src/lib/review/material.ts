import type { Chess, PieceSymbol, Square } from 'chess.js';
import type { Color } from '#lib/chess/types.ts';

export const PIECE_VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

export function materialBalance(position: Chess, color: Color) {
	let balance = 0;
	for (const rank of position.board()) {
		for (const piece of rank) {
			if (piece) balance += PIECE_VALUE[piece.type] * (piece.color === color ? 1 : -1);
		}
	}
	return balance;
}

export function exchangeBalance(position: Chess, color: Color, target?: Square): number {
	const current = materialBalance(position, color);
	const maximise = position.turn() === color;
	let result = current;
	// Both sides may decline the exchange. After the first capture, only recaptures
	// on the same square belong to that exchange.
	const captures = position.moves({ verbose: true }).filter(move => move.captured && (!target || move.to === target));
	for (const move of captures) {
		position.move(move);
		const balance = exchangeBalance(position, color, move.to);
		position.undo();
		result = maximise ? Math.max(result, balance) : Math.min(result, balance);
	}
	return result;
}
