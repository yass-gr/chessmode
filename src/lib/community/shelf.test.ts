import { describe, expect, it } from 'vitest';
import type { Course } from '#lib/courses/types.ts';
import { communityShelf } from '#lib/community/shelf.ts';

describe('communityShelf', () => {
	it('links a guest to the first line of each shipped course', () => {
		const course = {
			id: 'sample',
			name: 'Sample',
			tagline: 'A short opening.',
			side: 'w',
			lines: [{ id: 'first' }, { id: 'second' }]
		} as Course;
		expect(communityShelf([course])).toEqual([
			{
				id: 'sample',
				name: 'Sample',
				tagline: 'A short opening.',
				side: 'w',
				lines: 2,
				href: '/learn/sample/first'
			}
		]);
	});
});