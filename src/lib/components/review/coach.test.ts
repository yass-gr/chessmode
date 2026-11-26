import { expect, it } from 'vitest';
import type { GameRecord, GameReview } from '#lib/review/types.ts';
import { coachExpression, lineAction, overviewVerdict } from './coach.ts';

it('maps coach phases and move labels to one expression', () => {
	expect(coachExpression('loading')).toBe('thinking');
	expect(coachExpression('overview')).toBe('neutral');
	expect(coachExpression('move')).toBe('neutral');
	expect(coachExpression('complete')).toBe('happy');
	expect(coachExpression('followup')).toBe('thinking');
	expect(coachExpression('move', 'best')).toBe('happy');
	expect(coachExpression('move', 'strong')).toBe('happy');
	expect(coachExpression('move', 'good')).toBe('happy');
	expect(coachExpression('move', 'book')).toBe('happy');
	expect(coachExpression('move', 'only')).toBe('happy');
	expect(coachExpression('move', 'find')).toBe('celebrating');
	expect(coachExpression('move', 'sharp')).toBe('celebrating');
	expect(coachExpression('move', 'mistake')).toBe('encouraging');
	expect(coachExpression('move', 'missed')).toBe('encouraging');
	expect(coachExpression('move', 'loose')).toBe('encouraging');
	expect(coachExpression('move', 'blunder')).toBe('wince');
	expect(coachExpression('retry', undefined, 'playing')).toBe('thinking');
	expect(coachExpression('retry', undefined, 'wrong')).toBe('encouraging');
	expect(coachExpression('retry', undefined, 'right')).toBe('celebrating');
});

it('names the tactic on a line button and keeps the overview factual', () => {
	expect(lineAction('Nc3 forks the queen and the rook.', 'recommended')).toBe('Show the fork');
	expect(lineAction('Qxd5 takes the pawn and hangs the queen.', 'played')).toBe('Show the hanging piece');
	expect(lineAction('e4 is the best move, placing the pawn on e4.', 'recommended')).toBe('Show the best move');
	const game = { result: '1-0', userColor: 'b', white: { name: 'White' }, black: { name: 'Black' } } as GameRecord;
	const review = {
		white: { accuracy: 92.46, ratingContext: { kind: 'unavailable', reason: 'short-sample' } },
		black: { accuracy: 40, ratingContext: { kind: 'unavailable', reason: 'short-sample' } }
	} as GameReview;
	expect(overviewVerdict(game, review)).toEqual({
		headline: 'White won. You played Black.',
		detail: 'White accuracy 92.4%. Black accuracy 40.0%. Too few moves for a game rating.'
	});
});
