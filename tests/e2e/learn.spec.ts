import { expect, test, type Locator } from '@playwright/test';

async function move(board: Locator, from: string, to: string) {
	const box = await board.boundingBox();
	if (!box) throw new Error('Chess board is not visible');
	for (const square of [from, to]) {
		const x = (square.charCodeAt(0) - 97 + 0.5) * box.width / 8;
		const y = (8 - Number(square[1]) + 0.5) * box.height / 8;
		await board.click({ position: { x, y } });
	}
}

test('learn a line, recover from a wrong move, and keep progress', async ({ page }) => {
	test.setTimeout(120_000);
	await page.goto('/learn/jobava-london/nb5-na6-c6');
	await page.getByRole('button', { name: 'Start learning' }).click();
	const board = page.getByRole('application', { name: /Chess board/ });
	await expect(board).toBeVisible();
	await move(board, 'e2', 'e4');
	await expect(page.getByText(/is not the line/)).toBeVisible();
	await page.getByRole('button', { name: 'Take back' }).click();
	const progress = page.getByRole('progressbar');
	for (const [index, [from, to]] of [['d2','d4'], ['b1','c3'], ['c1','f4'], ['c3','b5'], ['e2','e3'], ['b5','c3'], ['f1','d3'], ['g1','f3'], ['d3','a6'], ['f3','e5']].entries()) {
		await move(board, from, to);
		await expect(progress).toHaveAttribute('aria-valuenow', String(index + 1));
	}
	await expect(page.getByText('Line learned · +10 XP')).toBeVisible();
	await page.getByRole('link', { name: 'Back to course' }).click();
	await expect(page).toHaveURL(/\/course\/jobava-london$/);
	await page.reload();
	await expect(page.getByText(/1\/\d+ learned/).first()).toBeVisible();
	await page.goto('/you');
	await expect(page.getByText('Lines discovered').locator('..')).toContainText('1');
	const [backup] = await Promise.all([
		page.waitForEvent('download'),
		page.getByRole('button', { name: 'Export' }).click()
	]);
	await page.getByRole('button', { name: 'Reset', exact: true }).click();
	await page.getByRole('button', { name: 'Delete', exact: true }).click();
	await expect(page.getByText('Lines discovered').locator('..')).toContainText('0');
	await page.locator('input[type=file]').setInputFiles(await backup.path());
	await page.getByRole('button', { name: 'Replace', exact: true }).click();
	await expect(page.getByText('Lines discovered').locator('..')).toContainText('1');
	await page.goto('/practice');
	await page.getByRole('link', { name: 'Start practice' }).click();
	const practiceBoard = page.getByRole('application', { name: /Chess board/ });
	await expect(practiceBoard).toBeVisible();
	for (const [index, [from, to]] of [['d2','d4'], ['b1','c3'], ['c1','f4'], ['c3','b5'], ['e2','e3'], ['b5','c3'], ['f1','d3'], ['g1','f3'], ['d3','a6'], ['f3','e5']].entries()) {
		await move(practiceBoard, from, to);
		await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', String(index + 1));
	}
	await expect(page.getByText(/Next review/)).toBeVisible();
	await page.goto('/drill');
	await page.getByRole('link', { name: 'Start drill' }).click();
	await expect(page.getByRole('application', { name: /Chess board/ })).toBeVisible();
	await page.goto('/drill');
	await page.getByRole('link', { name: 'Start the clock' }).click();
	await expect(page.getByRole('application', { name: /Chess board/ })).toBeVisible();
});

test('trainer appearance settings persist', async ({ page }) => {
	await page.goto('/learn/jobava-london/nb5-na6-c6');
	await page.getByRole('button', { name: 'Start learning' }).click();
	await page.getByRole('button', { name: 'Trainer settings' }).click();
	await page.getByRole('button', { name: 'Green', exact: true }).click();
	await page.getByRole('button', { name: 'Merida', exact: true }).click();
	await page.getByRole('group', { name: 'Text size' }).getByRole('button', { name: 'Large', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Merida', exact: true })).toHaveAttribute('aria-pressed', 'true');
	await page.reload();
	await page.getByRole('button', { name: 'Trainer settings' }).click();
	await expect(page.getByRole('button', { name: 'Green', exact: true })).toHaveAttribute('aria-pressed', 'true');
	await expect(page.getByRole('button', { name: 'Merida', exact: true })).toHaveAttribute('aria-pressed', 'true');
	await expect(page.getByRole('group', { name: 'Text size' }).getByRole('button', { name: 'Large', exact: true })).toHaveAttribute('aria-pressed', 'true');
});
