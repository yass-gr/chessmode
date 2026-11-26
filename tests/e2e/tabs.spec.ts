import { expect, test } from '@playwright/test';

test('main tabs navigate and identify the current page', async ({ page }) => {
	await page.goto('/');
	const nav = page.getByRole('navigation', { name: 'Main' });
	for (const [label, path] of [['Practice', '/practice'], ['Drill', '/drill'], ['Matches', '/matches'], ['You', '/you'], ['Learn', '/']] as const) {
		await nav.getByRole('link', { name: label }).click();
		await expect(page).toHaveURL(new RegExp(`${path === '/' ? '/$' : path + '$'}`));
		await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
		await expect(nav.getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page');
	}
});
