import { expect, test } from '@playwright/test';
import { createEmptyCard } from 'ts-fsrs';

test('open Arena and Puzzles from the Drill hub with learned lines', async ({ page }) => {
	await page.goto('/drill');
	await page.waitForFunction(async () => (await indexedDB.databases()).some(db => db.name === 'chessmode' && (db.version ?? 0) >= 30));
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
	await page.goto('/drill');
	const puzzles = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Puzzles' }) });
	await puzzles.getByRole('listitem').filter({ hasText: 'Jobava London' }).getByRole('link', { name: 'Solve' }).click();
	await expect(page.getByRole('heading', { name: 'Punish the mistake' })).toBeVisible();
	await expect(page.getByRole('application', { name: /Chess board/ })).toBeVisible();
});
