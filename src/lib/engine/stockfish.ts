import { Chess } from 'chess.js';
import { turnOf, type Color, type Fen, type Uci } from '#lib/chess/types.ts';
import type { EngineLine, PositionAnalysis } from '#lib/review/types.ts';
import type { AnalyseOptions, Engine } from '#lib/engine/types.ts';

/** UCI `go` line. Movetime is a ceiling beside depth, so a weak bot can stop early. */
export function goCommand(depth: number, movetime?: number): string {
	const time = movetime && movetime > 0 ? ` movetime ${Math.round(movetime)}` : '';
	return `go depth ${depth}${time}`;
}

export function parseInfo(message: string, turn: Color): { index: number; line: EngineLine } | undefined {
	const depth = message.match(/^info depth (\d+)\b/);
	const score = message.match(/\bscore (cp|mate) (-?\d+)(?=\s|$)/);
	const pv = message.match(/\bpv ((?:[a-h][1-8][a-h][1-8][qrbn]?(?:\s|$))+)/);
	if (!depth || !score || !pv || /\b(?:lowerbound|upperbound)\b/.test(message)) return;
	const value = Number(score[2]) * (turn === 'w' ? 1 : -1);
	return {
		index: Number(message.match(/\bmultipv (\d+)\b/)?.[1] ?? 1),
		line: {
			depth: Number(depth[1]),
			score: score[1] === 'cp' ? { cp: value } : { mate: value },
			pv: pv[1].trim().split(/\s+/) as Uci[]
		}
	};
}

class Stockfish implements Engine {
	private worker: Worker;
	private listeners = new Set<(line: string) => void>();
	private failure = new AbortController();
	private initialised: Promise<void>;
	private queue = Promise.resolve();

	constructor() {
		const threaded = globalThis.crossOriginIsolated && typeof SharedArrayBuffer !== 'undefined';
		const build = threaded ? 'stockfish-19-lite' : 'stockfish-19-lite-single';
		this.worker = new Worker('/stockfish/' + build + '.js');
		this.worker.onmessage = ({ data }) => {
			if (typeof data !== 'string') return;
			for (const line of data.split(/\r?\n/)) {
				for (const listener of this.listeners) listener(line.trim());
			}
		};
		this.worker.onerror = () => this.close(new Error('Stockfish could not run on this device.'));
		this.initialised = this.initialise(threaded).catch((error: unknown) => {
			this.close(error);
			throw error;
		});
		void this.initialised.catch(() => {});
	}

	private async initialise(threaded: boolean) {
		const timeout = setTimeout(() => this.close(new Error('Stockfish took too long to start.')), 20_000);
		try {
			await this.collect(['uci'], line => line === 'uciok');
			const options = threaded
				? ['setoption name Threads value ' + Math.max(1, Math.min(4, navigator.hardwareConcurrency - 1))]
				: [];
			await this.collect([...options, 'isready'], line => line === 'readyok');
		} finally {
			clearTimeout(timeout);
		}
	}

	private collect(commands: string[], done: (line: string) => boolean): Promise<void> {
		const signal = this.failure.signal;
		return new Promise((resolve, reject) => {
			signal.throwIfAborted();
			const cleanup = () => {
				this.listeners.delete(receive);
				signal.removeEventListener('abort', fail);
			};
			const fail = () => {
				cleanup();
				reject(signal.reason);
			};
			const receive = (line: string) => {
				try {
					if (!done(line)) return;
					cleanup();
					resolve();
				} catch (error) {
					cleanup();
					this.close(error);
					reject(error);
				}
			};
			signal.addEventListener('abort', fail, { once: true });
			this.listeners.add(receive);
			for (const command of commands) this.worker.postMessage(command);
		});
	}

	async ready() {
		await this.initialised;
		this.failure.signal.throwIfAborted();
	}

	analyse(fen: Fen, opts: AnalyseOptions, onUpdate?: (a: PositionAnalysis) => void) {
		const { signal } = opts;
		return new Promise<PositionAnalysis>((resolve, reject) => {
			signal?.throwIfAborted();
			const abort = () => reject(signal?.reason);
			signal?.addEventListener('abort', abort, { once: true });
			const job = this.queue.then(async () => {
				signal?.throwIfAborted();
				await this.ready();
				signal?.throwIfAborted();
				return this.search(fen, opts, onUpdate);
			});
			this.queue = job.then(() => {}, () => {});
			void job.then(resolve, reject).finally(() => signal?.removeEventListener('abort', abort));
		});
	}

	private async search(fen: Fen, opts: AnalyseOptions, onUpdate?: (a: PositionAnalysis) => void) {
		const { signal, depth, searchMoves } = opts;
		const requestedLines = opts.multiPv ?? 1;
		const multiPv = requestedLines > 1
			? Math.max(1, Math.min(requestedLines, searchMoves?.length || new Chess(fen).moves().length))
			: 1;
		const turn = turnOf(fen);
		const linesByDepth = new Map<number, EngineLine[]>();
		let result: PositionAnalysis = { fen, depth: 0, lines: [] };
		const restriction = searchMoves?.length ? ' searchmoves ' + searchMoves.join(' ') : '';
		const stop = () => this.worker.postMessage('stop');
		signal?.addEventListener('abort', stop, { once: true });
		try {
			await this.collect([
				'setoption name MultiPV value ' + multiPv,
				'position fen ' + fen,
				goCommand(depth, opts.movetime) + restriction
			], message => {
				if (message.startsWith('bestmove ')) {
					const bestMove = message.split(' ')[1];
					// A forced move or an early mate can end before a full MultiPV update.
					for (const [lineDepth, lines] of linesByDepth) {
						if (lineDepth <= result.depth || lines[0]?.pv[0] !== bestMove) continue;
						result = { fen, depth: lineDepth, lines: lines.filter(Boolean) };
					}
					return true;
				}
				if (signal?.aborted) return false;
				const info = parseInfo(message, turn);
				if (!info) return false;
				const lines = linesByDepth.get(info.line.depth) ?? [];
				lines[info.index - 1] = info.line;
				linesByDepth.set(info.line.depth, lines);
				if (info.line.depth > result.depth && Array.from(lines).filter(Boolean).length === multiPv) {
					result = { fen, depth: info.line.depth, lines: [...lines] };
					onUpdate?.(result);
				}
				return false;
			});
			signal?.throwIfAborted();
			return result;
		} finally {
			signal?.removeEventListener('abort', stop);
		}
	}

	private close(reason: unknown) {
		this.failure.abort(reason);
		this.worker.terminate();
		if (shared === this) shared = undefined;
	}

	dispose() {
		this.close(new DOMException('Stockfish was closed.', 'AbortError'));
	}
}

let shared: Engine | undefined;
export function getEngine(): Engine {
	return shared ??= new Stockfish();
}
