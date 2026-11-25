import { describe, expect, it } from 'vitest';
import chessMonth from './fixtures/chesscom-month.json';
import chessArchives from './fixtures/chesscom-archives.json';
import lichessGames from './fixtures/lichess.ndjson?raw';
import { parseArchiveGames, parseArchives, parseLichessGame, readNdjson } from '#lib/import/online.ts';
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
		expect(parseArchives(chessArchives, 'Hikaru')).toEqual(chessArchives.archives.slice(-2));
		const games = parseArchiveGames(chessMonth, 'hikaru', 1000);
		expect(games).toHaveLength(1);
		expect(games[0]).toMatchObject({
			source: 'chesscom', id: expect.stringMatching(/^chesscom-\d+$/), importedAt: 1000,
			userColor: expect.stringMatching(/^[wb]$/)
		});
		expect(readPgn(games[0].pgn).plies).toHaveLength(80);
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
