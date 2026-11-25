import { Chess, type PieceSymbol } from 'chess.js';
import { other, type Color, type Fen, type Uci } from '#lib/chess/types.ts';
import { materialBalance } from '#lib/review/material.ts';
import { CLASSIFICATIONS } from '#lib/review/classify.ts';
import type { MoveReview } from '#lib/review/types.ts';

const PIECE_NAMES = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' } satisfies Record<PieceSymbol, string>;
const PIECES = ['q', 'r', 'b', 'n', 'p'] as const;

function materialChange(fen: Fen, pv: readonly Uci[], color: Color) {
	const position = new Chess(fen);
	const start = materialBalance(position, color);
	const counts = { w: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 } };
	for (const uci of pv.slice(0, 8)) {
		const move = position.move(uci);
		if (move.captured) counts[other(move.color)][move.captured]++;
		if (move.promotion) {
			counts[move.color].p++;
			counts[move.color][move.promotion]--;
		}
	}
	const delta = materialBalance(position, color) - start;
	const opponent = counts[other(color)];
	const own = counts[color];
	return { delta, own, opponent };
}

function wonMaterial({ delta, own, opponent }: ReturnType<typeof materialChange>) {
	if (delta <= 0) return undefined;
	if (delta === 2 && opponent.r > own.r && own.n + own.b > opponent.n + opponent.b) return 'the exchange';
	const piece = PIECES.find(type => opponent[type] > own[type]);
	return piece ? 'a ' + PIECE_NAMES[piece] : undefined;
}

export function explain(
	move: Pick<MoveReview, 'san' | 'uci' | 'classification' | 'color' | 'fenBefore' | 'best' | 'scoreAfter'>,
	replyPv: readonly Uci[],
	openingName?: string
): MoveReview['explanation'] {
	const { san, classification, color, fenBefore, best, scoreAfter } = move;
	const label = CLASSIFICATIONS[classification].label.toLowerCase();
	const headlines: Partial<Record<MoveReview['classification'], string>> = {
		find: san + ' is a brilliant sacrifice.',
		best: san + ' is best.',
		sharp: san + ' is a sharp move.',
		strong: san + ' is a strong move.',
		good: san + ' is a good move.',
		book: san + ' is a book move.',
		only: san + ' is the only legal move.',
		loose: san + ' is a loose move.',
		missed: san + ' misses an opportunity.'
	};
	const headline = headlines[classification] ?? san + ' is a ' + label + '.';
	if (classification === 'book') return { headline, detail: openingName };
	if (classification === 'missed') {
		const mate = best.score.mate;
		if (mate !== undefined && (color === 'w' ? mate > 0 : mate < 0)) {
			return { headline, detail: 'You missed a chance to force mate in ' + Math.abs(mate) + ' with ' + best.san + '.' };
		}
		const material = wonMaterial(materialChange(fenBefore, best.pv, color));
		if (material) return { headline, detail: 'You missed a chance to win ' + material + ' with ' + best.san + '.' };
	}
	if (classification === 'blunder' || classification === 'mistake' || classification === 'loose' || classification === 'missed') {
		const mate = scoreAfter.mate;
		if (mate !== undefined && (color === 'w' ? mate < 0 : mate > 0)) {
			return { headline, detail: 'It allows mate in ' + Math.abs(mate) + '.' };
		}
		const loss = materialChange(fenBefore, [move.uci, ...replyPv], other(color));
		const material = wonMaterial(loss);
		if (material) {
			const reply = replyPv[0];
			const board = new Chess(fenBefore);
			board.move(move.uci);
			const capture = reply ? board.move(reply).captured : undefined;
			if (capture && material === 'a ' + PIECE_NAMES[capture]) {
				return { headline, detail: 'It hangs your ' + PIECE_NAMES[capture] + '.' };
			}
			return { headline, detail: 'It lets your opponent win ' + material + '.' };
		}
		return { headline, detail: 'Stockfish prefers ' + best.san + ' here.' };
	}
	return { headline };
}

function branch(fen: Fen, pv: readonly Uci[], score: MoveReview['scoreAfter'], openingExit: boolean): import('#lib/review/types.ts').ReviewBranch {
	const position = new Chess(fen);
	const steps: import('#lib/review/types.ts').ReviewBranchStep[] = [];
	for (const uci of pv.slice(0, 8)) {
		const fenBefore = position.fen() as Fen;
		let played;
		try { played = position.move(uci); } catch { break; }
		if (!played) break;
		const targets = position.board().flat().filter(piece => piece && piece.color !== played.color && piece.type !== 'p' && piece.type !== 'k' && position.attackers(piece.square, played.color).includes(played.to));
		const fork = targets.length >= 2 || (position.isCheck() && targets.length >= 1);
		const explanation = position.isCheckmate() ? `${played.san} delivers checkmate.`
			: fork ? `${played.san} attacks multiple pieces.`
			: played.captured ? `${played.san} captures a ${PIECE_NAMES[played.captured]}.`
			: openingExit && steps.length === 0 ? `${played.san} leaves the known opening.`
			: `${played.san} continues the line.`;
		steps.push({ uci, san: played.san as MoveReview['san'], fenBefore, fenAfter: position.fen() as Fen,
			...(steps.length === 0 ? { score } : {}), explanation });
	}
	return { explanation: steps[0]?.explanation ?? 'No continuation is available.', steps };
}

export function buildBranches(
	move: Pick<MoveReview, 'fenBefore' | 'uci' | 'best' | 'scoreAfter'>,
	replyPv: readonly Uci[],
	_openingName?: string,
	openingExit = false
): NonNullable<MoveReview['branches']> {
	return {
		played: branch(move.fenBefore, [move.uci, ...replyPv], move.scoreAfter, openingExit),
		recommended: branch(move.fenBefore, move.best.pv, move.best.score, false)
	};
}
