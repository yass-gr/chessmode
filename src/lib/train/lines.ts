import type { Course, Line, LineKey } from '#lib/courses/types.ts';
import { posKey } from '#lib/chess/types.ts';
import { shouldSkipSharedStart } from '#lib/settings/preferences.ts';
import type { SettingsMode } from '#lib/settings/types.ts';

/** How many opening plies every line shares. */
export function commonPrefix(lines: readonly { plies: readonly { uci: string }[] }[]): number {
	if (lines.length < 2) return 0;
	const limit = Math.min(...lines.map((line) => line.plies.length));
	let count = 0;
	while (count < limit && lines.every((line) => line.plies[count].uci === lines[0].plies[count].uci)) count += 1;
	return count;
}

export function playerMovesAfter(line: Line, skip: number): number {
	return line.plies.slice(skip).filter((ply) => ply.student).length;
}

/** Where this line starts. Learn's first finished line, Time, and a prefix with no player move all stay at 0. */
export function openingSkip(args: {
	mode: SettingsMode;
	enabled: boolean;
	lines: readonly Line[];
	line: Line;
	firstLearn: boolean;
}): number {
	const shared = commonPrefix(args.lines);
	const skip = shouldSkipSharedStart({
		mode: args.mode,
		enabled: args.enabled,
		lineCount: args.lines.length,
		sharedPlies: shared,
		playerMovesAfter: playerMovesAfter(args.line, shared),
		firstLearn: args.firstLearn
	});
	return skip ? shared : 0;
}

/** Another line in this course that already reaches the position the student just played. */
export function matchingLine(course: Course, fen: string, current: LineKey): { line: Line; index: number } | undefined {
	const key = posKey(fen);
	for (const line of course.lines) {
		if (line.key === current) continue;
		const index = line.plies.findIndex((ply) => posKey(ply.fenAfter) === key);
		if (index >= 0) return { line, index };
	}
	return undefined;
}
