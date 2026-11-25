import type { LineProgress, SessionLog } from '#lib/db.ts';
import type { Course, Line, LineKey } from '#lib/courses/types.ts';

export type LineStatus = { kind: 'new' } | { kind: 'due' } | { kind: 'learned'; due: number };

export function lineStatus(progress: Map<LineKey, LineProgress>, key: LineKey, now: number): LineStatus {
	const p = progress.get(key);
	if (!p) return { kind: 'new' };
	const due = new Date(p.card.due).getTime();
	return due <= now ? { kind: 'due' } : { kind: 'learned', due };
}

export interface CourseStats {
	total: number;
	learned: number;
	due: number;
	/** First line not yet learned, in course order. */
	next?: Line;
}

export function courseStats(course: Course, progress: Map<LineKey, LineProgress>, now: number): CourseStats {
	let learned = 0;
	let due = 0;
	let next: Line | undefined;
	for (const line of course.lines) {
		const s = lineStatus(progress, line.key, now);
		if (s.kind === 'new') next ??= line;
		else {
			learned++;
			if (s.kind === 'due') due++;
		}
	}
	return { total: course.lines.length, learned, due, next };
}

export function totalXp(sessions: SessionLog[]): number {
	return sessions.reduce((sum, s) => sum + s.xp, 0);
}

export function best(sessions: SessionLog[], mode: 'drill' | 'time'): number {
	return sessions.filter((s) => s.mode === mode).reduce((m, s) => Math.max(m, s.score ?? 0), 0);
}

/** The FEN after the last move of a line, for thumbnails. */
export const lineEnd = (line: Line) => line.plies[line.plies.length - 1].fenAfter;

/** Moves after the course's shared start, e.g. "4.Nb5 Na6 5.e3", trimmed to `max` plies. */
export function lineTail(line: Line, max = 4): string {
	const start = Math.max(0, line.plies.length - max);
	return line.plies
		.slice(start)
		.map((p, i) => {
			const idx = start + i;
			const n = Math.floor(idx / 2) + 1;
			if (p.color === 'w') return `${n}.${p.san}`;
			return i === 0 ? `${n}...${p.san}` : p.san;
		})
		.join(' ');
}

export function relativeTime(t: number, now = Date.now()): string {
	const s = Math.round((t - now) / 1000);
	const abs = Math.abs(s);
	const fmt = (v: number, u: string) => `${v} ${u}${v === 1 ? '' : 's'}`;
	const text =
		abs < 60 ? 'now' : abs < 3600 ? fmt(Math.round(abs / 60), 'min') : abs < 86400 ? fmt(Math.round(abs / 3600), 'hour') : fmt(Math.round(abs / 86400), 'day');
	if (text === 'now') return 'now';
	return s > 0 ? `in ${text}` : `${text} ago`;
}
