import { describe, expect, it } from 'vitest';
import { courses } from '#lib/courses/index.ts';
import { depthData } from '#lib/courses/depth-data.ts';
import { courseScope, defaultDepth } from '#lib/courses/depth.ts';
import { modeAvailability } from '#lib/courses/unlocks.ts';

describe('course depth', () => {
 it('covers each bundled course exactly once with increasing cumulative tiers', () => {
  expect(courses).toHaveLength(12);
  for (const course of courses) {
   const data = depthData[course.id];
   expect(data).toBeDefined();
   expect(new Set(data.order)).toEqual(new Set(course.lines.map(line => line.id)));
   expect(data.order).toHaveLength(course.lines.length);
   expect(data.counts.at(-1)).toBe(course.lines.length);
   expect(data.counts.every((n, i) => n > (data.counts[i - 1] ?? 0))).toBe(true);
   const first = courseScope(course, defaultDepth(), new Map());
   const full = courseScope(course, { ...defaultDepth(), tier: data.counts.length - 1 }, new Map());
   expect(first.lines.length).toBe(data.counts[0]);
   expect(new Set(first.lines.map(line => line.id))).toEqual(new Set(data.order.slice(0, data.counts[0])));
   expect(full.lines.length).toBe(course.lines.length);
   expect(first.lines).toEqual(course.lines.filter(line => first.lines.includes(line)));
   expect(full.lines).toEqual(course.lines);
  }
 });
 it('starts a fresh Caro-Kann course at its first in-scope line', () => {
  const course = courses.find(course => course.id === 'caro-kann');
  expect(course).toBeDefined();
  if (!course) return;
  const scope = courseScope(course, defaultDepth(), new Map());
  expect(scope.next).toBe(course.chapters[0].lines.find(line => scope.lines.includes(line)));
  expect(scope.next?.chapterId).toBe(course.chapters[0].id);
 });
 it('provides usable gates for short courses and missing data', () => {
  expect(modeAvailability('drill', 1, 1)).toEqual({ kind: 'available' });
  expect(modeAvailability('drill', 1, 10)).toEqual({ kind: 'locked', remaining: 2 });
  expect(modeAvailability('puzzle', 2, 10, false).kind).toBe('unavailable');
 });
});
