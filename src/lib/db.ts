import Dexie, { type EntityTable } from 'dexie';
import type { Card } from 'ts-fsrs';
import type { LineKey } from '#lib/courses/types.ts';
import type { GameRecord, GameReview } from '#lib/review/types.ts';

/** Spaced-repetition state for one course line. A row exists once the line has been learned. */
export interface LineProgress {
	key: LineKey;
	courseId: string;
	card: Card;
	learnedAt: number;
	reviews: number;
	lapses: number;
}

/** One finished training session, used for streaks, XP and personal bests. */
export interface SessionLog {
	id?: number;
	at: number;
	/** Local calendar day, `YYYY-MM-DD`. */
	day: string;
	mode: 'learn' | 'practice' | 'drill' | 'time' | 'quiz' | 'review';
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

export class ChessmodeDB extends Dexie {
	progress!: EntityTable<LineProgress, 'key'>;
	sessions!: EntityTable<SessionLog, 'id'>;
	games!: EntityTable<GameRecord, 'id'>;
	reviews!: EntityTable<GameReview & { key: string }, 'key'>;
	settings!: EntityTable<Setting, 'key'>;

	constructor() {
		super('chessmode');
		this.version(1).stores({
			progress: 'key, courseId, card.due',
			sessions: '++id, day, mode, courseId',
			games: 'id, source, playedAt',
			reviews: 'key, gameId',
			settings: 'key'
		});
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
