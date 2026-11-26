import { parseArchive } from '#lib/archive/archive.ts';
import { db } from '#lib/db.ts';
import { ARCHIVE_VERSION, type UserArchive } from '#lib/archive/types.ts';

const tables = [db.progress, db.sessions, db.games, db.reviews, db.settings, db.ratings, db.customCourses] as const;

export async function readArchive(exportedAt = Date.now()): Promise<UserArchive> {
	const [progress, sessions, games, reviews, settings, ratings, customCourses] = await Promise.all([
		db.progress.toArray(),
		db.sessions.toArray(),
		db.games.toArray(),
		db.reviews.toArray(),
		db.settings.toArray(),
		db.ratings.toArray(),
		db.customCourses.toArray()
	]);
	return { version: ARCHIVE_VERSION, exportedAt, progress, sessions, games, reviews, settings, ratings, customCourses };
}

/**
 * Replace every local table with the backup. Callers validate the file first.
 * The copy is rebuilt from JSON so a Svelte state proxy can be stored in IndexedDB.
 */
export async function replaceWithArchive(archive: UserArchive): Promise<void> {
	const parsed = parseArchive(JSON.stringify(archive));
	if (!parsed.ok) throw new Error(parsed.error);
	const data = parsed.archive;
	await db.transaction('rw', tables, async () => {
		for (const table of tables) await table.clear();
		if (data.progress.length) await db.progress.bulkAdd(data.progress);
		if (data.sessions.length) await db.sessions.bulkAdd(data.sessions);
		if (data.games.length) await db.games.bulkAdd(data.games);
		if (data.reviews.length) await db.reviews.bulkAdd(data.reviews);
		if (data.settings.length) await db.settings.bulkAdd(data.settings);
		if (data.ratings.length) await db.ratings.bulkAdd(data.ratings);
		if (data.customCourses.length) await db.customCourses.bulkAdd(data.customCourses);
	});
}
