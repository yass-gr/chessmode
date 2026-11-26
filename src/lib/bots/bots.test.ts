import { describe, expect, it } from 'vitest';
import { botMove, chooseBotMove, gamePgn, playerMove, resignGame, resolveColor, startBotGame } from '#lib/bots/bots.ts';
import type { Uci } from '#lib/chess/types.ts';

const mate = ['e2e4', 'e7e5', 'd1h5', 'b8c6', 'f1c4', 'g8f6', 'h5f7'] as Uci[];

describe('bot setup', () => {
	it('resolves a color and prefers the best move unless the roll slips', () => {
		expect(resolveColor('w', 0.9)).toBe('w');
		expect(resolveColor('random', 0.1)).toBe('w');
		expect(resolveColor('random', 0.9)).toBe('b');
		const moves = ['e2e4', 'd2d4'] as Uci[];
		expect(chooseBotMove(moves, 0, 0)).toBe('e2e4');
		expect(chooseBotMove(moves, 0.4, 0.2)).toBe('d2d4');
		expect(chooseBotMove(moves, 0.4, 0.9)).toBe('e2e4');
		expect(chooseBotMove([], 1, 0)).toBeUndefined();
	});
});

describe('bot game', () => {
	it('plays to checkmate and ignores a move from the previous session', () => {
		let game = startBotGame('pip', 'w', 'g1');
		for (const uci of mate) {
			game = game.phase === 'player' ? playerMove(game, 'g1', uci) : botMove(game, 'g1', uci);
		}
		expect(game).toMatchObject({ phase: 'over', result: '1-0', termination: 'checkmate' });
		expect(playerMove(game, 'g1', 'a2a3')).toBe(game);
		const again = startBotGame('nessa', 'w', 'g2');
		const moved = playerMove(again, 'g1', 'e2e4');
		expect(moved.fen).toBe(again.fen);
	});

	it('resigns as the player and writes a reviewable game', () => {
		let game = startBotGame('lark', 'b', 'g1');
		game = botMove(game, 'g1', 'e2e4');
		game = resignGame(playerMove(game, 'g1', 'e7e5'));
		expect(game).toMatchObject({ result: '1-0', termination: 'resign' });
		const pgn = gamePgn(game, 'Lark', 'You');
		expect(pgn).toContain('[White "Lark"]');
		expect(pgn).toContain('[Result "1-0"]');
		expect(pgn).toContain('e4');
	});
});
