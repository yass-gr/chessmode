import { expect, test } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';

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
		await expect(page.getByRole('main').getByText(heading, { exact: true }).first()).toBeVisible();
		expect(await page.evaluate(() => document.scrollingElement!.scrollWidth <= innerWidth)).toBe(true);
		expect(errors).toEqual([]);
	});
}

const courseIds = readdirSync('src/lib/courses')
	.filter((name) => name.endsWith('.json'))
	.map((name) => name.slice(0, -5));

for (const courseId of courseIds) {
	test(`/course/${courseId} loads without overflow or browser errors`, async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
		await page.goto(`/course/${courseId}`);
		await expect(page.getByRole('main')).toBeVisible();
		expect(await page.evaluate(() => document.scrollingElement!.scrollWidth <= innerWidth)).toBe(true);
		expect(errors).toEqual([]);
	});
}

const jobava = JSON.parse(readFileSync('src/lib/courses/jobava-london.json', 'utf8')) as {
	chapters: { id: string; quiz?: unknown[]; lines: { id: string }[] }[];
};
const quizChapter = jobava.chapters.find((chapter) => chapter.quiz?.length)?.id;
const firstLine = jobava.chapters.flatMap((chapter) => chapter.lines)[0]?.id;

test('parameterized play, study, quiz and review routes load without overflow or browser errors', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
	const routes = [
		`/learn/jobava-london/${firstLine}`,
		`/quiz/jobava-london/${quizChapter}`,
		'/books/last-pieces/queen',
		'/bots/play?bot=pip&color=w',
		'/endgames/play'
	];
	for (const route of routes) {
		await page.goto(route);
		await expect(page.locator('body')).not.toBeEmpty();
		expect(await page.evaluate(() => document.scrollingElement!.scrollWidth <= innerWidth), route).toBe(true);
	}
	await page.goto('/matches');
	await page.getByText('Paste a PGN').click();
	await page.getByRole('textbox', { name: 'Game PGN' }).fill('1. e4 e5 2. Nf3 Nc6 *');
	await page.getByRole('button', { name: 'Review PGN' }).click();
	await page.waitForURL(/\/review\//);
	await expect(page.locator('body')).not.toBeEmpty();
	expect(await page.evaluate(() => document.scrollingElement!.scrollWidth <= innerWidth)).toBe(true);
	expect(errors).toEqual([]);
});

test('unknown route displays an error', async ({ page }) => {
	await page.goto('/this-route-does-not-exist');
	await expect(page.getByText('That page is not here.')).toBeVisible();
});
