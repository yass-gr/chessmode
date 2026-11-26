import type { GameRecord, GameReview, Classification } from '#lib/review/types.ts';
import { accuracyText } from '#lib/components/review/evaluation.ts';

export type CoachPhase = 'loading' | 'overview' | 'move' | 'followup' | 'retry' | 'complete';
export type CoachExpression = 'neutral' | 'happy' | 'thinking' | 'wince' | 'celebrating' | 'encouraging';
export type RetryMood = 'playing' | 'wrong' | 'right';

const HAPPY: Classification[] = ['best', 'strong', 'good', 'book', 'only'];

export function coachExpression(phase: CoachPhase, classification?: Classification, retry?: RetryMood): CoachExpression {
	if (phase === 'loading' || phase === 'followup') return 'thinking';
	if (phase === 'overview') return 'neutral';
	if (phase === 'complete') return 'celebrating';
	if (phase === 'retry') return retry === 'right' ? 'celebrating' : retry === 'wrong' ? 'encouraging' : 'thinking';
	if (classification === 'find' || classification === 'sharp') return 'celebrating';
	if (classification === 'loose' || classification === 'mistake' || classification === 'missed') return 'encouraging';
	if (classification === 'blunder') return 'wince';
	if (classification && HAPPY.includes(classification)) return 'happy';
	return 'neutral';
}

export const MASCOT_SRC = {
	neutral: '/img/mascot/neutral.webp',
	happy: '/img/mascot/happy.webp',
	thinking: '/img/mascot/thinking.webp',
	wince: '/img/mascot/wince.webp',
	celebrating: '/img/mascot/celebrating.webp',
	encouraging: '/img/mascot/encouraging.webp'
} as const satisfies Record<CoachExpression, string>;

export function overviewVerdict(game: GameRecord, review: GameReview): { headline: string; detail: string } {
	const result = game.result === '1-0' ? 'White won' : game.result === '0-1' ? 'Black won' : game.result === '1/2-1/2' ? 'The game was drawn' : 'The game is unfinished';
	const you = game.userColor === 'w' ? ' You played White.' : game.userColor === 'b' ? ' You played Black.' : '';
	const short = review.white.ratingContext?.kind === 'unavailable' && review.white.ratingContext.reason === 'short-sample'
		&& review.black.ratingContext?.kind === 'unavailable' && review.black.ratingContext.reason === 'short-sample';
	const sample = short ? ' Too few moves for a game rating.' : '';
	return {
		headline: `${result}.${you}`,
		detail: `White accuracy ${accuracyText(review.white.accuracy)}%. Black accuracy ${accuracyText(review.black.accuracy)}%.${sample}`
	};
}

export function lineAction(explanation: string, role: 'recommended' | 'played'): string {
	const text = explanation.toLowerCase();
	const theme = text.includes('checkmate') ? 'mate'
		: text.includes('fork') ? 'fork'
		: text.includes('hang') ? 'hanging piece'
		: text.includes('gives check') || text.includes(' and gives check') ? 'check'
		: text.includes('promot') ? 'promotion'
		: text.includes('takes') ? 'capture'
		: text.includes('castle') ? 'castle'
		: text.includes('book') ? 'book exit'
		: text.includes('defends') ? 'defense'
		: text.includes('out of danger') ? 'save'
		: text.includes('threatens') ? 'threat'
		: undefined;
	if (role === 'played') return theme ? `Show the ${theme}` : 'Show the follow-up';
	return theme ? `Show the ${theme}` : 'Show the best move';
}
