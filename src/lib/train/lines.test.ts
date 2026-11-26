import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { parseCourse } from '#lib/courses/parse.ts';
import type { CourseFile, Line } from '#lib/courses/types.ts';
import fixture from '#lib/courses/fixtures/test-course.json';
import { commonPrefix, matchingLine, openingSkip } from './lines.ts';

const course = parseCourse({ ...fixture, side: 'w' } satisfies CourseFile);

function line(ucis: [string, boolean][]): Line {
	return { plies: ucis.map(([uci, student]) => ({ uci, student })) } as Line;
}

describe('opening skip', () => {
	const lines = [
		line([['e2e4', true], ['e7e5', false], ['g1f3', true]]),
		line([['e2e4', true], ['e7e5', false], ['b1c3', true]])
	];

	it('skips a shared opening of at least two plies when a player move remains', () => {
		expect(commonPrefix(lines)).toBe(2);
		expect(openingSkip({ mode: 'practice', enabled: true, lines, line: lines[0], firstLearn: false })).toBe(2);
		expect(openingSkip({ mode: 'learn', enabled: true, lines, line: lines[0], firstLearn: true })).toBe(0);
		expect(openingSkip({ mode: 'time', enabled: true, lines, line: lines[0], firstLearn: false })).toBe(0);
		expect(commonPrefix(course.lines)).toBe(1);
		expect(openingSkip({ mode: 'practice', enabled: true, lines: course.lines, line: course.lines[0], firstLearn: false })).toBe(0);
	});
});

describe('matchingLine', () => {
	it('finds the other line when a move reaches its position', () => {
		const chess = new Chess();
		chess.move('e4');
		chess.move('c5');
		const found = matchingLine(course, chess.fen(), course.lines[0].key);
		expect(found?.line.id).toBe('sicilian');
	});
});
