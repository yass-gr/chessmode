import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import type { Uci } from '#lib/chess/types.ts';
import { boardFromGamePgn, emptyBoard, enterVariation, fromPgn, goTo, mainlineSans, otherMoves, play, toPgn } from '#lib/review/variations.ts';

const uci = (value: string) => value as Uci;

describe('analysis variations', () => {
	it('keeps the first move as the main line when a later try branches', () => {
		let board = play(play(emptyBoard(), uci('e2e4')), uci('c7c5'));
		board = play(goTo(board, 1), uci('e7e5'));
		expect(mainlineSans(board)).toEqual(['e4', 'c5']);
		expect(otherMoves(goTo(board, 1)).map((edge) => edge.san)).toEqual(['c5']);
		expect(board.line.map((edge) => edge.san)).toEqual(['e4', 'e5']);
	});

	it('hides the continuation when the line holds a copy of that move', () => {
		const board = goTo(play(play(emptyBoard(), uci('e2e4')), uci('c7c6')), 1);
		const copy = { ...board.line[1], node: board.line[1].node };
		expect(otherMoves({ ...board, line: [board.line[0], copy] })).toEqual([]);
	});

	it('follows an existing variation instead of copying it', () => {
		let board = play(play(emptyBoard(), uci('e2e4')), uci('c7c5'));
		board = play(goTo(board, 1), uci('e7e5'));
		const branched = enterVariation(goTo(board, 1), uci('c7c5'));
		expect(branched.root.children).toHaveLength(1);
		expect(branched.root.children[0].node.children).toHaveLength(2);
		expect(branched.line.map((edge) => edge.san)).toEqual(['e4', 'c5']);
	});

	it('writes variations into PGN and leaves the main line for review', () => {
		let board = play(play(emptyBoard(), uci('e2e4')), uci('c7c5'));
		board = play(goTo(board, 1), uci('e7e5'));
		const pgn = toPgn(board);
		expect(pgn).toContain('1... e5');
		const chess = new Chess();
		chess.loadPgn(pgn);
		expect(chess.history()).toEqual(['e4', 'c5']);
		expect(fromPgn(pgn).root.children[0].node.children.map((edge) => edge.san)).toEqual(['c5', 'e5']);
	});

	it('rejects a move that is not legal', () => {
		expect(() => play(emptyBoard(), uci('e2e5'))).toThrow(/not legal/);
	});

	it('opens a set-up position on its main line when the tree reader cannot', () => {
		const board = boardFromGamePgn('[SetUp "1"]\n[FEN "4k3/8/8/8/8/8/8/4K3 w - - 0 1"]\n\n1. Ke2 Ke7');
		expect(board.line.map((edge) => edge.san)).toEqual(['Ke2', 'Ke7']);
		expect(board.cursor).toBe(2);
	});
});
