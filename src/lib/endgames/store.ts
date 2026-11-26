import { getSetting, setSetting } from '#lib/db.ts';
import { place } from '#lib/endgames/progress.ts';
import { parseProgress } from '#lib/endgames/progress.ts';
import type { EndgameProgress } from '#lib/endgames/types.ts';
import { readOnboarding } from '#lib/onboarding/store.ts';

export const ENDGAME_KEY = 'endgame-progress';

export async function loadEndgameProgress(): Promise<EndgameProgress> {
	const [stored, profile] = await Promise.all([getSetting<unknown>(ENDGAME_KEY, null), readOnboarding()]);
	let progress = parseProgress(stored);
	if (!progress.seeded && progress.games === 0 && profile.status === 'completed' && profile.bracket) {
		const placed = place(profile.bracket);
		progress = { ...progress, rating: placed.rating, tier: placed.tier, mix: 0, seeded: true };
		await setSetting(ENDGAME_KEY, progress);
	}
	return progress;
}

export function saveEndgameProgress(progress: EndgameProgress): Promise<void> {
	// A $state proxy is not structured-cloneable, so IndexedDB rejects it and the result sheet never appears.
	const plain = JSON.parse(JSON.stringify(progress)) as EndgameProgress;
	return setSetting(ENDGAME_KEY, plain);
}
