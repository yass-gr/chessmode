import type { Color } from '#lib/chess/types.ts';
import type { GameRecord, MoveReview, Score, Classification } from '#lib/review/types.ts';

export function scoreValue(score: Score, turn: Color): number {
	if (score.cp !== undefined) return Math.max(-4.75, Math.min(4.75, score.cp / 100));
	return (score.mate === 0 ? (turn === 'w' ? -1 : 1) : Math.sign(score.mate)) * 5.75;
}

export function whiteFill(score: Score | undefined, turn: Color, result?: GameRecord['result']): number {
	if (result && result !== '*') return result === '1-0' ? 100 : result === '0-1' ? 0 : 50;
	if (!score) return 50;
	if (score.mate !== undefined) return scoreValue(score, turn) > 0 ? 100 : 0;
	return 50 + Math.max(-4, Math.min(4, score.cp / 100)) * 11.25;
}

export function scoreText(score: Score | undefined, turn: Color, result?: GameRecord['result']): string {
	if (result && result !== '*') return result === '1/2-1/2' ? '½–½' : result === '1-0' ? '1–0' : '0–1';
	if (!score) return '–';
	if (score.mate !== undefined) return score.mate === 0 ? (turn === 'w' ? '−M0' : '+M0') : `${score.mate > 0 ? '+' : '−'}M${Math.abs(score.mate)}`;
	return `${score.cp > 0 ? '+' : ''}${(score.cp / 100).toFixed(1)}`;
}

export function firstClassPly(moves: readonly MoveReview[], classification: Classification, color: Color): number | undefined {
	return moves.find(move => move.classification === classification && move.color === color)?.ply;
}

export function accuracyText(value: number): string {
	return (Math.floor(Math.max(0, Math.min(100, value)) * 10) / 10).toFixed(1);
}
