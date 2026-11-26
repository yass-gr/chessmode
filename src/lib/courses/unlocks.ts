import { isCustom } from '#lib/courses/custom.ts';

export type CourseMode = 'learn' | 'practice' | 'drill' | 'time' | 'puzzle' | 'arena';

/** Bundled courses ship a puzzle file and an explorer. A private repertoire has neither. */
export function modeData(courseId: string) {
	return { puzzle: !isCustom(courseId), arena: !isCustom(courseId) };
}
export type ModeAvailability = { kind: 'available' } | { kind: 'locked'; remaining: number } | { kind: 'unavailable'; reason: string };
export function modeAvailability(mode: CourseMode, learned: number, total: number, hasData = true): ModeAvailability {
	if ((mode === 'arena' || mode === 'puzzle') && !hasData) return { kind: 'unavailable', reason: 'This course has no data for this mode yet.' };
	const threshold = mode === 'learn' ? 0 : mode === 'practice' ? 1 : mode === 'drill' || mode === 'time' ? 3 : 2;
	const remaining = Math.max(0, Math.min(threshold, total) - learned);
	return remaining ? { kind: 'locked', remaining } : { kind: 'available' };
}
