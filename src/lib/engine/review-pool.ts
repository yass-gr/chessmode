import type { Fen } from '#lib/chess/types.ts';
import { createReviewEngine } from '#lib/engine/stockfish.ts';
import type { Engine } from '#lib/engine/types.ts';
import type { PositionAnalysis } from '#lib/review/types.ts';

export function reviewWorkerCount(): number {
	const memory = 'deviceMemory' in navigator && typeof navigator.deviceMemory === 'number' ? navigator.deviceMemory : undefined;
	if ((memory !== undefined && memory <= 4) || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)) return 2;
	return Math.max(1, Math.min(6, (navigator.hardwareConcurrency || 2) - 1));
}

export class ReviewPool {
	private engines: Engine[];
	private queues: Promise<void>[];
	private closed = false;

	constructor(count = reviewWorkerCount()) {
		this.engines = Array.from({ length: count }, () => createReviewEngine());
		this.queues = this.engines.map(() => Promise.resolve());
	}

	analyse(fen: Fen, index: number, depth: number, nodes: number, signal?: AbortSignal): Promise<PositionAnalysis> {
		const slot = index % this.engines.length;
		const job = this.queues[slot].then(async () => {
			signal?.throwIfAborted();
			if (this.closed) throw new DOMException('Review pool was closed.', 'AbortError');
			try {
				return await this.engines[slot].analyse(fen, { depth, nodes, multiPv: 2, signal });
			} catch (error) {
			signal?.throwIfAborted();
				if (this.closed) throw error;
				this.engines[slot].dispose();
				this.engines[slot] = createReviewEngine();
				return this.engines[slot].analyse(fen, { depth, nodes, multiPv: 2, signal });
			}
		});
		this.queues[slot] = job.then(() => {}, () => {});
		return job;
	}

	dispose() {
		this.closed = true;
		for (const engine of this.engines) engine.dispose();
	}
}
