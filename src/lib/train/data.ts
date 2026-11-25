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

import { defaultDepth, type DepthChoice } from '#lib/courses/depth.ts';
export const loadDepth = (id: string) => getSetting<DepthChoice>(`depth/${id}`, defaultDepth());
export const saveDepth = (id: string, choice: DepthChoice) => setSetting(`depth/${id}`, choice);
export const loadLibrary = () => getSetting<string[]>('library', []);
export async function addToLibrary(id: string) {
 const library = await loadLibrary();
 if (!library.includes(id)) await setSetting('library', [...library, id]);
}
export async function removeFromLibrary(id: string) {
 await setSetting('library', (await loadLibrary()).filter(item => item !== id));
}
