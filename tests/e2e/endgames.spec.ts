import { expect, test } from '@playwright/test';

test('choose endgame settings and start a position', async ({ page }) => {
	await page.goto('/drill');
	await page.getByRole('navigation', { name: 'More training' }).getByRole('link', { name: 'Endgames' }).click();
	await page.getByRole('group', { name: 'Endgame mode' }).getByRole('button', { name: 'Coached' }).click();
	await page.getByRole('group', { name: 'Position difficulty' }).getByRole('button', { name: 'Easier' }).click();
	await page.getByRole('link', { name: 'Play an endgame' }).click();
	await expect(page.getByRole('application', { name: /Chess board/ })).toBeVisible();
});
