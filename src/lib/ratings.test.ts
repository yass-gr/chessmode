import { describe, expect, it } from 'vitest';
import {
	ARENA_REGRESSION,
	clampStoredRating,
	elo,
	expected,
	manualRating,
	nearestPickerRating,
	openingRating,
	ratingPickerValues
} from '#lib/ratings.ts';

describe('stored ratings', () => {
	it('keeps Elo inside 100–3000 and offers 400–3000 in steps of 100', () => {
		expect(clampStoredRating(50)).toBe(100);
		expect(clampStoredRating(3001)).toBe(3000);
		expect(clampStoredRating(966.4)).toBe(966);
		expect(clampStoredRating(Number.NaN)).toBe(950);
		const picker = ratingPickerValues();
		expect(picker[0]).toBe(400);
		expect(picker.at(-1)).toBe(3000);
		expect(picker).toHaveLength(27);
		expect(manualRating(450)).toBe(500);
		expect(manualRating(90)).toBe(400);
		expect(nearestPickerRating(966)).toBe(1000);
	});

	it('moves a puzzle rating by the Elo expectation', () => {
		expect(expected(1200, 1200)).toBeCloseTo(0.5);
		expect(elo(1200, 1200, 1)).toBe(1216);
		expect(elo(1200, 1600, 1)).toBeGreaterThan(elo(1200, 1200, 1));
		expect(elo(1200, 800, 0)).toBeLessThan(elo(1200, 1200, 0));
	});
});

describe('openingRating', () => {
	it('uses the onboarding bracket when the player chose one', () => {
		expect(openingRating({ kind: 'arena', bracket: 'under-400', others: [] })).toBe(750);
		expect(openingRating({ kind: 'arena', bracket: '400-800', others: [] })).toBe(1000);
		expect(openingRating({ kind: 'arena', bracket: '800-1200', others: [] })).toBe(1200);
		expect(openingRating({ kind: 'arena', bracket: '1200-1600', others: [] })).toBe(1400);
		expect(openingRating({ kind: 'arena', bracket: '1600-2000', others: [] })).toBe(1550);
		expect(openingRating({ kind: 'arena', bracket: '2000-plus', others: [] })).toBe(1700);
		expect(openingRating({ kind: 'arena', bracket: 'unknown', others: [{ rating: 2000, games: 40 }] })).toBe(950);
		expect(openingRating({ kind: 'puzzle', bracket: null, others: [] })).toBe(950);
		expect(openingRating({ kind: 'puzzle', bracket: '400-800', others: [] })).toBe(1050);
		expect(openingRating({ kind: 'puzzle', bracket: '2000-plus', others: [] })).toBe(1350);
	});

	it('regresses a new Arena rating 65% of the way from 950 toward the mean of courses with 20 games', () => {
		expect(openingRating({ kind: 'arena', bracket: null, others: [] })).toBe(950);
		expect(openingRating({ kind: 'arena', bracket: null, others: [{ rating: 2000, games: 19 }] })).toBe(950);
		const mean = 1350;
		expect(openingRating({ kind: 'arena', bracket: null, others: [{ rating: 1150, games: 20 }, { rating: 1550, games: 30 }] })).toBe(
			Math.round(950 + ARENA_REGRESSION * (mean - 950))
		);
		expect(openingRating({ kind: 'arena', bracket: 'under-400', others: [{ rating: 2000, games: 40 }] })).toBe(750);
	});
});
