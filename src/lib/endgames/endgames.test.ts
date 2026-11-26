import { describe, expect, it } from 'vitest';
import catalog from '../../../static/data/endgames.json';
import type { Fen, Uci } from '#lib/chess/types.ts';
import { elo } from '#lib/ratings.ts';
import {
	coachingFor,
	freshProgress,
	place,
	recordEndgame,
	resultScore,
	serveTier
} from '#lib/endgames/progress.ts';
import { hint, keepTrying, opponentMove, playerMove, playAnyway, resign, showMove, startEndgame } from '#lib/endgames/play.ts';
import { parseEndgames, pickPosition } from '#lib/endgames/select.ts';
import type { EndgamePosition } from '#lib/endgames/types.ts';

const mate: EndgamePosition = {
	id: 'mate',
	fen: '7k/8/6KQ/8/8/8/8/8 w - - 0 1' as Fen,
	player: 'w',
	rating: 900,
	themes: ['mate'],
	idea: 'h6g7' as Uci
};

describe('serveTier', () => {
	it('starts coached and promotes at 1200', () => {
		expect(serveTier({ tier: 'beginner', mix: 0 }, 800, 0)).toMatchObject({ tier: 'beginner', served: 'beginner', mix: 0 });
		expect(serveTier({ tier: 'beginner', mix: 0.4 }, 1200, 3)).toEqual({ tier: 'lineage', mix: 0, served: 'lineage' });
	});

	it('demotes an uncoached player under 850 only after a game', () => {
		expect(serveTier({ tier: 'lineage', mix: 0 }, 800, 0).tier).toBe('lineage');
		expect(serveTier({ tier: 'lineage', mix: 0 }, 849, 1)).toMatchObject({ tier: 'beginner', served: 'beginner' });
		expect(serveTier({ tier: 'lineage', mix: 0 }, 850, 4).served).toBe('lineage');
	});

	it('spends the mix meter on one uncoached position between 1000 and 1200', () => {
		const first = serveTier({ tier: 'beginner', mix: 0 }, 1100, 2);
		expect(first).toMatchObject({ tier: 'beginner', served: 'beginner', mix: 0.5 });
		expect(serveTier(first, 1100, 2)).toMatchObject({ tier: 'beginner', served: 'lineage', mix: 0 });
	});

	it('places a bracket under 1200 into coaching and 1200 or more out of it', () => {
		expect(place('800-1200')).toEqual({ rating: 900, tier: 'beginner' });
		expect(place('1200-1600')).toEqual({ rating: 1300, tier: 'lineage' });
		expect(place(null)).toEqual({ rating: 800, tier: 'beginner' });
		expect(place('unknown')).toEqual({ rating: 800, tier: 'beginner' });
	});
});

describe('coaching and records', () => {
	it('leaves the tier alone when the player forces a mode', () => {
		const rated = coachingFor({ ...freshProgress(), mode: 'rated', rating: 800 });
		expect(rated.coached).toBe(false);
		expect(rated.progress.tier).toBe('beginner');
		expect(coachingFor({ ...freshProgress(), mode: 'coached', tier: 'lineage', rating: 1500 }).coached).toBe(true);
	});

	it('scores a clean win above a helped win', () => {
		expect(resultScore('win', false)).toBe(1);
		expect(resultScore('win', true)).toBe(0.5);
		expect(elo(800, 900, resultScore('loss', false))).toBeLessThan(800);
		const saved = recordEndgame(freshProgress(), 820, 'win', 'mate', 10);
		expect(saved).toMatchObject({ rating: 820, games: 1, wins: 1, seen: ['mate'] });
	});
});

describe('endgame play', () => {
	it('mates, ignores a stale session, and resigns', () => {
		let play = startEndgame(mate, 's1', false);
		play = playerMove(play, 'other', 'g7g8');
		expect(play.phase).toBe('player');
		play = playerMove(play, 's1', 'h6g7');
		expect(play).toMatchObject({ phase: 'over', result: 'win', termination: 'checkmate' });
		expect(resign(play).result).toBe('win');
	});

	it('holds a coached miss for keep trying or play anyway', () => {
		let play = startEndgame(mate, 's1', true);
		play = playerMove(play, 's1', 'h6h5', mate.idea);
		expect(play).toMatchObject({ phase: 'considering', coach: 'try-again', fen: mate.fen });
		expect(keepTrying(play).phase).toBe('player');
		play = playAnyway(play);
		expect(play.phase).toBe('opponent');
		expect(play.helped).toBe(true);
		expect(play.plies[0]?.uci).toBe('h6h5');
	});

	it('hints and shows only while it is the player to move', () => {
		let play = startEndgame(mate, 's1', true);
		play = hint(play, mate.idea);
		expect(play).toMatchObject({ coach: 'hint', hintFrom: 'h6', helped: true });
		play = showMove(play, mate.idea);
		expect(play.showUci).toBe('h6g7');
		play = playerMove(play, 's1', 'h6g7', mate.idea);
		expect(play.phase).toBe('over');
		expect(opponentMove(play, 's1', 'h8g8')).toBe(play);
	});
});

describe('pickPosition', () => {
	const pool = [700, 900, 1100, 1400, 2000].map((rating, index) => ({ ...mate, id: `p${index}`, rating }));

	it('ships a small CC0 sample of legal endgames', () => {
		expect(catalog).toMatchObject({ license: 'CC0', source: 'Lichess puzzle database' });
		expect(parseEndgames(catalog)).toHaveLength(48);
	});

	it('parses a catalog and picks near the rating, then repeats once every id has been seen', () => {
		expect(parseEndgames({ positions: pool })).toHaveLength(5);
		expect(pickPosition(pool, 1000, [], () => 0)?.id).toBe('p1');
		expect(pickPosition(pool, 1000, ['p1', 'p2'], () => 0)?.id).toBe('p0');
		expect(pickPosition(pool, 1000, pool.map((position) => position.id), () => 0.99)?.id).toBe('p2');
	});
});
