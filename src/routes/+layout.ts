import { loadCustomCourses } from '#lib/courses/custom.ts';

export const ssr = false;
export const prerender = false;

export async function load() {
	await loadCustomCourses();
}
