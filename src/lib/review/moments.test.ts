import { describe, expect, it } from 'vitest';
import type { MoveReview } from '#lib/review/types.ts';
import { keyMomentPlies, nextGuidedDestination } from './moments.ts';

const move = (ply: number, color: 'w' | 'b', classification: MoveReview['classification']) =>
	({ ply, color, classification }) as MoveReview;

describe('guided moments', () => {
	it('merges and orders moments with the last book anchor for either perspective', () => {
		const moves = [move(6, 'b', 'blunder'), move(2, 'b', 'book'), move(3, 'w', 'mistake'), move(3, 'w', 'mistake'), move(1, 'w', 'book')];
		expect(keyMomentPlies(moves, 'w')).toEqual([2, 3]);
		expect(keyMomentPlies(moves, 'b')).toEqual([2, 6]);
		expect(keyMomentPlies(moves, 'both')).toEqual([2, 3, 6]);
	});
	it('moves strictly forward and ends explicitly at the final ply', () => {
		expect(nextGuidedDestination([6, 2, 3], 2, 6)).toEqual({ kind: 'moment', ply: 3 });
		expect(nextGuidedDestination([6, 2, 3], 3, 6)).toEqual({ kind: 'end', ply: 6 });
	});
});
