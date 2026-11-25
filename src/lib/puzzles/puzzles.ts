import { Chess } from 'chess.js';
import type { Fen, Uci } from '#lib/chess/types.ts';

/** A Lichess puzzle. `fen` is before the opponent's mistake, `moves[0]`; the solver plays moves 1, 3, 5... */
export interface Puzzle {
	id: string;
	fen: Fen;
	moves: Uci[];
	rating: number;
	themes: string[];
	opening: string;
}

export function parsePuzzles(json: unknown): Puzzle[] {
	if (!Array.isArray(json)) throw new Error('Not a puzzle file');
	return json.map((p) => {
		if (typeof p?.id !== 'string' || typeof p.fen !== 'string' || !Array.isArray(p.moves) || p.moves.length < 2)
			throw new Error('Bad puzzle row');
		return { id: p.id, fen: p.fen, moves: p.moves, rating: Number(p.rating), themes: p.themes ?? [], opening: p.opening ?? '' };
	});
}

export async function loadPuzzles(courseId: string): Promise<Puzzle[]> {
	const res = await fetch(`/data/puzzles/${courseId}.json`);
	return res.ok ? parsePuzzles(await res.json()) : [];
}

/** `index` points at the next move in `puzzle.moves`; even indexes are the opponent's. */
export type PuzzleState =
	| { kind: 'opponent'; index: number; fen: Fen }
	| { kind: 'solving'; index: number; fen: Fen }
	| { kind: 'solved'; fen: Fen; clean: boolean }
	/** The first wrong move fails the puzzle for rating; the player may still finish it. */
	| { kind: 'wrong'; index: number; fen: Fen; played: Uci };

export function startPuzzle(puzzle: Puzzle): PuzzleState {
	return { kind: 'opponent', index: 0, fen: puzzle.fen };
}

function apply(fen: Fen, uci: Uci): { fen: Fen; mate: boolean } | undefined {
	try {
		const chess = new Chess(fen);
		chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined });
		return { fen: chess.fen() as Fen, mate: chess.isCheckmate() };
	} catch {
		return undefined;
	}
}

export type PuzzleEvent = { type: 'opponent' } | { type: 'move'; uci: Uci } | { type: 'retry' };

export function puzzleStep(puzzle: Puzzle, state: PuzzleState, event: PuzzleEvent, failed = false): PuzzleState {
	if (event.type === 'opponent' && state.kind === 'opponent') {
		const next = apply(state.fen, puzzle.moves[state.index]);
		if (!next) return state;
		return { kind: 'solving', index: state.index + 1, fen: next.fen };
	}
	if (event.type === 'retry' && state.kind === 'wrong') return { kind: 'solving', index: state.index, fen: state.fen };
	if (event.type === 'move' && state.kind === 'solving') {
		const expected = puzzle.moves[state.index];
		const next = apply(state.fen, event.uci);
		if (!next) return state;
		const right = event.uci === expected || next.mate;
		if (!right) return { kind: 'wrong', index: state.index, fen: state.fen, played: event.uci };
		if (next.mate || state.index + 1 >= puzzle.moves.length) return { kind: 'solved', fen: next.fen, clean: !failed };
		return { kind: 'opponent', index: state.index + 1, fen: next.fen };
	}
	return state;
}

/** An unseen puzzle near the player's rating, widening the window until one fits. */
export function nextPuzzle(pool: Puzzle[], rating: number, seen: Set<string>, random = Math.random): Puzzle | undefined {
	const fresh = pool.filter((p) => !seen.has(p.id));
	const candidates = fresh.length ? fresh : pool;
	for (const window of [100, 200, 400, 800, Infinity]) {
		const near = candidates.filter((p) => Math.abs(p.rating - rating) <= window);
		if (near.length) return near[Math.floor(random() * near.length)];
	}
	return undefined;
}
