import { Chess } from 'chess.js';
import type { Color, Fen } from '#lib/chess/types.ts';
import { tokenize } from '#lib/courses/parse.ts';

/** Three short lessons, each under 12 words, plus the moves that define the course. */
export interface CourseIntroContent {
	learn: readonly [string, string, string];
	moves: string;
}

interface IntroFile {
	learn?: unknown;
	moves?: unknown;
}

const files = import.meta.glob<IntroFile>('./intros/*.json', { eager: true, import: 'default' });

const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

function isContent(value: IntroFile | undefined): value is CourseIntroContent {
	return !!value
		&& Array.isArray(value.learn)
		&& value.learn.length === 3
		&& value.learn.every((item) => typeof item === 'string' && wordCount(item) > 0 && wordCount(item) < 12)
		&& typeof value.moves === 'string'
		&& value.moves.trim().length > 0;
}

/** Black courses put Black at the bottom of the intro board. */
export function introOrientation(side: Color): 'white' | 'black' {
	return side === 'b' ? 'black' : 'white';
}

/** The position after the course's defining moves, and those moves in standard notation. */
export function introLine(moves: string): { sans: string[]; fen: Fen } {
	const chess = new Chess();
	const sans = tokenize(moves).map(({ san }) => {
		const played = chess.move(san);
		if (!played) throw new Error(`Illegal intro move: ${san}`);
		return played.san;
	});
	if (!sans.length) throw new Error('Intro has no moves');
	return { sans, fen: chess.fen() as Fen };
}

/** Welcome copy for a bundled course. Missing or unplayable data stays hidden. */
export function courseIntro(id: string): CourseIntroContent | undefined {
	const intro = Object.entries(files).find(([path]) => path.endsWith(`/${id}.json`))?.[1];
	if (!isContent(intro)) return;
	try {
		introLine(intro.moves);
	} catch {
		return;
	}
	return intro;
}
