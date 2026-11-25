import { describe, expect, it } from 'vitest';
import { buildCourse, readPgnTree } from '#lib/courses/pgn-tree.ts';
import { parseCourse } from '#lib/courses/parse.ts';
import { courseCoverage } from '#lib/explorer/coverage.ts';
import { posKey, type Uci } from '#lib/chess/types.ts';
import type { Explorer } from '#lib/explorer/types.ts';

const course = parseCourse(buildCourse(readPgnTree('1. e4 e5 2. Nf3 *').tree, { id: 'test', name: 'Test', side: 'w' }).file);
const key = posKey(course.lines[0].plies[0].fenAfter);
const explorer = (moves: [string, number][]): Explorer => ({ games: 100, month: '2026-01', bands: [1600], nodes: new Map([[key, new Map([[1600, moves.map(([uci, count]) => ({ uci: uci as Uci, count }))]])]]) });

describe('course coverage', () => {
 it('ranks common unanswered replies and marks positions without data', () => {
  const result = courseCoverage(course, explorer([['e7e5', 80], ['c7c5', 15], ['e7e6', 5]]));
  expect(result.gaps.map(gap => gap.san)).toEqual(['c5', 'e6']);
  expect(result.gaps[0].share).toBeCloseTo(0.15);
  expect(result.points).toBeCloseTo(20);
  expect(result.unknown.length).toBeGreaterThan(0);
 });
 it('does not treat missing observations as zero gaps with adequate data', () => {
  const result = courseCoverage(course, { games: 0, month: '', bands: [], nodes: new Map() });
  expect(result.observed).toBe(0);
  expect(result.unknown.length).toBeGreaterThan(0);
 });
});
