import { describe, expect, it } from 'vitest';
import { arrowFor, coachOpen } from './coach.ts';

describe('coach', () => {
	it('opens for a first encounter, every move, or a tap', () => {
		expect(coachOpen({ mode: 'learn', coaching: 'default', requested: false, explanatory: false })).toBe(true);
		expect(coachOpen({ mode: 'practice', coaching: 'default', requested: false, explanatory: false })).toBe(false);
		expect(coachOpen({ mode: 'practice', coaching: 'default', requested: false, explanatory: true })).toBe(true);
		expect(coachOpen({ mode: 'practice', coaching: 'always', requested: false, explanatory: false })).toBe(true);
		expect(coachOpen({ mode: 'learn', coaching: 'tap', requested: false, explanatory: true })).toBe(false);
		expect(coachOpen({ mode: 'learn', coaching: 'tap', requested: true, explanatory: false })).toBe(true);
	});

	it('hides the answer during a fix until the move is shown', () => {
		expect(arrowFor({ setting: 'always', hint: 'none', coachOpen: true, hideAnswer: true })).toBe('none');
		expect(arrowFor({ setting: 'none', hint: 'source', coachOpen: false, hideAnswer: true })).toBe('source');
		expect(arrowFor({ setting: 'withDialog', hint: 'move', coachOpen: false, hideAnswer: false })).toBe('none');
		expect(arrowFor({ setting: 'withDialog', hint: 'move', coachOpen: true, hideAnswer: false })).toBe('full');
		expect(arrowFor({ setting: 'none', hint: 'move', coachOpen: true, hideAnswer: false, forced: true })).toBe('full');
	});
});
