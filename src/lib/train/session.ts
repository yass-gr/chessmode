import type { LineProgress } from '#lib/db.ts';

export function selectDue(rows: LineProgress[], now: number): LineProgress[] {
 return rows.filter(row => new Date(row.card.due).getTime() <= now).sort((a, b) => +new Date(a.card.due) - +new Date(b.card.due));
}

export function timeRemaining(seconds: number, change: 'tick' | 'mistake' | 'clean'): number {
 return Math.max(0, seconds + (change === 'tick' ? -1 : change === 'mistake' ? -5 : 8));
}
