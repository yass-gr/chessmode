import { db, type RatingRecord } from '#lib/db.ts';
import { arenaSeed, puzzleSeed } from '#lib/onboarding/onboarding.ts';
import type { RatingBracketId } from '#lib/onboarding/types.ts';

/** Used when the player has no bracket and no other rated sample. */
export const PUZZLE_START = 950;
export const RATING_FLOOR = 100;
export const RATING_CAP = 3000;
export const RATING_PICK_MIN = 400;
export const RATING_PICK_MAX = 3000;
export const RATING_STEP = 100;
/** Other Arena courses need this many finished games before they seed a new course. */
export const ARENA_SAMPLE = 20;
/** Share of the gap between 950 and the mean of those courses that the new rating keeps. */
export const ARENA_REGRESSION = 0.65;

/** Elo expected score of a player rated `rating` against `opponent`. */
export function expected(rating: number, opponent: number): number {
	return 1 / (1 + 10 ** ((opponent - rating) / 400));
}

export function elo(rating: number, opponent: number, score: 0 | 0.5 | 1, k = 32): number {
	return Math.round(rating + k * (score - expected(rating, opponent)));
}

export function clampStoredRating(rating: number): number {
	if (!Number.isFinite(rating)) return PUZZLE_START;
	return Math.min(RATING_CAP, Math.max(RATING_FLOOR, Math.round(rating)));
}

/** 400, 500, … 3000. The stored rating may sit between these after a game. */
export function ratingPickerValues(): number[] {
	const values: number[] = [];
	for (let rating = RATING_PICK_MIN; rating <= RATING_PICK_MAX; rating += RATING_STEP) values.push(rating);
	return values;
}

/** Nearest picker step. Does not write a rating; Play does, and only when the player changes it. */
export function nearestPickerRating(rating: number): number {
	const snapped = Math.round(clampStoredRating(rating) / RATING_STEP) * RATING_STEP;
	return Math.min(RATING_PICK_MAX, Math.max(RATING_PICK_MIN, snapped));
}

export function manualRating(rating: number): number {
	return nearestPickerRating(rating);
}

export interface RatingSample {
	rating: number;
	games: number;
}

/**
 * Seed for a course that has no stored row.
 * A chosen bracket wins: that is the player's own baseline, including "unknown" at 950.
 * With no bracket, Arena uses 950 plus 65% of the mean gap from 950 across other Arena
 * courses with at least 20 games. Puzzles stay on the bracket map or 950.
 * A recovered puzzle does not use a separate delta; that number is not confirmed.
 */
export function openingRating(args: {
	kind: RatingRecord['kind'];
	bracket: RatingBracketId | null;
	others: readonly RatingSample[];
	fallback?: number;
}): number {
	const fallback = args.fallback ?? (args.kind === 'arena' ? 950 : PUZZLE_START);
	if (args.bracket) return clampStoredRating(args.kind === 'arena' ? arenaSeed(args.bracket) : puzzleSeed(args.bracket));
	if (args.kind !== 'arena') return clampStoredRating(fallback);
	const sample = args.others.filter((row) => row.games >= ARENA_SAMPLE && Number.isFinite(row.rating));
	if (!sample.length) return clampStoredRating(fallback);
	const mean = sample.reduce((sum, row) => sum + row.rating, 0) / sample.length;
	return clampStoredRating(Math.round(fallback + ARENA_REGRESSION * (mean - fallback)));
}

function blank(kind: RatingRecord['kind'], courseId: string, rating: number): RatingRecord {
	const key = `${kind}/${courseId}` as const;
	return { key, kind, courseId, rating: clampStoredRating(rating), games: 0, wins: 0, draws: 0, losses: 0, history: [], seen: [] };
}

export async function getRating(kind: RatingRecord['kind'], courseId: string, start: number): Promise<RatingRecord> {
	const key = `${kind}/${courseId}` as const;
	return (await db.ratings.get(key)) ?? blank(kind, courseId, start);
}

/** Writes the seed once. An existing row is kept, including a rating the player has already moved. */
export async function loadCourseRating(kind: RatingRecord['kind'], courseId: string, seed: number): Promise<RatingRecord> {
	const key = `${kind}/${courseId}` as const;
	const existing = await db.ratings.get(key);
	if (existing) return { ...existing, rating: clampStoredRating(existing.rating) };
	const row = blank(kind, courseId, seed);
	try {
		await db.ratings.add(row);
	} catch {
		return (await db.ratings.get(key)) ?? row;
	}
	return row;
}

/** A manual baseline. It does not count as a game. */
export async function setBaseline(record: RatingRecord, rating: number): Promise<RatingRecord> {
	const next = { ...record, rating: clampStoredRating(rating) };
	await db.ratings.put(next);
	return next;
}

export async function recordResult(record: RatingRecord, rating: number, score: 0 | 0.5 | 1, seen?: string): Promise<RatingRecord> {
	const stored = clampStoredRating(rating);
	const next: RatingRecord = {
		...record,
		rating: stored,
		games: record.games + 1,
		wins: record.wins + (score === 1 ? 1 : 0),
		draws: record.draws + (score === 0.5 ? 1 : 0),
		losses: record.losses + (score === 0 ? 1 : 0),
		history: [...record.history, { at: Date.now(), rating: stored }].slice(-200),
		seen: seen ? [...record.seen.filter((id) => id !== seen), seen].slice(-1000) : record.seen
	};
	await db.ratings.put(next);
	return next;
}

/** Drop played ids once every puzzle in the pool has been seen, so the next pass can track repeats again. */
export async function resetSeen(record: RatingRecord): Promise<RatingRecord> {
	if (!record.seen.length) return record;
	const next = { ...record, seen: [] };
	await db.ratings.put(next);
	return next;
}
