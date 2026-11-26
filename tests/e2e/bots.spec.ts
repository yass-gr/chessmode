import { expect, test } from '@playwright/test';

test('play moves against a bot and resign', async ({ page }) => {
	await page.goto('/bots');
	await page.getByRole('link', { name: 'Play', exact: true }).click();
	const board = page.getByRole('application', { name: /Chess board/ });
	await expect(page.getByText('Your move', { exact: true })).toBeVisible();
	await board.focus();
	await page.keyboard.type('e2e4');
	await page.keyboard.press('Enter');
	await expect(page.getByRole('button', { name: 'e4', exact: true })).toBeVisible();
	await expect(page.getByText('Your move', { exact: true })).toBeVisible({ timeout: 30_000 });
	await board.focus();
	await page.keyboard.type('g1f3');
	await page.keyboard.press('Enter');
	await expect(page.getByRole('button', { name: 'Nf3', exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Resign' }).click();
	await expect(page.getByRole('button', { name: 'Review the game' })).toBeVisible();
});
