import { Chess } from 'chess.js';
import { posKey, turnOf, type Color, type Fen, type Ply, type San } from '#lib/chess/types.ts';
import { db } from '#lib/db.ts';
import { getEngine } from '#lib/engine/stockfish.ts';
import { readPgn } from '#lib/import/pgn.ts';
import { centipawnLoss, estimatedRating, gameAccuracy, lichessWinPercent, moveAccuracy, ratingContext } from '#lib/review/accuracy.ts';
import { CLASSIFICATIONS, classify } from '#lib/review/classify.ts';
import { buildBranches, explain } from '#lib/review/explain.ts';
import type { Classification, GameRecord, GameReview, MoveReview, PlayerSummary, PositionAnalysis, Score } from '#lib/review/types.ts';

export const DEPTHS = [
	{ label: 'Fast', value: 12 },
	{ label: 'Standard', value: 16 },
	{ label: 'Deep', value: 20 }
] as const;
export type ReviewDepth = (typeof DEPTHS)[number]['value'];
export const DEFAULT_DEPTH: ReviewDepth = 16;
export const DEPTH_SETTING = 'reviewDepth';

export function reviewCacheKey(gameId: string, depth: number) {
	return gameId + ':' + depth + ':v2';
}

export interface ReviewProgress {
	ply: number;
	total: number;
	moves: readonly MoveReview[];
	win: readonly number[];
	initialScore: Score;
	opening?: GameReview['opening'];
}

export interface ReviewOptions {
	depth?: number;
	plies?: readonly Ply[];
	signal?: AbortSignal;
	onProgress?: (progress: ReviewProgress) => void;
}

let openings: Promise<Map<string, string>> | undefined;
function openingBook(): Promise<Map<string, string>> {
	return openings ??= fetch('/data/openings.json').then(async response => {
		if (!response.ok) throw new Error('Could not load the opening book.');
		const raw: unknown = await response.json();
		if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('The opening book is invalid.');
		const book = new Map<string, string>();
		for (const [key, value] of Object.entries(raw)) {
			if (typeof value === 'string') book.set(key, value);
		}
		return book;
	}).catch((error: unknown) => {
		openings = undefined;
		throw error;
	});
}

function terminalScore(fen: Fen): Score | undefined {
	const position = new Chess(fen);
	if (position.isCheckmate()) return { mate: 0 };
	if (position.isStalemate() || position.isInsufficientMaterial() || position.isDrawByFiftyMoves()) return { cp: 0 };
}

async function analysePosition(fen: Fen, depth: number, signal?: AbortSignal): Promise<{ analysis: PositionAnalysis; score: Score }> {
	signal?.throwIfAborted();
	const terminal = terminalScore(fen);
	if (terminal) return { analysis: { fen, depth: 0, lines: [] }, score: terminal };
	const analysis = await getEngine().analyse(fen, { depth, signal, multiPv: 2 });
	const best = analysis.lines[0];
	if (!best) throw new Error('Stockfish returned no evaluation for this position.');
	return { analysis, score: best.score };
}

const CLASS_KEYS = Object.keys(CLASSIFICATIONS) as Classification[];

function summarize(moves: MoveReview[], win: number[], color: Color): PlayerSummary {
	const counts = Object.fromEntries(CLASS_KEYS.map(key => [key, 0])) as PlayerSummary['counts'];
	let cpLoss = 0;
	let count = 0;
	for (const move of moves) {
		if (move.color !== color) continue;
		counts[move.classification]++;
		cpLoss += centipawnLoss(move.best.score, move.scoreAfter, color);
		count++;
	}
	const acpl = count ? cpLoss / count : 0;
	return {
		counts, acpl, ratingContext: ratingContext(count ? acpl : undefined, count), estimatedRating: count ? estimatedRating(acpl) : 0,
		accuracy: gameAccuracy(win, moves.map(move => move.color), color)
	};
}

export async function reviewGame(game: GameRecord, opts: ReviewOptions = {}): Promise<GameReview> {
	const { depth = DEFAULT_DEPTH, signal, onProgress } = opts;
	signal?.throwIfAborted();
	const key = reviewCacheKey(game.id, depth);
	const cached = await db.reviews.get(key);
	signal?.throwIfAborted();
	if (cached) {
		const first = cached.moves[0];
		if (first) onProgress?.({
			ply: cached.moves.length, total: cached.moves.length, moves: cached.moves,
			win: [first.winBefore, ...cached.moves.map(move => move.winAfter)],
			initialScore: first.best.score, opening: cached.opening
		});
		return cached;
	}

	const plies = opts.plies ?? readPgn(game.pgn).plies;
	if (!plies.length) throw new Error('The game has no moves to review.');
	const book = await openingBook();
	const moves: MoveReview[] = [];
	let before = await analysePosition(plies[0].fenBefore, depth, signal);
	const initialScore = before.score;
	const win = [lichessWinPercent(initialScore, plies[0].color)];
	let namedOpening: GameReview['opening'];
	let inBook = true;

	const report = () => onProgress?.({
		ply: moves.length, total: plies.length, moves: [...moves], win: [...win],
		initialScore, opening: namedOpening ?? game.opening
	});
	report();

	for (const [index, move] of plies.entries()) {
		const preferred = before.analysis.lines[0];
		if (!preferred) throw new Error('This PGN continues after the game has ended.');
		const after = await analysePosition(move.fenAfter, depth, signal);
		const bookEntry: string | undefined = inBook ? book.get(posKey(move.fenAfter)) : undefined;
		inBook = bookEntry !== undefined;
		if (bookEntry) {
			const [eco, name] = bookEntry.split('|');
			if (name) namedOpening = { eco, name };
		}
		const winBefore = win[index];
		const winAfter = lichessWinPercent(after.score, turnOf(move.fenAfter));
		const best = {
			uci: preferred.pv[0], pv: preferred.pv, score: preferred.score,
			san: new Chess(move.fenBefore).move(preferred.pv[0]).san as San
		};
		const reviewed = {
			...move, ply: index + 1, best, scoreAfter: after.score, winBefore, winAfter,
			accuracy: move.color === 'w' ? moveAccuracy(winBefore, winAfter) : moveAccuracy(100 - winBefore, 100 - winAfter),
			...classify({ move, before: before.analysis, scoreAfter: after.score, previous: moves.at(-1), inBook }),
			alternatives: before.analysis.lines
		};
		moves.push({
			...reviewed,
			explanation: explain(reviewed, after.analysis.lines[0]?.pv ?? [], namedOpening?.name),
			branches: buildBranches(reviewed, after.analysis.lines[0]?.pv ?? [], namedOpening?.name, !inBook && index > 0 && moves.at(-1)?.classification === 'book')
		});
		win.push(winAfter);
		before = after;
		report();
	}

	signal?.throwIfAborted();
	const review: GameReview = {
		gameId: game.id, depth, opening: namedOpening ?? game.opening, moves,
		white: summarize(moves, win, 'w'), black: summarize(moves, win, 'b')
	};
	await db.reviews.put({ ...review, key });
	return review;
}
