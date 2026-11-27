import type { Color } from '#lib/chess/types.ts';
import { readPgn, readResult } from '#lib/import/pgn.ts';
import type { GameRecord } from '#lib/review/types.ts';

function object(value: unknown): Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
		? value as Record<string, unknown> : {};
}
const string = (value: unknown) => typeof value === 'string' ? value : undefined;
const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : undefined;

function userSide(white: string, black: string, username: string): Color | undefined {
	const user = username.toLowerCase();
	if (white.toLowerCase() === user) return 'w';
	if (black.toLowerCase() === user) return 'b';
}

function opening(eco: unknown, name: unknown) {
	return typeof name === 'string' && name ? { eco: string(eco) ?? '', name } : undefined;
}

export function parseLichessGame(value: unknown, username: string, importedAt: number): GameRecord | undefined {
	const game = object(value);
	if (game.variant !== 'standard' || typeof game.id !== 'string' || !/^[a-z0-9]{8}$/i.test(game.id)
		|| typeof game.pgn !== 'string' || !game.moves) return;
	const { pgn, headers } = readPgn(game.pgn);
	const players = object(game.players);
	const player = (color: 'white' | 'black') => {
		const side = object(players[color]);
		const account = object(side.user);
		return { name: string(account.name) ?? headers[color === 'white' ? 'White' : 'Black'] ?? color, rating: number(side.rating) };
	};
	const white = player('white');
	const black = player('black');
	const clock = object(game.clock);
	const initial = number(clock.initial);
	const increment = number(clock.increment);
	const details = object(game.opening);
	return {
		id: 'lichess-' + game.id, source: 'lichess', url: 'https://lichess.org/' + game.id, white, black, pgn,
		result: readResult(headers.Result), termination: string(game.status), speed: string(game.speed),
		timeControl: initial !== undefined && increment !== undefined ? initial + '+' + increment : undefined,
		playedAt: number(game.createdAt) ?? importedAt, importedAt,
		opening: opening(details.eco, details.name), userColor: userSide(white.name, black.name, username)
	};
}

export function parseChesscomGame(value: unknown, username: string, importedAt: number): GameRecord | undefined {
	const game = object(value);
	if (game.rules !== 'chess' || typeof game.pgn !== 'string' || typeof game.url !== 'string') return;
	const id = game.url.match(/^https:\/\/(?:www\.)?chess\.com\/(?:game|live|daily)\/(?:live\/|daily\/)?(\d+)\/?$/)?.[1];
	if (!id) return;
	const { pgn, headers } = readPgn(game.pgn);
	const player = (color: 'white' | 'black') => {
		const side = object(game[color]);
		return { name: string(side.username) ?? color, rating: number(side.rating) };
	};
	const white = player('white');
	const black = player('black');
	return {
		id: 'chesscom-' + id, source: 'chesscom', url: game.url, white, black, pgn,
		result: readResult(headers.Result), termination: headers.Termination, speed: string(game.time_class),
		timeControl: string(game.time_control), playedAt: (number(game.end_time) ?? importedAt / 1000) * 1000,
		importedAt, opening: opening(headers.ECO, headers.Opening ?? headers.ECOUrl?.split('/').pop()?.replaceAll('-', ' ')),
		userColor: userSide(white.name, black.name, username)
	};
}

export function parseArchives(value: unknown, username: string) {
	const list = object(value).archives;
	if (!Array.isArray(list)) throw new Error('Chess.com returned an invalid archive list.');
	const prefix = 'https://api.chess.com/pub/player/' + username.toLowerCase() + '/games/';
	return list.filter((url): url is string => typeof url === 'string'
		&& url.toLowerCase().startsWith(prefix) && /^\d{4}\/\d{2}$/.test(url.slice(prefix.length)))
		.sort().slice(-2).reverse();
}

export function parseArchiveGames(value: unknown, username: string, importedAt: number) {
	const games = object(value).games;
	if (!Array.isArray(games)) throw new Error('Chess.com returned an invalid game archive.');
	return games.flatMap(game => {
		const parsed = parseChesscomGame(game, username, importedAt);
		return parsed ? [parsed] : [];
	});
}

export async function parseArchiveGamesAsync(
	value: unknown,
	username: string,
	importedAt: number,
	signal: AbortSignal,
	onProgress?: (completed: number, total: number) => void,
	limit = 50,
	completed = 0
) {
	const games = object(value).games;
	if (!Array.isArray(games)) throw new Error('Chess.com returned an invalid game archive.');
	const selected = games.filter(game => object(game).rules === 'chess')
		.sort((a, b) => (number(object(b).end_time) ?? 0) - (number(object(a).end_time) ?? 0)).slice(0, limit);
	const parsed: GameRecord[] = [];
	for (let index = 0; index < selected.length; index++) {
		signal.throwIfAborted();
		const game = parseChesscomGame(selected[index], username, importedAt);
		if (game) parsed.push(game);
		if (index % 10 === 9 || index === selected.length - 1) onProgress?.(completed + index + 1, 50);
		if (index < selected.length - 1) await new Promise<void>(resolve => setTimeout(resolve, 0));
	}
	return parsed;
}

export async function* readNdjson(body: ReadableStream<Uint8Array>): AsyncGenerator<unknown> {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let remainder = '';
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			const lines = (remainder + decoder.decode(value, { stream: true })).split('\n');
			remainder = lines.pop() ?? '';
			for (const line of lines) if (line.trim()) yield JSON.parse(line);
		}
		remainder += decoder.decode();
		if (remainder.trim()) yield JSON.parse(remainder);
	} finally {
		await reader.cancel().catch(() => {});
		reader.releaseLock();
	}
}
