import { describe, expect, it } from 'vitest';
import { createEmptyCard, Rating, State } from 'ts-fsrs';
import type { LineKey } from '#lib/courses/types.ts';
import type { LineProgress } from '#lib/db.ts';
import { discovered, gradeAttempt, graded, nextConfidence, practiceRating, schedule } from './srs.ts';

const now = new Date('2026-01-01T12:00:00Z');

function row(due: Date): LineProgress {
	return {
		key: 'course/line' as LineKey,
		courseId: 'course',
		card: { ...createEmptyCard(now), due, stability: 10, difficulty: 5, state: State.Review, reps: 3 },
		learnedAt: now.getTime(),
		reviews: 3,
		lapses: 0,
		clean: true,
		confidence: 6
	};
}

describe('attempt grades', () => {
	it('treats one mistake plus one hint as Hard, and two of either as Again', () => {
		expect(gradeAttempt(0, 0)).toBe('good');
		expect(gradeAttempt(1, 0)).toBe('hard');
		expect(gradeAttempt(0, 1)).toBe('hard');
		expect(gradeAttempt(1, 1)).toBe('hard');
		expect(gradeAttempt(2, 0)).toBe('again');
		expect(gradeAttempt(0, 2)).toBe('again');
		expect(practiceRating(1, 1)).toBe(Rating.Hard);
		expect(practiceRating(2, 0)).toBe(Rating.Again);
		expect(practiceRating(0, 0)).toBe(Rating.Good);
	});

	it('moves confidence from 5 and keeps it inside 1 to 10', () => {
		expect(nextConfidence(undefined, 0, 0)).toBe(7);
		expect(nextConfidence(5, 1, 1)).toBe(3);
		expect(nextConfidence(9, 0, 0)).toBe(10);
		expect(nextConfidence(1, 2, 1)).toBe(1);
	});
});

describe('scheduling', () => {
	it('uses a one-minute first step and a ten-minute relearn step', () => {
		const again = schedule(createEmptyCard(now), Rating.Again, now);
		expect(again.due.getTime() - now.getTime()).toBe(60_000);
		const relearn = schedule({ ...again, state: State.Review, stability: 20, difficulty: 5 }, Rating.Again, now);
		expect(relearn.due.getTime() - now.getTime()).toBe(10 * 60_000);
	});

	it('records a discovery without grading, and leaves an existing due date', () => {
		const created = discovered(undefined, 'course/line' as LineKey, 'course', now);
		expect(created.card.due.getTime()).toBe(now.getTime());
		expect(created.reviews).toBe(0);
		expect(created.confidence).toBe(5);
		const due = new Date('2026-02-01T00:00:00Z');
		expect(discovered(row(due), 'course/line' as LineKey, 'course', now).card.due).toEqual(due);
	});

	it('grades a finished attempt once and keeps perfection after a later miss', () => {
		const clean = graded(row(now), 0, 0, now);
		expect(clean.clean).toBe(true);
		expect(clean.confidence).toBe(8);
		expect(clean.reviews).toBe(4);
		const missed = graded(clean, 1, 0, now);
		expect(missed.clean).toBe(true);
		expect(missed.lapses).toBe(0);
		expect(graded(row(now), 2, 0, now).lapses).toBe(1);
	});
});
