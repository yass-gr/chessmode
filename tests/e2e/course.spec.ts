import { expect, test } from '@playwright/test';

test('browse a course, choose depth, and inspect its sections', async ({ page }) => {
	await page.goto('/courses');
	await page.getByRole('link', { name: /Jobava London/ }).first().click();
	await expect(page.getByRole('heading', { name: 'Choose your depth' })).toBeVisible();
	await page.getByRole('button', { name: /^Start with/ }).click();
	await expect(page.getByRole('heading', { name: 'Jobava London' })).toBeVisible();
	await expect(page.getByRole('button', { name: /Coverage/ })).toBeVisible();
	await page.getByRole('button', { name: /Coverage/ }).click();
	await expect(page.getByRole('button', { name: /Coverage/ })).toHaveAttribute('aria-expanded', 'true');
	await page.getByRole('button', { name: 'Ideas', exact: true }).click();
	await expect(page.getByText('Chapter 1', { exact: false }).first()).toBeVisible();
	await page.getByRole('button', { name: 'Quiz', exact: true }).click();
	await expect(page.getByText('Check that you know the plans, not only the moves.')).toBeVisible();
	await page.getByRole('button', { name: 'Lines', exact: true }).click();
	await expect(page.getByRole('link', { name: /4\.\.\.Na6 5\.e3 c6/ })).toBeVisible();
	await expect(page.getByText(/Learn \d+ more/).first()).toBeVisible();
});
