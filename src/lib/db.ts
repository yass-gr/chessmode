import Dexie, { type EntityTable } from 'dexie';
import type { Card } from 'ts-fsrs';
import type { CourseFile, LineKey } from '#lib/courses/types.ts';
import type { GameRecord, GameReview } from '#lib/review/types.ts';

/** Spaced-repetition state for one course line. A row exists once the line has been learned. */
export interface LineProgress {
	key: LineKey;
	courseId: string;
	card: Card;
	learnedAt: number;
	reviews: number;
	lapses: number;
	/** Set once a practice run finishes with no mistakes and no hints. */
	clean?: boolean;
}

/** One finished training session, used for streaks, XP and personal bests. */
export interface SessionLog {
	id?: number;
	at: number;
	/** Local calendar day, `YYYY-MM-DD`. */
	day: string;
	mode: 'learn' | 'practice' | 'drill' | 'time' | 'quiz' | 'review' | 'arena' | 'puzzles';
	courseId?: string;
	lines: number;
	mistakes: number;
	/** Drill streak length or Time-mode score. */
	score?: number;
	xp: number;
}

export interface Setting {
	key: string;
	value: unknown;
}

/** A rating kept per course for Arena and for Puzzles. */
export interface RatingRecord {
	key: `${'arena' | 'puzzle'}/${string}`;
	kind: 'arena' | 'puzzle';
	courseId: string;
	rating: number;
	games: number;
	wins: number;
	draws: number;
	losses: number;
	history: { at: number; rating: number }[];
	/** Puzzle ids already played, so the next pick is fresh. */
	seen: string[];
}

/** A course the student built from a PGN; stored as the file so it parses like a bundled one. */
export interface CustomCourseRecord {
	id: string;
	file: CourseFile;
	createdAt: number;
}

export class ChessmodeDB extends Dexie {
	progress!: EntityTable<LineProgress, 'key'>;
	sessions!: EntityTable<SessionLog, 'id'>;
	games!: EntityTable<GameRecord, 'id'>;
	reviews!: EntityTable<GameReview & { key: string }, 'key'>;
	settings!: EntityTable<Setting, 'key'>;
	ratings!: EntityTable<RatingRecord, 'key'>;
	customCourses!: EntityTable<CustomCourseRecord, 'id'>;

	constructor() {
		super('chessmode');
		this.version(1).stores({
			progress: 'key, courseId, card.due',
			sessions: '++id, day, mode, courseId',
			games: 'id, source, playedAt',
			reviews: 'key, gameId',
			settings: 'key'
		});
		this.version(2).stores({ ratings: 'key, kind, courseId' });
		this.version(3).stores({ customCourses: 'id' });
	}
}

export const db = new ChessmodeDB();

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
	const row = await db.settings.get(key);
	return row ? (row.value as T) : fallback;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
	await db.settings.put({ key, value });
}

export const dayKey = (t = Date.now()) => {
	const d = new Date(t);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
