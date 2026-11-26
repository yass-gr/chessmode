import type { RatingRecord } from '#lib/db.ts';
import {
	GOALS,
	MOTIVATIONS,
	RATING_BRACKETS,
	type CourseBrief,
	type GoalId,
	type MotivationId,
	type OnboardingProfile,
	type RatingBracketId,
	type SetupStep,
	type StudySide
} from '#lib/onboarding/types.ts';

/**
 * Prompt order is Chessmode's. The parity notes say to confirm the reference product's live
 * onboarding copy before copying it, and this setup does not copy that copy.
 */
const PUZZLE_SEED: Record<RatingBracketId, number> = {
	unknown: 950,
	'under-400': 950,
	'400-800': 1050,
	'800-1200': 1150,
	'1200-1600': 1250,
	'1600-2000': 1350,
	'2000-plus': 1350
};

const ARENA_SEED: Record<RatingBracketId, number> = {
	unknown: 950,
	'under-400': 750,
	'400-800': 1000,
	'800-1200': 1200,
	'1200-1600': 1400,
	'1600-2000': 1550,
	'2000-plus': 1700
};

const COURSE_ORDER = [
	'italian-game',
	'caro-kann',
	'french-defense',
	'scandinavian',
	'ruy-lopez',
	'queens-gambit',
	'vienna-game',
	'english-opening',
	'jobava-london',
	'queens-gambit-declined',
	'kings-indian',
	'sicilian-najdorf'
];

const WIDEN = {
	beginner: ['beginner', 'club', 'advanced'],
	club: ['club', 'beginner', 'advanced'],
	advanced: ['advanced', 'club', 'beginner']
} as const;

const blank = (): OnboardingProfile => ({
	status: 'pending',
	bracket: null,
	goals: [],
	motivation: null,
	side: null,
	updatedAt: 0
});

function choice<T extends string>(value: unknown, allowed: readonly T[]): T | null {
	return allowed.find((item) => item === value) ?? null;
}

export function parseOnboarding(value: unknown): OnboardingProfile {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return blank();
	const stored = value as Record<string, unknown>;
	const goals = Array.isArray(stored.goals)
		? [...new Set(stored.goals.flatMap((goal) => {
				const id = choice(goal, GOALS.map((item) => item.id));
				return id ? [id] : [];
			}))]
		: [];
	const updatedAt = typeof stored.updatedAt === 'number' && Number.isFinite(stored.updatedAt) ? stored.updatedAt : 0;
	return {
		status: stored.status === 'dismissed' || stored.status === 'completed' ? stored.status : 'pending',
		bracket: choice(stored.bracket, RATING_BRACKETS.map((item) => item.id)),
		goals,
		motivation: choice(stored.motivation, MOTIVATIONS.map((item) => item.id)),
		side: stored.side === 'w' || stored.side === 'b' || stored.side === 'either' ? stored.side : null,
		updatedAt
	};
}

export function puzzleSeed(bracket: RatingBracketId): number {
	return PUZZLE_SEED[bracket];
}

export function arenaSeed(bracket: RatingBracketId): number {
	return ARENA_SEED[bracket];
}

/** Rating rows for courses that do not already have one. An existing row is left alone. */
export function seedRecords(bracket: RatingBracketId, courseIds: readonly string[], existingKeys: readonly string[]): RatingRecord[] {
	const have = new Set(existingKeys);
	const rows: RatingRecord[] = [];
	for (const courseId of courseIds) {
		for (const kind of ['arena', 'puzzle'] as const) {
			const key = `${kind}/${courseId}` as const;
			if (have.has(key)) continue;
			have.add(key);
			rows.push({
				key,
				kind,
				courseId,
				rating: kind === 'arena' ? arenaSeed(bracket) : puzzleSeed(bracket),
				games: 0,
				wins: 0,
				draws: 0,
				losses: 0,
				history: [],
				seen: []
			});
		}
	}
	return rows;
}

export function courseBand(level: string): CourseBrief['band'] {
	if (level.includes('1200')) return 'advanced';
	if (/beginner/i.test(level)) return 'beginner';
	return 'club';
}

function bandFor(bracket: RatingBracketId, goal: GoalId): CourseBrief['band'] {
	const base: CourseBrief['band'] =
		bracket === '1600-2000' || bracket === '2000-plus' ? 'advanced' : bracket === '800-1200' || bracket === '1200-1600' ? 'club' : 'beginner';
	if (goal === 'sharpness' && base === 'club') return 'advanced';
	if (goal === 'first-opening' && base === 'advanced') return 'club';
	return base;
}

export function recommendCourse(
	profile: { bracket: RatingBracketId; goals: readonly GoalId[]; side: StudySide },
	briefs: readonly CourseBrief[]
): string | null {
	const goal = profile.goals[0];
	if (!goal) return null;
	const sides: Array<'w' | 'b'> = profile.side === 'either' ? ['w', 'b'] : [profile.side];
	const rank = (id: string) => {
		const at = COURSE_ORDER.indexOf(id);
		return at === -1 ? COURSE_ORDER.length : at;
	};
	for (const band of WIDEN[bandFor(profile.bracket, goal)]) {
		for (const side of sides) {
			const match = briefs
				.filter((course) => course.band === band && course.side === side)
				.sort((a, b) => rank(a.id) - rank(b.id))[0];
			if (match) return match.id;
		}
	}
	return null;
}

export function resumeStep(profile: OnboardingProfile): SetupStep {
	if (!profile.bracket) return 'rating';
	if (profile.goals.length === 0) return 'goal';
	if (!profile.motivation) return 'motivation';
	if (!profile.side) return 'side';
	return 'course';
}

export function isReady(profile: OnboardingProfile): profile is OnboardingProfile & {
	bracket: RatingBracketId;
	motivation: MotivationId;
	side: StudySide;
} {
	return profile.bracket !== null && profile.goals.length > 0 && profile.motivation !== null && profile.side !== null;
}
