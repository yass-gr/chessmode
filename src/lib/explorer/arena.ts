import { Chess } from 'chess.js';
import { posKey, START_FEN, type Color, type Fen, type Uci } from '#lib/chess/types.ts';
import type { Course } from '#lib/courses/types.ts';
import type { Explorer, MoveCount } from '#lib/explorer/types.ts';

export const ARENA_START = 950;
export const ARENA_UNLOCK_LINES = 2;
/** ChessReps' rule: half a pawn better than the start is a win, half a pawn worse a loss. */
export const ARENA_MARGIN_CP = 50;
const MIN_SAMPLE = 50;

export type ArenaResult = 'win' | 'draw' | 'loss';

/** Replies from the band nearest the rating, widened to neighbouring bands until there are enough games. */
export function bandReplies(explorer: Explorer, key: string, rating: number): MoveCount[] {
	const node = explorer.nodes.get(key as never);
	if (!node) return [];
	const bands = [...explorer.bands].sort((a, b) => Math.abs(a + 100 - rating) - Math.abs(b + 100 - rating));
	const merged = new Map<Uci, number>();
	for (const band of bands) {
		for (const m of node.get(band) ?? []) merged.set(m.uci, (merged.get(m.uci) ?? 0) + m.count);
		if ([...merged.values()].reduce((s, n) => s + n, 0) >= MIN_SAMPLE) break;
	}
	return [...merged].map(([uci, count]) => ({ uci, count })).sort((a, b) => b.count - a.count);
}

export function sampleReply(explorer: Explorer, fen: Fen, rating: number, random = Math.random): Uci | undefined {
	const moves = bandReplies(explorer, posKey(fen), rating);
	const total = moves.reduce((s, m) => s + m.count, 0);
	if (!total) return undefined;
	let pick = random() * total;
	for (const m of moves) {
		pick -= m.count;
		if (pick < 0) return m.uci;
	}
	return moves[moves.length - 1].uci;
}

/** Both evaluations in centipawns from the student's side. */
export function adjudicate(startCp: number, finalCp: number): ArenaResult {
	const delta = finalCp - startCp;
	return delta > ARENA_MARGIN_CP ? 'win' : delta < -ARENA_MARGIN_CP ? 'loss' : 'draw';
}

/** Elo against an opponent pool sampled at the player's own rating. */
export function updateRating(rating: number, result: ArenaResult, k = 32): number {
	const score = result === 'win' ? 1 : result === 'draw' ? 0.5 : 0;
	return Math.round(rating + k * (score - 0.5));
}

export type ArenaState =
	| { kind: 'student'; fen: Fen; moves: Uci[] }
	| { kind: 'opponent'; fen: Fen; moves: Uci[] }
	/** The players' data ran out: the UI asks the engine for the final evaluation. */
	| { kind: 'judging'; fen: Fen; moves: Uci[] }
	| { kind: 'done'; fen: Fen; moves: Uci[]; result: ArenaResult; startCp: number; finalCp: number };

export type ArenaEvent =
	| { type: 'move'; uci: Uci }
	| { type: 'outOfData' }
	| { type: 'judged'; startCp: number; finalCp: number };

/** The moves every line of the course begins with; Arena games start after them. */
export function sharedPrefix(course: Course): { fen: Fen; moves: Uci[] } {
	const [first, ...rest] = course.lines;
	let n = 0;
	while (first && n < first.plies.length && rest.every((l) => l.plies[n]?.uci === first.plies[n].uci)) n++;
	return n ? { fen: first.plies[n - 1].fenAfter, moves: first.plies.slice(0, n).map((p) => p.uci) } : { fen: START_FEN, moves: [] };
}

export function startArena(side: Color, from: { fen: Fen; moves: Uci[] } = { fen: START_FEN, moves: [] }): ArenaState {
	const turn = from.fen.split(' ')[1] as Color;
	return { kind: turn === side ? 'student' : 'opponent', fen: from.fen, moves: from.moves };
}

function play(fen: Fen, uci: Uci): Fen | undefined {
	try {
		const chess = new Chess(fen);
		chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined });
		return chess.fen() as Fen;
	} catch {
		return undefined;
	}
}

export function arenaStep(state: ArenaState, event: ArenaEvent): ArenaState {
	if (event.type === 'move' && (state.kind === 'student' || state.kind === 'opponent')) {
		const fen = play(state.fen, event.uci);
		if (!fen) return state;
		const moves = [...state.moves, event.uci];
		if (new Chess(fen).isGameOver()) return { kind: 'judging', fen, moves };
		return state.kind === 'student' ? { kind: 'opponent', fen, moves } : { kind: 'student', fen, moves };
	}
	if (event.type === 'outOfData' && state.kind === 'opponent') return { kind: 'judging', fen: state.fen, moves: state.moves };
	if (event.type === 'judged' && state.kind === 'judging')
		return { ...state, kind: 'done', result: adjudicate(event.startCp, event.finalCp), startCp: event.startCp, finalCp: event.finalCp };
	return state;
}
