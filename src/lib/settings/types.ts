export type SettingsMode = 'learn' | 'practice' | 'drill' | 'time' | 'puzzles' | 'arena';
export type BoardTheme = 'default' | 'green' | 'brown' | 'blue' | 'dark-blue';
export type PieceSet = 'default' | 'geometric' | 'outline';
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
export interface CoursePreferences { fastOpponent: boolean; skipSharedStart: boolean }
export const DEFAULT_PREFERENCES: Preferences = { coaching: 'default', arrows: 'withDialog', evalBar: true, autoNext: true, sound: true, confetti: true, haptics: true, textSize: 'default', theme: 'default', pieces: 'default' };
export const DEFAULT_COURSE_PREFERENCES: CoursePreferences = { fastOpponent: true, skipSharedStart: false };
