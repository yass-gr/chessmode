import { describe, expect, it } from 'vitest';
import { createEmptyCard } from 'ts-fsrs';
import { courses } from '#lib/courses/index.ts';
import { depthData } from '#lib/courses/depth-data.ts';
import { courseScope, defaultDepth } from '#lib/courses/depth.ts';
import type { LineKey } from '#lib/courses/types.ts';
import type { LineProgress } from '#lib/db.ts';
import { modeAvailability } from '#lib/courses/unlocks.ts';
import { ackNotice, gateRedirect, normalizeDepth, pendingNotice, resumeHref, tierBlurb, trainerTarget, withPinnedLine } from '#lib/courses/scope.ts';

const now = Date.UTC(2026, 10, 25, 12);
const course = courses.find((item) => depthData[item.id]?.counts.length === 3)!;

function rows(keys: LineKey[], clean = false): Map<LineKey, LineProgress> {
	return new Map(
		keys.map((key) => [
			key,
			{ key, courseId: course.id, card: { ...createEmptyCard(), due: new Date(now - 1000) }, learnedAt: now, reviews: 1, lapses: 0, clean }
		])
	);
}

const quiet = ['unlock:practice', 'unlock:rated', 'unlock:drill', 'celebrate:5'];

describe('course scope', () => {
	it('describes the three tiers in one line each', () => {
		expect(tierBlurb('Essentials')).toBe('The main lines you will meet most');
		expect(tierBlurb('Advanced')).toBe('Adds the common sidelines');
		expect(tierBlurb('Full Mastery')).toBe('Every line in the course');
	});

	it('pins an out-of-tier line and keeps every saved card when the tier changes', () => {
		const open = courseScope(course, defaultDepth(), new Map());
		const outside = open.beyond[0];
		expect(outside).toBeDefined();
		const pinned = withPinnedLine(course, defaultDepth(), outside.key);
		expect(pinned.pinned).toEqual([outside.key]);
		expect(withPinnedLine(course, pinned, outside.key)).toBe(pinned);
		expect(withPinnedLine(course, defaultDepth(), open.lines[0].key).pinned).toEqual([]);
		const wide = courseScope(course, { ...pinned, tier: open.tiers.length - 1 }, rows([outside.key]));
		const narrow = courseScope(course, pinned, rows([outside.key]));
		expect(wide.lines.some((line) => line.key === outside.key)).toBe(true);
		expect(narrow.lines.some((line) => line.key === outside.key)).toBe(true);
		expect(narrow.learned).toBe(1);
	});

	it('fills missing depth fields from older saves', () => {
		expect(normalizeDepth({ tier: 1, seen: true })).toEqual({ tier: 1, seen: true, pinned: [], acked: [] });
		expect(normalizeDepth(undefined)).toEqual(defaultDepth());
	});

	it('celebrates each newly opened mode, then a five-line milestone that is not a gate', () => {
		const one = rows(course.lines.slice(0, 1).map((line) => line.key));
		expect(pendingNotice(course, defaultDepth(), one, true, true)?.id).toBe('unlock:practice');
		const two = rows(course.lines.slice(0, 2).map((line) => line.key));
		expect(pendingNotice(course, { ...defaultDepth(), acked: ['unlock:practice'] }, two, true, true)?.id).toBe('unlock:rated');
		expect(pendingNotice(course, { ...defaultDepth(), acked: ['unlock:practice'] }, two, false, false)).toBeUndefined();
		const three = rows(course.lines.slice(0, 3).map((line) => line.key));
		expect(pendingNotice(course, { ...defaultDepth(), acked: ['unlock:practice', 'unlock:rated'] }, three, true, true)?.id).toBe('unlock:drill');
		const five = rows(course.lines.slice(0, 5).map((line) => line.key));
		expect(pendingNotice(course, { ...defaultDepth(), acked: ['unlock:practice', 'unlock:rated', 'unlock:drill'] }, five, true, true)?.id).toBe('celebrate:5');
		expect(modeAvailability('drill', 3, course.lines.length).kind).toBe('available');
		expect(modeAvailability('puzzle', 2, course.lines.length, true).kind).toBe('available');
		expect(modeAvailability('drill', 1, 1)).toEqual({ kind: 'available' });
	});

	it('offers the next tier after the first completion and the first perfection of the active tier', () => {
		const scope = courseScope(course, defaultDepth(), new Map());
		const learned = rows(scope.lines.map((line) => line.key));
		const choice = { ...defaultDepth(), seen: true, acked: quiet };
		const learnedNotice = pendingNotice(course, choice, learned, true, true);
		expect(learnedNotice).toMatchObject({ id: 'learned:0', go: { tier: 1 } });
		expect(ackNotice(choice, 'learned:0').tier).toBe(0);
		expect(ackNotice(choice, 'learned:0', 1).tier).toBe(1);
		expect(ackNotice(choice, 'learned:0').acked).toContain('learned:0');
		const perfected = rows(scope.lines.map((line) => line.key), true);
		expect(pendingNotice(course, { ...choice, acked: [...quiet, 'learned:0'] }, perfected, true, true)?.id).toBe('perfected:0');
	});

	it('reads trainer URLs and blocks locked deep links without blocking an all-course drill', () => {
		expect(trainerTarget('/learn/caro-kann/classical-main', new URLSearchParams())).toEqual({
			courseId: 'caro-kann',
			lineKey: 'caro-kann/classical-main'
		});
		expect(trainerTarget('/practice/run', new URLSearchParams('line=caro-kann%2Fclassical-main'))?.lineKey).toBe('caro-kann/classical-main');
		expect(trainerTarget('/drill/run', new URLSearchParams())).toBeUndefined();
		expect(gateRedirect('/practice/run', new URLSearchParams('course=caro-kann'), 0, 20, true, true)).toBe('/course/caro-kann');
		expect(gateRedirect('/drill/run', new URLSearchParams('course=caro-kann&mode=time'), 2, 20, true, true)).toBe('/drill');
		expect(gateRedirect('/drill/run', new URLSearchParams('mode=drill'), 1, 20, true, true)).toBeUndefined();
		expect(gateRedirect('/drill/run', new URLSearchParams('course=short'), 1, 1, false, true)).toBeUndefined();
		expect(gateRedirect('/puzzles/caro-kann', new URLSearchParams(), 2, 20, false, true)).toBe('/course/caro-kann');
		expect(gateRedirect('/arena/caro-kann', new URLSearchParams(), 2, 20, true, true)).toBeUndefined();
	});

	it('resumes the saved depth and sends an unseen chooser back to the course', () => {
		const first = courseScope(course, defaultDepth(), new Map()).lines[0];
		expect(resumeHref(course, defaultDepth(), new Map(), now)).toBe(`/course/${course.id}`);
		expect(resumeHref(course, { ...defaultDepth(), seen: true }, new Map(), now)).toBe(`/learn/${course.id}/${first.id}`);
		const due = rows([first.key]);
		expect(resumeHref(course, { ...defaultDepth(), seen: true }, due, now)).toBe(`/practice/run?course=${course.id}`);
	});
});
