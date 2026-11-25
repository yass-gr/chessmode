import { Chess } from 'chess.js';
import type { Fen, Ply, San, Uci } from '#lib/chess/types.ts';
import type { GameRecord } from '#lib/review/types.ts';

export function readPgn(pgn: string) {
	const chess = new Chess();
	chess.loadPgn(pgn.trim());
	const headers = chess.getHeaders();
	if (headers.Variant && !/^(standard|chess|from position)$/i.test(headers.Variant)) {
		throw new Error('Only standard chess games can be reviewed.');
	}
	const history = chess.history({ verbose: true });
	if (!history.length) throw new Error('The PGN needs at least one move.');
	const plies: Ply[] = history.map(move => ({
		san: move.san as San, uci: move.lan as Uci, color: move.color,
		fenBefore: move.before as Fen, fenAfter: move.after as Fen
	}));
	return { headers, plies, pgn: chess.pgn() };
}

export function readResult(value: string | undefined): GameRecord['result'] {
	switch (value) {
		case '1-0': case '0-1': case '1/2-1/2': return value;
		default: return '*';
	}
}

function rating(value: string | undefined) {
	const number = Number(value);
	return Number.isInteger(number) && number > 0 ? number : undefined;
}

function gameId(pgn: string) {
	let hash = 0xcbf29ce484222325n;
	for (const code of pgn) hash = BigInt.asUintN(64, (hash ^ BigInt(code.codePointAt(0) ?? 0)) * 0x100000001b3n);
	return 'pgn-' + hash.toString(16);
}

export function parsePgn(input: string, importedAt = Date.now()): GameRecord {
	const { headers, pgn } = readPgn(input);
	const date = headers.UTCDate ?? headers.Date;
	const playedAt = date && /^\d{4}\.\d{2}\.\d{2}$/.test(date)
		? Date.parse(date.replaceAll('.', '-') + 'T' + (headers.UTCTime ?? '00:00:00') + 'Z') : NaN;
	return {
		id: gameId(pgn), source: 'pgn', pgn, importedAt,
		white: { name: headers.White || 'White', rating: rating(headers.WhiteElo) },
		black: { name: headers.Black || 'Black', rating: rating(headers.BlackElo) },
		result: readResult(headers.Result), playedAt: Number.isFinite(playedAt) ? playedAt : importedAt,
		termination: headers.Termination, timeControl: headers.TimeControl === '-' ? undefined : headers.TimeControl,
		opening: headers.Opening ? { eco: headers.ECO ?? '', name: headers.Opening } : undefined
	};
}
