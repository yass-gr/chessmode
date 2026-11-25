import type { LineProgress } from '#lib/db.ts';

export function selectDue(rows: LineProgress[], now: number): LineProgress[] {
	return rows.filter((row) => new Date(row.card.due).getTime() <= now).sort((a, b) => +new Date(a.card.due) - +new Date(b.card.due));
}

/** Time mode: the clock is a deadline. Clean lines push it back, mistakes pull it in. */
export const TIME_MODE = { startMs: 60_000, cleanMs: 8_000, mistakeMs: 5_000 } as const;

export function moveDeadline(deadline: number, now: number, change: 'clean' | 'mistake'): number {
	const next = change === 'clean' ? deadline + TIME_MODE.cleanMs : deadline - TIME_MODE.mistakeMs;
	return Math.max(now, next);
}

/** A random line from the pool, avoiding an immediate repeat when there is a choice. */
export function pickNext<T>(pool: T[], previous: T | undefined, random = Math.random): T {
	const options = pool.length > 1 ? pool.filter((x) => x !== previous) : pool;
	return options[Math.floor(random() * options.length)];
}
