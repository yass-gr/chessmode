import type { PosKey, Uci } from '#lib/chess/types.ts';

export interface MoveCount {
	uci: Uci;
	count: number;
}

/** What Lichess players chose at each course position, split by the rating band of the player to move. */
export interface Explorer {
	games: number;
	month: string;
	bands: number[];
	nodes: Map<PosKey, Map<number, MoveCount[]>>;
}

interface ExplorerFile {
	games: number;
	month: string;
	bands: number[];
	nodes: Record<string, Record<string, [string, number][]>>;
}

export function parseExplorer(json: unknown): Explorer {
	const file = json as ExplorerFile;
	if (!file || typeof file.games !== 'number' || !Array.isArray(file.bands) || typeof file.nodes !== 'object')
		throw new Error('Not an explorer file');
	const nodes = new Map<PosKey, Map<number, MoveCount[]>>();
	for (const [key, bands] of Object.entries(file.nodes)) {
		const byBand = new Map<number, MoveCount[]>();
		for (const [band, moves] of Object.entries(bands))
			byBand.set(Number(band), moves.map(([uci, count]) => ({ uci: uci as Uci, count })));
		nodes.set(key as PosKey, byBand);
	}
	return { games: file.games, month: file.month, bands: file.bands, nodes };
}

/** Replies at a position, from the given bands or all of them, merged and sorted by count. */
export function repliesAt(explorer: Explorer, key: PosKey, bands?: number[]): MoveCount[] {
	const node = explorer.nodes.get(key);
	if (!node) return [];
	const merged = new Map<Uci, number>();
	for (const [band, moves] of node) {
		if (bands && !bands.includes(band)) continue;
		for (const m of moves) merged.set(m.uci, (merged.get(m.uci) ?? 0) + m.count);
	}
	return [...merged].map(([uci, count]) => ({ uci, count })).sort((a, b) => b.count - a.count);
}

const cache = new Map<string, Promise<Explorer | undefined>>();

export function loadExplorer(courseId: string): Promise<Explorer | undefined> {
	let pending = cache.get(courseId);
	if (!pending) {
		pending = fetch(`/data/explorer/${courseId}.json`)
			.then((r) => (r.ok ? r.json() : undefined))
			.then((json) => (json ? parseExplorer(json) : undefined))
			.catch(() => undefined);
		cache.set(courseId, pending);
	}
	return pending;
}
