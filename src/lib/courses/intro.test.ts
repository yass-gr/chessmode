import { describe, expect, it } from 'vitest';
import { courseIntro } from '#lib/courses/intro.ts';

describe('courseIntro', () => {
	it('returns nothing when a course has no recording', () => {
		expect(courseIntro('not-a-course')).toBeUndefined();
		expect(courseIntro('italian-game')).toBeUndefined();
	});

	it('returns the Caro-Kann intro with a playable video and a transcript', () => {
		const intro = courseIntro('caro-kann');
		expect(intro?.title).toBe('Caro-Kann Defence');
		expect(intro?.video).toBe('/intro/caro-kann.webm');
		expect(intro?.captions).toBe('/intro/caro-kann.vtt');
		expect(intro?.transcript).toContain('1.e4 c6');
	});
});
