import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import type { Uci } from '#lib/chess/types.ts';
import { emptyBoard, play, type AnalysisBoard } from '#lib/review/variations.ts';
import { addGameToCourse, analysisRecord, courseFromGame } from '#lib/review/handoff.ts';

const pgn = '1. e4 c6 2. d4 d5 3. e5 Bf5 *';

describe('game to course', () => {
	it('makes a one-line course for the chosen side', () => {
		const built = courseFromGame({ id: 'custom-1', name: 'From a game', side: 'b', pgn });
		expect(built.file.chapters[0].lines).toHaveLength(1);
		expect(built.file.side).toBe('b');
		expect(built.file.chapters[0].lines[0].pgn).toContain('c6');
	});

	it('merges a second game into an existing course instead of duplicating the shared start', () => {
		const first = courseFromGame({ id: 'custom-1', name: 'From a game', side: 'b', pgn });
		const extra = '1. e4 c6 2. d4 d5 3. Nc3 dxe4 *';
		const merged = addGameToCourse(first.file, extra);
		expect(merged.file.id).toBe('custom-1');
		expect(merged.file.name).toBe('From a game');
		expect(merged.file.chapters[0].lines.length).toBeGreaterThan(1);
		const texts = merged.file.chapters[0].lines.map((line) => line.pgn);
		expect(texts.some((line) => line.includes('Bf5'))).toBe(true);
		expect(texts.some((line) => line.includes('Nc3'))).toBe(true);
	});

	it('stores analysis variations in the saved game', () => {
		let board: AnalysisBoard = play(play(emptyBoard(), 'e2e4' as Uci), 'c7c5' as Uci);
		board = play({ ...board, cursor: 1 }, 'e7e5' as Uci);
		const record = analysisRecord(board, 1000);
		expect(record.pgn).toContain('e5');
		expect(record.importedAt).toBe(1000);
		const chess = new Chess();
		chess.loadPgn(record.pgn);
		expect(chess.history()).toEqual(['e4', 'c5']);
	});
});
