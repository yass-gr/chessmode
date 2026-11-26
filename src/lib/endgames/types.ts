import type { Color, Fen, Uci } from '#lib/chess/types.ts';

/** One endgame with the player to move. Sourced from the Lichess puzzle database (CC0). */
export interface EndgamePosition {
	id: string;
	fen: Fen;
	player: Color;
	rating: number;
	themes: string[];
	/** A strong first try, used when coaching has no engine line yet. */
	idea: Uci;
	game?: string;
}

export interface EndgameCatalog {
	source: string;
	url: string;
	license: string;
	positions: EndgamePosition[];
}

export type EndgameTier = 'beginner' | 'lineage';
export type EndgameMode = 'auto' | 'coached' | 'rated';
export type EndgameDifficulty = 'easier' | 'normal' | 'harder';

export interface EndgameProgress {
	rating: number;
	games: number;
	wins: number;
	draws: number;
	losses: number;
	history: { at: number; rating: number }[];
	seen: string[];
	tier: EndgameTier;
	/** Accumulates while coached, and occasionally serves an uncoached position. */
	mix: number;
	mode: EndgameMode;
	difficulty: EndgameDifficulty;
	/** Set once a placement rating has been applied. */
	seeded: boolean;
}
