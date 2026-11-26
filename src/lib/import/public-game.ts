import { onlineFetch } from '#lib/native.ts';
import { parseChesscomGame } from '#lib/import/online.ts';
import type { GameRecord } from '#lib/review/types.ts';

const GAME_URL = /(?:chess\.com\/(?:game\/)?(?:live|daily)\/|api\.chess\.com\/pub\/game\/(?:live\/|daily\/)?)(\d+)/i;

/** The public Chess.com game URL for a pasted link or numeric id. */
export function chesscomGameUrl(input: string): string | undefined {
	const id = input.trim().match(GAME_URL)?.[1] ?? (/^\d{3,}$/.test(input.trim()) ? input.trim() : undefined);
	return id ? `https://api.chess.com/pub/game/${id}` : undefined;
}

export function gameFromChesscom(json: unknown, importedAt = Date.now()): GameRecord | undefined {
	return parseChesscomGame(json, '', importedAt);
}

export async function fetchChesscomGame(input: string, signal: AbortSignal, importedAt = Date.now()): Promise<GameRecord> {
	const url = chesscomGameUrl(input);
	if (!url) throw new Error('Paste a Chess.com game link.');
	let response: Response;
	try {
		response = await onlineFetch(url, { headers: { Accept: 'application/json' }, signal });
	} catch {
		signal.throwIfAborted();
		throw new Error('Could not reach Chess.com. Check your connection and try again.');
	}
	if (response.status === 404) throw new Error('Chess.com could not find that game.');
	if (!response.ok) throw new Error(`Chess.com returned HTTP ${response.status}. Try again shortly.`);
	const game = gameFromChesscom(await response.json(), importedAt);
	if (!game) throw new Error('That Chess.com game is not a standard game with moves.');
	return game;
}
