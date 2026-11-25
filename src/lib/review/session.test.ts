import { describe, expect, it } from 'vitest';
import { START_FEN, type Fen, type San, type Uci } from '#lib/chess/types.ts';
import type { MoveReview } from '#lib/review/types.ts';
import { decisionTransition, evaluateRetry, legalRetryMove, lineMoves, type DecisionSession } from './session.ts';

const uci = (value: string) => value as Uci;
const move: MoveReview = {
	ply: 1, color: 'w', san: 'e4' as San, uci: uci('e2e4'), fenBefore: START_FEN,
	fenAfter: lineMoves(START_FEN, [uci('e2e4')])[0].fen, classification: 'mistake', loss: .1,
	winBefore: 50, winAfter: 40, accuracy: 80, best: { uci: uci('d2d4'), san: 'd4' as San, pv: [uci('d2d4')], score: { cp: 20 } },
	scoreAfter: { cp: 0 }, explanation: { headline: 'Move' },
	alternatives: [{ pv: [uci('e2e4')], score: { cp: 19 }, depth: 12 }]
};

describe('decision session', () => {
	it('shares a branch cursor and invalidates stale playback on selection and exit', () => {
		let state: DecisionSession = { kind: 'mainline', ply: 4, generation: 0 };
		state = decisionTransition(state, { type: 'branch', baseFen: START_FEN, line: lineMoves(START_FEN, [uci('e2e4'), uci('e7e5')]) });
		const token = state.generation;
		state = decisionTransition(state, { type: 'tick', generation: token });
		expect(state).toMatchObject({ kind: 'branch', step: 1, ply: 4 });
		state = decisionTransition(state, { type: 'step', step: 0 });
		expect(decisionTransition(state, { type: 'tick', generation: token })).toEqual(state);
		state = decisionTransition(state, { type: 'exit' });
		expect(state).toMatchObject({ kind: 'mainline', ply: 4 });
		expect(decisionTransition(state, { type: 'tick', generation: token })).toEqual(state);
	});
	it('rewinds before enabling input, cycles hints and ignores late answers', async () => {
		let state: DecisionSession = { kind: 'mainline', ply: 1, generation: 0 };
		state = decisionTransition(state, { type: 'retry', move });
		expect(decisionTransition(state, { type: 'submit', uci: uci('e2e4') })).toEqual(state);
		state = decisionTransition(state, { type: 'rewound', generation: state.generation });
		for (const hint of ['origin', 'arrow', 'clear']) {
			state = decisionTransition(state, { type: 'hint' });
			expect(state).toMatchObject({ hint });
		}
		state = decisionTransition(state, { type: 'submit', uci: uci('e2e4') });
		const token = state.generation;
		const feedback = await evaluateRetry(move, uci('e2e4'), new AbortController().signal);
		expect(feedback).toMatchObject({ accepted: true, score: { cp: 19 } });
		state = decisionTransition(state, { type: 'select', ply: 3 });
		expect(decisionTransition(state, { type: 'checked', generation: token, uci: uci('e2e4'), feedback })).toEqual(state);
	});
	it('requires a legal promotion piece', () => {
		const promotion = { ...move, fenBefore: '7k/P7/8/8/8/8/8/7K w - - 0 1' as Fen };
		expect(legalRetryMove(promotion, uci('a7a8'))).toBe(false);
		expect(legalRetryMove(promotion, uci('a7a8n'))).toBe(true);
	});
});
