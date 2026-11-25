import { Chess } from 'chess.js';
import type { Fen, San, Uci } from '#lib/chess/types.ts';
import { getEngine } from '#lib/engine/stockfish.ts';
import { expectedPoints, THRESHOLDS } from '#lib/review/classify.ts';
import type { MoveReview } from '#lib/review/types.ts';

type Selection = { ply: number };
export type ReviewState =
	| ({ kind: 'browsing' } & Selection)
	| ({ kind: 'analysing' } & Selection)
	| ({ kind: 'showingLine'; step: number; line: LineMove[] } & Selection)
	| ({ kind: 'retrying'; index: number; total: number; attempt: Attempt } & Selection);

export type Attempt =
	| { kind: 'playing'; message?: string }
	| { kind: 'promoting'; squares: string }
	| { kind: 'checking' }
	| { kind: 'solved'; move: LineMove };

type Event =
	| { type: 'analysisStarted' }
	| { type: 'analysisEnded' }
	| { type: 'select'; ply: number }
	| { type: 'line'; line: LineMove[] }
	| { type: 'step'; step: number }
	| { type: 'retry'; ply: number; index: number; total: number }
	| { type: 'attempt'; attempt: Attempt }
	| { type: 'return' };

export function transition(state: ReviewState, event: Event): ReviewState {
	switch (event.type) {
		case 'analysisStarted': return { kind: 'analysing', ply: state.ply };
		case 'analysisEnded': return state.kind === 'analysing' ? { kind: 'browsing', ply: state.ply } : state;
		case 'select': return { kind: state.kind === 'analysing' ? 'analysing' : 'browsing', ply: event.ply };
		case 'line': return state.kind === 'browsing' ? { kind: 'showingLine', ply: state.ply, line: event.line, step: 0 } : state;
		case 'step': return state.kind === 'showingLine'
			? { ...state, step: Math.min(state.line.length, Math.max(0, event.step)) } : state;
		case 'retry': return { kind: 'retrying', ply: event.ply, index: event.index, total: event.total, attempt: { kind: 'playing' } };
		case 'attempt': return state.kind === 'retrying' ? { ...state, attempt: event.attempt } : state;
		case 'return': return { kind: 'browsing', ply: state.ply };
	}
}

export interface LineMove {
	fen: Fen;
	san: San;
	uci: Uci;
}

export function lineMoves(fen: Fen, pv: readonly Uci[]): LineMove[] {
	const chess = new Chess(fen);
	return pv.map(uci => {
		const move = chess.move(uci);
		return { fen: move.after as Fen, san: move.san as San, uci };
	});
}

export async function retryMove(move: MoveReview, uci: Uci, signal: AbortSignal) {
	if (uci === move.best.uci) return true;
	const known = move.alternatives?.find(line => line.pv[0] === uci);
	const line = known ?? (await getEngine().analyse(move.fenBefore, {
		depth: 12, searchMoves: [uci], signal
	})).lines[0];
	if (!line) throw new Error('Stockfish could not check that move.');
	const ep = (score: MoveReview['best']['score']) => expectedPoints(score, move.color, move.color);
	return ep(move.best.score) - ep(line.score) <= THRESHOLDS.strong + 1e-12;
}

export function isRetryable(move: MoveReview) {
	return move.classification === 'mistake' || move.classification === 'blunder' || move.classification === 'missed';
}
