import { expect, test } from '@playwright/test';

test('create a course and warn about conflicting moves', async ({ page }) => {
	await page.goto('/create');
	await page.getByRole('button', { name: 'Paste PGN' }).click();
	await page.getByRole('textbox', { name: 'Course name' }).fill('My repertoire');
	await page.getByRole('textbox', { name: 'PGN', exact: true }).fill('1. e4 (1. d4 d5) e5 2. Nf3 Nc6 *');
	await expect(page.getByText(/Your PGN gives two moves for you/)).toBeVisible();
	await page.getByRole('button', { name: 'Create course', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'My repertoire' })).toBeVisible();
	await page.getByRole('link', { name: /Learn/ }).first().click();
	await expect(page.getByRole('application', { name: /Chess board/ })).toBeVisible();
});
