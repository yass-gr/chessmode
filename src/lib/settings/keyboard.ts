import { Chess, type Move, type Square } from 'chess.js';

export interface ParsedEntry {
	uci: string;
	kind: 'move' | 'premove';
}

function load(fen: string): Chess | undefined {
	try {
		return new Chess(fen);
	} catch {
		return undefined;
	}
}

/** Position used to name a premove: our turn, opponent pieces removed, both kings kept. */
function premovePosition(fen: string, side: 'w' | 'b'): Chess | undefined {
	const game = load(fen);
	if (!game) return undefined;
	if (game.turn() === side) return game;
	for (const file of 'abcdefgh') {
		for (let rank = 1; rank <= 8; rank++) {
			const square = `${file}${rank}` as Square;
			const piece = game.get(square);
			if (piece && piece.color !== side && piece.type !== 'k') game.remove(square);
		}
	}
	const parts = game.fen().split(' ');
	parts[1] = side;
	parts[3] = '-';
	try {
		return new Chess(parts.join(' '));
	} catch {
		return undefined;
	}
}

function uciOf(move: Move): string {
	return move.from + move.to + (move.promotion ?? '');
}

function fold(san: string): string {
	return san.replace(/[+#]/g, '').replace(/0/g, 'O');
}

function loose(san: string): string {
	return fold(san).replace(/x/g, '');
}

/**
 * Turn typed SAN or UCI into one move for `side`.
 * A premove is returned on the opponent's turn. Promotion premoves are refused.
 * `force` accepts an exact SAN that is also a prefix of a longer move, such as O-O before O-O-O.
 */
export function parseKeyboardMove(fen: string, text: string, side: 'w' | 'b', force = false): ParsedEntry | undefined {
	const raw = text.replace(/\s+/g, '');
	if (!raw) return undefined;
	const live = load(fen);
	if (!live) return undefined;
	const kind: ParsedEntry['kind'] = live.turn() === side ? 'move' : 'premove';
	const game = kind === 'move' ? live : premovePosition(fen, side);
	if (!game) return undefined;
	const moves = game.moves({ verbose: true });

	const uci = raw.match(/^([a-h][1-8])([a-h][1-8])([qrbn])?$/i);
	if (uci) {
		const from = uci[1].toLowerCase();
		const to = uci[2].toLowerCase();
		const promo = uci[3]?.toLowerCase();
		const matches = moves.filter((move) => move.from === from && move.to === to);
		if (matches.length === 0) return undefined;
		if (matches.some((move) => move.promotion)) {
			if (kind === 'premove') return undefined;
			const chosen = matches.find((move) => move.promotion === (promo ?? 'q'));
			return chosen ? { uci: uciOf(chosen), kind } : undefined;
		}
		if (promo) return undefined;
		return { uci: uciOf(matches[0]), kind };
	}

	const typed = loose(raw);
	const exact = moves.filter((move) => loose(move.san) === typed || fold(move.san) === fold(raw));
	if (exact.length !== 1) return undefined;
	if (exact[0].promotion && kind === 'premove') return undefined;
	if (!force) {
		const longer = moves.some((move) => {
			const san = loose(move.san);
			return san !== typed && san.startsWith(typed);
		});
		if (longer) return undefined;
	}
	return { uci: uciOf(exact[0]), kind };
}
