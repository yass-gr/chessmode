import { expect, test } from '@playwright/test';

test('dismisses the optional setup', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByText('Want a course suggested?')).toBeVisible();
	await page.getByRole('button', { name: 'Not now' }).click();
	await page.reload();
	await expect(page.getByText('Want a course suggested?')).toHaveCount(0);
});

test('completes setup and suggests a course', async ({ page }) => {
	await page.goto('/onboarding');
	for (const choice of ["I don't know", 'Learn a first opening', 'Just curious', 'White']) {
		await page.getByRole('button', { name: choice }).click();
		await page.getByRole('button', { name: 'Continue' }).click();
	}
	await expect(page.getByRole('button', { name: /^Start / })).toBeVisible();
	await page.getByRole('button', { name: 'Browse courses' }).click();
	await expect(page).toHaveURL(/\/courses$/);
});
