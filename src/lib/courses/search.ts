import { Chess } from 'chess.js';
import { posKey, type Color, type Fen } from '#lib/chess/types.ts';
import type { Course } from '#lib/courses/types.ts';

export type CourseQuery = { side?: Color; text: string };

/** "1.d4 d5 2.Nc3" → the position it reaches, or undefined when the text is not a legal move sequence. */
export function positionOf(text: string): Fen | undefined {
	const tokens = text
		.replace(/\d+\.(\.\.)?/g, ' ')
		.split(/\s+/)
		.map((t) => t.replace(/[!?]+$/, ''))
		.filter(Boolean);
	if (!tokens.length) return undefined;
	const chess = new Chess();
	try {
		for (const token of tokens) chess.move(token);
	} catch {
		return undefined;
	}
	return chess.fen() as Fen;
}

/** Courses matching by name or description, or reaching the position the typed moves lead to. */
export function searchCourses(courses: Course[], query: CourseQuery): Course[] {
	const text = query.text.trim();
	const fen = positionOf(text);
	const words = text.toLowerCase().split(/\s+/).filter(Boolean);
	return courses.filter((course) => {
		if (query.side && course.side !== query.side) return false;
		if (!text) return true;
		if (fen && course.repertoire.has(posKey(fen))) return true;
		const haystack = `${course.name} ${course.tagline} ${course.description}`.toLowerCase();
		return words.every((w) => haystack.includes(w));
	});
}
