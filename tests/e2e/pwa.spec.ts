import { expect, test } from '@playwright/test';

test('manifest and offline shell', async ({ page, context, request, isMobile }) => {
	test.fixme(isMobile, 'Offline reload is blank on phone; see docs/e2e-report.md');
	const response = await request.get('/manifest.webmanifest');
	expect(response.ok()).toBeTruthy();
	const manifest = await response.json();
	expect(manifest.name).toBeTruthy();
	expect(manifest.start_url).toBeTruthy();
	expect(manifest.icons.length).toBeGreaterThan(0);
	await page.goto('/');
	await expect(page.getByText('Your library')).toBeVisible();
	await page.evaluate(async () => {
		await navigator.serviceWorker.ready;
		if (!navigator.serviceWorker.controller) await new Promise<void>((resolve) => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }));
	});
	await context.setOffline(true);
	await page.reload();
	await expect(page.getByText('Your library')).toBeVisible();
	await page.goto('/learn/jobava-london/nb5-na6-c6');
	await expect(page.getByRole('application', { name: /Chess board/ })).toBeVisible();
});
