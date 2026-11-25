import { db, getSetting, setSetting, type LineProgress } from '#lib/db.ts';
import { courses, getCourse } from '#lib/courses/index.ts';
import type { Course, LineKey } from '#lib/courses/types.ts';
import type { DepthChoice } from '#lib/courses/depth.ts';
import { normalizeDepth, withPinnedLine } from '#lib/courses/scope.ts';

export async function loadProgress(): Promise<Map<LineKey, LineProgress>> {
	return new Map((await db.progress.toArray()).map((p) => [p.key, p]));
}

export async function activeCourse(): Promise<Course | undefined> {
	const id = await getSetting<string>('course', courses[0]?.id ?? '');
	return courses.find((c) => c.id === id) ?? courses[0];
}

export const setActiveCourse = (id: string) => setSetting('course', id);

export const loadDepth = async (id: string) => normalizeDepth(await getSetting<Partial<DepthChoice> | null>(`depth/${id}`, null));
export const saveDepth = (id: string, choice: DepthChoice) => setSetting(`depth/${id}`, choice);
/** A trainer URL counts as opening the course: library membership, resume target, and an out-of-tier pin. */
export async function enterFromTrainer(courseId: string, lineKey?: LineKey) {
	const course = getCourse(courseId);
	if (!course) return;
	await Promise.all([setActiveCourse(course.id), addToLibrary(course.id)]);
	if (!lineKey) return;
	const choice = await loadDepth(course.id);
	const next = withPinnedLine(course, choice, lineKey);
	if (next !== choice) await saveDepth(course.id, next);
}
export const loadLibrary = () => getSetting<string[]>('library', []);
export async function addToLibrary(id: string) {
 const library = await loadLibrary();
 if (!library.includes(id)) await setSetting('library', [...library, id]);
}
export async function removeFromLibrary(id: string) {
 await setSetting('library', (await loadLibrary()).filter(item => item !== id));
}
