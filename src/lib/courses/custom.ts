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
	const previous = await db.customCourses.get(file.id);
	const saved = previous ? preserveLineIds(previous.file, file) : file;
	parseCourse(saved);
	await db.transaction('rw', db.customCourses, db.progress, async () => {
		const valid = new Set(saved.chapters.flatMap((chapter) => chapter.lines.map((line) => `${saved.id}/${line.id}`)));
		for (const row of await db.progress.where('courseId').equals(saved.id).toArray()) {
			if (!valid.has(row.key)) await db.progress.delete(row.key);
		}
		await db.customCourses.put({ id: saved.id, file: saved, createdAt: previous?.createdAt ?? Date.now() });
	});
	upsert(saved);
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

/** Keep identities for lines with the same legal move sequence, regardless of notes or order. */
export function preserveLineIds(previous: CourseFile, next: CourseFile): CourseFile {
	const old = parseCourse(previous);
	const fresh = parseCourse(next);
	const signature = (plies: typeof old.lines[number]['plies']) => plies.map((ply) => ply.uci).join(' ');
	const available = new Map(previous.side === next.side ? old.lines.map((line) => [signature(line.plies), line.id]) : []);
	const used = new Set<string>();
	let serial = 1;
	const ids = new Map<string, string>();
	for (const line of fresh.lines) {
		let id = available.get(signature(line.plies));
		if (!id || used.has(id)) {
			do { id = `line-${serial++}`; } while (old.lines.some((item) => item.id === id) || used.has(id));
		}
		used.add(id);
		ids.set(line.id, id);
	}
	return { ...next, chapters: next.chapters.map((chapter) => ({
		...chapter, lines: chapter.lines.map((line) => ({ ...line, id: ids.get(line.id) ?? line.id }))
	})) };
}

export function copyCourse(file: CourseFile, id = newCustomId()): CourseFile {
	return { ...structuredClone(file), id, name: `${file.name} copy` };
}

export interface ReimportLine {
	id: string;
	name: string;
	chapter: string;
}

export interface ReimportReport {
	added: ReimportLine[];
	changed: (ReimportLine & { previousName: string })[];
	removed: ReimportLine[];
	kept: ReimportLine[];
	/** Learned lines whose move sequence still maps to the same progress row. */
	progressKept: number;
	progressTotal: number;
}

/** Says which lines a reimport adds, changes or removes, and how many learned lines keep their progress. */
export function diffReimport(previous: CourseFile, next: CourseFile, progressKeys: string[]): ReimportReport {
	const aligned = preserveLineIds(previous, next);
	const before = describe(previous);
	const after = describe(aligned);
	const previousById = new Map(before.map((line) => [line.id, line]));
	const kept: ReimportLine[] = [];
	const consumed = new Set<string>();
	const pending: typeof after = [];
	for (const line of after) {
		const prior = previousById.get(line.id);
		if (prior && prior.signature === line.signature) {
			kept.push(present(line));
			consumed.add(prior.id);
		} else pending.push(line);
	}
	const removedPool = before.filter((line) => !consumed.has(line.id));
	const pairs = removedPool.flatMap((prior) => pending.map((line) => ({ prior, line, score: sharedPrefix(prior.ucis, line.ucis) })))
		.filter((pair) => pair.score > 0)
		.sort((a, b) => b.score - a.score || Number(b.prior.name === b.line.name) - Number(a.prior.name === a.line.name));
	const usedOld = new Set<string>();
	const usedNew = new Set<string>();
	const changed: ReimportReport['changed'] = [];
	for (const pair of pairs) {
		if (usedOld.has(pair.prior.id) || usedNew.has(pair.line.id)) continue;
		usedOld.add(pair.prior.id);
		usedNew.add(pair.line.id);
		changed.push({ ...present(pair.line), previousName: pair.prior.name });
	}
	const courseId = previous.id;
	const owned = progressKeys.filter((key) => key.startsWith(`${courseId}/`));
	const keptKeys = new Set(kept.map((line) => `${courseId}/${line.id}`));
	return {
		added: pending.filter((line) => !usedNew.has(line.id)).map(present),
		changed,
		removed: removedPool.filter((line) => !usedOld.has(line.id)).map(present),
		kept,
		progressKept: owned.filter((key) => keptKeys.has(key)).length,
		progressTotal: owned.length
	};
}

function present(line: { id: string; name: string; chapter: string }): ReimportLine {
	return { id: line.id, name: line.name, chapter: line.chapter };
}

function sharedPrefix(left: string[], right: string[]) {
	let count = 0;
	while (count < left.length && count < right.length && left[count] === right[count]) count++;
	return count;
}

function describe(file: CourseFile) {
	const course = parseCourse(file);
	const chapterName = new Map(course.chapters.map((chapter) => [chapter.id, chapter.name]));
	return course.lines.map((line) => ({
		id: line.id,
		name: line.name,
		chapter: chapterName.get(line.chapterId) ?? line.chapterId,
		signature: line.plies.map((ply) => ply.uci).join(' '),
		ucis: line.plies.map((ply) => ply.uci)
	}));
}
