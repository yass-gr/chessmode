import { expect, test } from '@playwright/test';
import { createEmptyCard } from 'ts-fsrs';
import { readFileSync } from 'node:fs';

test('open Arena and Puzzles from the Drill hub with learned lines', async ({ page }) => {
	await page.goto('/drill');
	await page.waitForFunction(async () => {
		const stored = (await indexedDB.databases()).find((db) => db.name === 'chessmode' && (db.version ?? 0) >= 30);
		if (!stored) return false;
		const db = await new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open('chessmode');
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
		const ready = db.objectStoreNames.contains('progress');
		db.close();
		return ready;
	});
	const card = createEmptyCard();
	await page.evaluate(async (card) => {
		const request = indexedDB.open('chessmode');
		const db = await new Promise<IDBDatabase>((resolve, reject) => {
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
		await new Promise<void>((resolve, reject) => {
			const tx = db.transaction('progress', 'readwrite');
			for (const id of ['nb5-na6-c6', 'nb5-na6-nb4', 'nb5-bd6']) {
				tx.objectStore('progress').put({ key: `jobava-london/${id}`, courseId: 'jobava-london', card, learnedAt: Date.now(), reviews: 0, lapses: 0 });
			}
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
		});
		db.close();
	}, card);
	await page.reload();
	const arena = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Arena' }) });
	await arena.getByRole('listitem').filter({ hasText: 'Jobava London' }).getByRole('link', { name: 'Play' }).click();
	await expect(page.getByRole('heading', { name: 'Arena' })).toBeVisible();
	await page.getByRole('button', { name: 'Play', exact: true }).click();
	await expect(page.getByRole('application', { name: /Chess board/ })).toBeVisible();
	const arenaBoard = page.getByRole('application', { name: /Chess board/ });
	await arenaBoard.focus();
	await page.keyboard.type('h2h3');
	await page.keyboard.press('Enter');
	await expect(page.getByRole('heading', { name: /You won the opening|An even opening|You lost the opening/ })).toBeVisible({ timeout: 90_000 });
	await page.goto('/drill');
	const puzzles = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Puzzles' }) });
	await puzzles.getByRole('listitem').filter({ hasText: 'Jobava London' }).getByRole('link', { name: 'Solve' }).click();
	await expect(page.getByRole('heading', { name: 'Punish the mistake' })).toBeVisible();
	for (let prompt = 0; prompt < 3; prompt++) {
		const notNow = page.getByRole('button', { name: 'Not now' });
		if (!await notNow.isVisible()) break;
		await notNow.click();
	}
	const puzzleBoard = page.getByRole('application', { name: /Chess board/ });
	await expect(puzzleBoard).toBeVisible();
	const puzzleId = (await page.getByRole('link', { name: /Puzzle .* from the Lichess database/ }).getAttribute('href'))!.split('/').at(-1);
	const puzzle = (JSON.parse(readFileSync('static/data/puzzles/jobava-london.json', 'utf8')) as { id: string; moves: string[] }[])
		.find((candidate) => candidate.id === puzzleId);
	expect(puzzle).toBeTruthy();
	const turnPrompt = page.getByText(/to move\. Find the punishment\./);
	for (let index = 1; index < puzzle!.moves.length; index += 2) {
		await expect(turnPrompt).toBeVisible();
		await puzzleBoard.focus();
		await page.keyboard.type(puzzle!.moves[index]);
		await page.keyboard.press('Enter');
		if (index + 2 < puzzle!.moves.length) {
			await expect(page.getByText(/Your opponent leaves the line/)).toBeVisible();
			await expect(turnPrompt).toBeVisible();
		}
	}
	await expect(page.getByText(/Solved\.|Recovered\./)).toBeVisible({ timeout: 30_000 });
});
