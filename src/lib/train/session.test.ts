import { describe, expect, it } from 'vitest';
import { createEmptyCard } from 'ts-fsrs';
import type { LineProgress } from '#lib/db.ts';
import type { LineKey } from '#lib/courses/types.ts';
import { moveDeadline, pickNext, selectDue, TIME_MODE } from './session.ts';

const row = (key: string, date: string): LineProgress => ({
	key: key as LineKey,
	courseId: 'test',
	card: { ...createEmptyCard(), due: new Date(date) },
	learnedAt: 0,
	reviews: 0,
	lapses: 0
});

describe('practice queue', () => {
	it('returns due cards in due order and excludes future cards', () => {
		const rows = [row('later', '2026-01-04'), row('old', '2026-01-01'), row('due', '2026-01-03')];
		expect(selectDue(rows, Date.parse('2026-01-03')).map((r) => r.key)).toEqual(['old', 'due']);
	});
});

describe('time mode clock', () => {
	it('adds time for clean lines and removes it for mistakes, never into the past', () => {
		expect(moveDeadline(10_000, 0, 'clean')).toBe(10_000 + TIME_MODE.cleanMs);
		expect(moveDeadline(10_000, 0, 'mistake')).toBe(10_000 - TIME_MODE.mistakeMs);
		expect(moveDeadline(3_000, 1_000, 'mistake')).toBe(1_000);
	});
});

describe('pickNext', () => {
	it('never repeats the previous line when another exists', () => {
		const pool = ['a', 'b'];
		for (let i = 0; i < 20; i++) expect(pickNext(pool, 'a')).toBe('b');
		expect(pickNext(['a'], 'a')).toBe('a');
	});
});
