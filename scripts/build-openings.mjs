#!/usr/bin/env node
// Builds static/data/openings.json from the Lichess chess-openings TSVs (CC0, data/openings/*.tsv).
// Output: { "<fen first 4 fields>": "ECO|Name" } for named positions, and "" for positions that
// only appear on the way to a named opening (still book).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { Chess } from 'chess.js';

const out = {};
for (const f of ['a', 'b', 'c', 'd', 'e']) {
	const rows = readFileSync(`data/openings/${f}.tsv`, 'utf8').trim().split('\n').slice(1);
	for (const row of rows) {
		const [eco, name, pgn] = row.split('\t');
		const g = new Chess();
		const sans = pgn.replace(/\d+\.\s*/g, '').trim().split(/\s+/);
		for (const [i, san] of sans.entries()) {
			g.move(san);
			const key = g.fen().split(' ').slice(0, 4).join(' ');
			if (i === sans.length - 1) out[key] = `${eco}|${name}`;
			else if (!(key in out)) out[key] = '';
		}
	}
}
mkdirSync('static/data', { recursive: true });
writeFileSync('static/data/openings.json', JSON.stringify(out));
console.log(Object.keys(out).length, 'positions');
