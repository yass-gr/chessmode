import type { Color } from '#lib/chess/types.ts';
import { buildCourse, readPgnTree, type BuiltCourse } from '#lib/courses/pgn-tree.ts';
import type { CourseFile } from '#lib/courses/types.ts';
import { parsePgn } from '#lib/import/pgn.ts';
import type { GameRecord } from '#lib/review/types.ts';
import { toPgn, type AnalysisBoard } from '#lib/review/variations.ts';

export interface HandoffRequest {
	id: string;
	name: string;
	side: Color;
	pgn: string;
}

/** Builds a private course from one game, variations included. */
export function courseFromGame(request: HandoffRequest): BuiltCourse {
	const { tree } = readPgnTree(request.pgn);
	return buildCourse(tree, { id: request.id, name: request.name, side: request.side });
}

/**
 * Adds the game to a course the player already saved. Lines that meet merge.
 * The course keeps its name and side; the builder reports student-move conflicts.
 */
export function addGameToCourse(file: CourseFile, pgn: string): BuiltCourse {
	const games = [
		...file.chapters.flatMap((chapter) => chapter.lines.map((line) => line.pgn)),
		pgn
	].map((game, index) => `[Event "line-${index + 1}"]\n\n${game}`);
	const { tree } = readPgnTree(games.join('\n\n'));
	const built = buildCourse(tree, { id: file.id, name: file.name, side: file.side });
	return {
		...built,
		file: {
			...built.file,
			level: file.level,
			tagline: file.tagline,
			description: file.description
		}
	};
}

/** A savable game whose PGN still contains the variations the user made on the board. */
export function analysisRecord(board: AnalysisBoard, importedAt = Date.now()): GameRecord {
	const pgn = toPgn(board);
	const record = parsePgn(pgn, importedAt);
	return { ...record, pgn };
}
