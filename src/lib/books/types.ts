import type { Fen, San } from '#lib/chess/types.ts';

export interface StudyLine {
	fen: Fen;
	sans: San[];
	caption: string;
	orientation: 'white' | 'black';
}

export interface StudyTry {
	fen: Fen;
	caption: string;
	orientation: 'white' | 'black';
}

export interface StudySection {
	id: string;
	title: string;
	paragraphs: string[];
	line?: StudyLine;
	try?: StudyTry;
}

export interface StudyBook {
	id: string;
	title: string;
	author: string;
	summary: string;
	sections: StudySection[];
}
