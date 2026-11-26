import { describe, expect, it } from 'vitest';
import type { Card } from 'ts-fsrs';
import type { UserArchive } from '#lib/archive/types.ts';
import { parseArchive, serializeArchive } from '#lib/archive/archive.ts';

function card(): Card {
	return {
		due: new Date('2026-02-01T15:00:00.000Z'),
		stability: 2.5,
		difficulty: 4,
		scheduled_days: 3,
		learning_steps: 0,
		reps: 2,
		lapses: 0,
		state: 2,
		last_review: new Date('2026-01-28T15:00:00.000Z')
	};
}

function sample(): UserArchive {
	return {
		version: 1,
		exportedAt: 1_700_000_000_000,
		progress: [
			{
				key: 'italian/main' as UserArchive['progress'][number]['key'],
				courseId: 'italian',
				card: card(),
				learnedAt: 1_700_000_000_000,
				reviews: 3,
				lapses: 1,
				clean: true
			}
		],
		sessions: [
			{
				id: 4,
				at: 1_700_000_000_000,
				day: '2026-11-26',
				mode: 'time',
				courseId: 'italian',
				lines: 40,
				mistakes: 1,
				score: 40,
				scoreVersion: 'moves',
				reps: 1,
				xp: 8
			}
		],
		games: [
			{
				id: 'game-1',
				source: 'pgn',
				white: { name: 'You' },
				black: { name: 'Them' },
				result: '1-0',
				playedAt: 1_700_000_000_000,
				pgn: '1. e4 e5',
				importedAt: 1_700_000_000_000
			}
		],
		reviews: [{ key: 'game-1:12:v2', gameId: 'game-1', depth: 12, moves: [], white: { accuracy: 80 }, black: { accuracy: 70 } } as unknown as UserArchive['reviews'][number]],
		settings: [{ key: 'onboarding', value: { status: 'completed' } }],
		ratings: [
			{
				key: 'puzzle/italian',
				kind: 'puzzle',
				courseId: 'italian',
				rating: 1050,
				games: 0,
				wins: 0,
				draws: 0,
				losses: 0,
				history: [],
				seen: []
			}
		],
		customCourses: [
			{
				id: 'custom-1',
				createdAt: 1_700_000_000_000,
				file: {
					id: 'custom-1',
					name: 'Mine',
					side: 'w',
					level: 'Club',
					tagline: 'Own lines',
					description: 'A private repertoire',
					chapters: []
				}
			}
		]
	};
}

describe('parseArchive', () => {
	it('round-trips a backup, including card dates', () => {
		const parsed = parseArchive(serializeArchive(sample()));
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.archive.progress[0]?.card.due).toEqual(new Date('2026-02-01T15:00:00.000Z'));
		expect(parsed.archive.progress[0]?.card.last_review).toEqual(new Date('2026-01-28T15:00:00.000Z'));
		expect(JSON.parse(serializeArchive(parsed.archive))).toEqual(JSON.parse(serializeArchive(sample())));
	});

	it('rejects a file that is not this backup version', () => {
		const notJson = parseArchive('not json');
		const newer = parseArchive('{"version":2,"exportedAt":1}');
		const shapeless = parseArchive('{"exportedAt":1}');
		expect(notJson.ok).toBe(false);
		expect(newer.ok).toBe(false);
		expect(shapeless.ok).toBe(false);
		if (!notJson.ok) expect(notJson.error).toMatch(/not a Chessmode backup/);
		if (!newer.ok) expect(newer.error).toMatch(/not supported/);
		if (!shapeless.ok) expect(shapeless.error).toMatch(/not a Chessmode backup/);
	});

	it('rejects an incomplete or repeated row and leaves the caller to keep current data', () => {
		const archive = sample();
		const broken = { ...archive, progress: [{ ...archive.progress[0], card: { due: 'yesterday' } }] };
		expect(parseArchive(JSON.stringify(broken)).ok).toBe(false);
		const duplicated = { ...archive, settings: [...archive.settings, archive.settings[0]] };
		const parsed = parseArchive(JSON.stringify(duplicated));
		expect(parsed.ok).toBe(false);
		if (!parsed.ok) expect(parsed.error).toMatch(/setting/);
	});
});
