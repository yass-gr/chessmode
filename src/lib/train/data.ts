import { db, getSetting, setSetting, type LineProgress } from '#lib/db.ts';
import { courses } from '#lib/courses/index.ts';
import type { Course, LineKey } from '#lib/courses/types.ts';

export async function loadProgress(): Promise<Map<LineKey, LineProgress>> {
	return new Map((await db.progress.toArray()).map((p) => [p.key, p]));
}

export async function activeCourse(): Promise<Course | undefined> {
	const id = await getSetting<string>('course', courses[0]?.id ?? '');
	return courses.find((c) => c.id === id) ?? courses[0];
}

export const setActiveCourse = (id: string) => setSetting('course', id);
