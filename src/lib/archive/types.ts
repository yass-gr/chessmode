import type { Card } from 'ts-fsrs';
import type { CustomCourseRecord, LineProgress, RatingRecord, SessionLog, Setting } from '#lib/db.ts';
import type { GameRecord, GameReview } from '#lib/review/types.ts';

/** Backup file written by You → Export. Version 1 is the only readable shape. */
export const ARCHIVE_VERSION = 1;

export interface UserArchive {
	version: typeof ARCHIVE_VERSION;
	exportedAt: number;
	progress: LineProgress[];
	sessions: SessionLog[];
	games: GameRecord[];
	reviews: (GameReview & { key: string })[];
	settings: Setting[];
	ratings: RatingRecord[];
	customCourses: CustomCourseRecord[];
}

export type ArchiveResult = { ok: true; archive: UserArchive } | { ok: false; error: string };
