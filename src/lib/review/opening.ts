import { START_FEN, type Color, type Fen, type Ply, type San } from '#lib/chess/types.ts';
import type { Course } from '#lib/courses/types.ts';
import { explorerHref } from '#lib/explorer/browse.ts';
import { findDeviation, type Deviation } from '#lib/review/repertoire.ts';

/** One imported game, already parsed, ready to match against the local courses. */
export interface OpeningGame {
	id: string;
	plies: Ply[];
	userColor?: Color;
	/** Set when the stored PGN could not be parsed. The game stays in the list. */
	unreadable?: boolean;
}

export interface OpeningMatch {
	gameId: string;
	userColor?: Color;
	status: 'matched';
	courseId: string;
	courseName: string;
	side: Color;
	kind: Deviation['kind'];
	ply: number;
	fen: Fen;
	playedSan?: San;
	expectedSan?: San;
	line: string;
	reviewHref: string;
	positionHref: string;
	explorerHref: string;
}

export interface OpeningMiss {
	gameId: string;
	userColor?: Color;
	status: 'unmatched';
	reason: 'unmatched' | 'unreadable';
	reviewHref: string;
}

export type OpeningRow = OpeningMatch | OpeningMiss;

export interface OpeningFilter {
	courseId?: string;
	side?: Color;
}

function fenOf(game: OpeningGame, found: Deviation): Fen {
	if (found.kind === 'complete') return game.plies[found.ply]?.fenAfter ?? START_FEN;
	return found.played.fenBefore;
}

/** Matches every game. A game that never enters a course stays in the list as unmatched. */
export function reviewOpenings(games: readonly OpeningGame[], courses: readonly Course[], started?: ReadonlySet<string>): OpeningRow[] {
	return games.map((game) => {
		const reviewHref = `/review/${game.id}`;
		if (game.unreadable) return { gameId: game.id, userColor: game.userColor, status: 'unmatched', reason: 'unreadable', reviewHref };
		const found = game.plies.length ? findDeviation([...courses], game.plies, game.userColor, started) : undefined;
		if (!found) return { gameId: game.id, userColor: game.userColor, status: 'unmatched', reason: 'unmatched', reviewHref };
		const fen = fenOf(game, found);
		return {
			gameId: game.id,
			userColor: game.userColor,
			status: 'matched',
			courseId: found.course.id,
			courseName: found.course.name,
			side: found.course.side,
			kind: found.kind,
			ply: found.ply,
			fen,
			playedSan: found.kind === 'complete' ? undefined : found.played.san,
			expectedSan: found.kind === 'you' ? found.expected.san : undefined,
			line: found.line,
			reviewHref,
			positionHref: `/analysis?fen=${encodeURIComponent(fen)}`,
			explorerHref: explorerHref({ fen, courseId: found.course.id })
		};
	});
}

export function trainHref(row: OpeningMatch, learned: boolean): string {
	if (learned) return `/practice/run?line=${encodeURIComponent(row.line)}`;
	const id = row.line.split('/').slice(1).join('/');
	return `/learn/${row.courseId}/${id}`;
}

/**
 * Course and side narrow the matched rows. Unmatched games stay visible: a course filter
 * does not mean those games belonged to another course, and an unknown side is not hidden.
 */
export function selectOpenings(rows: readonly OpeningRow[], filter: OpeningFilter = {}): { matched: OpeningMatch[]; unmatched: OpeningMiss[] } {
	const matched: OpeningMatch[] = [];
	const unmatched: OpeningMiss[] = [];
	for (const row of rows) {
		if (row.status === 'unmatched') {
			if (!filter.side || row.userColor === undefined || row.userColor === filter.side) unmatched.push(row);
			continue;
		}
		if (filter.courseId && row.courseId !== filter.courseId) continue;
		if (filter.side && row.side !== filter.side) continue;
		matched.push(row);
	}
	return { matched, unmatched };
}
