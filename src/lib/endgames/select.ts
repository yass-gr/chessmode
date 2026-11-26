import { Chess } from 'chess.js';
import type { Fen, Uci } from '#lib/chess/types.ts';
import type { EndgameCatalog, EndgamePosition } from '#lib/endgames/types.ts';

function uci(value: unknown): value is string {
	return typeof value === 'string' && /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(value);
}

export function parseEndgames(json: unknown): EndgamePosition[] {
	const rows = Array.isArray(json) ? json : (json as { positions?: unknown })?.positions;
	if (!Array.isArray(rows)) throw new Error('Not an endgame file');
	return rows.map((row) => {
		if (typeof row?.id !== 'string' || typeof row.fen !== 'string' || !uci(row.idea)) throw new Error('Bad endgame row');
		const chess = new Chess(row.fen);
		if (chess.turn() !== row.player) throw new Error(`Endgame ${row.id} is not the player's move`);
		const legal = chess.moves({ verbose: true }).some((move) => move.from + move.to + (move.promotion ?? '') === row.idea);
		if (!legal) throw new Error(`Endgame ${row.id} idea is illegal`);
		return {
			id: row.id,
			fen: row.fen as Fen,
			player: row.player,
			rating: Number(row.rating),
			themes: Array.isArray(row.themes) ? row.themes.filter((theme: unknown) => typeof theme === 'string') : [],
			idea: row.idea as Uci,
			game: typeof row.game === 'string' ? row.game : undefined
		};
	});
}

export function catalogMeta(json: unknown): Pick<EndgameCatalog, 'source' | 'url' | 'license'> {
	const row = json as { source?: unknown; url?: unknown; license?: unknown };
	return {
		source: typeof row?.source === 'string' ? row.source : 'Lichess puzzle database',
		url: typeof row?.url === 'string' ? row.url : 'https://database.lichess.org/lichess_db_puzzle.csv.zst',
		license: typeof row?.license === 'string' ? row.license : 'CC0'
	};
}

export async function loadEndgames(): Promise<EndgamePosition[]> {
	const res = await fetch('/data/endgames.json');
	if (!res.ok) return [];
	return parseEndgames(await res.json());
}

/** An unseen position near `rating`. The window widens until one fits, then the seen set is reused. */
export function pickPosition(pool: EndgamePosition[], rating: number, seen: readonly string[], random = Math.random): EndgamePosition | undefined {
	const fresh = pool.filter((position) => !seen.includes(position.id));
	const candidates = fresh.length ? fresh : pool;
	for (const window of [100, 200, 400, 800, Infinity]) {
		const near = candidates.filter((position) => Math.abs(position.rating - rating) <= window);
		if (near.length) return near[Math.floor(random() * near.length)];
	}
	return undefined;
}
