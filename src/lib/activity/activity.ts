import { dayKey } from '#lib/db.ts';
import type {
	CourseActivity,
	CourseLines,
	HeatBand,
	HeatDay,
	ProfileActivity,
	ProgressRow,
	RecordLine,
	RepSession,
	ScoreSession,
	ScoreMetric
} from '#lib/activity/types.ts';

const LINE_MODES = new Set(['learn', 'practice', 'drill', 'time']);
const ATTEMPT_MODES = new Set(['quiz', 'puzzles']);
const SCORED_MODES = new Set(['drill', 'time']);
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function whole(value: number): number {
	if (!Number.isFinite(value) || value <= 0) return 0;
	return Math.floor(value);
}

/**
 * Reps from one finished session.
 * Learn and practice count finished lines. Drill and Time use `reps` when the run stored how many
 * lines finished. A Time log scored in move points (`metric` `moves`) with no `reps` counts as one
 * run, because those older rows kept the point total in `lines`. Other Drill and Time logs count
 * `lines`, or one run when that count is zero. Quiz and puzzle sessions are one attempt each, plus
 * any extra lines the log recorded. An explicit `reps` field always wins. Review and arena are not reps.
 */
export function sessionReps(session: RepSession): number {
	if (typeof session.reps === 'number') return whole(session.reps);
	if (LINE_MODES.has(session.mode)) {
		if (session.mode === 'time' && session.metric === 'moves') return 1;
		const lines = whole(session.lines);
		if (session.mode === 'drill' || session.mode === 'time') return lines > 0 ? lines : 1;
		return lines;
	}
	if (ATTEMPT_MODES.has(session.mode)) return Math.max(1, whole(session.lines));
	return 0;
}

/** Bands are 0, 1–3, 4–6, 7–12 and 13+. */
export function heatBand(reps: number): HeatBand {
	if (reps <= 0) return 0;
	if (reps <= 3) return 1;
	if (reps <= 6) return 2;
	if (reps <= 12) return 3;
	return 4;
}

function atNoon(day: string): Date {
	const [year, month, date] = day.split('-').map(Number);
	return new Date(year, month - 1, date, 12);
}

/** Monday of the local week containing `day`, as `YYYY-MM-DD`. */
export function weekKey(day: string): string {
	const date = atNoon(day);
	date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
	return dayKey(date.getTime());
}

/**
 * Local calendar days from the Monday on or before a year ago through `today`.
 * Steps with `setDate`, so a DST jump cannot skip or repeat a date.
 */
export function yearDays(today: Date): string[] {
	const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
	const start = new Date(end);
	start.setDate(start.getDate() - 364);
	start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
	const days: string[] = [];
	for (const cursor = new Date(start); cursor.getTime() <= end.getTime(); cursor.setDate(cursor.getDate() + 1)) {
		days.push(dayKey(cursor.getTime()));
	}
	return days;
}

export function repsByDay(sessions: readonly RepSession[]): Map<string, number> {
	const totals = new Map<string, number>();
	for (const session of sessions) {
		if (!DAY.test(session.day)) continue;
		const reps = sessionReps(session);
		if (reps <= 0) continue;
		totals.set(session.day, (totals.get(session.day) ?? 0) + reps);
	}
	return totals;
}

export function yearHeatmap(sessions: readonly RepSession[], today: Date): HeatDay[] {
	const totals = repsByDay(sessions);
	return yearDays(today).map((day) => {
		const reps = totals.get(day) ?? 0;
		return { day, reps, band: heatBand(reps) };
	});
}

export function profileActivity(catalog: readonly CourseLines[], progress: readonly ProgressRow[]): ProfileActivity {
	const byKey = new Map<string, ProgressRow>();
	for (const row of progress) if (!byKey.has(row.key)) byKey.set(row.key, row);
	const courses: CourseActivity[] = catalog.map((course) => {
		let discovered = 0;
		let perfected = 0;
		const seen = new Set<string>();
		for (const key of course.lineKeys) {
			if (seen.has(key)) continue;
			seen.add(key);
			const row = byKey.get(key);
			if (!row || row.courseId !== course.id) continue;
			discovered += 1;
			if (row.clean) perfected += 1;
		}
		const total = seen.size;
		return {
			id: course.id,
			name: course.name,
			side: course.side,
			total,
			discovered,
			perfected,
			perfectedCourse: total > 0 && perfected === total
		};
	});
	return {
		discovered: courses.reduce((sum, course) => sum + course.discovered, 0),
		perfectedLines: courses.reduce((sum, course) => sum + course.perfected, 0),
		openingsPerfected: courses.filter((course) => course.perfectedCourse).length,
		courses
	};
}

/** Move-point Time scores stay in their own bucket. Drill, and older Time rows with no metric, are line scores. */
export function metricOf(session: ScoreSession): ScoreMetric {
	return session.mode === 'time' && session.metric === 'moves' ? 'moves' : 'lines';
}

export function personalRecords(sessions: readonly ScoreSession[], today: Date): RecordLine[] {
	const todayKey = dayKey(today.getTime());
	const week = weekKey(todayKey);
	const month = todayKey.slice(0, 7);
	const groups = new Map<string, RecordLine & { at: Record<'day' | 'week' | 'month' | 'all', number> }>();

	for (const session of sessions) {
		if (!SCORED_MODES.has(session.mode) || !session.courseId || !DAY.test(session.day)) continue;
		if (typeof session.score !== 'number' || !Number.isFinite(session.score)) continue;
		const metric = metricOf(session);
		const id = `${session.mode}/${metric}/${session.courseId}`;
		let row = groups.get(id);
		if (!row) {
			row = {
				mode: session.mode as 'drill' | 'time',
				courseId: session.courseId,
				metric,
				day: null,
				week: null,
				month: null,
				all: null,
				at: { day: Infinity, week: Infinity, month: Infinity, all: Infinity }
			};
			groups.set(id, row);
		}
		const consider = (window: 'day' | 'week' | 'month' | 'all') => {
			const current = row![window];
			if (current !== null && (session.score! < current || (session.score === current && session.at >= row!.at[window]))) return;
			row![window] = session.score!;
			row!.at[window] = session.at;
		};
		consider('all');
		if (session.day.slice(0, 7) === month) consider('month');
		if (weekKey(session.day) === week) consider('week');
		if (session.day === todayKey) consider('day');
	}

	return [...groups.values()]
		.map(({ at: _at, ...row }) => row)
		.sort((a, b) => a.courseId.localeCompare(b.courseId) || a.mode.localeCompare(b.mode) || a.metric.localeCompare(b.metric));
}

export function bestAllTime(rows: readonly RecordLine[], mode: 'drill' | 'time', version: ScoreMetric = 'lines'): number | null {
	let best: number | null = null;
	for (const row of rows) {
		if (row.mode !== mode || row.metric !== version || row.all === null) continue;
		best = best === null ? row.all : Math.max(best, row.all);
	}
	return best;
}

/** Longest run of consecutive local days, ignoring duplicates and order. */
export function longestStreak(days: readonly string[]): number {
	const unique = [...new Set(days.filter((day) => DAY.test(day)))].sort();
	let run = 0;
	let max = 0;
	let prev: number | undefined;
	for (const day of unique) {
		const time = atNoon(day).getTime();
		run = prev !== undefined && Math.round((time - prev) / 86_400_000) === 1 ? run + 1 : 1;
		max = Math.max(max, run);
		prev = time;
	}
	return max;
}
