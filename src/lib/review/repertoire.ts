import { START_FEN, posKey, type Color, type Ply } from '#lib/chess/types.ts';
import type { Course, CoursePly, LineKey } from '#lib/courses/types.ts';
import { courseMayStartWith } from '#lib/courses/parse.ts';

/** Where an imported game stopped following one of the player's courses. `ply` indexes the game's plies. */
export type Deviation =
	| { kind: 'you'; course: Course; ply: number; played: Ply; expected: CoursePly; line: LineKey }
	| { kind: 'opponent'; course: Course; ply: number; played: Ply; line: LineKey }
	| { kind: 'complete'; course: Course; ply: number; line: LineKey };

function walk(course: Course, plies: Ply[]): Deviation | undefined {
	let line: LineKey | undefined;
	let matched = false;
	for (const [i, played] of plies.entries()) {
		const node = course.repertoire.get(posKey(played.fenBefore));
		if (!node) return line ? { kind: 'complete', course, ply: i - 1, line } : undefined;
		line = node.lines[0] ?? line;
		if (!line) return undefined;
		if (node.student) {
			// Leaving before the player's first course move means a different opening, not a deviation.
			if (node.student.uci !== played.uci) return matched ? { kind: 'you', course, ply: i, played, expected: node.student, line } : undefined;
			matched = true;
			continue;
		}
		if (!node.replies.length) return { kind: 'complete', course, ply: i - 1, line };
		const reply = node.replies.find((r) => r.uci === played.uci);
		if (!reply) return matched ? { kind: 'opponent', course, ply: i, played, line } : undefined;
		line = course.repertoire.get(posKey(reply.fenAfter))?.lines[0] ?? line;
	}
	return line ? { kind: 'complete', course, ply: plies.length - 1, line } : undefined;
}

/**
 * The course the game followed longest for the player's side; both sides are tried when the side is unknown.
 * Courses in `started` are compared first, so a game is judged against the repertoire the player studies,
 * and the rest of the catalog only answers when none of those fit.
 */
export function findDeviation(courses: Course[], plies: Ply[], userColor?: Color, started?: ReadonlySet<string>): Deviation | undefined {
	if (started?.size) {
		const own = longest(courses.filter((c) => started.has(c.id)), plies, userColor);
		if (own) return own;
	}
	return longest(courses, plies, userColor);
}

function longest(courses: Course[], plies: Ply[], userColor?: Color): Deviation | undefined {
	let best: Deviation | undefined;
	for (const course of courses) {
		if (userColor && course.side !== userColor) continue;
		if (plies[0] && posKey(plies[0].fenBefore) === posKey(START_FEN) && !courseMayStartWith(course, plies[0].uci)) continue;
		const found = walk(course, plies);
		if (found && found.ply > (best?.ply ?? -1)) best = found;
	}
	return best;
}
