export type Color = 'w' | 'b';

/** A full FEN string. */
export type Fen = string & { readonly __brand: 'Fen' };
/** The first four FEN fields (placement, turn, castling, en passant). Transpositions share a key. */
export type PosKey = string & { readonly __brand: 'PosKey' };
/** A move in UCI notation, e.g. `e2e4`, `e7e8q`. */
export type Uci = string & { readonly __brand: 'Uci' };
/** A move in SAN, exactly as chess.js prints it. */
export type San = string & { readonly __brand: 'San' };

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' as Fen;

export const posKey = (fen: Fen | string): PosKey => fen.split(' ').slice(0, 4).join(' ') as PosKey;
export const turnOf = (fen: Fen): Color => fen.split(' ')[1] as Color;
export const other = (c: Color): Color => (c === 'w' ? 'b' : 'w');

/** One move with the positions on both sides of it. Shared by courses, training and review. */
export interface Ply {
	san: San;
	uci: Uci;
	color: Color;
	fenBefore: Fen;
	fenAfter: Fen;
}
