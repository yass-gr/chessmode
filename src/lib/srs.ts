import { createEmptyCard, fsrs, Rating, type Card } from 'ts-fsrs';
import { db, type LineProgress } from '#lib/db.ts';
import type { LineKey } from '#lib/courses/types.ts';

/** Observed client bounds: 90% retention, 1m then 10m learning, 10m relearn, no fuzz, 100-year cap. */
const scheduler = fsrs({
	request_retention: 0.9,
	maximum_interval: 36_500,
	enable_fuzz: false,
	enable_short_term: true,
	learning_steps: ['1m', '10m'],
	relearning_steps: ['10m']
});

export type AttemptGrade = 'good' | 'hard' | 'again';

const RATINGS = { good: Rating.Good, hard: Rating.Hard, again: Rating.Again } as const;

/** Two distinct mistakes or two distinct hints is Again. One of either, including one of each, is Hard. */
export function gradeAttempt(mistakes: number, hints: number): AttemptGrade {
	if (mistakes >= 2 || hints >= 2) return 'again';
	if (mistakes > 0 || hints > 0) return 'hard';
	return 'good';
}

export function practiceRating(mistakes: number, hints: number): typeof Rating.Again | typeof Rating.Hard | typeof Rating.Good {
	return RATINGS[gradeAttempt(mistakes, hints)];
}

/** Clean adds 2. Each distinct mistake or hint subtracts one. Missing confidence is the starting 5. */
export function nextConfidence(current: number | undefined, mistakes: number, hints: number): number {
	const base = current ?? 5;
	const delta = mistakes === 0 && hints === 0 ? 2 : -(mistakes + hints);
	return Math.min(10, Math.max(1, base + delta));
}

export function schedule(card: Card, rating: typeof Rating.Again | typeof Rating.Hard | typeof Rating.Good, now = new Date()): Card {
	return scheduler.repeat(card, now)[rating].card;
}

/** A first Learn stores the line without a graded repetition. A later Learn leaves the card alone. */
export function discovered(existing: LineProgress | undefined, key: LineKey, courseId: string, now: Date): LineProgress {
	if (existing) return existing;
	return {
		key,
		courseId,
		card: createEmptyCard(now),
		learnedAt: now.getTime(),
		reviews: 0,
		lapses: 0,
		confidence: 5
	};
}

/** One finished Practice, Drill or Time attempt. Perfection sticks until a Practice reset clears it. */
export function graded(progress: LineProgress, mistakes: number, hints: number, now: Date): LineProgress {
	const grade = gradeAttempt(mistakes, hints);
	return {
		...progress,
		card: schedule(progress.card, RATINGS[grade], now),
		reviews: progress.reviews + 1,
		lapses: progress.lapses + (grade === 'again' ? 1 : 0),
		clean: progress.clean || grade === 'good',
		confidence: nextConfidence(progress.confidence, mistakes, hints)
	};
}

export async function finishLearn(key: LineKey, courseId: string, now = new Date()): Promise<{ progress: LineProgress; created: boolean }> {
	const existing = await db.progress.get(key);
	const progress = discovered(existing, key, courseId, now);
	if (!existing) await db.progress.put(progress);
	return { progress, created: !existing };
}

export async function finishPractice(key: LineKey, mistakes: number, hints: number, now = new Date()): Promise<LineProgress | undefined> {
	const progress = await db.progress.get(key);
	if (!progress) return undefined;
	const updated = graded(progress, mistakes, hints, now);
	await db.progress.put(updated);
	return updated;
}
