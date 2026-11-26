import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';

test('one visit installs the offline app shell and its routes', async ({ page, context, request }) => {
	const response = await request.get('/manifest.webmanifest');
	expect(response.ok()).toBeTruthy();
	const manifest = await response.json();
	expect(manifest.name).toBeTruthy();
	expect(manifest.icons.length).toBeGreaterThan(0);

	const diagnostics: string[] = [];
	mkdirSync('/tmp/chessmode-offline-shots', { recursive: true });
	page.on('console', (message) => {
		if (message.type() === 'error') diagnostics.push(`console: ${message.text()}`);
	});
	page.on('pageerror', (error) => diagnostics.push(`pageerror: ${error.message}`));
	page.on('requestfailed', (request) => diagnostics.push(`failed: ${request.url()} ${request.failure()?.errorText}`));

	await page.goto('/');
	await expect(page.getByText('Your library')).toBeVisible();
	await page.goto('/course/jobava-london');
	await expect(page.getByRole('heading', { name: 'Jobava London' })).toBeVisible();
	await page.goto('/matches');
	await page.getByText('Paste a PGN').click();
	await page.getByLabel('Game PGN').fill('[Event "Offline proof"]\n[White "Student"]\n[Black "Practice"]\n[Result "*"]\n\n1. e4 e5 2. Nf3 Nc6 *');
	await page.getByRole('button', { name: 'Review PGN' }).click();
	await page.waitForURL(/\/review\//);
	const savedReviewPath = new URL(page.url()).pathname;
	await page.goto('/');
	await expect(page.getByText('Your library')).toBeVisible();
	await page.evaluate(async () => {
		await navigator.serviceWorker.ready;
		if (!navigator.serviceWorker.controller)
			await new Promise<void>((resolve) => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }));
	});
	const puzzleFetch = await page.evaluate(async () => {
		const responses = await Promise.all(['/data/puzzles/jobava-london.json', '/data/explorer/jobava-london.json'].map((path) => fetch(path)));
		return Promise.all(responses.map(async (response) => ({ status: response.status, body: await response.text() })));
	});
	expect(puzzleFetch.map((response) => response.status)).toEqual([200, 200]);
	await expect
		.poll(() => page.evaluate(async () => {
			const cache = await caches.open((await caches.keys()).find((key) => key.startsWith('chessmode-'))!);
			return Promise.all(['/data/puzzles/jobava-london.json', '/data/explorer/jobava-london.json'].map(async (path) => !!(await cache.match(path, { ignoreVary: true }))));
		}))
		.toEqual([true, true]);
	const precacheBytes = await page.evaluate(async () => {
		const cache = await caches.open((await caches.keys()).find((key) => key.startsWith('chessmode-'))!);
		const keys = (await cache.keys()).filter((request) => !/\/data\/(puzzles|explorer)\//.test(new URL(request.url).pathname));
		return (await Promise.all(keys.map(async (request) => (await cache.match(request))!.arrayBuffer()))).reduce((sum, body) => sum + body.byteLength, 0);
	});
	console.log(`App shell precache: ${precacheBytes.toLocaleString()} bytes (${(precacheBytes / 1024).toFixed(1)} KiB)`);
	await expect
		.poll(() => page.evaluate(async () => (await caches.keys()).some((key) => key.startsWith('chessmode-'))))
		.toBe(true);

	await context.setOffline(true);
	const reloadDiagnostics = diagnostics.length;
	await page.reload();
	await expect(page.getByText('Your library')).toBeVisible();
	await expect(diagnostics.slice(reloadDiagnostics), diagnostics.slice(reloadDiagnostics).join('\n')).toEqual([]);
	await page.screenshot({ path: '/tmp/chessmode-offline-shots/home.png', fullPage: true });

	await page.goto('/courses');
	await expect(page.getByRole('main')).toBeVisible();
	await page.goto('/course/jobava-london');
	await expect(page.getByRole('heading', { name: 'Jobava London' })).toBeVisible();
	await page.screenshot({ path: '/tmp/chessmode-offline-shots/course.png', fullPage: true });

	await page.goto('/learn/jobava-london/nb5-na6-c6');
	const startLearning = page.getByRole('button', { name: 'Start learning' });
	await startLearning.click();
	await expect(startLearning).toBeHidden();
	const board = page.getByRole('application', { name: /Chess board/ });
	await expect(board).toBeVisible();
	await board.focus();
	await board.press('d');
	await board.press('4');
	await expect
		.poll(() =>
			board.locator('.cg-host cg-board piece.white.pawn').evaluateAll((pieces) =>
				pieces.some((piece) => {
					const rect = piece.getBoundingClientRect();
					const parent = piece.closest('cg-board')!.getBoundingClientRect();
					const x = (rect.x + rect.width / 2 - parent.x) / parent.width;
					const y = (rect.y + rect.height / 2 - parent.y) / parent.height;
					return Math.abs(x - 0.4375) < 0.04 && Math.abs(y - 0.5625) < 0.04;
				})
			)
		)
		.toBe(true);
	await page.screenshot({ path: '/tmp/chessmode-offline-shots/learn-move.png', fullPage: true });

	for (const route of [
		'/practice',
		'/practice/run?course=jobava-london',
		'/drill',
		'/drill/run',
		'/puzzles/jobava-london',
		'/explorer?course=jobava-london',
		'/arena/jobava-london',
		'/matches',
		savedReviewPath,
		'/you',
		'/you#settings'
	]) {
		await page.goto(route);
		await expect(page.locator('body')).not.toBeEmpty();
	}
	await expect(page.getByText('Settings', { exact: true }).first()).toBeVisible();
});
