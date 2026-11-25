import { describe, expect, it } from 'vitest';
import { createEmptyCard, Rating } from 'ts-fsrs';
import { practiceRating, schedule } from './srs.ts';

describe('scheduling', () => {
	it('rates mistakes before hints', () => {
		expect(practiceRating(1, 1)).toBe(Rating.Again);
		expect(practiceRating(0, 1)).toBe(Rating.Hard);
		expect(practiceRating(0, 0)).toBe(Rating.Good);
	});
	it('schedules a newly learned card', () => {
		const now = new Date('2026-01-01T12:00:00Z');
		expect(schedule(createEmptyCard(now), Rating.Good, now).due.getTime()).toBeGreaterThan(now.getTime());
	});
});
