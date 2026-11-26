/** Opponent's mistake is shown after this delay. Auto-next waits this long after a finish. */
export const PUZZLE_SETUP_MS = 150;
export const PUZZLE_AUTO_NEXT_MS = 600;

export type PuzzleFeedback = 'pending' | 'solved' | 'failed' | 'recovered';

export interface PuzzleAttempt {
	feedback: PuzzleFeedback;
	/** True after the one rating update this puzzle is allowed. */
	charged: boolean;
	streak: number;
}

export function startAttempt(streak: number): PuzzleAttempt {
	return { feedback: 'pending', charged: false, streak };
}

export interface AttemptUpdate {
	attempt: PuzzleAttempt;
	/** Null means this click must not change the rating. */
	score: 0 | 1 | null;
}

/**
 * The first miss charges one loss and ends the streak.
 * Another click on the same puzzle does not charge again.
 * Solving after that miss is a recovery: the rating stays where the miss left it.
 * The reference product's recovery delta is not applied here; it is not confirmed.
 */
export function missAttempt(attempt: PuzzleAttempt): AttemptUpdate {
	if (attempt.charged || attempt.feedback === 'solved' || attempt.feedback === 'recovered') {
		return { attempt, score: null };
	}
	return { attempt: { feedback: 'failed', charged: true, streak: 0 }, score: 0 };
}

export function solveAttempt(attempt: PuzzleAttempt, clean: boolean): AttemptUpdate {
	if (attempt.feedback === 'solved' || attempt.feedback === 'recovered') return { attempt, score: null };
	if (!clean || attempt.charged) {
		return { attempt: { feedback: 'recovered', charged: attempt.charged, streak: 0 }, score: null };
	}
	return { attempt: { feedback: 'solved', charged: true, streak: attempt.streak + 1 }, score: 1 };
}

/** Ids still unseen. Once every puzzle in the pool has been played, the seen list starts over. */
export function unseenIds(poolIds: readonly string[], seen: readonly string[]): { played: Set<string>; reset: boolean } {
	const ids = new Set(poolIds);
	const played = seen.filter((id) => ids.has(id));
	if (ids.size > 0 && played.length >= ids.size) return { played: new Set(), reset: true };
	return { played: new Set(played), reset: false };
}
