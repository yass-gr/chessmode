import { describe, expect, it } from 'vitest';
import { createEmptyCard } from 'ts-fsrs';
import type { LineProgress } from '#lib/db.ts';
import type { LineKey } from '#lib/courses/types.ts';
import { adjust, clockSpeed, drain, lineResult, pickNext, selectDue, TIME_MODE } from './session.ts';

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

	it('puts lines never played cleanly ahead of more overdue clean ones', () => {
		const rows = [{ ...row('clean-old', '2026-01-01'), clean: true }, row('fresh', '2026-01-02')];
		expect(selectDue(rows, Date.parse('2026-01-03')).map((r) => r.key)).toEqual(['fresh', 'clean-old']);
	});
});

describe('time mode clock', () => {
	it('drains faster as the score grows, up to a cap', () => {
		expect(drain(10_000, 1_000, 0)).toBe(9_000);
		expect(drain(10_000, 1_000, 10)).toBeCloseTo(10_000 - 1_000 * clockSpeed(10));
		expect(clockSpeed(10)).toBeGreaterThan(clockSpeed(0));
		expect(clockSpeed(1_000)).toBe(TIME_MODE.maxSpeed);
		expect(drain(500, 1_000, 0)).toBe(0);
	});

	it('pays clean lines only, and a hint forfeits the bonus without a penalty', () => {
		expect(lineResult(0, 0)).toBe('clean');
		expect(lineResult(0, 1)).toBe('hinted');
		expect(lineResult(2, 1)).toBe('mistake');
		expect(adjust(10_000, 'clean')).toBe(10_000 + TIME_MODE.cleanMs);
		expect(adjust(10_000, 'hinted')).toBe(10_000);
		expect(adjust(3_000, 'mistake')).toBe(0);
	});
});

describe('pickNext', () => {
	it('never repeats the previous line when another exists', () => {
		const pool = ['a', 'b'];
		for (let i = 0; i < 20; i++) expect(pickNext(pool, 'a')).toBe('b');
		expect(pickNext(['a'], 'a')).toBe('a');
	});
});
