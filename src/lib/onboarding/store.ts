import { courses } from '#lib/courses/index.ts';
import { db, getSetting, setSetting } from '#lib/db.ts';
import { isReady, parseOnboarding, seedRecords } from '#lib/onboarding/onboarding.ts';
import type { OnboardingProfile } from '#lib/onboarding/types.ts';

export const ONBOARDING_KEY = 'onboarding';

let tail: Promise<void> = Promise.resolve();

function enqueue(work: () => Promise<void>): Promise<void> {
	const run = tail.then(work, work);
	tail = run.then(
		() => undefined,
		() => undefined
	);
	return run;
}

export async function readOnboarding(): Promise<OnboardingProfile> {
	return parseOnboarding(await getSetting<unknown>(ONBOARDING_KEY, null));
}

export function writeOnboarding(profile: OnboardingProfile): Promise<void> {
	return enqueue(() => setSetting(ONBOARDING_KEY, { ...profile, updatedAt: Date.now() }));
}

export function dismissOnboarding(): Promise<void> {
	return enqueue(async () => {
		const current = parseOnboarding(await getSetting<unknown>(ONBOARDING_KEY, null));
		await setSetting(ONBOARDING_KEY, { ...current, status: 'dismissed', updatedAt: Date.now() });
	});
}

/** Saves a finished profile and fills missing per-course ratings. Existing ratings stay. */
export function completeOnboarding(profile: OnboardingProfile): Promise<void> {
	return enqueue(async () => {
		const ready = { ...profile, status: 'completed' as const, updatedAt: Date.now() };
		if (!isReady(ready)) throw new Error('Setup is incomplete.');
		await setSetting(ONBOARDING_KEY, ready);
		const existing = await db.ratings.toArray();
		const rows = seedRecords(ready.bracket, courses.map((course) => course.id), existing.map((row) => row.key));
		if (rows.length) await db.ratings.bulkAdd(rows);
	});
}
