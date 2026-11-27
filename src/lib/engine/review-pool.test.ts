import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Fen } from '#lib/chess/types.ts';

const factory = vi.hoisted(() => vi.fn());
vi.mock('#lib/engine/stockfish.ts', () => ({ createReviewEngine: factory }));
import { ReviewPool, reviewWorkerCount } from '#lib/engine/review-pool.ts';

const fen = 'test' as Fen;
const result = { fen, depth: 1, lines: [] };

describe('review pool', () => {
	beforeEach(() => factory.mockReset());

	it('limits mobile and low-memory devices to two workers', () => {
		vi.stubGlobal('navigator', { hardwareConcurrency: 8, deviceMemory: 4, userAgent: 'Desktop' });
		expect(reviewWorkerCount()).toBe(2);
		vi.stubGlobal('navigator', { hardwareConcurrency: 8, userAgent: 'Android' });
		expect(reviewWorkerCount()).toBe(2);
		vi.unstubAllGlobals();
	});

	it('retries a failed search on a replacement worker', async () => {
		const first = { analyse: vi.fn().mockRejectedValue(new Error('crashed')), dispose: vi.fn() };
		const second = { analyse: vi.fn().mockResolvedValue(result), dispose: vi.fn() };
		factory.mockReturnValueOnce(first).mockReturnValueOnce(second);
		const pool = new ReviewPool(1);
		await expect(pool.analyse(fen, 0, 16, 300_000)).resolves.toEqual(result);
		expect(first.dispose).toHaveBeenCalledOnce();
		pool.dispose();
		expect(second.dispose).toHaveBeenCalledOnce();
	});

	it('does not restart queued work after disposal', async () => {
		let fail: (reason: Error) => void = () => {};
		const engine = { analyse: vi.fn(() => new Promise((_, reject) => { fail = reject; })), dispose: vi.fn() };
		factory.mockReturnValue(engine);
		const pool = new ReviewPool(1);
		const first = pool.analyse(fen, 0, 16, 300_000);
		const second = pool.analyse(fen, 1, 16, 300_000);
		await Promise.resolve();
		pool.dispose();
		fail(new Error('closed'));
		await expect(first).rejects.toThrow('closed');
		await expect(second).rejects.toThrow('Review pool was closed.');
		expect(factory).toHaveBeenCalledOnce();
	});
});
