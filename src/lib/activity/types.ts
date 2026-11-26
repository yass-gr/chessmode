/** How many finished reps paint one day of the year heatmap. */
export type HeatBand = 0 | 1 | 2 | 3 | 4;

export interface HeatDay {
	/** Local calendar day, `YYYY-MM-DD`. */
	day: string;
	reps: number;
	band: HeatBand;
}

/** A session row the heatmap can count. `reps` wins when the caller stored an explicit count. */
export interface RepSession {
	day: string;
	mode: string;
	lines: number;
	reps?: number;
	metric?: string;
}

export interface CourseLines {
	id: string;
	name: string;
	side: 'w' | 'b';
	lineKeys: readonly string[];
}

export interface ProgressRow {
	key: string;
	courseId: string;
	clean?: boolean;
}

export interface CourseActivity {
	id: string;
	name: string;
	side: 'w' | 'b';
	total: number;
	discovered: number;
	perfected: number;
	/** Every line in a non-empty course has been perfected. */
	perfectedCourse: boolean;
}

export interface ProfileActivity {
	discovered: number;
	perfectedLines: number;
	openingsPerfected: number;
	courses: CourseActivity[];
}

export interface ScoreSession {
	at: number;
	day: string;
	mode: string;
	courseId?: string;
	score?: number;
	metric?: string;
}

export type ScoreMetric = 'lines' | 'moves';

/** Best score inside each local window. `null` means that window has no attempt. */
export interface RecordLine {
	mode: 'drill' | 'time';
	courseId: string;
	metric: ScoreMetric;
	day: number | null;
	week: number | null;
	month: number | null;
	all: number | null;
}
