import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { BOOKS } from '#lib/books/shelf.ts';
import { bookById, clampPly, lineFen, playUci, sectionById, sectionNeighbors } from '#lib/books/read.ts';

describe('study shelf', () => {
	it('gives every section a stable id and a neighbor on either side', () => {
		const book = bookById(BOOKS, 'last-pieces');
		expect(book?.sections.map((section) => section.id)).toEqual(['queen', 'rook']);
		expect(sectionNeighbors(book!, 'queen')).toMatchObject({ index: 0, prev: undefined, next: { id: 'rook' } });
		expect(sectionNeighbors(book!, 'rook').prev?.id).toBe('queen');
		expect(sectionById(book!, 'rook')?.try?.fen).toContain(' w ');
		expect(bookById(BOOKS, 'missing')).toBeUndefined();
	});

	it('plays every demonstration and every exercise', () => {
		for (const book of BOOKS) {
			for (const section of book.sections) {
				if (section.line) {
					const chess = new Chess(section.line.fen);
					for (const san of section.line.sans) chess.move(san);
				}
				if (section.try) expect(new Chess(section.try.fen).isGameOver()).toBe(false);
			}
		}
	});

	it('steps a demonstration line and stops at the ends', () => {
		const line = sectionById(bookById(BOOKS, 'king-and-pawn')!, 'outside')!.line!;
		expect(lineFen(line, 0)).toBe(line.fen);
		expect(lineFen(line, 1)).not.toBe(line.fen);
		expect(lineFen(line, 99)).toBe(lineFen(line, line.sans.length));
		expect(clampPly(line, -3)).toBe(0);
		expect(clampPly(line, 1.8)).toBe(1);
		const next = playUci(line.fen, 'b5b6');
		expect(next).toBeTruthy();
		expect(playUci(line.fen, 'a2a3')).toBeUndefined();
	});
});
