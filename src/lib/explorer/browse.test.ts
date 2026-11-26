import { describe, expect, it } from 'vitest';
import { posKey, START_FEN, type Fen, type Uci } from '#lib/chess/types.ts';
import { parseExplorer, type Explorer } from '#lib/explorer/types.ts';
import {
	SPARSE_BELOW,
	explorerHref,
	lichessExplorerUrl,
	localSample,
	parseLichessExplorer,
	playExplorer,
	replayExplorer,
	viewPosition
} from '#lib/explorer/browse.ts';

const explorer = (nodes: Record<string, Record<string, [string, number][]>>): Explorer =>
	parseExplorer({ games: 1000, month: '2026-10', bands: [800, 1600], nodes });

const start = explorer({
	[posKey(START_FEN)]: { '1600': [['e2e4', 70], ['d2d4', 30]], '800': [['e2e4', 3]] }
});

describe('viewPosition', () => {
	it('sorts measured replies and marks a legal move missing from a complete sample as zero', () => {
		const view = viewPosition(START_FEN, localSample([start], START_FEN, 1600));
		expect(view.kind).toBe('known');
		expect(view.games).toBe(100);
		expect(view.replies[0]).toMatchObject({ san: 'e4', count: 70, zero: false });
		const zero = view.replies.find((reply) => reply.san === 'a3');
		expect(zero).toMatchObject({ count: 0, zero: true, share: 0 });
	});

	it('keeps an empty rating band distinct from a missing position', () => {
		expect(viewPosition(START_FEN, localSample([start], START_FEN, 1400)).kind).toBe('empty-band');
		expect(viewPosition(START_FEN, localSample([start], START_FEN, 1400)).replies[0].zero).toBe(false);
		expect(viewPosition(START_FEN, undefined).kind).toBe('unavailable');
	});

	it('flags a thin sample without calling it unavailable', () => {
		const view = viewPosition(START_FEN, localSample([start], START_FEN, 800));
		expect(view.kind).toBe('sparse');
		expect(view.games).toBeLessThan(SPARSE_BELOW);
		expect(view.replies.find((reply) => reply.san === 'e4')?.count).toBe(3);
	});

	it('does not treat a truncated online tail as zeros', () => {
		const sample = parseLichessExplorer({
			white: 10,
			draws: 0,
			black: 0,
			moves: [{ uci: 'e2e4', san: 'e4', white: 6, draws: 0, black: 0 }]
		});
		const view = viewPosition(START_FEN, sample);
		expect(view.kind).toBe('sparse');
		expect(view.replies.find((reply) => reply.san === 'e4')).toMatchObject({ count: 6, zero: false });
		expect(view.replies.find((reply) => reply.san === 'd4')).toMatchObject({ count: null, zero: false });
	});

	it('uses the first file that contains the position', () => {
		const other = explorer({ [posKey(START_FEN)]: { '1600': [['e2e4', 1]] } });
		expect(localSample([start, other], START_FEN, 1600)?.moves[0].count).toBe(70);
	});
});

describe('explorer history and links', () => {
	it('plays a move and drops moves that were ahead of the cursor', () => {
		const played = playExplorer(replayExplorer(START_FEN, ['e2e4', 'c7c5'] as Uci[]), 0, 'd2d4' as Uci);
		expect(played.map((step) => step.san)).toEqual([undefined, 'd4']);
	});

	it('stops a shared line at the first illegal move', () => {
		const steps = replayExplorer(START_FEN, ['e2e4', 'e2e4'] as Uci[]);
		expect(steps).toHaveLength(2);
		expect(steps[1].san).toBe('e4');
	});

	it('round-trips a course position into a shareable explorer link', () => {
		const href = explorerHref({ courseId: 'caro-kann', band: 1600, moves: ['e2e4', 'c7c6'] as Uci[] });
		expect(href).toBe('/explorer?course=caro-kann&band=1600&moves=e2e4%2Cc7c6');
		expect(lichessExplorerUrl(START_FEN, 800)).toContain('ratings=0');
		expect(lichessExplorerUrl(START_FEN, 'all')).not.toContain('ratings=');
	});
});
