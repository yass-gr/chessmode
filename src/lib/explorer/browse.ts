import { Chess } from 'chess.js';
import { posKey, START_FEN, type Fen, type San, type Uci } from '#lib/chess/types.ts';
import { repliesAt, type Explorer, type MoveCount } from '#lib/explorer/types.ts';

/** Rating floors stored in the shipped explorer files. `all` merges every band. */
export const EXPLORER_BANDS = [800, 1000, 1200, 1400, 1600, 1800, 2000, 2200] as const;
export type ExplorerBand = (typeof EXPLORER_BANDS)[number];
export type BandChoice = ExplorerBand | 'all';

/**
 * Below this many games the shares are a real sample, but too thin to treat like the rest.
 * Absence from a complete sample is a measured zero, which is a different state.
 */
export const SPARSE_BELOW = 20;

export type SampleKind = 'known' | 'sparse' | 'empty-band' | 'unavailable';

/** One legal reply at the position being browsed. */
export interface ExplorerReply {
	uci: Uci;
	san: San;
	/** Null when this move was not measured (no sample, or the feed omitted the tail). */
	count: number | null;
	/** Share of the measured games. Null when `count` is null. */
	share: number | null;
	/** The sample includes this position and records no games for this move. */
	zero: boolean;
}

/** What the explorer shows for one position and one rating choice. */
export interface ExplorerPosition {
	fen: Fen;
	kind: SampleKind;
	games: number;
	replies: ExplorerReply[];
}

/** A measured slice of master-game replies. `complete` means unlisted legal moves are zeros. */
export interface PositionSample {
	present: boolean;
	moves: MoveCount[];
	complete: boolean;
}

/** One step of explorer history. The root has no move. */
export interface ExplorerStep {
	fen: Fen;
	san?: San;
	uci?: Uci;
}

interface LegalMove {
	uci: Uci;
	san: San;
}

function legalMoves(fen: Fen): LegalMove[] {
	const chess = new Chess(fen);
	return chess.moves({ verbose: true }).map((move) => ({
		uci: (move.from + move.to + (move.promotion ?? '')) as Uci,
		san: move.san as San
	}));
}

export function readBand(value: string | null): BandChoice {
	if (!value || value === 'all') return 'all';
	const band = Number(value);
	return (EXPLORER_BANDS as readonly number[]).includes(band) ? (band as ExplorerBand) : 'all';
}

/** First shipped file that actually contains the position. Files overlap, so they are not summed. */
export function localSample(explorers: readonly Explorer[], fen: Fen, band: BandChoice): PositionSample | undefined {
	const key = posKey(fen);
	const explorer = explorers.find((item) => item.nodes.has(key));
	if (!explorer) return undefined;
	const node = explorer.nodes.get(key);
	if (!node) return undefined;
	if (band !== 'all' && !node.has(band)) return { present: true, moves: [], complete: true };
	return { present: true, moves: repliesAt(explorer, key, band === 'all' ? undefined : [band]), complete: true };
}

export function viewPosition(fen: Fen, sample: PositionSample | undefined): ExplorerPosition {
	const legal = legalMoves(fen);
	if (!sample?.present) {
		return { fen, kind: 'unavailable', games: 0, replies: legal.map((move) => unmeasured(move)) };
	}
	const games = sample.moves.reduce((sum, move) => sum + move.count, 0);
	if (games === 0) {
		return { fen, kind: 'empty-band', games: 0, replies: legal.map((move) => unmeasured(move)) };
	}
	const counts = new Map(sample.moves.map((move) => [move.uci, move.count]));
	const replies = legal
		.map((move) => {
			const count = counts.get(move.uci);
			if (count === undefined && !sample.complete) return unmeasured(move);
			const measured = count ?? 0;
			return {
				...move,
				count: measured,
				share: measured / games,
				zero: measured === 0
			};
		})
		.sort((a, b) => (b.count ?? -1) - (a.count ?? -1) || a.san.localeCompare(b.san));
	return { fen, kind: games < SPARSE_BELOW ? 'sparse' : 'known', games, replies };
}

