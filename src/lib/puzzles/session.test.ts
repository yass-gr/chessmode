import { describe, expect, it } from 'vitest';
import { missAttempt, solveAttempt, startAttempt, unseenIds } from '#lib/puzzles/session.ts';

describe('puzzle attempts', () => {
	it('charges a clean solve once and extends the streak', () => {
		const first = solveAttempt(startAttempt(2), true);
		expect(first).toMatchObject({ score: 1, attempt: { feedback: 'solved', charged: true, streak: 3 } });
		expect(solveAttempt(first.attempt, true).score).toBeNull();
	});

	it('charges the first miss once, then a corrected solve is a recovery with no second payment', () => {
		const missed = missAttempt(startAttempt(4));
		expect(missed).toMatchObject({ score: 0, attempt: { feedback: 'failed', charged: true, streak: 0 } });
		expect(missAttempt(missed.attempt).score).toBeNull();
		const recovered = solveAttempt(missed.attempt, false);
		expect(recovered).toMatchObject({ score: null, attempt: { feedback: 'recovered', charged: true, streak: 0 } });
		expect(solveAttempt(recovered.attempt, true).score).toBeNull();
	});

	it('does not treat a shown solution as a recovery', () => {
		const gaveUp = missAttempt(startAttempt(1));
		expect(gaveUp.attempt.feedback).toBe('failed');
		expect(gaveUp.score).toBe(0);
	});
});

describe('unseenIds', () => {
	it('hides played puzzles until the pool is exhausted', () => {
		expect(unseenIds(['a', 'b'], ['a'])).toEqual({ played: new Set(['a']), reset: false });
		expect(unseenIds(['a', 'b'], ['a', 'b', 'old'])).toEqual({ played: new Set(), reset: true });
		expect(unseenIds([], ['a']).reset).toBe(false);
	});
});
