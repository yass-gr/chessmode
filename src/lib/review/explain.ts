import { Chess, type PieceSymbol, type Square } from 'chess.js';
import { other, type Color, type Fen, type Uci } from '#lib/chess/types.ts';
import { materialBalance } from '#lib/review/material.ts';
import { CLASSIFICATIONS } from '#lib/review/classify.ts';
import type { MoveReview } from '#lib/review/types.ts';

const PIECE_NAMES = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' } satisfies Record<PieceSymbol, string>;
const PIECES = ['q', 'r', 'b', 'n', 'p'] as const;
const NAME_RANK = ['queen', 'rook', 'bishop', 'knight', 'pawn'];

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

function listNames(names: string[]) {
	const ordered = [...names].sort((a, b) => NAME_RANK.indexOf(a) - NAME_RANK.indexOf(b));
	if (ordered.length <= 1) return ordered[0] ?? 'piece';
	if (ordered.length === 2) return `${ordered[0]} and the ${ordered[1]}`;
	return `${ordered.slice(0, -1).join(', the ')} and the ${ordered.at(-1)}`;
}

/** A piece attacked by the opponent and not defended. Pawns count; the king is check, not a hang. */
function hanging(position: Chess, color: Color) {
	const squares: Square[] = [];
	for (const rank of position.board()) {
		for (const piece of rank) {
			if (!piece || piece.color !== color || piece.type === 'k') continue;
			if (position.attackers(piece.square, other(color)).length > 0 && position.attackers(piece.square, color).length === 0) {
				squares.push(piece.square);
			}
		}
	}
	return squares;
}

function attackedFrom(position: Chess, square: Square, color: Color) {
	const names: string[] = [];
	for (const rank of position.board()) {
		for (const piece of rank) {
			if (!piece || piece.color === color || piece.type === 'k') continue;
			if (position.attackers(piece.square, color).includes(square)) names.push(PIECE_NAMES[piece.type]);
		}
	}
	return names;
}

function describeStep(fen: Fen, uci: Uci, options: { openingExit: boolean; recommendedFirst: boolean }) {
	const start = new Chess(fen);
	const mover = start.turn();
	const beforeHang = new Set(hanging(start, mover));
	const played = start.move(uci);
	if (!played) return 'That move is not legal in this position.';
	const after = new Chess(played.after);
	const san = played.san;
	const piece = PIECE_NAMES[played.piece];
	if (after.isCheckmate()) return `${san} is checkmate.`;
	if (played.promotion) {
		const promoted = PIECE_NAMES[played.promotion];
		const gained = played.captured
			? `takes the ${PIECE_NAMES[played.captured]} and promotes to a ${promoted}`
			: `promotes the pawn to a ${promoted}`;
		return after.isCheck() ? `${san} ${gained} and gives check.` : `${san} ${gained}.`;
	}
	if (san.startsWith('O-O')) return `${san} castles the king.`;
	const threats = attackedFrom(after, played.to, mover);
	if (after.isCheck() && threats.length) return `${san} forks the king and the ${listNames(threats)}.`;
	if (threats.length >= 2) return `${san} forks the ${listNames(threats)}.`;
	const afterHang = hanging(after, mover);
	const newHangs = afterHang.filter(square => !beforeHang.has(square)).map(square => PIECE_NAMES[after.get(square)?.type ?? 'p']);
	if (played.captured) {
		const taken = PIECE_NAMES[played.captured];
		return newHangs.length ? `${san} takes the ${taken} and hangs the ${listNames(newHangs)}.` : `${san} takes the ${taken}.`;
	}
	if (after.isCheck()) return `${san} gives check.`;
	if (options.openingExit) return `${san} leaves the book.`;
	if (newHangs.length) return `${san} hangs the ${listNames(newHangs)}.`;
	const destHanging = after.attackers(played.to, other(mover)).length > 0 && after.attackers(played.to, mover).length === 0;
	if (beforeHang.has(played.from) && !destHanging) return `${san} steps the ${piece} out of danger.`;
	const rescued = [...beforeHang].filter(square => !afterHang.includes(square) && after.get(square)?.color === mover);
	const rescuedPiece = rescued[0] ? after.get(rescued[0]) : undefined;
	if (rescuedPiece) return `${san} defends the ${PIECE_NAMES[rescuedPiece.type]}.`;
	if (threats.length === 1) return `${san} threatens the ${threats[0]}.`;
	const backRank = mover === 'w' ? '1' : '8';
	if ((played.piece === 'n' || played.piece === 'b' || played.piece === 'q') && played.from.endsWith(backRank)) {
		return `${san} develops the ${piece}.`;
	}
	if (options.recommendedFirst) return `${san} is the best move, placing the ${piece} on ${played.to}.`;
	return `${san} places the ${piece} on ${played.to}.`;
}

function branch(fen: Fen, pv: readonly Uci[], score: MoveReview['scoreAfter'], openingExit: boolean, recommended: boolean): import('#lib/review/types.ts').ReviewBranch {
	const position = new Chess(fen);
	const steps: import('#lib/review/types.ts').ReviewBranchStep[] = [];
	for (const uci of pv.slice(0, 8)) {
		const fenBefore = position.fen() as Fen;
		let played;
		try { played = position.move(uci); } catch { break; }
		if (!played) break;
		const explanation = describeStep(fenBefore, uci, { openingExit: openingExit && steps.length === 0, recommendedFirst: recommended && steps.length === 0 });
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
		played: branch(move.fenBefore, [move.uci, ...replyPv], move.scoreAfter, openingExit, false),
		recommended: branch(move.fenBefore, move.best.pv, move.best.score, false, true)
	};
}
