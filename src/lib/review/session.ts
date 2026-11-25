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

export const BRANCH_INTERVAL_MS = 1000;
export const RETRY_REWIND_MS = 500;

export type Hint = 'clear' | 'origin' | 'arrow';
export type RetryFeedback = { accepted: boolean; move: LineMove; score: MoveReview['best']['score'] };
export type DecisionSession =
	| { kind: 'mainline'; ply: number; generation: number }
	| { kind: 'branch'; ply: number; generation: number; baseFen: Fen; line: LineMove[]; step: number; autoplay: boolean }
	| { kind: 'rewinding'; ply: number; generation: number; move: MoveReview; queue: number[] }
	| { kind: 'retry'; ply: number; generation: number; move: MoveReview; queue: number[]; hint: Hint;
		status: 'playing' | 'checking'; submission: Uci | null }
	| { kind: 'feedback'; ply: number; generation: number; move: MoveReview; queue: number[]; feedback: RetryFeedback };

export type DecisionEvent =
	| { type: 'select'; ply: number }
	| { type: 'exit' }
	| { type: 'branch'; baseFen: Fen; line: LineMove[]; autoplay?: boolean }
	| { type: 'step'; step: number }
	| { type: 'tick'; generation: number }
	| { type: 'autoplay'; enabled: boolean }
	| { type: 'retry'; move: MoveReview; queue?: number[] }
	| { type: 'rewound'; generation: number }
	| { type: 'hint' }
	| { type: 'submit'; uci: Uci }
	| { type: 'checked'; generation: number; uci: Uci; feedback: RetryFeedback }
	| { type: 'checkFailed'; generation: number; uci: Uci }
	| { type: 'tryAgain' };

export function decisionTransition(state: DecisionSession, event: DecisionEvent): DecisionSession {
	switch (event.type) {
		case 'select': return { kind: 'mainline', ply: event.ply, generation: state.generation + 1 };
		case 'exit': return { kind: 'mainline', ply: state.ply, generation: state.generation + 1 };
		case 'branch': return state.kind === 'mainline' ? { kind: 'branch', ply: state.ply, generation: state.generation + 1,
			baseFen: event.baseFen, line: event.line, step: 0, autoplay: event.autoplay ?? true } : state;
		case 'step': return state.kind === 'branch' ? { ...state, step: Math.max(0, Math.min(state.line.length, event.step)), generation: state.generation + 1 } : state;
		case 'tick': return state.kind === 'branch' && state.autoplay && state.generation === event.generation
			? { ...state, step: Math.min(state.line.length, state.step + 1) } : state;
		case 'autoplay': return state.kind === 'branch' ? { ...state, autoplay: event.enabled, generation: state.generation + 1 } : state;
		case 'retry': return { kind: 'rewinding', ply: event.move.ply, generation: state.generation + 1, move: event.move, queue: event.queue ?? [] };
		case 'rewound': return state.kind === 'rewinding' && state.generation === event.generation
			? { ...state, kind: 'retry', hint: 'clear', status: 'playing', submission: null } : state;
		case 'hint': return state.kind === 'retry' && state.status === 'playing'
			? { ...state, hint: state.hint === 'clear' ? 'origin' : state.hint === 'origin' ? 'arrow' : 'clear' } : state;
		case 'submit': return state.kind === 'retry' && state.status === 'playing' && legalRetryMove(state.move, event.uci)
			? { ...state, status: 'checking', submission: event.uci, generation: state.generation + 1 } : state;
		case 'checked': return state.kind === 'retry' && state.status === 'checking' && state.generation === event.generation && state.submission === event.uci
			? { kind: 'feedback', ply: state.ply, generation: state.generation, move: state.move, queue: state.queue, feedback: event.feedback } : state;
		case 'checkFailed': return state.kind === 'retry' && state.status === 'checking' && state.generation === event.generation && state.submission === event.uci
			? { ...state, status: 'playing', submission: null } : state;
		case 'tryAgain': return state.kind === 'feedback' ? { kind: 'retry', ply: state.ply, generation: state.generation + 1,
			move: state.move, queue: state.queue, hint: 'clear', status: 'playing', submission: null } : state;
	}
}

export function legalRetryMove(move: MoveReview, uci: Uci): boolean {
	if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) return false;
	try {
		const chess = new Chess(move.fenBefore);
		const legal = chess.moves({ verbose: true });
		return legal.some(candidate => candidate.from + candidate.to + (candidate.promotion ?? '') === uci);
	} catch { return false; }
}

export async function evaluateRetry(move: MoveReview, uci: Uci, signal: AbortSignal,
	analyse: typeof getEngine = getEngine): Promise<RetryFeedback> {
	signal.throwIfAborted();
	if (!legalRetryMove(move, uci)) throw new Error('That move is not legal.');
	const line = uci === move.best.uci ? { score: move.best.score } :
		move.alternatives?.find(candidate => candidate.pv[0] === uci) ??
		(await analyse().analyse(move.fenBefore, { depth: 12, searchMoves: [uci], signal })).lines[0];
	signal.throwIfAborted();
	if (!line) throw new Error('Stockfish could not check that move.');
	const ep = (score: MoveReview['best']['score']) => expectedPoints(score, move.color, move.color);
	return { accepted: ep(move.best.score) - ep(line.score) <= THRESHOLDS.strong + 1e-12,
		move: lineMoves(move.fenBefore, [uci])[0], score: line.score };
}

export function retryQueue(moves: readonly MoveReview[], side: import('#lib/chess/types.ts').Color): MoveReview[] {
	return moves.filter(move => move.color === side && isRetryable(move)).sort((a, b) => a.ply - b.ply);
}
