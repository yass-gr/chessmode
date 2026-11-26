import { expect, test } from '@playwright/test';

test('main tabs navigate and identify the current page', async ({ page }) => {
	await page.goto('/');
	const nav = page.getByRole('navigation', { name: 'Main' });
	await expect(nav).toBeVisible();
	const bounds = await nav.boundingBox();
	expect(bounds).not.toBeNull();
	if (!bounds) throw new Error('Main navigation is not visible');
	if (page.viewportSize()!.width < 1024) expect(bounds.y).toBeGreaterThan(page.viewportSize()!.height / 2);
	else expect(bounds.y).toBeLessThan(page.viewportSize()!.height / 2);
	for (const [label, path] of [['Practice', '/practice'], ['Drill', '/drill'], ['Matches', '/matches'], ['You', '/you'], ['Learn', '/']] as const) {
		await nav.getByRole('link', { name: label }).click();
		await expect(page).toHaveURL(new RegExp(`${path === '/' ? '/$' : path + '$'}`));
		await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
		await expect(nav.getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page');
	}
});
