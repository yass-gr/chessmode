import { describe, expect, it } from 'vitest';
import { plural } from '#lib/format.ts';

describe('plural', () => {
	it('uses the singular only for one', () => {
		expect(plural(1, 'line')).toBe('line');
		expect(plural(0, 'line')).toBe('lines');
		expect(plural(2, 'chapter')).toBe('chapters');
	});
});
