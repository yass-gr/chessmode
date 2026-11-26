import type { Fen, Uci } from '#lib/chess/types.ts';
import type { PositionAnalysis } from '#lib/review/types.ts';

export interface AnalyseOptions {
	depth: number;
	/** Stop the search after this many milliseconds as well as at `depth`. */
	movetime?: number;
	multiPv?: number;
	/** Restrict the search to these moves (UCI `searchmoves`). */
	searchMoves?: Uci[];
	signal?: AbortSignal;
}

/**
 * One Stockfish instance in a Web Worker. Calls are queued and run one at a time.
 * `onUpdate` fires on every completed depth so the UI can stream results.
 */
export interface Engine {
	ready(): Promise<void>;
	analyse(fen: Fen, opts: AnalyseOptions, onUpdate?: (a: PositionAnalysis) => void): Promise<PositionAnalysis>;
	dispose(): void;
}
