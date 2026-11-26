import { parseArchives, parseArchiveGamesAsync, parseLichessGame, readNdjson } from '#lib/import/online.ts';
import type { GameRecord, GameSource } from '#lib/review/types.ts';

export type OnlineSource = Exclude<GameSource, 'pgn'>;
export const PLATFORMS = { lichess: 'Lichess', chesscom: 'Chess.com' } satisfies Record<OnlineSource, string>;

async function request(
	url: string, source: OnlineSource, username: string, signal: AbortSignal,
	options: { accept?: string; allowMissing?: boolean } = {}
) {
	const name = PLATFORMS[source];
	let response: Response;
	try {
		response = await fetch(url, { headers: { Accept: options.accept ?? 'application/json' }, signal });
	} catch {
		signal.throwIfAborted();
		throw new Error('Could not connect to ' + name + '. Check your connection and try again.');
	}
	if (response.status === 404) {
		if (options.allowMissing) return response;
		throw new Error(name + ' could not find the user or games for “' + username + '”.');
	}
	if (response.status === 429) throw new Error(name + ' is rate limiting requests. Try again in a minute.');
	if (!response.ok) throw new Error(name + ' returned HTTP ' + response.status + '. Try again shortly.');
	return response;
}

export async function fetchGames(
	source: OnlineSource,
	input: string,
	signal: AbortSignal,
	onProgress?: (completed: number, total: number) => void
) {
	const username = input.trim();
	if (!/^[\w-]{1,40}$/.test(username)) throw new Error('Enter a valid ' + PLATFORMS[source] + ' username.');
	const account = encodeURIComponent(username.toLowerCase());
	const importedAt = Date.now();
	const games: GameRecord[] = [];
	let missingArchives = 0;
	if (source === 'lichess') {
		const url = 'https://lichess.org/api/games/user/' + encodeURIComponent(username) + '?max=50&pgnInJson=true&opening=true&clocks=true';
		const response = await request(url, source, username, signal, { accept: 'application/x-ndjson' });
		if (!response.body) throw new Error('Lichess returned an empty response.');
		for await (const entry of readNdjson(response.body)) {
			const game = parseLichessGame(entry, username, importedAt);
			if (game) games.push(game);
		}
	} else {
		const url = 'https://api.chess.com/pub/player/' + account + '/games/archives';
		const archives = await request(url, source, username, signal);
		const months = parseArchives(await archives.json(), username);
		for (const month of months) {
			const response = await request(month, source, username, signal, { allowMissing: true });
			if (response.status === 404) missingArchives++;
			else {
				const body = await response.json();
				games.push(...await parseArchiveGamesAsync(body, username, importedAt, signal, onProgress));
			}
		}
		if (missingArchives && missingArchives === months.length) {
			throw new Error('Chess.com’s recent game archives are unavailable. Try again shortly.');
		}
	}
	return { games, missingArchives };
}
