import { describe, expect, it } from 'vitest';
import {
	bestAllTime,
	heatBand,
	longestStreak,
	personalRecords,
	profileActivity,
	sessionReps,
	weekKey,
	yearDays,
	yearHeatmap
} from '#lib/activity/activity.ts';

describe('sessionReps', () => {
	it('counts finished lines, and one run when a drill or time log stored none', () => {
		expect(sessionReps({ day: '2026-11-26', mode: 'learn', lines: 1 })).toBe(1);
		expect(sessionReps({ day: '2026-11-26', mode: 'practice', lines: 4 })).toBe(4);
		expect(sessionReps({ day: '2026-11-26', mode: 'drill', lines: 0 })).toBe(1);
		expect(sessionReps({ day: '2026-11-26', mode: 'drill', lines: 6 })).toBe(6);
		expect(sessionReps({ day: '2026-11-26', mode: 'time', lines: 3, scoreVersion: 'lines' })).toBe(3);
		expect(sessionReps({ day: '2026-11-26', mode: 'time', lines: 40, scoreVersion: 'moves' })).toBe(1);
		expect(sessionReps({ day: '2026-11-26', mode: 'quiz', lines: 0 })).toBe(1);
		expect(sessionReps({ day: '2026-11-26', mode: 'puzzles', lines: 2 })).toBe(2);
		expect(sessionReps({ day: '2026-11-26', mode: 'arena', lines: 1 })).toBe(0);
		expect(sessionReps({ day: '2026-11-26', mode: 'review', lines: 1 })).toBe(0);
		expect(sessionReps({ day: '2026-11-26', mode: 'time', lines: 40, reps: 7, scoreVersion: 'moves' })).toBe(7);
	});
});

describe('heatBand', () => {
	it('uses the five activity bands', () => {
		expect(heatBand(0)).toBe(0);
		expect(heatBand(1)).toBe(1);
		expect(heatBand(3)).toBe(1);
		expect(heatBand(4)).toBe(2);
		expect(heatBand(6)).toBe(2);
		expect(heatBand(7)).toBe(3);
		expect(heatBand(12)).toBe(3);
		expect(heatBand(13)).toBe(4);
	});
});

describe('yearDays', () => {
	it('starts on Monday and does not skip a local date', () => {
		const days = yearDays(new Date(2026, 2, 10, 1, 30));
		expect(days[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(new Date(`${days[0]}T12:00:00`).getDay()).toBe(1);
		expect(days.length).toBeGreaterThanOrEqual(365);
		expect(days.length).toBeLessThanOrEqual(371);
		expect(new Set(days).size).toBe(days.length);
		expect(days).toContain('2026-03-08');
		expect(days).toContain('2026-03-09');
		expect(days.at(-1)).toBe('2026-03-10');
		for (let i = 1; i < days.length; i++) {
			const prev = new Date(`${days[i - 1]}T12:00:00`).getTime();
			const next = new Date(`${days[i]}T12:00:00`).getTime();
			expect(Math.round((next - prev) / 86_400_000)).toBe(1);
		}
	});
});

describe('yearHeatmap', () => {
	it('sums reps on the stored local day and drops days outside the year', () => {
		const today = new Date(2026, 10, 26, 18);
		const heat = yearHeatmap(
			[
				{ day: '2026-11-26', mode: 'practice', lines: 2 },
				{ day: '2026-11-26', mode: 'learn', lines: 1 },
				{ day: '2026-11-26', mode: 'arena', lines: 9 },
				{ day: '2024-01-01', mode: 'practice', lines: 8 },
				{ day: 'bad', mode: 'learn', lines: 1 }
			],
			today
		);
		expect(heat.find((day) => day.day === '2026-11-26')).toEqual({ day: '2026-11-26', reps: 3, band: 1 });
		expect(heat.find((day) => day.day === '2024-01-01')).toBeUndefined();
		expect(heat.filter((day) => day.reps > 0)).toHaveLength(1);
	});
});

describe('profileActivity', () => {
	const catalog = [
		{ id: 'italian', name: 'Italian', side: 'w' as const, lineKeys: ['italian/a', 'italian/a', 'italian/b'] },
		{ id: 'caro', name: 'Caro', side: 'b' as const, lineKeys: ['caro/a', 'caro/b'] }
	];

	it('counts discovered and perfected lines, and a course only when every line is clean', () => {
		const activity = profileActivity(catalog, [
			{ key: 'italian/a', courseId: 'italian', clean: true },
			{ key: 'italian/b', courseId: 'italian' },
			{ key: 'caro/a', courseId: 'caro', clean: true },
			{ key: 'caro/b', courseId: 'caro', clean: true },
			{ key: 'other/a', courseId: 'other', clean: true },
			{ key: 'italian/a', courseId: 'nope', clean: true }
		]);
		expect(activity.discovered).toBe(4);
		expect(activity.perfectedLines).toBe(3);
		expect(activity.openingsPerfected).toBe(1);
		expect(activity.courses[0]).toMatchObject({ total: 2, discovered: 2, perfected: 1, perfectedCourse: false });
		expect(activity.courses[1]).toMatchObject({ discovered: 2, perfected: 2, perfectedCourse: true });
	});
});

describe('personalRecords', () => {
	const today = new Date(2026, 10, 25, 15);

	it('keeps daily, weekly, monthly and all-time bests per course without mixing time score versions', () => {
		expect(weekKey('2026-11-25')).toBe('2026-11-23');
		const rows = personalRecords(
			[
				{ at: 1, day: '2026-11-22', mode: 'drill', courseId: 'italian', score: 9 },
				{ at: 2, day: '2026-11-23', mode: 'drill', courseId: 'italian', score: 4 },
				{ at: 3, day: '2026-11-25', mode: 'drill', courseId: 'italian', score: 4 },
				{ at: 4, day: '2026-10-02', mode: 'drill', courseId: 'italian', score: 7 },
				{ at: 5, day: '2026-11-25', mode: 'time', courseId: 'italian', score: 100, scoreVersion: 'lines' },
				{ at: 6, day: '2026-11-25', mode: 'time', courseId: 'italian', score: 12, scoreVersion: 'moves' },
				{ at: 7, day: '2026-11-25', mode: 'time', courseId: 'caro', score: 3, scoreVersion: 'moves' },
				{ at: 8, day: '2026-11-25', mode: 'arena', courseId: 'italian', score: 50 }
			],
			today
		);
		expect(rows).toEqual([
			{ mode: 'time', courseId: 'caro', scoreVersion: 'moves', day: 3, week: 3, month: 3, all: 3 },
			{ mode: 'drill', courseId: 'italian', scoreVersion: 'lines', day: 4, week: 4, month: 9, all: 9 },
			{ mode: 'time', courseId: 'italian', scoreVersion: 'lines', day: 100, week: 100, month: 100, all: 100 },
			{ mode: 'time', courseId: 'italian', scoreVersion: 'moves', day: 12, week: 12, month: 12, all: 12 }
		]);
		expect(bestAllTime(rows, 'time', 'lines')).toBe(100);
		expect(bestAllTime(rows, 'time', 'moves')).toBe(12);
		expect(bestAllTime(rows, 'drill')).toBe(9);
	});
});

describe('longestStreak', () => {
	it('ignores duplicate days and gaps', () => {
		expect(longestStreak(['2026-11-24', '2026-11-24', '2026-11-23', '2026-11-21'])).toBe(2);
		expect(longestStreak([])).toBe(0);
	});
});
