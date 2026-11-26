import type { LineProgress } from '#lib/db.ts';

/** Due lines, those never played cleanly first, then the most overdue. Kept for due counts. */
export function selectDue(rows: LineProgress[], now: number): LineProgress[] {
	return rows
		.filter((row) => new Date(row.card.due).getTime() <= now)
		.sort((a, b) => Number(!!a.clean) - Number(!!b.clean) || +new Date(a.card.due) - +new Date(b.card.due));
}

export interface PracticeCandidate {
	key: string;
	/** Missing means the line is learned but has no card, which ranks as most overdue. */
	due: number | null;
	perfected: boolean;
}

/**
 * Next Practice line. Never-perfected lines come first. The current line is skipped when another
 * candidate exists. Overdue picks are random among the three most overdue; otherwise the earliest due.
 */
export function selectPractice<T extends PracticeCandidate>(
	rows: readonly T[],
	now: number,
	current: string | undefined,
	random: () => number = Math.random
): T | undefined {
	if (!rows.length) return undefined;
	let pool = [...rows];
	if (current !== undefined && pool.some((row) => row.key !== current)) pool = pool.filter((row) => row.key !== current);
	if (pool.some((row) => !row.perfected)) pool = pool.filter((row) => !row.perfected);
	const dueAt = (row: T) => (row.due == null ? Number.NEGATIVE_INFINITY : row.due);
	const overdue = pool.filter((row) => dueAt(row) <= now).sort((a, b) => dueAt(a) - dueAt(b));
	if (overdue.length) return overdue[Math.min(overdue.length - 1, Math.floor(random() * Math.min(3, overdue.length)))];
	return [...pool].sort((a, b) => dueAt(a) - dueAt(b))[0];
}

/** One pass through the pool. A later pass needs another shuffle. */
export function dealDeck<T>(pool: readonly T[], random: () => number = Math.random): T[] {
	const deck = [...pool];
	for (let i = deck.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[deck[i], deck[j]] = [deck[j], deck[i]];
	}
	return deck;
}

export const DRILL_ADVANCE_MS = 1_000;

/** Time trial. Bonus seconds are `floor(plies / 2)`, applied only to a clean line. */
export const TIME_MODE = {
	startMs: 60_000,
	penaltyMs: 3_000,
	speedPerClean: 0.05,
	rollbackMs: 250,
	nextLineMs: 750
} as const;

export function lineBonusMs(plies: number): number {
	return Math.floor(plies / 2) * 1_000;
}

export function clockSpeed(cleanLines: number): number {
	return 1 + Math.max(0, cleanLines) * TIME_MODE.speedPerClean;
}

export function drain(remainingMs: number, elapsedMs: number, cleanLines: number): number {
	return Math.max(0, remainingMs - elapsedMs * clockSpeed(cleanLines));
}

export function penalise(remainingMs: number): number {
	return Math.max(0, remainingMs - TIME_MODE.penaltyMs);
}

/** A hinted or mistaken line adds nothing. A clean line adds time from its length. */
export function reward(remainingMs: number, plies: number, clean: boolean): number {
	return clean ? remainingMs + lineBonusMs(plies) : remainingMs;
}

/** A random line from the pool, avoiding an immediate repeat when there is a choice. */
export function pickNext<T>(pool: T[], previous: T | undefined, random = Math.random): T {
	const options = pool.length > 1 ? pool.filter((x) => x !== previous) : pool;
	return options[Math.floor(random() * options.length)];
}
