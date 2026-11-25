import { courses } from '#lib/courses/index.ts';
import { parseCourse } from '#lib/courses/parse.ts';
import type { CourseFile } from '#lib/courses/types.ts';
import { db } from '#lib/db.ts';

export const CUSTOM_PREFIX = 'custom-';
export const isCustom = (id: string) => id.startsWith(CUSTOM_PREFIX);
export const newCustomId = () => `${CUSTOM_PREFIX}${Date.now().toString(36)}`;

function upsert(file: CourseFile) {
	const course = parseCourse(file);
	const at = courses.findIndex((c) => c.id === course.id);
	if (at >= 0) courses[at] = course;
	else courses.push(course);
}

/** Adds the student's saved courses to `courses`; runs once before the first page renders. */
export async function loadCustomCourses(): Promise<void> {
	for (const row of await db.customCourses.toArray()) {
		try {
			upsert(row.file);
		} catch (error) {
			console.warn(`Skipping custom course ${row.id}`, error);
		}
	}
}

export async function saveCustomCourse(file: CourseFile): Promise<void> {
	upsert(file);
	await db.customCourses.put({ id: file.id, file, createdAt: Date.now() });
}

/** Removes the course with its progress and ratings. */
export async function deleteCustomCourse(id: string): Promise<void> {
	if (!isCustom(id)) return;
	await db.transaction('rw', db.customCourses, db.progress, db.ratings, async () => {
		await db.customCourses.delete(id);
		await db.progress.where('courseId').equals(id).delete();
		await db.ratings.where('courseId').equals(id).delete();
	});
	const at = courses.findIndex((c) => c.id === id);
	if (at >= 0) courses.splice(at, 1);
}
