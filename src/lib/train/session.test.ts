import { describe, expect, it } from 'vitest';
import { createEmptyCard } from 'ts-fsrs';
import type { LineProgress } from '#lib/db.ts';
import type { LineKey } from '#lib/courses/types.ts';
import { selectDue, timeRemaining } from './session.ts';

const row = (key: string, date: string): LineProgress => ({ key: key as LineKey, courseId: 'test', card: { ...createEmptyCard(), due: new Date(date) }, learnedAt: 0, reviews: 0, lapses: 0 });
describe('practice queue', () => {
 it('returns due cards in due order and excludes future cards', () => {
  const rows = [row('later', '2026-01-04'), row('old', '2026-01-01'), row('due', '2026-01-03')];
  expect(selectDue(rows, Date.parse('2026-01-03')).map(r => r.key)).toEqual(['old', 'due']);
 });
});
describe('timed drill', () => {
 it('adds clean-line time and subtracts ticks and mistakes without going negative', () => {
  expect(timeRemaining(60, 'tick')).toBe(59);
  expect(timeRemaining(59, 'clean')).toBe(67);
  expect(timeRemaining(3, 'mistake')).toBe(0);
 });
});
