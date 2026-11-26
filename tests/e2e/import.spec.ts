import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const fixture = (name: string) => readFileSync(`src/lib/import/fixtures/${name}`, 'utf8');

test('import Lichess games', async ({ page }) => {
	if (process.env.E2E_ONLINE !== '1') {
		await page.route('https://lichess.org/api/games/user/**', route => route.fulfill({
			status: 200, contentType: 'application/x-ndjson', body: fixture('lichess.ndjson')
		}));
	}
	await page.goto('/matches');
	await page.getByRole('textbox', { name: 'Username' }).fill('DrNykterstein');
	await page.getByRole('button', { name: 'Import last 50 games' }).click();
	await expect(page.getByRole('status')).toContainText(/Imported \d+ standard games/);
	await expect(page.getByRole('link', { name: /vs\./ }).first()).toBeVisible();
});

test('import Chess.com games', async ({ page }) => {
	if (process.env.E2E_ONLINE !== '1') {
		await page.route('https://api.chess.com/pub/player/hikaru/games/**', route => route.fulfill({
			status: 200, contentType: 'application/json', body: fixture(route.request().url().endsWith('/archives') ? 'chesscom-archives.json' : 'chesscom-month.json')
		}));
	}
	await page.goto('/matches');
	await page.getByRole('button', { name: 'Chess.com' }).click();
	await page.getByRole('textbox', { name: 'Username' }).fill('Hikaru');
	await page.getByRole('button', { name: 'Import recent games' }).click();
	await expect(page.getByRole('status')).toContainText(/Imported \d+ standard games/);
	await expect(page.getByRole('link', { name: /vs\./ }).first()).toBeVisible();
});

test('paste a PGN and complete a Stockfish review', async ({ page }) => {
	test.setTimeout(180_000);
	await page.goto('/matches');
	await page.getByText('Paste a PGN').click();
	await page.getByRole('textbox', { name: 'Game PGN' }).fill('[White "Alice"]\n[Black "Bob"]\n[Result "0-1"]\n\n1. f3 e5 2. g4 Qh4# 0-1');
	await page.getByRole('button', { name: 'Review PGN' }).click();
	await expect(page).toHaveURL(/\/review\//);
	await expect(page.getByRole('slider', { name: 'Selected position on evaluation graph' })).toHaveAttribute('aria-valuemax', '4', { timeout: 150_000 });
	await expect(page.getByText('Accuracy', { exact: true }).first()).toBeVisible();
	await page.getByText('Moves and key moments').click();
	await expect(page.getByRole('heading', { name: 'Key moments' })).toBeVisible();
});

test('retry a losing move in the Fool\'s Mate review', async ({ page }) => {
	await page.goto('/matches');
	await page.getByText('Paste a PGN').click();
	await page.getByRole('textbox', { name: 'Game PGN' }).fill('[White \"Alice\"]\n[Black \"Bob\"]\n[Result \"0-1\"]\n\n1. f3 e5 2. g4 Qh4# 0-1');
	await page.getByRole('button', { name: 'Review PGN' }).click();
	await expect(page.getByRole('slider', { name: 'Selected position on evaluation graph' })).toHaveAttribute('aria-valuemax', '4', { timeout: 150_000 });
	await page.getByText('Moves and key moments').click();
	await expect(page.getByRole('region', { name: 'Key moments' }).getByText(/mistake|blunder|missed/i).first()).toBeVisible();
	await page.getByRole('button', { name: 'Retry White mistakes' }).click();
	await expect(page.getByRole('button', { name: 'Hint', exact: true })).toBeVisible();
	const board = page.getByRole('application', { name: /Chess board/ });
	await board.focus();
	await page.keyboard.type('e2e4');
	await page.keyboard.press('Enter');
	const coach = page.getByRole('region', { name: 'Coach' });
	await expect(coach.getByText(/e4 works\./).first()).toBeVisible({ timeout: 30_000 });
	const success = coach.getByRole('button', { name: 'Back to game', exact: true });
	await expect(success).toBeVisible({ timeout: 30_000 });
	await success.click();
	await expect(page.getByRole('status').filter({ hasText: 'Retry complete. You found a better move for each position.' })).toBeVisible();
});
