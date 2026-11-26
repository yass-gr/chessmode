import { courses } from '#lib/courses/index.ts';
import { db, getSetting, setSetting } from '#lib/db.ts';
import { isReady, parseOnboarding, seedRecords } from '#lib/onboarding/onboarding.ts';
import type { OnboardingProfile } from '#lib/onboarding/types.ts';

export const ONBOARDING_KEY = 'onboarding';

export async function readOnboarding(): Promise<OnboardingProfile> {
	return parseOnboarding(await getSetting<unknown>(ONBOARDING_KEY, null));
}

export async function writeOnboarding(profile: OnboardingProfile): Promise<void> {
	await setSetting(ONBOARDING_KEY, { ...profile, updatedAt: Date.now() });
}

export async function dismissOnboarding(): Promise<void> {
	const current = await readOnboarding();
	await writeOnboarding({ ...current, status: 'dismissed' });
}

/** Saves a finished profile and fills missing per-course ratings. Existing ratings stay. */
export async function completeOnboarding(profile: OnboardingProfile): Promise<void> {
	const ready = { ...profile, status: 'completed' as const };
	if (!isReady(ready)) throw new Error('Setup is incomplete.');
	await writeOnboarding(ready);
	const existing = await db.ratings.toArray();
	const rows = seedRecords(ready.bracket, courses.map((course) => course.id), existing.map((row) => row.key));
	if (rows.length) await db.ratings.bulkAdd(rows);
}
