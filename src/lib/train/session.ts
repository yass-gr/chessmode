import type { LineProgress } from '#lib/db.ts';

/** Due lines, those never played cleanly first, then the most overdue. */
export function selectDue(rows: LineProgress[], now: number): LineProgress[] {
	return rows
		.filter((row) => new Date(row.card.due).getTime() <= now)
		.sort((a, b) => Number(!!a.clean) - Number(!!b.clean) || +new Date(a.card.due) - +new Date(b.card.due));
}

/** Time mode: a time budget that drains faster as the score grows. Clean lines win time back, mistakes cost time. */
export const TIME_MODE = { startMs: 60_000, cleanMs: 6_000, mistakeMs: 5_000, speedPerLine: 0.04, maxSpeed: 2 } as const;

export function clockSpeed(score: number): number {
	return Math.min(TIME_MODE.maxSpeed, 1 + score * TIME_MODE.speedPerLine);
}

export function drain(remainingMs: number, elapsedMs: number, score: number): number {
	return Math.max(0, remainingMs - elapsedMs * clockSpeed(score));
}

/** A line with a hint but no mistake neither earns nor costs time. */
export function lineResult(mistakes: number, hints: number): 'clean' | 'hinted' | 'mistake' {
	return mistakes > 0 ? 'mistake' : hints > 0 ? 'hinted' : 'clean';
}

export function adjust(remainingMs: number, change: 'clean' | 'hinted' | 'mistake'): number {
	if (change === 'clean') return remainingMs + TIME_MODE.cleanMs;
	if (change === 'mistake') return Math.max(0, remainingMs - TIME_MODE.mistakeMs);
	return remainingMs;
}

/** A random line from the pool, avoiding an immediate repeat when there is a choice. */
export function pickNext<T>(pool: T[], previous: T | undefined, random = Math.random): T {
	const options = pool.length > 1 ? pool.filter((x) => x !== previous) : pool;
	return options[Math.floor(random() * options.length)];
}
