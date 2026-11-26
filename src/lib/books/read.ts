import { Chess } from 'chess.js';
import type { Fen } from '#lib/chess/types.ts';
import type { StudyBook, StudyLine, StudySection } from '#lib/books/types.ts';

export function bookById(books: readonly StudyBook[], id: string | undefined): StudyBook | undefined {
	return books.find((book) => book.id === id);
}

export function sectionById(book: StudyBook, id: string | undefined): StudySection | undefined {
	return book.sections.find((section) => section.id === id);
}

export function sectionNeighbors(book: StudyBook, id: string): { index: number; prev?: StudySection; next?: StudySection } {
	const index = book.sections.findIndex((section) => section.id === id);
	return {
		index,
		prev: index > 0 ? book.sections[index - 1] : undefined,
		next: index >= 0 && index < book.sections.length - 1 ? book.sections[index + 1] : undefined
	};
}

/** Fen after `ply` moves of the demonstration. Ply 0 is the starting diagram. */
export function lineFen(line: StudyLine, ply: number): Fen {
	const chess = new Chess(line.fen);
	const steps = Math.max(0, Math.min(ply, line.sans.length));
	for (let i = 0; i < steps; i++) chess.move(line.sans[i]);
	return chess.fen() as Fen;
}

export function playUci(fen: Fen, uci: string): Fen | undefined {
	try {
		const chess = new Chess(fen);
		chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined });
		return chess.fen() as Fen;
	} catch {
		return;
	}
}

export function clampPly(line: StudyLine, ply: number): number {
	if (!Number.isFinite(ply)) return 0;
	return Math.max(0, Math.min(line.sans.length, Math.floor(ply)));
}
