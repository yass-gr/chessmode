import { describe, expect, it } from 'vitest';
import { courses } from '#lib/courses/index.ts';
import { positionOf, searchCourses } from '#lib/courses/search.ts';

const ids = (text: string, side?: 'w' | 'b') => searchCourses(courses, { text, side }).map((c) => c.id);

describe('searchCourses', () => {
	it('lists every course for an empty query, filtered by side', () => {
		expect(ids('')).toEqual(courses.map((c) => c.id));
		expect(ids('', 'b')).toEqual(['caro-kann']);
	});

	it('matches by name, ignoring case', () => {
		expect(ids('jobava')).toEqual(['jobava-london']);
		expect(ids('CARO')).toEqual(['caro-kann']);
	});

	it('matches by moves, whatever the move order', () => {
		expect(ids('1.e4 c6 2.d4 d5 3.e5')).toEqual(['caro-kann']);
		expect(ids('1. d4 d5 2. Nc3')).toEqual(['jobava-london']);
		expect(ids('1.Nc3 d5 2.d4')).toEqual(['jobava-london']);
	});

	it('finds nothing for moves no course reaches', () => {
		expect(ids('1.e4 e5 2.Nf3 Nc6 3.Bb5')).toEqual([]);
	});
});

describe('positionOf', () => {
	it('reads numbered and bare moves and rejects illegal ones', () => {
		expect(positionOf('1.e4 c6')).toBe(positionOf('e4 c6'));
		expect(positionOf('1.e4 e4')).toBeUndefined();
		expect(positionOf('caro kann')).toBeUndefined();
	});
});
