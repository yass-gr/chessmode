import { describe, expect, it } from 'vitest';
import { criticalPositions } from '#lib/review/analyse.ts';
import type { MoveReview } from '#lib/review/types.ts';

function move(overrides: Partial<MoveReview> = {}): MoveReview {
	return { classification: 'best', uci: 'e2e4', best: { uci: 'e2e4' }, loss: 0, winBefore: 50, winAfter: 50, ...overrides } as MoveReview;
}

describe('criticalPositions', () => {
	it('selects both sides of critical moves and deduplicates shared positions', () => {
		expect(criticalPositions([move(), move({ classification: 'sharp' }), move({ uci: 'd2d4' as MoveReview['uci'] }), move()])).toEqual([1, 2, 3]);
	});
	it('skips book moves and retains quiet best moves', () => {
		expect(criticalPositions([move({ classification: 'book', uci: 'd2d4' as MoveReview['uci'] }), move()])).toEqual([]);
	});
	it('includes large swings and serious labels', () => {
		expect(criticalPositions([move({ winAfter: 62 }), move({ classification: 'blunder' })])).toEqual([0, 1, 2]);
	});
});
