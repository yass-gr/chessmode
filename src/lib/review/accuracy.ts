import type { Color } from '#lib/chess/types.ts';
import { scoreCp, winPercent } from '#lib/review/classify.ts';
import type { Score } from '#lib/review/types.ts';

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

export const lichessWinPercent = (score: Score, turn: Color) => winPercent(clamp(scoreCp(score, turn), -1000, 1000));

export function moveAccuracy(before: number, after: number) {
	const loss = Math.max(0, before - after);
	return clamp(103.1668100711649 * Math.exp(-0.04354415386753951 * loss) - 3.166924740191411 + 1, 0, 100);
}

function volatility(values: readonly number[]) {
	const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
	const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
	return clamp(Math.sqrt(variance), 0.5, 12);
}

export function gameAccuracy(win: readonly number[], colors: readonly Color[], color: Color) {
	if (win.length < 2) return 0;
	const window = clamp(Math.floor((win.length - 1) / 10), 2, 8);
	let weighted = 0;
	let weightSum = 0;
	let reciprocal = 0;
	let count = 0;
	for (const [i, mover] of colors.entries()) {
		if (mover !== color) continue;
		const start = Math.max(0, i - window + 2);
		const weight = volatility(win.slice(start, start + window));
		const accuracy = color === 'w' ? moveAccuracy(win[i], win[i + 1]) : moveAccuracy(win[i + 1], win[i]);
		weighted += accuracy * weight;
		weightSum += weight;
		reciprocal += 1 / Math.max(1, accuracy);
		count++;
	}
	return count ? (weighted / weightSum + count / reciprocal) / 2 : 0;
}

export function centipawnLoss(before: Score, after: Score, mover: Color) {
	const from = clamp(scoreCp(before, mover), -1000, 1000);
	const to = clamp(scoreCp(after, mover === 'w' ? 'b' : 'w'), -1000, 1000);
	return Math.max(0, (from - to) * (mover === 'w' ? 1 : -1));
}

export const estimatedRating = (acpl: number) => Math.round(clamp(3100 * Math.exp(-0.01 * acpl), 400, 3200));
