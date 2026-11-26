import type { Color, Fen, San, Uci } from '#lib/chess/types.ts';

export type BotColor = 'w' | 'b' | 'random';

export interface BotProfile {
	id: string;
	name: string;
	initials: string;
	blurb: string;
	depth: number;
	movetime: number;
	/** Chance, 0 to 1, of playing the second-best move when the search has one. */
	slip: number;
	/** The house mascot stands in for a portrait. Other bots use their initials. */
	mascot: boolean;
}

export type BotEnd = 'checkmate' | 'stalemate' | 'insufficient' | 'repetition' | 'fifty-move' | 'resign';

export interface BotPly {
	san: San;
	uci: Uci;
	color: Color;
	fenBefore: Fen;
	fenAfter: Fen;
}

export interface BotGame {
	session: string;
	botId: string;
	player: Color;
	fen: Fen;
	plies: BotPly[];
	phase: 'player' | 'bot' | 'over';
	result?: '1-0' | '0-1' | '1/2-1/2';
	termination?: BotEnd;
}