function unmeasured(move: LegalMove): ExplorerReply {
	return { ...move, count: null, share: null, zero: false };
}

/** Lichess buckets under 1000 as 0. Our 800 band uses that bucket only for the live fallback. */
export function lichessRating(band: BandChoice): number | undefined {
	if (band === 'all') return undefined;
	if (band <= 800) return 0;
	return band;
}

export function lichessExplorerUrl(fen: Fen, band: BandChoice): string {
	const params = new URLSearchParams({
		fen,
		variant: 'standard',
		moves: '20',
		topGames: '0'
	});
	const rating = lichessRating(band);
	if (rating !== undefined) params.set('ratings', String(rating));
	return `https://explorer.lichess.ovh/lichess?${params}`;
}

/** Parses a Lichess opening-explorer body. The root totals are the sample; omitted moves are not zeros. */
export function parseLichessExplorer(json: unknown): PositionSample {
	const body = typeof json === 'object' && json !== null ? (json as Record<string, unknown>) : {};
	const games = countOf(body.white) + countOf(body.draws) + countOf(body.black);
	const moves: MoveCount[] = [];
	if (Array.isArray(body.moves)) {
		for (const entry of body.moves) {
			if (typeof entry !== 'object' || entry === null) continue;
			const row = entry as Record<string, unknown>;
			if (typeof row.uci !== 'string' || row.uci.length < 4) continue;
			const count = countOf(row.white) + countOf(row.draws) + countOf(row.black);
			moves.push({ uci: row.uci as Uci, count });
		}
	}
	const listed = moves.reduce((sum, move) => sum + move.count, 0);
	return { present: games > 0, moves, complete: games > 0 && listed >= games };
}

function countOf(value: unknown): number {
	return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

export function explorerHref(options: { fen?: Fen; courseId?: string; band?: BandChoice; moves?: readonly Uci[] } = {}): string {
	const params = new URLSearchParams();
	if (options.courseId) params.set('course', options.courseId);
	if (options.band && options.band !== 'all') params.set('band', String(options.band));
	if (options.fen && options.fen !== START_FEN) params.set('fen', options.fen);
	if (options.moves?.length) params.set('moves', options.moves.join(','));
	const query = params.toString();
	return query ? `/explorer?${query}` : '/explorer';
}

function applyUci(chess: Chess, uci: string) {
	return chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] as 'q' | 'r' | 'b' | 'n' | undefined });
}

/** Replays UCI moves from `fen`, stopping at the first illegal one. */
export function replayExplorer(fen: Fen, moves: readonly Uci[]): ExplorerStep[] {
	const steps: ExplorerStep[] = [{ fen }];
	let chess: Chess;
	try {
		chess = new Chess(fen);
	} catch {
		return [{ fen: START_FEN }];
	}
	for (const uci of moves) {
		let move;
		try {
			move = applyUci(chess, uci);
		} catch {
			break;
		}
		steps.push({
			fen: chess.fen() as Fen,
			san: move.san as San,
			uci: (move.from + move.to + (move.promotion ?? '')) as Uci
		});
	}
	return steps;
}

/** Plays `uci` at `cursor`, dropping any forward history. */
export function playExplorer(steps: readonly ExplorerStep[], cursor: number, uci: Uci): ExplorerStep[] {
	const at = Math.min(Math.max(cursor, 0), steps.length - 1);
	const chess = new Chess(steps[at]?.fen ?? START_FEN);
	const move = applyUci(chess, uci);
	const next: ExplorerStep = {
		fen: chess.fen() as Fen,
		san: move.san as San,
		uci: (move.from + move.to + (move.promotion ?? '')) as Uci
	};
	return [...steps.slice(0, at + 1), next];
}

export function analysisHref(fen: Fen): string {
	const params = new URLSearchParams();
	if (fen !== START_FEN) params.set('fen', fen);
	const query = params.toString();
	return query ? `/analysis?${query}` : '/analysis';
}
