import type { Color, Fen, San, Uci } from '#lib/chess/types.ts';

/** Engine score from White's point of view. `mate: 3` means White mates in 3; `mate: 0` means the side to move is mated. */
export type Score = { cp: number; mate?: undefined } | { mate: number; cp?: undefined };

export interface EngineLine {
	/** Principal variation, first move first. */
	pv: Uci[];
	score: Score;
	depth: number;
}

export interface PositionAnalysis {
	fen: Fen;
	depth: number;
	/** MultiPV lines, best first. Empty for a finished game (mate or stalemate). */
	lines: EngineLine[];
}

/**
 * Move classes, worst-to-best ordering lives in CLASSIFICATIONS. Our own names (not Chess.com's):
 * find = brilliant, sharp = great, strong = excellent, loose = inaccuracy, missed = miss, only = forced.
 */
export type Classification =
	| 'find'
	| 'sharp'
	| 'best'
	| 'strong'
	| 'good'
	| 'book'
	| 'only'
	| 'loose'
	| 'mistake'
	| 'missed'
	| 'blunder';

export interface MoveReview {
	ply: number;
	color: Color;
	san: San;
	uci: Uci;
	fenBefore: Fen;
	fenAfter: Fen;
	classification: Classification;
	/** Expected-points loss for the mover, 0..1. */
	loss: number;
	/** Win chance for White, 0..100, before and after the move. */
	winBefore: number;
	winAfter: number;
	/** Per-move accuracy for the mover, 0..100. */
	accuracy: number;
	/** Engine's best move in fenBefore, and its continuation. */
	best: { uci: Uci; san: San; pv: Uci[]; score: Score };
	/** Score of fenAfter (White POV). */
	scoreAfter: Score;
	alternatives?: EngineLine[];
	/** Coach text, built from the analysis. */
	explanation: { headline: string; detail?: string };
}

export interface PlayerSummary {
	accuracy: number;
	/** Rough performance estimate from move quality. */
	estimatedRating: number;
	acpl: number;
	counts: Record<Classification, number>;
}

export interface GameReview {
	gameId: string;
	depth: number;
	opening?: { eco: string; name: string };
	moves: MoveReview[];
	white: PlayerSummary;
	black: PlayerSummary;
}

export type GameSource = 'lichess' | 'chesscom' | 'pgn';

/** A game as stored after import, independent of where it came from. */
export interface GameRecord {
	id: string;
	source: GameSource;
	url?: string;
	white: { name: string; rating?: number };
	black: { name: string; rating?: number };
	result: '1-0' | '0-1' | '1/2-1/2' | '*';
	/** How the game ended, e.g. "checkmate", "resignation", "time". */
	termination?: string;
	timeControl?: string;
	speed?: string;
	opening?: { eco: string; name: string };
	playedAt: number;
	pgn: string;
	/** Which side the importing user played, when known. */
	userColor?: Color;
	importedAt: number;
}
