import { Chess } from 'chess.js';
import type { Color, Ply, San, Uci } from '#lib/chess/types.ts';
import type { ArenaResult } from '#lib/explorer/arena.ts';
import type { GameRecord, MoveReview, Score } from '#lib/review/types.ts';

export function pgnResult(side: Color, result: ArenaResult): GameRecord['result'] {
	if (result === 'draw') return '1/2-1/2';
	const whiteWon = result === 'win' ? side === 'w' : side === 'b';
	return whiteWon ? '1-0' : '0-1';
}

/** PGN of the played moves, with the student named on their side. */
export function arenaPgn(moves: readonly Uci[], meta: { side: Color; result: ArenaResult; rating: number; course: string }): string {
	const chess = new Chess();
	for (const uci of moves) {
		const played = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined });
		if (!played) break;
	}
	const result = pgnResult(meta.side, meta.result);
	const you = meta.side === 'w' ? 'White' : 'Black';
	const them = meta.side === 'w' ? 'Black' : 'White';
	chess.setHeader('Event', `Arena · ${meta.course}`);
	chess.setHeader('Site', 'Chessmode');
	chess.setHeader(you, 'You');
	chess.setHeader(them, 'Arena');
	chess.setHeader(`${you}Elo`, String(meta.rating));
	chess.setHeader('Result', result);
	chess.setHeader('Termination', 'adjudication');
	return chess.pgn();
}

/** First moves of an engine line, as SAN. Stops at the first illegal move. */
export function variationSan(fen: string, pv: readonly string[], limit = 6): string {
	const chess = new Chess(fen);
	const sans: string[] = [];
	for (const uci of pv.slice(0, limit)) {
		try {
			const move = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined });
			if (!move) break;
			sans.push(move.san);
		} catch {
			break;
		}
	}
	return sans.join(' ');
}

/**
 * Played moves as review rows so the existing evaluation graph can draw them.
 * Each centipawn value is from White's side. Missing values stay at 0 and the
 * caller should say the evaluation is incomplete.
 */
export function seriesMoves(plies: readonly Ply[], whiteCp: readonly number[]): MoveReview[] {
	return plies.map((ply, index) => {
		const cp = whiteCp[index];
		const score: Score = { cp: Number.isFinite(cp) ? cp : 0 };
		return {
			ply: index + 1,
			color: ply.color,
			san: ply.san,
			uci: ply.uci,
			fenBefore: ply.fenBefore,
			fenAfter: ply.fenAfter,
			classification: 'book',
			loss: 0,
			winBefore: 50,
			winAfter: 50,
			accuracy: 100,
			best: { uci: ply.uci, san: ply.san as San, pv: [ply.uci], score },
			scoreAfter: score,
			explanation: { headline: 'Book' }
		};
	});
}
