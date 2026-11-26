import { expect, test } from '@playwright/test';

test('open a book section and step through its example', async ({ page }) => {
	await page.goto('/books');
	await page.getByRole('link', { name: /The last pieces/ }).click();
	await page.getByRole('link', { name: /Queen and king/ }).click();
	await expect(page.getByRole('heading', { name: 'Queen and king' })).toBeVisible();
	await expect(page.getByRole('application', { name: /Chess board/ }).first()).toBeVisible();
	await page.getByRole('button', { name: 'Next move' }).click();
	await expect(page.getByRole('button', { name: 'Previous move' })).toBeEnabled();
});

test('load a game on the analysis board and navigate moves', async ({ page }) => {
	await page.goto('/analysis');
	await page.getByRole('textbox', { name: 'Game PGN' }).fill('1. e4 e5 2. Nf3 Nc6 *');
	await page.getByRole('button', { name: 'Load PGN' }).click();
	await expect(page.getByRole('button', { name: 'Back', exact: true })).toBeEnabled();
	await page.getByRole('button', { name: 'Back', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Forward', exact: true })).toBeEnabled();
});

test('complete a chapter quiz and retry it', async ({ page }) => {
	await page.goto('/course/jobava-london');
	await page.getByRole('button', { name: /^Start with/ }).click();
	await page.getByRole('button', { name: 'Quiz', exact: true }).click();
	await page.getByRole('link', { name: /questions/ }).first().click();
	await expect(page.getByRole('heading', { name: 'Find the plan' })).toBeVisible();
	const count = await page.getByText(/^Question 1 of /).textContent();
	const total = Number(count?.match(/of (\d+)/)?.[1]);
	expect(total).toBeGreaterThan(0);
	for (let index = 0; index < total; index++) {
		await page.getByRole('button', { name: /^A\./ }).click();
		await page.getByRole('button', { name: 'Check answer' }).click();
		await expect(page.getByText(/^(Correct\.|The answer is)/)).toBeVisible();
		await page.getByRole('button', { name: index === total - 1 ? 'See results' : 'Next question' }).click();
	}
	await expect(page.getByText(/Quiz complete/)).toBeVisible();
	await page.getByRole('button', { name: 'Try again' }).click();
	await expect(page.getByText(`Question 1 of ${total}`)).toBeVisible();
});

test('explore saved opening replies and return to the starting position', async ({ page }) => {
	await page.goto('/explorer');
	await page.getByRole('group', { name: 'Course', exact: true }).getByRole('button', { name: 'Jobava London' }).click();
	await expect(page.getByRole('status')).toContainText(/games/);
	await page.getByRole('button', { name: /^d4\s/ }).click();
	await expect(page.getByRole('button', { name: 'Back', exact: true })).toBeEnabled();
	await page.getByRole('button', { name: 'Back', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Forward', exact: true })).toBeEnabled();
});

test('filter saved games in opening review', async ({ page }) => {
	await page.route('https://lichess.org/api/games/user/**', async route => {
		const { readFileSync } = await import('node:fs');
		await route.fulfill({ status: 200, contentType: 'application/x-ndjson', body: readFileSync('src/lib/import/fixtures/lichess.ndjson', 'utf8') });
	});
	await page.goto('/matches');
	await page.getByRole('textbox', { name: 'Username' }).fill('DrNykterstein');
	await page.getByRole('button', { name: 'Import last 50 games' }).click();
	await expect(page.getByRole('status')).toContainText(/Imported \d+ standard games/);
	await page.goto('/opening-review');
	await expect(page.getByRole('heading', { name: /In a course/ })).toBeVisible();
	await expect(page.getByRole('heading', { name: /Not matched/ })).toBeVisible();
	await page.getByRole('group', { name: 'Side' }).getByRole('button', { name: 'White' }).click();
	await expect(page.getByRole('group', { name: 'Side' }).getByRole('button', { name: 'White' })).toHaveAttribute('aria-pressed', 'true');
});
