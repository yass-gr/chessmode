import type { Color } from '#lib/chess/types.ts';
import type { MoveReview } from '#lib/review/types.ts';

export type ReviewPerspective = Color | 'both';
export type GuidedDestination = { kind: 'moment'; ply: number } | { kind: 'end'; ply: number };

const keyClasses = new Set<MoveReview['classification']>(['find', 'sharp', 'mistake', 'missed', 'blunder']);

export function keyMomentPlies(moves: readonly MoveReview[], perspective: ReviewPerspective): number[] {
	const plies = new Set(moves.filter(move => keyClasses.has(move.classification) &&
		(perspective === 'both' || move.color === perspective)).map(move => move.ply));
	const lastBook = moves.filter(move => move.classification === 'book').reduce<number | undefined>(
		(last, move) => last === undefined || move.ply > last ? move.ply : last, undefined);
	if (lastBook !== undefined) plies.add(lastBook);
	return [...plies].sort((a, b) => a - b);
}

export function nextGuidedDestination(moments: readonly number[], currentPly: number, lastPly: number): GuidedDestination {
	const next = moments.filter(ply => ply > currentPly && ply < lastPly).reduce<number | undefined>(
		(first, ply) => first === undefined || ply < first ? ply : first, undefined);
	return next === undefined ? { kind: 'end', ply: lastPly } : { kind: 'moment', ply: next };
}
