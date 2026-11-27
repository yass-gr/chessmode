import { describe, expect, it, vi } from 'vitest';
import { fetchGames } from '#lib/import/fetch-games.ts';
import chessMonth from './fixtures/chesscom-month.json';
import chessArchives from './fixtures/chesscom-archives.json';
import lichessGames from './fixtures/lichess.ndjson?raw';
import { parseArchiveGames, parseArchiveGamesAsync, parseArchives, parseLichessGame, readNdjson } from '#lib/import/online.ts';
import { parsePgn, readPgn } from '#lib/import/pgn.ts';

describe('game imports', () => {
	it('streams the saved Lichess games even when chunks split lines and UTF-8', async () => {
		const bytes = new TextEncoder().encode(lichessGames.trimEnd());
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				for (let i = 0; i < bytes.length; i += 73) controller.enqueue(bytes.slice(i, i + 73));
				controller.close();
			}
		});
		const games = [];
		for await (const entry of readNdjson(stream)) games.push(parseLichessGame(entry, 'DRNYKTERSTEIN', 1000));
		expect(games).toHaveLength(2);
		expect(games[0]).toMatchObject({
			id: 'lichess-HqjDTU4A', source: 'lichess', white: { name: 'DrNykterstein', rating: 3177 },
			result: '1-0', timeControl: '180+0', userColor: 'w', opening: { eco: 'A50' }, importedAt: 1000
		});
		expect(games[0]?.pgn).toContain('[%clk');
	});

	it('uses the newest two Chess.com archives and keeps standard chess games', () => {
		expect(parseArchives(chessArchives, 'Hikaru')).toEqual(chessArchives.archives.slice(-2).reverse());
		const games = parseArchiveGames(chessMonth, 'hikaru', 1000);
		expect(games).toHaveLength(1);
		expect(games[0]).toMatchObject({
			source: 'chesscom', id: expect.stringMatching(/^chesscom-\d+$/), importedAt: 1000,
			userColor: expect.stringMatching(/^[wb]$/)
		});
		expect(readPgn(games[0].pgn).plies).toHaveLength(80);
	});

	it('parses Chess.com archives in cancellable chunks', async () => {
		const signal = new AbortController().signal;
		const progress: number[] = [];
		const value = { games: [...chessMonth.games, ...chessMonth.games] };
		const games = await parseArchiveGamesAsync(value, 'hikaru', 1000, signal, completed => progress.push(completed));
		expect(games).toHaveLength(2);
		expect(progress).toEqual([2]);

		const controller = new AbortController();
		setTimeout(() => controller.abort(), 0);
		await expect(parseArchiveGamesAsync(value, 'hikaru', 1000, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
	});

	it('selects the newest standard games across at most two archives', async () => {
		const template = chessMonth.games.find(game => game.rules === 'chess')!;
		const makeGame = (id: number, rules = 'chess') => ({ ...template, rules, end_time: id, url: `https://www.chess.com/game/live/${id}` });
		const newest = [makeGame(400, 'chess960'), ...Array.from({ length: 30 }, (_, i) => makeGame(200 + i)), makeGame(401, 'bughouse')];
		const previous = Array.from({ length: 40 }, (_, i) => makeGame(100 + i));
		const fetchMock = vi.fn(async (url: string | URL | Request) => {
			const address = String(url);
			return Response.json(address.endsWith('/archives') ? chessArchives : { games: address.endsWith('/11') ? newest : previous });
		});
		vi.stubGlobal('fetch', fetchMock);
		try {
			const { games } = await fetchGames('chesscom', 'hikaru', new AbortController().signal);
			expect(games.map(game => game.id)).toEqual([...Array.from({ length: 30 }, (_, i) => `chesscom-${229 - i}`), ...Array.from({ length: 20 }, (_, i) => `chesscom-${139 - i}`)]);
			expect(fetchMock.mock.calls.map(([url]) => String(url).slice(-7))).toEqual(['rchives', '2026/11', '2026/10']);
		} finally { vi.unstubAllGlobals(); }
	});

	it('parses pasted PGN with annotations and a deterministic identifier', () => {
		const input = '[White "A"]\n[Black "B"]\n[Date "2024.07.04"]\n\n1.e4! e5 2.Qh5 Nc6 3.Bc4 Nf6?? 4.Qxf7# 1-0';
		const game = parsePgn(input, 1000);
		expect(game).toMatchObject({ source: 'pgn', white: { name: 'A' }, black: { name: 'B' }, playedAt: Date.UTC(2024, 6, 4), result: '1-0' });
		expect(parsePgn(input, 2000).id).toBe(game.id);
		expect(readPgn(game.pgn).plies.at(-1)?.san).toBe('Qxf7#');
		expect(() => parsePgn('1. Invalid')).toThrow();
		expect(() => parsePgn('[Variant "Atomic"]\n\n1.e4')).toThrow('Only standard chess');
	});
});
