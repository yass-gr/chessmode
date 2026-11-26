import type { Card } from 'ts-fsrs';
import type { CustomCourseRecord, LineProgress, RatingRecord, SessionLog, Setting } from '#lib/db.ts';
import type { GameRecord, GameReview } from '#lib/review/types.ts';
import { ARCHIVE_VERSION, type ArchiveResult, type UserArchive } from '#lib/archive/types.ts';

const BAD_FILE = 'This file is not a Chessmode backup.';
const BAD_VERSION = 'This backup version is not supported.';

const SESSION_MODES = new Set(['learn', 'practice', 'drill', 'time', 'quiz', 'review', 'arena', 'puzzles']);
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

function fail(error: string): ArchiveResult {
	return { ok: false, error };
}

function record(value: unknown): Record<string, unknown> | null {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
	return value as Record<string, unknown>;
}

function text(value: unknown): string | null {
	return typeof value === 'string' && value.length > 0 ? value : null;
}

function finite(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function whole(value: unknown): number | null {
	const number = finite(value);
	return number !== null && Number.isInteger(number) && number >= 0 ? number : null;
}

function list(value: unknown, label: string): unknown[] | ArchiveResult {
	if (!Array.isArray(value)) return fail(`This backup is missing ${label}.`);
	return value;
}

function reviveDate(value: unknown): Date | undefined {
	if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
	if (typeof value === 'number' && Number.isFinite(value)) {
		const date = new Date(value);
		return Number.isNaN(date.getTime()) ? undefined : date;
	}
	if (typeof value === 'string' && ISO_DATE.test(value)) {
		const date = new Date(value);
		return Number.isNaN(date.getTime()) ? undefined : date;
	}
	return undefined;
}

function reviveCard(value: unknown): Card | null {
	const card = record(value);
	if (!card) return null;
	const due = reviveDate(card.due);
	if (!due) return null;
	const scheduled = finite(card.scheduled_days);
	const steps = finite(card.learning_steps);
	if (finite(card.stability) === null || finite(card.difficulty) === null) return null;
	if (scheduled === null || scheduled < 0 || steps === null || steps < 0) return null;
	if (whole(card.reps) === null || whole(card.lapses) === null || whole(card.state) === null) return null;
	const next: Record<string, unknown> = { ...card, due };
	const last = card.last_review;
	if (last !== undefined && last !== null) {
		const revived = reviveDate(last);
		if (!revived) return null;
		next.last_review = revived;
	}
	return next as unknown as Card;
}

function unique(ids: string[], label: string): ArchiveResult | null {
	if (new Set(ids).size !== ids.length) return fail(`This backup repeats a ${label}.`);
	return null;
}

function readProgress(value: unknown): LineProgress[] | ArchiveResult {
	const rows = list(value, 'training progress');
	if (!Array.isArray(rows)) return rows;
	const progress: LineProgress[] = [];
	for (const row of rows) {
		const item = record(row);
		const card = item ? reviveCard(item.card) : null;
		if (!item || !text(item.key) || !text(item.courseId) || whole(item.learnedAt) === null || whole(item.reviews) === null || whole(item.lapses) === null || !card) {
			return fail('A progress row in this backup is incomplete.');
		}
		if (item.clean !== undefined && typeof item.clean !== 'boolean') return fail('A progress row in this backup is incomplete.');
		progress.push({ ...item, card } as LineProgress);
	}
	return unique(progress.map((row) => row.key), 'line') ?? progress;
}

function readSessions(value: unknown): SessionLog[] | ArchiveResult {
	const rows = list(value, 'session history');
	if (!Array.isArray(rows)) return rows;
	const sessions: SessionLog[] = [];
	for (const row of rows) {
		const item = record(row);
		if (!item) return fail('A session in this backup is incomplete.');
		const mode = text(item.mode);
		const day = text(item.day);
		if (!mode || !SESSION_MODES.has(mode) || !day || !DAY.test(day)) {
			return fail('A session in this backup is incomplete.');
		}
		if (whole(item.at) === null || whole(item.lines) === null || whole(item.mistakes) === null || finite(item.xp) === null) {
			return fail('A session in this backup is incomplete.');
		}
		if (item.score !== undefined && finite(item.score) === null) return fail('A session in this backup is incomplete.');
		if (item.reps !== undefined && whole(item.reps) === null) return fail('A session in this backup is incomplete.');
		if (item.scoreVersion !== undefined && item.scoreVersion !== 'lines' && item.scoreVersion !== 'moves') {
			return fail('A session in this backup is incomplete.');
		}
		if (item.courseId !== undefined && !text(item.courseId)) return fail('A session in this backup is incomplete.');
		if (item.id !== undefined && (whole(item.id) === null || item.id === 0)) return fail('A session in this backup is incomplete.');
		sessions.push(item as unknown as SessionLog);
	}
	return unique(sessions.flatMap((row) => (row.id === undefined ? [] : [String(row.id)])), 'session') ?? sessions;
}

function readGames(value: unknown): GameRecord[] | ArchiveResult {
	const rows = list(value, 'saved games');
	if (!Array.isArray(rows)) return rows;
	const games: GameRecord[] = [];
	for (const row of rows) {
		const item = record(row);
		const white = item ? record(item.white) : null;
		const black = item ? record(item.black) : null;
		const result = item?.result;
		if (!item || !text(item.id) || !text(item.pgn) || whole(item.playedAt) === null || whole(item.importedAt) === null) {
			return fail('A saved game in this backup is incomplete.');
		}
		if (item.source !== 'lichess' && item.source !== 'chesscom' && item.source !== 'pgn') return fail('A saved game in this backup is incomplete.');
		if (!white || !text(white.name) || !black || !text(black.name)) return fail('A saved game in this backup is incomplete.');
		if (result !== '1-0' && result !== '0-1' && result !== '1/2-1/2' && result !== '*') return fail('A saved game in this backup is incomplete.');
		games.push(item as unknown as GameRecord);
	}
	return unique(games.map((game) => game.id), 'game') ?? games;
}

function readReviews(value: unknown): (GameReview & { key: string })[] | ArchiveResult {
	const rows = list(value, 'game reviews');
	if (!Array.isArray(rows)) return rows;
	const reviews: (GameReview & { key: string })[] = [];
	for (const row of rows) {
		const item = record(row);
		if (!item || !text(item.key) || !text(item.gameId) || whole(item.depth) === null || !Array.isArray(item.moves)) {
			return fail('A game review in this backup is incomplete.');
		}
		if (!record(item.white) || !record(item.black)) return fail('A game review in this backup is incomplete.');
		reviews.push(item as unknown as GameReview & { key: string });
	}
	return unique(reviews.map((review) => review.key), 'review') ?? reviews;
}

function readSettings(value: unknown): Setting[] | ArchiveResult {
	const rows = list(value, 'settings');
	if (!Array.isArray(rows)) return rows;
	const settings: Setting[] = [];
	for (const row of rows) {
		const item = record(row);
		if (!item || !text(item.key) || !('value' in item)) return fail('A setting in this backup is incomplete.');
		settings.push({ key: item.key as string, value: item.value });
	}
	return unique(settings.map((setting) => setting.key), 'setting') ?? settings;
}

function readRatings(value: unknown): RatingRecord[] | ArchiveResult {
	const rows = list(value, 'ratings');
	if (!Array.isArray(rows)) return rows;
	const ratings: RatingRecord[] = [];
	for (const row of rows) {
		const item = record(row);
		if (!item || (item.kind !== 'arena' && item.kind !== 'puzzle') || !text(item.courseId)) return fail('A rating in this backup is incomplete.');
		if (item.key !== `${item.kind}/${item.courseId}`) return fail('A rating in this backup is incomplete.');
		if (finite(item.rating) === null || whole(item.games) === null || whole(item.wins) === null || whole(item.draws) === null || whole(item.losses) === null) {
			return fail('A rating in this backup is incomplete.');
		}
		if (!Array.isArray(item.history) || !Array.isArray(item.seen)) return fail('A rating in this backup is incomplete.');
		for (const point of item.history) {
			const entry = record(point);
			if (!entry || whole(entry.at) === null || finite(entry.rating) === null) return fail('A rating in this backup is incomplete.');
		}
		if (item.seen.some((id) => typeof id !== 'string')) return fail('A rating in this backup is incomplete.');
		ratings.push(item as unknown as RatingRecord);
	}
	return unique(ratings.map((rating) => rating.key), 'rating') ?? ratings;
}

function readCourses(value: unknown): CustomCourseRecord[] | ArchiveResult {
	const rows = list(value, 'custom courses');
	if (!Array.isArray(rows)) return rows;
	const courses: CustomCourseRecord[] = [];
	for (const row of rows) {
		const item = record(row);
		const file = item ? record(item.file) : null;
		if (!item || !text(item.id) || whole(item.createdAt) === null || !file) return fail('A custom course in this backup is incomplete.');
		if (file.id !== item.id || !text(file.name) || (file.side !== 'w' && file.side !== 'b') || !Array.isArray(file.chapters)) {
			return fail('A custom course in this backup is incomplete.');
		}
		courses.push(item as unknown as CustomCourseRecord);
	}
	return unique(courses.map((course) => course.id), 'custom course') ?? courses;
}

export function serializeArchive(archive: UserArchive): string {
	return JSON.stringify(archive);
}

/** Parse a backup file. Dates on spaced-repetition cards are restored. Nothing is written. */
export function parseArchive(text: string): ArchiveResult {
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		return fail(BAD_FILE);
	}
	const root = record(parsed);
	if (!root || !('version' in root)) return fail(BAD_FILE);
	if (root.version !== ARCHIVE_VERSION) return fail(BAD_VERSION);
	if (whole(root.exportedAt) === null) return fail(BAD_FILE);

	const progress = readProgress(root.progress);
	const sessions = readSessions(root.sessions);
	const games = readGames(root.games);
	const reviews = readReviews(root.reviews);
	const settings = readSettings(root.settings);
	const ratings = readRatings(root.ratings);
	const customCourses = readCourses(root.customCourses);
	if (!Array.isArray(progress)) return progress;
	if (!Array.isArray(sessions)) return sessions;
	if (!Array.isArray(games)) return games;
	if (!Array.isArray(reviews)) return reviews;
	if (!Array.isArray(settings)) return settings;
	if (!Array.isArray(ratings)) return ratings;
	if (!Array.isArray(customCourses)) return customCourses;

	return {
		ok: true,
		archive: {
			version: ARCHIVE_VERSION,
			exportedAt: root.exportedAt as number,
			progress,
			sessions,
			games,
			reviews,
			settings,
			ratings,
			customCourses
		}
	};
}
