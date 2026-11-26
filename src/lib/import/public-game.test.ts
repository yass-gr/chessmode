import { describe, expect, it } from 'vitest';
import { chesscomGameUrl, gameFromChesscom } from '#lib/import/public-game.ts';

const body = {
	url: 'https://www.chess.com/game/live/123456789',
	pgn: '[White "A"]\n[Black "B"]\n[Result "1-0"]\n\n1. e4 e5 2. Nf3 Nc6 1-0',
	time_control: '180+2',
	end_time: 1_700_000_000,
	rules: 'chess',
	time_class: 'blitz',
	white: { username: 'A', rating: 1500 },
	black: { username: 'B', rating: 1480 }
};

describe('public Chess.com games', () => {
	it('accepts a live link, a daily link and a bare id', () => {
		expect(chesscomGameUrl('https://www.chess.com/game/live/123456789')).toBe('https://api.chess.com/pub/game/123456789');
		expect(chesscomGameUrl('https://chess.com/game/daily/42')).toBe('https://api.chess.com/pub/game/42');
		expect(chesscomGameUrl('999')).toBe('https://api.chess.com/pub/game/999');
		expect(chesscomGameUrl('not a game')).toBeUndefined();
	});

	it('reads a published game without assigning a side', () => {
		expect(gameFromChesscom(body, 50)).toMatchObject({
			id: 'chesscom-123456789',
			source: 'chesscom',
			userColor: undefined,
			speed: 'blitz',
			importedAt: 50
		});
	});

	it('rejects a body that is not a standard game', () => {
		expect(gameFromChesscom({ ...body, rules: 'chess960' })).toBeUndefined();
		expect(gameFromChesscom({ pgn: '1. e4' })).toBeUndefined();
	});
});
