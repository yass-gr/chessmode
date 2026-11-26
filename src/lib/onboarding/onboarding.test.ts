import { describe, expect, it } from 'vitest';
import {
	arenaSeed,
	courseBand,
	isReady,
	parseOnboarding,
	puzzleSeed,
	recommendCourse,
	resumeStep,
	seedRecords
} from '#lib/onboarding/onboarding.ts';
import type { CourseBrief, RatingBracketId } from '#lib/onboarding/types.ts';

const briefs: CourseBrief[] = [
	{ id: 'sicilian-najdorf', side: 'b', band: 'advanced' },
	{ id: 'ruy-lopez', side: 'w', band: 'club' },
	{ id: 'italian-game', side: 'w', band: 'beginner' },
	{ id: 'caro-kann', side: 'b', band: 'beginner' },
	{ id: 'kings-indian', side: 'b', band: 'club' }
];

describe('rating seeds', () => {
	it('maps the observed brackets and leaves unknown on the fallback', () => {
		const puzzle: Record<RatingBracketId, number> = {
			unknown: 950,
			'under-400': 950,
			'400-800': 1050,
			'800-1200': 1150,
			'1200-1600': 1250,
			'1600-2000': 1350,
			'2000-plus': 1350
		};
		const arena: Record<RatingBracketId, number> = {
			unknown: 950,
			'under-400': 750,
			'400-800': 1000,
			'800-1200': 1200,
			'1200-1600': 1400,
			'1600-2000': 1550,
			'2000-plus': 1700
		};
		for (const id of Object.keys(puzzle) as RatingBracketId[]) {
			expect(puzzleSeed(id)).toBe(puzzle[id]);
			expect(arenaSeed(id)).toBe(arena[id]);
		}
	});

	it('writes a seed only when that course has no rating yet', () => {
		const rows = seedRecords('400-800', ['italian', 'caro'], ['puzzle/caro']);
		expect(rows.map((row) => [row.key, row.rating])).toEqual([
			['arena/italian', 1000],
			['puzzle/italian', 1050],
			['arena/caro', 1000]
		]);
		expect(rows.every((row) => row.games === 0)).toBe(true);
	});
});

describe('recommendCourse', () => {
	it('picks a beginner course for a new player and a sharper one when asked', () => {
		expect(courseBand('Beginner to club')).toBe('beginner');
		expect(courseBand('Club (800–2000)')).toBe('club');
		expect(courseBand('Club (1200–2000)')).toBe('advanced');
		expect(recommendCourse({ bracket: 'under-400', goals: ['first-opening'], side: 'w' }, briefs)).toBe('italian-game');
		expect(recommendCourse({ bracket: 'under-400', goals: ['first-opening'], side: 'b' }, briefs)).toBe('caro-kann');
		expect(recommendCourse({ bracket: '2000-plus', goals: ['first-opening'], side: 'w' }, briefs)).toBe('ruy-lopez');
		expect(recommendCourse({ bracket: '1200-1600', goals: ['sharpness'], side: 'either' }, briefs)).toBe('sicilian-najdorf');
		expect(recommendCourse({ bracket: 'unknown', goals: ['repertoire'], side: 'either' }, briefs)).toBe('italian-game');
	});
});

describe('parseOnboarding', () => {
	it('keeps a finished profile and drops unknown choices', () => {
		const profile = parseOnboarding({
			status: 'completed',
			bracket: '400-800',
			goals: ['sharpness', 'nope', 'sharpness'],
			motivation: 'games',
			side: 'b',
			updatedAt: 10
		});
		expect(profile).toEqual({
			status: 'completed',
			bracket: '400-800',
			goals: ['sharpness'],
			motivation: 'games',
			side: 'b',
			updatedAt: 10
		});
		expect(isReady(profile)).toBe(true);
		expect(resumeStep(profile)).toBe('course');
		expect(parseOnboarding(null).status).toBe('pending');
		expect(resumeStep(parseOnboarding({ bracket: 'unknown', goals: ['games'] }))).toBe('goal');
	});
});
