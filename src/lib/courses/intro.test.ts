import { describe, expect, it } from 'vitest';
import { courses } from '#lib/courses/index.ts';
import { courseIntro, introLine, introOrientation } from '#lib/courses/intro.ts';

describe('courseIntro', () => {
	it('returns nothing for a course without intro data', () => {
		expect(courseIntro('not-a-course')).toBeUndefined();
	});

	it('gives every bundled course three short lessons and a position the course reaches', () => {
		expect(courses.length).toBeGreaterThan(0);
		for (const course of courses) {
			const intro = courseIntro(course.id);
			expect(intro, course.id).toBeTruthy();
			expect(intro!.learn, course.id).toHaveLength(3);
			for (const bullet of intro!.learn) expect(bullet.trim().split(/\s+/).length, `${course.id}: ${bullet}`).toBeLessThan(12);
			const line = introLine(intro!.moves);
			const reached = course.lines.some((item) => line.sans.every((san, index) => item.plies[index]?.san === san));
			expect(reached, `${course.id}: ${intro!.moves}`).toBe(true);
		}
	});

	it('stops the Caro-Kann on the position after 1.e4 c6 2.d4 d5', () => {
		const intro = courseIntro('caro-kann');
		expect(introLine(intro!.moves).fen.startsWith('rnbqkbnr/pp2pppp/2p5/3p4/3PP3/8/PPP2PPP/RNBQKBNR')).toBe(true);
	});

	it('turns a black course toward the student', () => {
		expect(introOrientation('b')).toBe('black');
		expect(introOrientation('w')).toBe('white');
		for (const course of courses) {
			expect(introOrientation(course.side), course.id).toBe(course.side === 'b' ? 'black' : 'white');
		}
	});

	it('stops the Ruy Lopez on the position after 3.Bb5', () => {
		const intro = courseIntro('ruy-lopez');
		expect(introLine(intro!.moves).fen.startsWith('r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R')).toBe(true);
	});
});
