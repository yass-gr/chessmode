import { describe, expect, it } from 'vitest';
import { createEmptyCard } from 'ts-fsrs';
import type { LineKey } from '#lib/courses/types.ts';
import type { LineProgress } from '#lib/db.ts';
import { clearedCourse, clearedPractice } from './reset.ts';

function row(key: string, courseId: string, clean = true): LineProgress {
	return { key: key as LineKey, courseId, card: createEmptyCard(), learnedAt: 1, reviews: 2, lapses: 0, clean, confidence: 8 };
}

describe('scoped reset', () => {
	const rows = [row('a/one', 'a'), row('a/two', 'a', false), row('custom/main', 'custom')];

	it('clears perfection for one course and leaves discoveries', () => {
		const next = clearedPractice(rows, 'a');
		expect(next.map((row) => row.clean)).toEqual([false, false, true]);
		expect(next).toHaveLength(3);
		expect(next[0].learnedAt).toBe(1);
	});

	it('removes one course and keeps the repertoire beside it', () => {
		expect(clearedCourse(rows, 'a').map((row) => row.key)).toEqual(['custom/main']);
		expect(clearedCourse(rows, 'missing')).toEqual(rows);
	});
});
