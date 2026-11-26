import { describe, expect, it } from 'vitest';
import { accuracyText, firstClassPly, scoreText, scoreValue, whiteFill } from './evaluation.ts';
import type { MoveReview } from '#lib/review/types.ts';

describe('evaluation presentation', () => {
	it('centers missing and equal scores, and caps ordinary scores', () => {
		expect(whiteFill(undefined, 'w')).toBe(50);
		expect(whiteFill({ cp: 0 }, 'w')).toBe(50);
		expect(whiteFill({ cp: 400 }, 'w')).toBe(95);
		expect(whiteFill({ cp: -900 }, 'w')).toBe(5);
		expect(scoreValue({ cp: 900 }, 'w')).toBe(4.75);
	});
	it('distinguishes mate and final results including a mated side to move', () => {
		expect(whiteFill({ mate: 0 }, 'w')).toBe(0);
		expect(whiteFill({ mate: 0 }, 'b')).toBe(100);
		expect(scoreText({ mate: -3 }, 'w')).toBe('−M3');
		expect(scoreText(undefined, 'w', '1/2-1/2')).toBe('½–½');
		expect(whiteFill({ cp: 900 }, 'w', '0-1')).toBe(0);
	});
	it('truncates accuracy and finds the first matching side and class', () => {
		expect(accuracyText(89.99)).toBe('89.9');
		const moves = [ { ply: 1, color: 'w', classification: 'mistake' }, { ply: 2, color: 'b', classification: 'mistake' }, { ply: 4, color: 'b', classification: 'mistake' } ] as MoveReview[];
		expect(firstClassPly(moves, 'mistake', 'b')).toBe(2);
		expect(firstClassPly(moves, 'find', 'w')).toBeUndefined();
	});
});
