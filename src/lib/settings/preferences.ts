import type { Color } from '#lib/chess/types.ts';
import { getSetting, setSetting } from '#lib/db.ts';
import {
	DEFAULT_COURSE_PREFERENCES,
	DEFAULT_PREFERENCES,
	DEFAULT_REVIEW_PREFERENCES,
	PIECE_SETS,
	REVIEW_PREFERENCES_KEY,
	type CoursePreferences,
	type PieceSet,
	type Preferences,
	type ReviewPreferences,
	type SettingsMode
} from '#lib/settings/types.ts';

function record(value: unknown): Record<string, unknown> {
	if (typeof value === 'object' && value !== null && !Array.isArray(value)) return { ...value };
	return {};
}

function choice<T extends string>(value: unknown, values: readonly T[], fallback: T): T {
	return values.find((item) => item === value) ?? fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
	return typeof value === 'boolean' ? value : fallback;
}

/** Stored `default` is the previous name for the cburnett set. */
export function parsePieceSet(value: unknown): PieceSet {
	if (value === 'default') return 'cburnett';
	return choice(value, PIECE_SETS, 'cburnett');
}

export function parsePreferences(value: unknown, muted = false): Preferences {
	const stored = record(value);
	const defaults = DEFAULT_PREFERENCES;
	return {
		coaching: choice(stored.coaching, ['default', 'always', 'tap'], defaults.coaching),
		arrows: choice(stored.arrows, ['none', 'withDialog', 'always'], defaults.arrows),
		evalBar: bool(stored.evalBar, defaults.evalBar),
		autoNext: bool(stored.autoNext, defaults.autoNext),
		sound: !muted,
		confetti: bool(stored.confetti, defaults.confetti),
		haptics: bool(stored.haptics, defaults.haptics),
		textSize: choice(stored.textSize, ['default', 'large', 'xl'], defaults.textSize),
		theme: choice(stored.theme, ['default', 'green', 'brown', 'blue', 'dark-blue'], defaults.theme),
		pieces: parsePieceSet(stored.pieces)
	};
}

export function parseCoursePreferences(value: unknown): CoursePreferences {
	const stored = record(value);
	return {
		fastOpponent: bool(stored.fastOpponent, DEFAULT_COURSE_PREFERENCES.fastOpponent),
		skipSharedStart: bool(stored.skipSharedStart, DEFAULT_COURSE_PREFERENCES.skipSharedStart)
	};
}

export async function readPreferences(): Promise<Preferences> {
	const [value, muted] = await Promise.all([
		getSetting<unknown>('trainer-preferences', null),
		getSetting('muted', false)
	]);
	return parsePreferences(value, muted);
}

export async function writePreferences(value: Preferences): Promise<void> {
	await setSetting('trainer-preferences', value);
	await setSetting('muted', !value.sound);
}

export function parseReviewPreferences(value: unknown, userColor?: Color): ReviewPreferences {
	const stored = record(value);
	const defaults = DEFAULT_REVIEW_PREFERENCES;
	return {
		perspective: choice(stored.perspective, ['w', 'b', 'both'] as const, userColor ?? defaults.perspective),
		overlays: choice(stored.overlays, ['none', 'played', 'best', 'both'] as const, defaults.overlays),
		autoplay: bool(stored.autoplay, defaults.autoplay),
		voice: bool(stored.voice, defaults.voice),
		coach: bool(stored.coach, defaults.coach),
		glyphs: bool(stored.glyphs, defaults.glyphs)
	};
}

export async function readReviewPreferences(userColor?: Color): Promise<ReviewPreferences> {
	return parseReviewPreferences(await getSetting<unknown>(REVIEW_PREFERENCES_KEY, null), userColor);
}

export async function writeReviewPreferences(value: ReviewPreferences): Promise<void> {
	await setSetting(REVIEW_PREFERENCES_KEY, value);
}

export async function readCoursePreferences(courseId: string): Promise<CoursePreferences> {
	return parseCoursePreferences(await getSetting<unknown>(`trainer-course/${courseId}`, DEFAULT_COURSE_PREFERENCES));
}

export async function writeCoursePreferences(courseId: string, value: CoursePreferences): Promise<void> {
	await setSetting(`trainer-course/${courseId}`, value);
}

export function showEvaluation(mode: SettingsMode, preferences: Preferences): boolean {
	return mode !== 'puzzles' && preferences.evalBar;
}

export function shouldSkipSharedStart(args: {
	mode: SettingsMode;
	enabled: boolean;
	lineCount: number;
	sharedPlies: number;
	playerMovesAfter: number;
	firstLearn: boolean;
}): boolean {
	return (
		args.enabled &&
		(args.mode === 'learn' || args.mode === 'practice' || args.mode === 'drill') &&
		args.lineCount >= 2 &&
		args.sharedPlies >= 2 &&
		args.playerMovesAfter > 0 &&
		!(args.mode === 'learn' && args.firstLearn)
	);
}

export function opponentDelay(mode: SettingsMode, course: CoursePreferences): number {
	return mode === 'puzzles' || ((mode === 'drill' || mode === 'time') && course.fastOpponent) ? 150 : 500;
}
