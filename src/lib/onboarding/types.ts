/** Stored rating brackets. Labels are the choices a player sees. */
export const RATING_BRACKETS = [
	{ id: 'unknown', label: "I don't know" },
	{ id: 'under-400', label: 'Under 400' },
	{ id: '400-800', label: '400–799' },
	{ id: '800-1200', label: '800–1199' },
	{ id: '1200-1600', label: '1200–1599' },
	{ id: '1600-2000', label: '1600–1999' },
	{ id: '2000-plus', label: '2000+' }
] as const;

export type RatingBracketId = (typeof RATING_BRACKETS)[number]['id'];

export const GOALS = [
	{ id: 'first-opening', label: 'Learn a first opening', detail: 'One repertoire, from the start.' },
	{ id: 'repertoire', label: 'Build a repertoire', detail: 'Lines you can trust in a game.' },
	{ id: 'sharpness', label: 'Get sharper', detail: 'Keep lines you know ready to play.' }
] as const;

export type GoalId = (typeof GOALS)[number]['id'];

export const MOTIVATIONS = [
	{ id: 'curious', label: 'Just curious' },
	{ id: 'games', label: 'Better games' },
	{ id: 'rating', label: 'A higher rating' }
] as const;

export type MotivationId = (typeof MOTIVATIONS)[number]['id'];

export type StudySide = 'w' | 'b' | 'either';

export interface OnboardingProfile {
	status: 'pending' | 'dismissed' | 'completed';
	bracket: RatingBracketId | null;
	goals: GoalId[];
	motivation: MotivationId | null;
	side: StudySide | null;
	updatedAt: number;
}

export interface CourseBrief {
	id: string;
	side: 'w' | 'b';
	band: 'beginner' | 'club' | 'advanced';
}

export const SETUP_STEPS = ['rating', 'goal', 'motivation', 'side', 'course'] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];
