import { expect, test } from '@playwright/test';

test('export and restore saved settings', async ({ page }) => {
	await page.goto('/you');
	const sound = page.getByRole('switch', { name: 'Sound' });
	await expect(sound).toHaveAttribute('aria-checked', 'true');
	await sound.click();
	await expect(sound).toHaveAttribute('aria-checked', 'false');
	const [download] = await Promise.all([
		page.waitForEvent('download'),
		page.getByRole('button', { name: 'Export' }).click()
	]);
	const path = await download.path();
	await sound.click();
	await expect(sound).toHaveAttribute('aria-checked', 'true');
	await page.locator('input[type=file]').setInputFiles(path);
	await page.getByRole('button', { name: 'Replace' }).click();
	await expect(sound).toHaveAttribute('aria-checked', 'false');
});
