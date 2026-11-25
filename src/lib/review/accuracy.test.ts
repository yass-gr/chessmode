import { expect, it } from 'vitest';
import { centipawnLoss, estimatedRating, gameAccuracy, moveAccuracy } from '#lib/review/accuracy.ts';

it('matches a four-ply worked example with weights of 10 and 5 for White', () => {
	const game = [70, 50, 60, 50, 50];
	const colors = ['w', 'b', 'w', 'b'] as const;
	expect(moveAccuracy(70, 50)).toBeCloseTo(41.016819, 5);
	expect(moveAccuracy(60, 50)).toBeCloseTo(64.579828, 5);
	expect(gameAccuracy(game, colors, 'w')).toBeCloseTo(49.52027, 3);
	expect(gameAccuracy(game, colors, 'b')).toBeCloseTo(73.13913, 3);
	expect(moveAccuracy(10, 30)).toBe(100);
	expect(moveAccuracy(100, 0)).toBe(0);
	expect(gameAccuracy([100, 0], ['w'], 'w')).toBe(0.5);
});

it('measures centipawn loss from the mover’s side and bounds the rating estimate', () => {
	expect(centipawnLoss({ cp: -35 }, { cp: 65 }, 'b')).toBe(100);
	expect(centipawnLoss({ cp: 0 }, { cp: 65 }, 'w')).toBe(0);
	expect(estimatedRating(100)).toBe(1140);
	expect(estimatedRating(900)).toBe(400);
});
