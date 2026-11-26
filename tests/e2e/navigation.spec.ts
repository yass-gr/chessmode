import { expect, test } from '@playwright/test';

const routes = [
	['/', 'Your library'], ['/courses', 'Courses'], ['/practice', 'Practice'],
	['/drill', 'Drill'], ['/matches', 'Matches'], ['/explorer', 'Opening explorer'],
	['/analysis', 'Analysis'], ['/opening-review', 'Opening review'], ['/bots', 'Play a bot'],
	['/endgames', 'Endgame arena'], ['/books', 'Reading'], ['/community', 'Openings'],
	['/create', 'Create a course'], ['/onboarding', "What's your rating?"], ['/you', 'Settings']
] as const;

for (const [route, heading] of routes) {
	test(`${route} loads without overflow or browser errors`, async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
		page.on('requestfailed', (request) => {
			if (new URL(request.url()).origin === 'http://127.0.0.1:4360') errors.push(`${request.url()}: ${request.failure()?.errorText}`);
		});
		await page.goto(route);
		await expect(page.getByText(heading, { exact: true }).first()).toBeVisible();
		expect(await page.evaluate(() => document.scrollingElement!.scrollWidth <= innerWidth)).toBe(true);
		expect(errors).toEqual([]);
	});
}

test('unknown route displays an error', async ({ page }) => {
	await page.goto('/this-route-does-not-exist');
	await expect(page.getByText('That page is not here.')).toBeVisible();
});
