export type SettingsMode = 'learn' | 'practice' | 'drill' | 'time' | 'puzzles' | 'arena';

export type BoardTheme = 'default' | 'green' | 'brown' | 'blue' | 'dark-blue';

export const PIECE_SETS = ['cburnett', 'merida', 'pirouetti', 'chessnut'] as const;

export type PieceSet = (typeof PIECE_SETS)[number];

export interface Preferences {
	coaching: 'default' | 'always' | 'tap';
	arrows: 'none' | 'withDialog' | 'always';
	evalBar: boolean;
	autoNext: boolean;
	sound: boolean;
	confetti: boolean;
	haptics: boolean;
	textSize: 'default' | 'large' | 'xl';
	theme: BoardTheme;
	pieces: PieceSet;
}

export interface CoursePreferences {
	fastOpponent: boolean;
	skipSharedStart: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
	coaching: 'default',
	arrows: 'withDialog',
	evalBar: true,
	autoNext: true,
	sound: true,
	confetti: true,
	haptics: true,
	textSize: 'default',
	theme: 'default',
	pieces: 'cburnett'
};

export const DEFAULT_COURSE_PREFERENCES: CoursePreferences = {
	fastOpponent: true,
	skipSharedStart: false
};

export type ReviewPerspective = 'w' | 'b' | 'both';
export type ReviewOverlays = 'none' | 'played' | 'best' | 'both';

export interface ReviewPreferences {
	perspective: ReviewPerspective;
	overlays: ReviewOverlays;
	autoplay: boolean;
	voice: boolean;
	coach: boolean;
	glyphs: boolean;
}

export const DEFAULT_REVIEW_PREFERENCES: ReviewPreferences = {
	perspective: 'both',
	overlays: 'both',
	autoplay: true,
	voice: false,
	coach: true,
	glyphs: true
};

export const REVIEW_PREFERENCES_KEY = 'review-preferences';
