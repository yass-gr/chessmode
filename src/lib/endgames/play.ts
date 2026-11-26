import { Chess } from 'chess.js';
import type { Color, Fen, San, Uci } from '#lib/chess/types.ts';
import type { EndgamePosition } from '#lib/endgames/types.ts';

export type EndgameResult = 'win' | 'loss' | 'draw';
export type EndgameEnd = 'checkmate' | 'stalemate' | 'insufficient' | 'repetition' | 'fifty-move' | 'resign';

export interface EndgamePly {
	san: San;
	uci: Uci;
	color: Color;
	fenBefore: Fen;
	fenAfter: Fen;
}

export type EndgamePhase = 'player' | 'opponent' | 'considering' | 'over';

export interface EndgamePlay {
	session: string;
	positionId: string;
	fen: Fen;
	player: Color;
	plies: EndgamePly[];
	phase: EndgamePhase;
	result?: EndgameResult;
	termination?: EndgameEnd;
	/** `off` is an uncoached position. The other values are beginner coaching. */
	coach: 'off' | 'idle' | 'hint' | 'shown' | 'try-again';
	pending?: Uci;
	helped: boolean;
	hintFrom?: string;
	showUci?: Uci;
}

const PLY_CAP = 160;

export function startEndgame(position: EndgamePosition, session: string, coached: boolean): EndgamePlay {
	return {
		session,
		positionId: position.id,
		fen: position.fen,
		player: position.player,
		plies: [],
		phase: 'player',
		coach: coached ? 'idle' : 'off',
		helped: false
	};
}

function ended(chess: Chess, player: Color, plies: number): { result: EndgameResult; termination: EndgameEnd } | undefined {
	if (!chess.isGameOver() && plies < PLY_CAP) return;
	if (chess.isCheckmate()) {
		const winner = chess.turn() === 'w' ? 'b' : 'w';
		return { result: winner === player ? 'win' : 'loss', termination: 'checkmate' };
	}
	if (chess.isStalemate()) return { result: 'draw', termination: 'stalemate' };
	if (chess.isInsufficientMaterial()) return { result: 'draw', termination: 'insufficient' };
	if (chess.isThreefoldRepetition()) return { result: 'draw', termination: 'repetition' };
	if (chess.isDraw() || plies >= PLY_CAP) return { result: 'draw', termination: 'fifty-move' };
	return;
}

function push(play: EndgamePlay, uci: string): EndgamePlay | undefined {
	const chess = new Chess(play.fen);
	let move;
	try {
		move = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined });
	} catch {
		return;
	}
	const done = ended(chess, play.player, play.plies.length + 1);
	const ply: EndgamePly = {
		san: move.san as San,
		uci: (move.from + move.to + (move.promotion ?? '')) as Uci,
		color: move.color,
		fenBefore: play.fen,
		fenAfter: chess.fen() as Fen
	};
	const opponentTurn = chess.turn() !== play.player;
	return {
		...play,
		fen: ply.fenAfter,
		plies: [...play.plies, ply],
		phase: done ? 'over' : opponentTurn ? 'opponent' : 'player',
		result: done?.result,
		termination: done?.termination,
		coach: play.coach === 'off' ? 'off' : 'idle',
		pending: undefined,
		hintFrom: undefined,
		showUci: undefined
	};
}

export function playerMove(play: EndgamePlay, session: string, uci: string, recommended?: Uci): EndgamePlay {
	if (play.session !== session || play.phase !== 'player') return play;
	if (play.coach !== 'off' && recommended && uci !== recommended) {
		const chess = new Chess(play.fen);
		const legal = chess.moves({ verbose: true }).some((move) => move.from + move.to + (move.promotion ?? '') === uci);
		if (!legal) return play;
		return { ...play, phase: 'considering', pending: uci as Uci, coach: 'try-again' };
	}
	return push(play, uci) ?? play;
}

export function keepTrying(play: EndgamePlay): EndgamePlay {
	if (play.phase !== 'considering') return play;
	return { ...play, phase: 'player', pending: undefined, coach: 'idle' };
}

export function playAnyway(play: EndgamePlay): EndgamePlay {
	if (play.phase !== 'considering' || !play.pending) return play;
	const next = push({ ...play, helped: true }, play.pending);
	return next ?? play;
}

export function hint(play: EndgamePlay, recommended?: Uci): EndgamePlay {
	if (play.coach === 'off' || play.phase !== 'player' || !recommended) return play;
	return { ...play, coach: 'hint', helped: true, hintFrom: recommended.slice(0, 2), showUci: undefined };
}

export function showMove(play: EndgamePlay, recommended?: Uci): EndgamePlay {
	if (play.coach === 'off' || play.phase !== 'player' || !recommended) return play;
	return { ...play, coach: 'shown', helped: true, hintFrom: undefined, showUci: recommended };
}

export function opponentMove(play: EndgamePlay, session: string, uci: string): EndgamePlay {
	if (play.session !== session || play.phase !== 'opponent') return play;
	return push(play, uci) ?? play;
}

export function resign(play: EndgamePlay): EndgamePlay {
	if (play.phase === 'over') return play;
	return { ...play, phase: 'over', result: 'loss', termination: 'resign', pending: undefined };
}

export function resultLabel(result: EndgameResult, termination: EndgameEnd): string {
	const how =
		termination === 'checkmate'
			? 'Checkmate'
			: termination === 'stalemate'
				? 'Stalemate'
				: termination === 'insufficient'
					? 'Not enough material'
					: termination === 'repetition'
						? 'Threefold repetition'
						: termination === 'resign'
							? 'Resignation'
							: 'Fifty-move rule';
	const who = result === 'win' ? 'You win' : result === 'loss' ? 'You lose' : 'Draw';
	return `${who} · ${how}`;
}
