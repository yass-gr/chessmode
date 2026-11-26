import { describe, expect, it } from 'vitest';
import { tabs, tabForPath } from '#lib/nav.ts';

describe('navigation', () => {
	it('assigns each top-level route to exactly one section', () => {
		const routes = new Set(Object.keys(import.meta.glob('../routes/**/+page.svelte')).map((file) => file.split('/')[2]).filter((name) => name !== '+page.svelte'));
		for (const route of routes) {
			const path = `/${route}`;
			const matches = tabs.filter((tab) => tab.prefixes.some((prefix) => prefix === path));
			expect(matches, path).toHaveLength(1);
			expect(tabForPath(path)).toBe(matches[0]);
		}
		expect(tabForPath('/')?.label).toBe('Learn');
	});

	it.each(['/puzzles/caro-kann', '/books/a/section', '/community'])('keeps %s in Drill', (path) => {
		expect(tabForPath(path)?.label).toBe('Drill');
	});
});
