import { db, type LineProgress } from '#lib/db.ts';

/** Drops perfection so the lines return to the front of Practice. Discoveries stay. */
export function clearedPractice(rows: readonly LineProgress[], courseId: string): LineProgress[] {
	return rows.map((row) => (row.courseId === courseId ? { ...row, clean: false } : row));
}

/** Drops this course's line progress. Every other course, including a custom repertoire, stays. */
export function clearedCourse(rows: readonly LineProgress[], courseId: string): LineProgress[] {
	return rows.filter((row) => row.courseId !== courseId);
}

export async function resetPractice(courseId: string): Promise<void> {
	const rows = await db.progress.where('courseId').equals(courseId).toArray();
	await db.progress.bulkPut(clearedPractice(rows, courseId));
}

export async function resetCourseProgress(courseId: string): Promise<void> {
	await db.progress.where('courseId').equals(courseId).delete();
}
