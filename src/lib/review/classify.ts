import { Chess } from 'chess.js';
import { other, type Color, type Ply } from '#lib/chess/types.ts';
import { materialBalance, exchangeBalance } from '#lib/review/material.ts';
import type { Classification, PositionAnalysis, Score } from '#lib/review/types.ts';

export const CLASSIFICATIONS: Record<Classification, { label: string; glyph: string; color: string; rank: number }> = {
	find: { label: 'Brilliant', glyph: '!!', color: '#26C2A3', rank: 10 },
	sharp: { label: 'Great', glyph: '!', color: '#749BBF', rank: 9 },
	best: { label: 'Best', glyph: '★', color: '#81B64C', rank: 8 },
	strong: { label: 'Excellent', glyph: '👍', color: '#96BC4B', rank: 7 },
	good: { label: 'Good', glyph: '✓', color: '#95B776', rank: 6 },
	book: { label: 'Book', glyph: '▤', color: '#D5A47D', rank: 5 },
	only: { label: 'Forced', glyph: '→', color: '#97AF8B', rank: 4 },
	loose: { label: 'Inaccuracy', glyph: '?!', color: '#F7C631', rank: 3 },
	mistake: { label: 'Mistake', glyph: '?', color: '#FFA459', rank: 2 },
	missed: { label: 'Miss', glyph: '×', color: '#FF7769', rank: 1 },
	blunder: { label: 'Blunder', glyph: '??', color: '#FA412D', rank: 0 }
};

export const THRESHOLDS = {
	strong: 0.02, good: 0.05, loose: 0.10, mistake: 0.20,
	missedGift: 0.10, missedLoss: 0.05, losing: 0.50,
	sharpGap: 0.10, sharpSecond: 0.90,
	findLoss: 0.02, findMaterial: 2, findAfter: 0.50, findBefore: 0.97
} as const;

const lossLabels = [
	['strong', THRESHOLDS.strong], ['good', THRESHOLDS.good],
	['loose', THRESHOLDS.loose], ['mistake', THRESHOLDS.mistake]
] as const;
const epsilon = 1e-12;

export const winPercent = (cp: number) => 100 / (1 + Math.exp(-0.00368208 * cp));

export function scoreCp(score: Score, turn: Color) {
	if (score.cp !== undefined) return score.cp;
	return (score.mate === 0 ? (turn === 'w' ? -1 : 1) : Math.sign(score.mate)) * 1000;
}

export function expectedPoints(score: Score, mover: Color, turn: Color) {
	const value = scoreCp(score, turn);
	const white = score.mate === undefined ? winPercent(value) / 100 : value > 0 ? 0.9999 : 0.0001;
	return mover === 'w' ? white : 1 - white;
}

export interface ClassifyInput {
	move: Ply;
	before: PositionAnalysis;
	scoreAfter: Score;
	previous?: Pick<Ply, 'uci' | 'fenBefore'> & { loss: number };
	inBook?: boolean;
}

export function classify({ move, before, scoreAfter, previous, inBook }: ClassifyInput): {
	classification: Classification; loss: number;
} {
	const { color, uci, fenBefore, fenAfter } = move;
	const nextTurn = other(color);
	const [best, second] = before.lines;
	const played = before.lines.find(line => line.pv[0] === uci);
	const bestEP = expectedPoints(best.score, color, color);
	const playedEP = played
		? expectedPoints(played.score, color, color)
		: expectedPoints(scoreAfter, color, nextTurn);
	const loss = best.pv[0] === uci ? 0 : Math.max(0, bestEP - playedEP);

	let classification: Classification;
	const position = new Chess(fenBefore);
	const actual = position.moves({ verbose: true });
	const recapture = previous?.uci.slice(2, 4) === uci.slice(2, 4)
		&& actual.some(candidate => candidate.lan === uci && candidate.captured)
		&& new Chess(previous.fenBefore).move(previous.uci).captured;
	const secondEP = second ? expectedPoints(second.score, color, color) : bestEP;
	const forcedMate = best.score.mate !== undefined && (color === 'w' ? best.score.mate > 0 : best.score.mate < 0);
	const blunder = loss + epsilon >= THRESHOLDS.mistake;
	const afterEP = expectedPoints(scoreAfter, color, nextTurn);

	if (actual.length === 1) classification = 'only';
	else if (loss <= THRESHOLDS.findLoss + epsilon && afterEP >= THRESHOLDS.findAfter
		&& bestEP < THRESHOLDS.findBefore
		&& materialBalance(position, color) - exchangeBalance(new Chess(fenAfter), color) >= THRESHOLDS.findMaterial) {
		classification = 'find';
	} else if (best.pv[0] === uci && bestEP - secondEP + epsilon >= THRESHOLDS.sharpGap
		&& secondEP < THRESHOLDS.sharpSecond && !recapture) {
		classification = 'sharp';
	} else if (((previous?.loss ?? 0) + epsilon >= THRESHOLDS.missedGift || forcedMate)
		&& loss + epsilon >= THRESHOLDS.missedLoss && !(blunder && playedEP < THRESHOLDS.losing)) {
		classification = 'missed';
	} else {
		classification = loss <= epsilon ? 'best' : lossLabels.find(([, limit]) => loss + epsilon < limit)?.[0] ?? 'blunder';
	}
	if (inBook && !['loose', 'mistake', 'missed', 'blunder'].includes(classification)
		&& best.score.mate === undefined && scoreAfter.mate === undefined) classification = 'book';
	return { classification, loss };
}
