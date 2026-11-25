import type { Color, PosKey, Ply } from '#lib/chess/types.ts';

/** The JSON shape on disk (see scripts/course-format.md). Parsed once by `parseCourse`. */
export interface CourseFile {
	id: string;
	name: string;
	side: Color;
	level: string;
	tagline: string;
	description: string;
	chapters: {
		id: string;
		name: string;
		moves?: string;
		intro: string;
		lines: { id: string; name: string; pgn: string }[];
		quiz?: { pgn: string; question: string; options: string[]; answer: number; explanation: string }[];
	}[];
}

export type CourseId = string & { readonly __brand: 'CourseId' };
/** `<courseId>/<lineId>`: unique across all courses, used as the SRS card key. */
export type LineKey = string & { readonly __brand: 'LineKey' };

export interface CoursePly extends Ply {
	/** True when the student's side plays this move. */
	student: boolean;
	note?: string;
}

export interface Line {
	key: LineKey;
	id: string;
	name: string;
	chapterId: string;
	plies: CoursePly[];
}

export interface Quiz {
	plies: Ply[];
	question: string;
	options: string[];
	answer: number;
	explanation: string;
}

export interface Chapter {
	id: string;
	name: string;
	moves?: string;
	intro: string;
	lines: Line[];
	quiz: Quiz[];
}

/** Every position the course reaches, keyed by PosKey so transpositions merge. */
export interface RepertoireNode {
	/** The student's move here, when it is the student's turn. */
	student?: CoursePly;
	/** Opponent replies the course prepares for, when it is the opponent's turn. */
	replies: CoursePly[];
	/** Lines that pass through this position, in course order. */
	lines: LineKey[];
}

export interface Course {
	id: CourseId;
	name: string;
	side: Color;
	level: string;
	tagline: string;
	description: string;
	chapters: Chapter[];
	/** Flat, in course order. */
	lines: Line[];
	repertoire: Map<PosKey, RepertoireNode>;
}
