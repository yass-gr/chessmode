import type { Uci } from '#lib/chess/types.ts';
import type { Line } from '#lib/courses/types.ts';

/**
 * - learn: first contact with a line. The move can be shown, and notes follow the coach setting.
 * - practice: recall. Answers stay hidden until a hint or a fix asks for them.
 * - drill: a deck of learned lines. A mistake or hint breaks the streak and the line can still be finished.
 * - time: unassisted moves score points against a clock.
 */
export type TrainerMode = 'learn' | 'practice' | 'drill' | 'time';

/** `none` hides the move, `source` marks the piece, `move` shows the whole move. */
export type HintStage = 'none' | 'source' | 'move';

/** Where a single line run stands. `index` points into `line.plies`. */
export type TrainerState =
	| { kind: 'opponent'; index: number }
	| { kind: 'student'; index: number; hint: HintStage }
	| { kind: 'wrong'; index: number; played: Uci; hint: HintStage }
	| { kind: 'fix'; index: number; resume: number; hint: HintStage }
	| { kind: 'done'; mistakes: number; hints: number; points: number };

export type TrainerEvent =
	| { type: 'opponentPlayed' }
	| { type: 'studentMoved'; uci: Uci }
	| { type: 'hint' }
	| { type: 'retry' }
	| { type: 'reveal' }
	| { type: 'fix' }
	| { type: 'browse'; index: number }
	| { type: 'resume' };

export interface AttemptResult {
	mistakes: number;
	hints: number;
	points: number;
}

export interface LineRun {
	line: Line;
	mode: TrainerMode;
	state: TrainerState;
	/** Distinct positions with a wrong move. A repeat at the same ply does not count again. */
	mistakes: number;
	/** Distinct positions given a hint. Source and solve at one ply count once. */
	hints: number;
	/** Correct player moves at positions that had not been hinted. */
	points: number;
	mistakeAt: number[];
	hintAt: number[];
	scoredAt: number[];
	/** First ply of this attempt. Shared-opening skip starts later than 0. */
	origin: number;
	/** When set, the board is showing a previous ply and live input waits. */
	view: number | null;
}
