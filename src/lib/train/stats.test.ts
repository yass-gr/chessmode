import { describe, expect, it } from 'vitest';
import { createEmptyCard } from 'ts-fsrs';
import { parseCourse } from '#lib/courses/parse.ts';
import type { CourseFile, LineKey } from '#lib/courses/types.ts';
import type { LineProgress } from '#lib/db.ts';
import fixture from '#lib/courses/fixtures/test-course.json';
import { courseStats, lineTail, relativeTime } from './stats.ts';

const course = parseCourse(fixture as CourseFile);
const now = Date.UTC(2026, 10, 25, 12);

function progress(key: LineKey, due: number): LineProgress {
	return { key, courseId: course.id, card: { ...createEmptyCard(), due: new Date(due) }, learnedAt: now, reviews: 0, lapses: 0 };
}

describe('courseStats', () => {
	it('counts learned and due lines and finds the next new line in course order', () => {
		const [a, b] = course.lines;
		const map = new Map([[a.key, progress(a.key, now - 1000)]]);
		expect(courseStats(course, map, now)).toMatchObject({ learned: 1, due: 1, next: b });
		map.set(a.key, progress(a.key, now + 1000));
		expect(courseStats(course, map, now)).toMatchObject({ learned: 1, due: 0 });
	});
});

describe('lineTail', () => {
	it('numbers the trimmed tail from the right move', () => {
		expect(lineTail(course.lines[0], 3)).toMatch(/^\d+\.(\.\.)?\S+/);
	});
});

describe('relativeTime', () => {
	it('reads naturally both ways', () => {
		expect(relativeTime(now + 10 * 60_000, now)).toBe('in 10 mins');
		expect(relativeTime(now - 2 * 86_400_000, now)).toBe('2 days ago');
		expect(relativeTime(now + 20_000, now)).toBe('now');
	});
});
