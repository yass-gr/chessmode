import { createEmptyCard, fsrs, Rating, type Card } from 'ts-fsrs';
import { db, type LineProgress } from '#lib/db.ts';
import type { LineKey } from '#lib/courses/types.ts';

const scheduler = fsrs();
export function practiceRating(mistakes: number, hints: number): typeof Rating.Again | typeof Rating.Hard | typeof Rating.Good {
	return mistakes > 0 ? Rating.Again : hints > 0 ? Rating.Hard : Rating.Good;
}
export function schedule(card: Card, rating: typeof Rating.Again | typeof Rating.Hard | typeof Rating.Good, now = new Date()): Card {
	return scheduler.repeat(card, now)[rating].card;
}
export async function finishLearn(key: LineKey, courseId: string, now = new Date()): Promise<LineProgress> {
	const existing = await db.progress.get(key);
	if (existing) return existing;
	const progress: LineProgress = { key, courseId, card: schedule(createEmptyCard(now), Rating.Good, now), learnedAt: now.getTime(), reviews: 0, lapses: 0 };
	await db.progress.put(progress);
	return progress;
}
export async function finishPractice(key: LineKey, mistakes: number, hints: number, now = new Date()): Promise<LineProgress | undefined> {
	const progress = await db.progress.get(key);
	if (!progress) return undefined;
	const updated = { ...progress, card: schedule(progress.card, practiceRating(mistakes, hints), now), reviews: progress.reviews + 1, lapses: progress.lapses + (mistakes > 0 ? 1 : 0) };
	await db.progress.put(updated);
	return updated;
}
export async function dueQueue(courseId?: string, now = new Date()): Promise<LineProgress[]> {
	const rows = courseId ? await db.progress.where('courseId').equals(courseId).toArray() : await db.progress.toArray();
	return rows.filter(row => new Date(row.card.due).getTime() <= now.getTime()).sort((a, b) => +new Date(a.card.due) - +new Date(b.card.due));
}
