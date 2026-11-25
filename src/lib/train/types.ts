import type { Uci } from '#lib/chess/types.ts';
import type { Line } from '#lib/courses/types.ts';

/**
 * - learn: first contact with a line. Notes shown, the student's move is shown as an arrow until played.
 * - practice: SRS review of one due line. No arrows, mistakes count against the card.
 * - drill: lines back to back; the first mistake ends the run.
 * - time: lines back to back against a clock; clean lines add time, mistakes cost time.
 */
export type TrainerMode = 'learn' | 'practice' | 'drill' | 'time';

/** Where a single line run stands. `index` points into `line.plies`. */
export type TrainerState =
	| { kind: 'opponent'; index: number }
	| { kind: 'student'; index: number; revealed: boolean }
	| { kind: 'wrong'; index: number; played: Uci; revealed: boolean }
	| { kind: 'done'; mistakes: number; hints: number };

export type TrainerEvent =
	| { type: 'opponentPlayed' }
	| { type: 'studentMoved'; uci: Uci }
	| { type: 'hint' }
	| { type: 'retry' };

export interface LineRun {
	line: Line;
	mode: TrainerMode;
	state: TrainerState;
	mistakes: number;
	hints: number;
}
