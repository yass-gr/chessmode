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

/** Replace every local table with the backup. Callers validate the file first. */
export async function replaceWithArchive(archive: UserArchive): Promise<void> {
	await db.transaction('rw', tables, async () => {
		for (const table of tables) await table.clear();
		if (archive.progress.length) await db.progress.bulkAdd(archive.progress);
		if (archive.sessions.length) await db.sessions.bulkAdd(archive.sessions);
		if (archive.games.length) await db.games.bulkAdd(archive.games);
		if (archive.reviews.length) await db.reviews.bulkAdd(archive.reviews);
		if (archive.settings.length) await db.settings.bulkAdd(archive.settings);
		if (archive.ratings.length) await db.ratings.bulkAdd(archive.ratings);
		if (archive.customCourses.length) await db.customCourses.bulkAdd(archive.customCourses);
	});
}
