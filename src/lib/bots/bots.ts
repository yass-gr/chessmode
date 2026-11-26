import { Chess } from 'chess.js';
import { START_FEN, type Color, type Fen, type San, type Uci } from '#lib/chess/types.ts';
import type { BotColor, BotEnd, BotGame, BotPly, BotProfile } from '#lib/bots/types.ts';

/**
 * Original opponents. Strength is depth, a movetime ceiling, and how often the bot
 * takes the second line of the search. Skill Level is not set on the shared engine:
 * that option would stay on for a later analysis search.
 */
export const BOTS: BotProfile[] = [
	{ id: 'pip', name: 'Pip', initials: 'P', blurb: 'Grabs what it can see and leaves the rest.', depth: 1, movetime: 200, slip: 0.65, mascot: false },
	{ id: 'lark', name: 'Lark', initials: 'L', blurb: 'Plays the obvious capture and little else.', depth: 3, movetime: 350, slip: 0.35, mascot: false },
	{ id: 'bram', name: 'Bram', initials: 'B', blurb: 'A club regular who sees one move of tactics.', depth: 6, movetime: 500, slip: 0.15, mascot: false },
	{ id: 'nessa', name: 'Nessa', initials: 'N', blurb: 'Keeps the position tidy and punishes loose pieces.', depth: 10, movetime: 700, slip: 0.05, mascot: false },
	{ id: 'coach', name: 'Coach', initials: 'C', blurb: 'The house mascot, playing a patient game.', depth: 8, movetime: 600, slip: 0.08, mascot: true }
];

export function botById(id: string | undefined): BotProfile | undefined {
	return BOTS.find((bot) => bot.id === id);
}

export function resolveColor(choice: BotColor, roll: number): Color {
	if (choice === 'random') return roll < 0.5 ? 'w' : 'b';
	return choice;
}

export function chooseBotMove(moves: readonly Uci[], slip: number, roll: number): Uci | undefined {
	if (!moves.length) return;
	if (moves.length > 1 && roll < slip) return moves[1];
	return moves[0];
}

export function startBotGame(botId: string, player: Color, session: string): BotGame {
	const chess = new Chess();
	const phase = chess.turn() === player ? 'player' : 'bot';
	return { session, botId, player, fen: START_FEN, plies: [], phase };
}

function resultOf(chess: Chess): { result: BotGame['result']; termination: BotEnd } | undefined {
	if (chess.isCheckmate()) return { result: chess.turn() === 'w' ? '0-1' : '1-0', termination: 'checkmate' };
	if (chess.isStalemate()) return { result: '1/2-1/2', termination: 'stalemate' };
	if (chess.isInsufficientMaterial()) return { result: '1/2-1/2', termination: 'insufficient' };
	if (chess.isThreefoldRepetition()) return { result: '1/2-1/2', termination: 'repetition' };
	if (chess.isDraw()) return { result: '1/2-1/2', termination: 'fifty-move' };
	return;
}

function push(game: BotGame, uci: string): BotGame | undefined {
	const chess = new Chess(game.fen);
	let move;
	try {
		move = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined });
	} catch {
		return;
	}
	const done = resultOf(chess);
	const ply: BotPly = {
		san: move.san as San,
		uci: (move.from + move.to + (move.promotion ?? '')) as Uci,
		color: move.color,
		fenBefore: game.fen,
		fenAfter: chess.fen() as Fen
	};
	return {
		...game,
		fen: ply.fenAfter,
		plies: [...game.plies, ply],
		phase: done ? 'over' : chess.turn() === game.player ? 'player' : 'bot',
		result: done?.result,
		termination: done?.termination
	};
}

/** A move from another session is ignored, so a late engine reply cannot land on the next game. */
export function playerMove(game: BotGame, session: string, uci: string): BotGame {
	if (game.session !== session || game.phase !== 'player') return game;
	return push(game, uci) ?? game;
}

export function botMove(game: BotGame, session: string, uci: string): BotGame {
	if (game.session !== session || game.phase !== 'bot') return game;
	return push(game, uci) ?? game;
}

export function resignGame(game: BotGame): BotGame {
	if (game.phase === 'over') return game;
	return { ...game, phase: 'over', result: game.player === 'w' ? '0-1' : '1-0', termination: 'resign' };
}

export function gamePgn(game: BotGame, white: string, black: string): string {
	const chess = new Chess();
	for (const ply of game.plies) {
		chess.move({ from: ply.uci.slice(0, 2), to: ply.uci.slice(2, 4), promotion: ply.uci[4] || undefined });
	}
	chess.header('White', white, 'Black', black, 'Result', game.result ?? '*');
	if (game.termination) chess.header('Termination', game.termination);
	return chess.pgn();
}

export function outcomeText(game: BotGame): string {
	const how =
		game.termination === 'checkmate'
			? 'checkmate'
			: game.termination === 'stalemate'
				? 'stalemate'
				: game.termination === 'insufficient'
					? 'not enough material'
					: game.termination === 'repetition'
						? 'threefold repetition'
						: game.termination === 'resign'
							? 'resignation'
							: 'the fifty-move rule';
	if (game.result === '1/2-1/2') return `Draw by ${how}`;
	const whiteWon = game.result === '1-0';
	const playerWon = (whiteWon && game.player === 'w') || (!whiteWon && game.player === 'b');
	return `${playerWon ? 'You win' : 'You lose'} by ${how}`;
}
