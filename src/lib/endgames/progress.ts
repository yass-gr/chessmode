import type { EndgameDifficulty, EndgameMode, EndgameProgress, EndgameTier } from '#lib/endgames/types.ts';

/**
 * Session defaults checked against the public endgame client on 2026-11-26.
 * A new player starts at 800. Placement at 1200 or more begins uncoached (lineage);
 * below that, coached (beginner). During play, beginner promotes at 1200.
 * Lineage demotes below 850 only after at least one game. While still beginner,
 * ratings above 1000 fill a mix meter that occasionally serves one uncoached position.
 */
export const ENDGAME_START = 800;
export const PROMOTE_AT = 1200;
export const DEMOTE_BELOW = 850;
export const MIX_FROM = 1000;

export const DIFFICULTY_OFFSET: Record<EndgameDifficulty, number> = {
	easier: -200,
	normal: 0,
	harder: 200
};

/** Onboarding bracket to the endgame placement rating. Unknown stays at the 800 default. */
export const PLACEMENT: Record<string, number> = {
	unknown: 800,
	'under-400': 400,
	'400-800': 600,
	'800-1200': 900,
	'1200-1600': 1300,
	'1600-2000': 1600,
	'2000-plus': 1900
};

export function freshProgress(): EndgameProgress {
	return {
		rating: ENDGAME_START,
		games: 0,
		wins: 0,
		draws: 0,
		losses: 0,
		history: [],
		seen: [],
		tier: 'beginner',
		mix: 0,
		mode: 'auto',
		difficulty: 'normal',
		seeded: false
	};
}

export function tierForRating(rating: number): EndgameTier {
	return rating >= PROMOTE_AT ? 'lineage' : 'beginner';
}

export function place(bracket: string | null | undefined): { rating: number; tier: EndgameTier } {
	const rating = PLACEMENT[bracket ?? ''] ?? ENDGAME_START;
	return { rating, tier: tierForRating(rating) };
}

export interface TierStep {
	tier: EndgameTier;
	mix: number;
	served: EndgameTier;
}

/** One deal. `games` is the count already finished, before this position. */
export function serveTier(state: { tier: EndgameTier; mix: number }, rating: number, games: number): TierStep {
	let tier = state.tier;
	if (tier === 'lineage' && games > 0 && rating < DEMOTE_BELOW) tier = 'beginner';
	if (tier === 'beginner' && rating >= PROMOTE_AT) tier = 'lineage';
	if (tier === 'lineage') return { tier, mix: 0, served: 'lineage' };
	const step = Math.max(0, Math.min(1, (rating - MIX_FROM) / (PROMOTE_AT - MIX_FROM)));
	let mix = state.mix + step;
	const uncoached = mix >= 1;
	if (uncoached) mix -= 1;
	return { tier, mix, served: uncoached ? 'lineage' : 'beginner' };
}

export function coachingFor(progress: EndgameProgress): { progress: EndgameProgress; coached: boolean } {
	if (progress.mode === 'coached') return { progress, coached: true };
	if (progress.mode === 'rated') return { progress, coached: false };
	const next = serveTier(progress, progress.rating, progress.games);
	return {
		progress: { ...progress, tier: next.tier, mix: next.mix },
		coached: next.served === 'beginner'
	};
}

export function targetRating(progress: EndgameProgress): number {
	return progress.rating + DIFFICULTY_OFFSET[progress.difficulty];
}

const MODES: EndgameMode[] = ['auto', 'coached', 'rated'];
const DIFFICULTIES: EndgameDifficulty[] = ['easier', 'normal', 'harder'];

function number(value: unknown, fallback: number): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function parseProgress(value: unknown): EndgameProgress {
	const fresh = freshProgress();
	if (typeof value !== 'object' || value === null) return fresh;
	const stored = value as Partial<EndgameProgress>;
	const tier = stored.tier === 'lineage' || stored.tier === 'beginner' ? stored.tier : fresh.tier;
	return {
		rating: Math.max(100, Math.min(3000, Math.round(number(stored.rating, fresh.rating)))),
		games: Math.max(0, Math.round(number(stored.games, 0))),
		wins: Math.max(0, Math.round(number(stored.wins, 0))),
		draws: Math.max(0, Math.round(number(stored.draws, 0))),
		losses: Math.max(0, Math.round(number(stored.losses, 0))),
		history: Array.isArray(stored.history)
			? stored.history.filter((row) => row && typeof row.rating === 'number' && typeof row.at === 'number').slice(-200)
			: [],
		seen: Array.isArray(stored.seen) ? stored.seen.filter((id) => typeof id === 'string').slice(-1000) : [],
		tier,
		mix: Math.max(0, Math.min(1, number(stored.mix, 0))),
		mode: MODES.find((mode) => mode === stored.mode) ?? 'auto',
		difficulty: DIFFICULTIES.find((item) => item === stored.difficulty) ?? 'normal',
		seeded: stored.seeded === true
	};
}

export function resultScore(result: 'win' | 'loss' | 'draw', helped: boolean): 0 | 0.5 | 1 {
	if (result === 'loss') return 0;
	if (result === 'draw' || helped) return 0.5;
	return 1;
}

export function recordEndgame(
	progress: EndgameProgress,
	rating: number,
	result: 'win' | 'loss' | 'draw',
	seen: string,
	at = Date.now()
): EndgameProgress {
	const score = result === 'win' ? 1 : result === 'draw' ? 0.5 : 0;
	return {
		...progress,
		rating,
		games: progress.games + 1,
		wins: progress.wins + (score === 1 ? 1 : 0),
		draws: progress.draws + (score === 0.5 ? 1 : 0),
		losses: progress.losses + (score === 0 ? 1 : 0),
		history: [...progress.history, { at, rating }].slice(-200),
		seen: [...progress.seen.filter((id) => id !== seen), seen].slice(-1000)
	};
}
