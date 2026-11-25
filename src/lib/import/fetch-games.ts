import { parseArchives, parseArchiveGames, parseLichessGame, readNdjson } from '#lib/import/online.ts';
import type { GameRecord, GameSource } from '#lib/review/types.ts';

export type OnlineSource = Exclude<GameSource, 'pgn'>;
export const PLATFORMS = { lichess: 'Lichess', chesscom: 'Chess.com' } satisfies Record<OnlineSource, string>;

async function request(url: string, source: OnlineSource, username: string, signal: AbortSignal, accept = 'application/json') {
	const name = PLATFORMS[source];
	let response: Response;
	try {
		response = await fetch(url, { headers: { Accept: accept }, signal });
	} catch {
		signal.throwIfAborted();
		throw new Error('Could not connect to ' + name + '. Check your connection and try again.');
	}
	if (response.status === 404) throw new Error(name + ' could not find the user or games for “' + username + '”.');
	if (response.status === 429) throw new Error(name + ' is rate limiting requests. Try again in a minute.');
	if (!response.ok) throw new Error(name + ' returned HTTP ' + response.status + '. Try again shortly.');
	return response;
}

export async function fetchGames(source: OnlineSource, input: string, signal: AbortSignal) {
	const username = input.trim();
	if (!/^[\w-]{1,40}$/.test(username)) throw new Error('Enter a valid ' + PLATFORMS[source] + ' username.');
	const account = encodeURIComponent(username.toLowerCase());
	const importedAt = Date.now();
	const games: GameRecord[] = [];
	if (source === 'lichess') {
		const url = 'https://lichess.org/api/games/user/' + account + '?max=50&pgnInJson=true&opening=true&clocks=true';
		const response = await request(url, source, username, signal, 'application/x-ndjson');
		if (!response.body) throw new Error('Lichess returned an empty response.');
		for await (const entry of readNdjson(response.body)) {
			const game = parseLichessGame(entry, username, importedAt);
			if (game) games.push(game);
		}
	} else {
		const url = 'https://api.chess.com/pub/player/' + account + '/games/archives';
		const archives = await request(url, source, username, signal);
		for (const month of parseArchives(await archives.json(), username)) {
			const response = await request(month, source, username, signal);
			games.push(...parseArchiveGames(await response.json(), username, importedAt));
		}
	}
	return games;
}
