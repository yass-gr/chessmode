import { describe, expect, it } from 'vitest';
import { cubicBezier, navKind } from '#lib/motion.ts';

describe('navKind', () => {
	it('does not animate between tabs', () => {
		expect(navKind('/', '/drill')).toBe('none');
		expect(navKind('/you', '/practice', -1)).toBe('none');
		expect(navKind('/course/caro-kann', '/drill')).toBe('none');
	});

	it('pushes deeper and pops back up', () => {
		expect(navKind('/', '/course/caro-kann')).toBe('push');
		expect(navKind('/courses', '/course/caro-kann')).toBe('push');
		expect(navKind('/course/caro-kann', '/')).toBe('pop');
		expect(navKind('/create', '/courses')).toBe('pop');
	});

	it('follows history direction for back and forward', () => {
		expect(navKind('/course/caro-kann', '/courses', -1)).toBe('pop');
		expect(navKind('/courses', '/course/caro-kann', 1)).toBe('push');
	});

	it('presents full-screen flows and dismisses them', () => {
		expect(navKind('/course/caro-kann', '/learn/caro-kann/advance')).toBe('present');
		expect(navKind('/matches', '/review/abc')).toBe('present');
		expect(navKind('/review/abc', '/matches', -1)).toBe('dismiss');
		expect(navKind('/matches', '/explorer')).toBe('present');
		expect(navKind('/analysis', '/matches', -1)).toBe('dismiss');
		expect(navKind('/drill/run', '/drill')).toBe('dismiss');
		expect(navKind('/drill', '/endgames/play')).toBe('present');
		expect(navKind('/endgames/play', '/endgames', -1)).toBe('dismiss');
		expect(navKind('/bots', '/bots/play')).toBe('present');
	});

	it('pushes from one flow to the next', () => {
		expect(navKind('/learn/caro-kann/a', '/learn/caro-kann/b')).toBe('push');
		expect(navKind('/matches', '/opening-review')).toBe('push');
		expect(navKind('/opening-review', '/matches')).toBe('pop');
		expect(navKind('/drill', '/endgames')).toBe('push');
		expect(navKind('/endgames', '/drill')).toBe('pop');
		expect(navKind('/books/last-pieces', '/books')).toBe('pop');
	});
});

describe('cubicBezier', () => {
	it('matches the endpoints and a strong ease-out', () => {
		const ease = cubicBezier(0.23, 1, 0.32, 1);
		expect(ease(0)).toBe(0);
		expect(ease(1)).toBe(1);
		expect(ease(0.5)).toBeGreaterThan(0.85);
		expect(cubicBezier(0, 0, 1, 1)(0.3)).toBeCloseTo(0.3, 3);
	});
});
