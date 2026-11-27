import { Chess } from 'chess.js';
import { posKey, turnOf, type Color, type Fen, type Ply, type San } from '#lib/chess/types.ts';
import { db } from '#lib/db.ts';
import { ReviewPool } from '#lib/engine/review-pool.ts';
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
	return gameId + ':' + depth + ':v4';
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
	onReview?: (review: GameReview, refined: number, total: number) => void;
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

async function analysePosition(pool: ReviewPool, fen: Fen, index: number, depth: number, nodes: number, signal?: AbortSignal): Promise<{ analysis: PositionAnalysis; score: Score }> {
	signal?.throwIfAborted();
	const terminal = terminalScore(fen);
	if (terminal) return { analysis: { fen, depth: 0, lines: [] }, score: terminal };
	const analysis = await pool.analyse(fen, index, depth, nodes, signal);
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

type EvaluatedPosition = { analysis: PositionAnalysis; score: Score };

export function criticalPositions(moves: readonly MoveReview[]): number[] {
	const candidates = new Set(['find', 'sharp', 'only', 'missed', 'mistake', 'blunder']);
	const indices = new Set<number>();
	for (const [index, move] of moves.entries()) {
		if (move.classification === 'book') continue;
		if (move.uci !== move.best.uci || move.loss >= 0.05 || candidates.has(move.classification)
			|| Math.abs(move.winAfter - move.winBefore) >= 10) {
			indices.add(index);
			indices.add(index + 1);
		}
	}
	return [...indices];
}
const previews = new Map<string, EvaluatedPosition[]>();

function buildReview(game: GameRecord, depth: number, plies: readonly Ply[], book: Map<string, string>, positions: EvaluatedPosition[]): GameReview {
	const moves: MoveReview[] = [];
	const win = [lichessWinPercent(positions[0].score, plies[0].color)];
	let namedOpening: GameReview['opening'];
	let inBook = true;
	for (const [index, move] of plies.entries()) {
		const before = positions[index];
		const after = positions[index + 1];
		const preferred = before.analysis.lines[0];
		if (!preferred) throw new Error('This PGN continues after the game has ended.');
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
	}
	return { gameId: game.id, depth, opening: namedOpening ?? game.opening, moves,
		white: summarize(moves, win, 'w'), black: summarize(moves, win, 'b') };
}

export async function reviewGame(game: GameRecord, opts: ReviewOptions = {}): Promise<GameReview> {
	const { depth = DEFAULT_DEPTH, signal, onProgress, onReview } = opts;
	signal?.throwIfAborted();
	const key = reviewCacheKey(game.id, depth);
	const cached = await db.reviews.get(key);
	signal?.throwIfAborted();
	if (cached) return cached;
	const plies = opts.plies ?? readPgn(game.pgn).plies;
	if (!plies.length) throw new Error('The game has no moves to review.');
	const book = await openingBook();
	signal?.throwIfAborted();
	const pool = new ReviewPool();
	const abortPool = () => pool.dispose();
	signal?.addEventListener('abort', abortPool, { once: true });
	try {
		const fens = [plies[0].fenBefore, ...plies.map(move => move.fenAfter)];
		const previewKey = key + ':preview';
		let positions = previews.get(key) ?? (await db.settings.get(previewKey))?.value as EvaluatedPosition[] | undefined;
		if (!positions) {
			let done = 0;
			positions = await Promise.all(fens.map(async (fen, index) => {
				const result = await analysePosition(pool, fen, index, depth, 75_000, signal);
				done++;
				onProgress?.({ ply: Math.min(done, plies.length), total: plies.length, moves: [], win: [], initialScore: { cp: 0 } });
				return result;
			}));
			previews.set(key, positions);
			await db.settings.put({ key: previewKey, value: positions });
		}
		let review = buildReview(game, depth, plies, book, positions);
		const order = criticalPositions(review.moves);
		onReview?.(review, 0, order.length);
		let refined = 0;
		await Promise.all(order.map(async (index, slot) => {
			const result = await analysePosition(pool, fens[index], slot, depth, depth === DEFAULT_DEPTH ? 400_000 : 0, signal);
			signal?.throwIfAborted();
			positions[index] = result;
			refined++;
			review = buildReview(game, depth, plies, book, positions);
			onReview?.(review, refined, order.length);
		}));
		signal?.throwIfAborted();
		await db.reviews.put({ ...review, key });
		previews.delete(key);
		await db.settings.delete(previewKey);
		return review;
	} finally {
		signal?.removeEventListener('abort', abortPool);
		pool.dispose();
	}
}
