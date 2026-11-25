import { db, type RatingRecord } from '#lib/db.ts';

export const PUZZLE_START = 1200;

/** Elo expected score of a player rated `rating` against `opponent`. */
export function expected(rating: number, opponent: number): number {
	return 1 / (1 + 10 ** ((opponent - rating) / 400));
}

export function elo(rating: number, opponent: number, score: 0 | 0.5 | 1, k = 32): number {
	return Math.round(rating + k * (score - expected(rating, opponent)));
}

export async function getRating(kind: RatingRecord['kind'], courseId: string, start: number): Promise<RatingRecord> {
	const key = `${kind}/${courseId}` as const;
	return (await db.ratings.get(key)) ?? { key, kind, courseId, rating: start, games: 0, wins: 0, draws: 0, losses: 0, history: [], seen: [] };
}

export async function recordResult(record: RatingRecord, rating: number, score: 0 | 0.5 | 1, seen?: string): Promise<RatingRecord> {
	const next: RatingRecord = {
		...record,
		rating,
		games: record.games + 1,
		wins: record.wins + (score === 1 ? 1 : 0),
		draws: record.draws + (score === 0.5 ? 1 : 0),
		losses: record.losses + (score === 0 ? 1 : 0),
		history: [...record.history, { at: Date.now(), rating }].slice(-200),
		seen: seen ? [...record.seen.filter((id) => id !== seen), seen].slice(-1000) : record.seen
	};
	await db.ratings.put(next);
	return next;
}
