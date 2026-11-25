import { Chess, type Move, type PieceSymbol, type Square } from 'chess.js';
import type { Fen, San, Uci } from '#lib/chess/types.ts';

const VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
const NAME: Record<PieceSymbol, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };

/** What a move off the course line gives away, judged one reply deep. */
export type WrongMoveVerdict =
	| { kind: 'illegal' }
	| { kind: 'mated'; reply: San }
	| { kind: 'loses'; piece: string; material: number; reply: San }
	| { kind: 'playable' };

function capturesOn(chess: Chess, square: Square): Move[] {
	return chess.moves({ verbose: true }).filter((m) => m.to === square && m.captured);
}

/** Static exchange: what the side to move nets by starting captures on `square`, stopping whenever it pays to. */
function exchange(chess: Chess, square: Square): number {
	const attackers = capturesOn(chess, square).sort((a, b) => VALUE[a.piece] - VALUE[b.piece]);
	const least = attackers[0];
	if (!least?.captured) return 0;
	chess.move(least);
	const gain = VALUE[least.captured] - exchange(chess, square);
	chess.undo();
	return Math.max(0, gain);
}

export function judgeWrongMove(fen: Fen, uci: Uci): WrongMoveVerdict {
	const chess = new Chess(fen);
	let taken = 0;
	try {
		const played = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined });
		taken = played.captured ? VALUE[played.captured] : 0;
	} catch {
		return { kind: 'illegal' };
	}

	let best: { gain: number; move: Move } | undefined;
	for (const reply of chess.moves({ verbose: true })) {
		chess.move(reply);
		const mate = chess.isCheckmate();
		const recapture = reply.captured ? exchange(chess, reply.to) : 0;
		chess.undo();
		if (mate) return { kind: 'mated', reply: reply.san as San };
		if (!reply.captured) continue;
		const gain = VALUE[reply.captured] - recapture - taken;
		if (gain > (best?.gain ?? 0)) best = { gain, move: reply };
	}

	if (best && best.gain >= 1 && best.move.captured)
		return { kind: 'loses', piece: NAME[best.move.captured], material: best.gain, reply: best.move.san as San };
	return { kind: 'playable' };
}
