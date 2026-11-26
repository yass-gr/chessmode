import { describe, expect, it } from 'vitest';
import { createEmptyCard } from 'ts-fsrs';
import type { LineProgress } from '#lib/db.ts';
import type { LineKey } from '#lib/courses/types.ts';
import {
	clockSpeed,
	dealDeck,
	drain,
	lineBonusMs,
	penalise,
	pickNext,
	reward,
	selectDue,
	selectPractice,
	TIME_MODE,
	type PracticeCandidate
} from './session.ts';

const row = (key: string, date: string, clean?: boolean): LineProgress => ({
	key: key as LineKey,
	courseId: 'test',
	card: { ...createEmptyCard(), due: new Date(date) },
	learnedAt: 0,
	reviews: 0,
	lapses: 0,
	...(clean ? { clean: true } : {})
});

const candidate = (key: string, due: number | null, perfected = false): PracticeCandidate => ({ key, due, perfected });

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

describe('selectPractice', () => {
	const now = Date.parse('2026-01-03T00:00:00Z');

	it('prefers a never-perfected line and will not repeat the current one', () => {
		const rows = [
			candidate('current', now - 10_000),
			candidate('other-new', now + 86_400_000),
			candidate('perfect', now - 50_000, true)
		];
		expect(selectPractice(rows, now, 'current', () => 0)?.key).toBe('other-new');
	});

	it('chooses among the three most overdue, using a fixed seed', () => {
		const rows = [1, 2, 3, 4].map((n) => candidate(`d${n}`, now - n * 1000, true));
		expect(selectPractice(rows, now, undefined, () => 0)?.key).toBe('d4');
		expect(selectPractice(rows, now, undefined, () => 0.99)?.key).toBe('d2');
	});

	it('takes the earliest future review when nothing is overdue', () => {
		const rows = [candidate('later', now + 5_000, true), candidate('sooner', now + 1_000, true)];
		expect(selectPractice(rows, now, 'sooner')?.key).toBe('later');
		expect(selectPractice(rows, now, undefined)?.key).toBe('sooner');
	});

	it('treats a missing card as the most overdue', () => {
		const rows = [candidate('scheduled', now - 1, true), candidate('missing', null, true)];
		expect(selectPractice(rows, now, undefined, () => 0)?.key).toBe('missing');
	});
});

describe('dealDeck', () => {
	it('shows every line once before a repeat', () => {
		const deck = dealDeck(['a', 'b', 'c'], () => 0.5);
		expect(new Set(deck).size).toBe(3);
		expect(deck).toHaveLength(3);
	});
});

describe('time mode clock', () => {
	it('drains faster with each clean line and clamps at zero', () => {
		expect(drain(10_000, 1_000, 0)).toBe(9_000);
		expect(clockSpeed(2)).toBeCloseTo(1.1);
		expect(drain(10_000, 1_000, 2)).toBeCloseTo(10_000 - 1_000 * clockSpeed(2));
		expect(drain(500, 1_000, 0)).toBe(0);
	});

	it('adds six seconds for a 12-ply or 13-ply clean line and nothing after a miss', () => {
		expect(lineBonusMs(12)).toBe(6_000);
		expect(lineBonusMs(13)).toBe(6_000);
		expect(reward(10_000, 12, true)).toBe(16_000);
		expect(reward(10_000, 12, false)).toBe(10_000);
		expect(penalise(10_000)).toBe(10_000 - TIME_MODE.penaltyMs);
		expect(penalise(1_000)).toBe(0);
	});
});

describe('pickNext', () => {
	it('never repeats the previous line when another exists', () => {
		const pool = ['a', 'b'];
		for (let i = 0; i < 20; i++) expect(pickNext(pool, 'a')).toBe('b');
		expect(pickNext(['a'], 'a')).toBe('a');
	});
});
