import { getSetting, setSetting } from '#lib/db.ts';
import { DEFAULT_PREFERENCES, DEFAULT_COURSE_PREFERENCES, type Preferences, type CoursePreferences, type SettingsMode } from '#lib/settings/types.ts';

function record(value: unknown): Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : {}; }
function choice<T extends string>(value: unknown, values: readonly T[], fallback: T): T { return values.find(v => v === value) ?? fallback; }
function bool(value: unknown, fallback: boolean): boolean { return typeof value === 'boolean' ? value : fallback; }
export function parsePreferences(value: unknown, muted = false): Preferences {
 const v = record(value), d = DEFAULT_PREFERENCES;
 return { coaching: choice(v.coaching, ['default', 'always', 'tap'], d.coaching), arrows: choice(v.arrows, ['none', 'withDialog', 'always'], d.arrows), evalBar: bool(v.evalBar, d.evalBar), autoNext: bool(v.autoNext, d.autoNext), sound: !muted, confetti: bool(v.confetti, d.confetti), haptics: bool(v.haptics, d.haptics), textSize: choice(v.textSize, ['default', 'large', 'xl'], d.textSize), theme: choice(v.theme, ['default', 'green', 'brown', 'blue', 'dark-blue'], d.theme), pieces: choice(v.pieces, ['default', 'geometric', 'outline'], d.pieces) };
}
export function parseCoursePreferences(value: unknown): CoursePreferences { const v = record(value); return { fastOpponent: bool(v.fastOpponent, true), skipSharedStart: bool(v.skipSharedStart, false) }; }
export async function readPreferences(): Promise<Preferences> { const [value, muted] = await Promise.all([getSetting<unknown>('trainer-preferences', null), getSetting('muted', false)]); return parsePreferences(value, muted); }
export async function writePreferences(value: Preferences): Promise<void> { await setSetting('trainer-preferences', value); await setSetting('muted', !value.sound); }
export async function readCoursePreferences(courseId: string): Promise<CoursePreferences> { return parseCoursePreferences(await getSetting<unknown>(`trainer-course/${courseId}`, DEFAULT_COURSE_PREFERENCES)); }
export async function writeCoursePreferences(courseId: string, value: CoursePreferences): Promise<void> { await setSetting(`trainer-course/${courseId}`, value); }
export function showEvaluation(mode: SettingsMode, preferences: Preferences): boolean { return mode !== 'puzzles' && preferences.evalBar; }
export function shouldSkipSharedStart(args: { mode: SettingsMode; enabled: boolean; lineCount: number; sharedPlies: number; playerMovesAfter: number; firstLearn: boolean }): boolean { return args.enabled && ['learn', 'practice', 'drill'].includes(args.mode) && args.lineCount >= 2 && args.sharedPlies >= 2 && args.playerMovesAfter > 0 && !(args.mode === 'learn' && args.firstLearn); }
export function opponentDelay(mode: SettingsMode, course: CoursePreferences): number { return mode === 'puzzles' || ((mode === 'drill' || mode === 'time') && course.fastOpponent) ? 150 : 500; }
