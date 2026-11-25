import { describe, expect, it } from 'vitest';
import { streak } from './progress.ts';

describe('streak', () => {
 it('counts consecutive local days through today or yesterday, ignoring duplicates', () => {
  const now = new Date(2026, 10, 25, 12);
  expect(streak(['2026-11-25', '2026-11-24', '2026-11-24', '2026-11-23'], now)).toBe(3);
  expect(streak(['2026-11-24', '2026-11-23'], now)).toBe(2);
  expect(streak(['2026-11-23'], now)).toBe(0);
 });
});
