import { Chess } from 'chess.js';
import { START_FEN, type Fen, type San, type Uci } from '#lib/chess/types.ts';
import { readPgnTree, type TreeNode } from '#lib/courses/pgn-tree.ts';
import { readPgn } from '#lib/import/pgn.ts';

/** A node in the user's analysis tree. `children[0]` is the main line; the rest are variations. */
export interface LineNode {
	children: LineEdge[];
}

export interface LineEdge {
	san: San;
	uci: Uci;
	fenAfter: Fen;
	node: LineNode;
}

/**
 * The board the user is exploring. `line` is the active spine, including moves after `cursor`,
 * so back and forward stay on that spine. Other variations remain on `root`.
 */
export interface AnalysisBoard {
	startFen: Fen;
	root: LineNode;
	line: LineEdge[];
	cursor: number;
}

const emptyNode = (): LineNode => ({ children: [] });

export function emptyBoard(startFen: Fen = START_FEN): AnalysisBoard {
	new Chess(startFen);
	return { startFen, root: emptyNode(), line: [], cursor: 0 };
}

export function currentFen(board: AnalysisBoard): Fen {
	return board.cursor === 0 ? board.startFen : board.line[board.cursor - 1].fenAfter;
}

function nodeAt(board: AnalysisBoard): LineNode {
	let node = board.root;
	for (let i = 0; i < board.cursor; i++) node = board.line[i].node;
	return node;
}

function spine(node: LineNode): LineEdge[] {
	const line: LineEdge[] = [];
	let at = node;
	while (at.children[0]) {
		line.push(at.children[0]);
		at = at.children[0].node;
	}
	return line;
}

function applyUci(chess: Chess, uci: string) {
	return chess.move({
		from: uci.slice(0, 2),
		to: uci.slice(2, 4),
		promotion: uci[4] as 'q' | 'r' | 'b' | 'n' | undefined
	});
}

/**
 * Plays a legal move on the active spine. An existing move is followed.
 * A new move is appended after the moves already there, so the main line stays `children[0]`.
 */
export function play(board: AnalysisBoard, uci: Uci): AnalysisBoard {
	const chess = new Chess(currentFen(board));
	let move;
	try {
		move = applyUci(chess, uci);
	} catch {
		throw new Error('That move is not legal here.');
	}
	const played = (move.from + move.to + (move.promotion ?? '')) as Uci;
	const node = nodeAt(board);
	let edge = node.children.find((child) => child.uci === played);
	if (!edge) {
		edge = { san: move.san as San, uci: played, fenAfter: chess.fen() as Fen, node: emptyNode() };
		node.children.push(edge);
	}
	const prefix = board.line.slice(0, board.cursor);
	return { ...board, line: [...prefix, edge, ...spine(edge.node)], cursor: prefix.length + 1 };
}

export function goTo(board: AnalysisBoard, cursor: number): AnalysisBoard {
	const next = Math.min(board.line.length, Math.max(0, cursor));
	return next === board.cursor ? board : { ...board, cursor: next };
}

/**
 * Other moves already stored at the cursor. The active continuation is not listed again.
 * Match the move, not the object: Svelte wraps one edge in a separate proxy on each path.
 */
export function otherMoves(board: AnalysisBoard): LineEdge[] {
	const current = board.line[board.cursor]?.uci;
	return nodeAt(board).children.filter((child) => child.uci !== current);
}

/** Switches the active spine to a variation that already starts at the cursor. */
export function enterVariation(board: AnalysisBoard, uci: Uci): AnalysisBoard {
	const edge = nodeAt(board).children.find((child) => child.uci === uci);
	if (!edge) return board;
	const prefix = board.line.slice(0, board.cursor);
	return { ...board, line: [...prefix, edge, ...spine(edge.node)], cursor: prefix.length + 1 };
}

function convert(tree: TreeNode, chess: Chess): LineNode {
	const children: LineEdge[] = [];
	for (const edge of tree.children.values()) {
		const next = new Chess(chess.fen());
		const move = next.move(edge.san);
		children.push({
			san: edge.san,
			uci: edge.uci,
			fenAfter: next.fen() as Fen,
			node: convert(edge.node, next)
		});
		void move;
	}
	return { children };
}

/** Reads a standard-start PGN, keeping parenthesised variations behind the main line. */
export function fromPgn(pgn: string): AnalysisBoard {
	const { tree } = readPgnTree(pgn);
	const root = convert(tree, new Chess());
	const line = spine(root);
	return { startFen: START_FEN, root, line, cursor: line.length };
}

/** Prefers the variation tree. A set-up position falls back to the main line so the game still opens. */
export function boardFromGamePgn(pgn: string): AnalysisBoard {
	try {
		return fromPgn(pgn);
	} catch {
		const { plies } = readPgn(pgn);
		let board = emptyBoard(plies[0].fenBefore);
		for (const ply of plies) board = play(board, ply.uci);
		return goTo(board, board.line.length);
	}
}

function emit(node: LineNode, ply: number): string {
	const main = node.children[0];
	if (!main) return '';
	const number = Math.floor(ply / 2) + 1;
	const prefix = ply % 2 === 0 ? `${number}. ` : '';
	let text = prefix + main.san;
	for (const alt of node.children.slice(1)) {
		const altPrefix = ply % 2 === 0 ? `${number}. ` : `${number}... `;
		const altRest = emit(alt.node, ply + 1);
		text += ` (${altPrefix}${alt.san}${altRest ? ' ' + altRest : ''})`;
	}
	const rest = emit(main.node, ply + 1);
	if (!rest) return text;
	if (node.children.length > 1 && ply % 2 === 0) return `${text} ${number}... ${rest}`;
	return `${text} ${rest}`;
}

/** PGN for the whole tree. The first child of every node is the main line the reviewer will analyse. */
export function toPgn(board: AnalysisBoard, headers: Record<string, string> = {}): string {
	const movetext = emit(board.root, 0);
	if (!movetext) throw new Error('The board has no moves.');
	const tags: Record<string, string> = { Result: '*', ...headers };
	if (board.startFen !== START_FEN) {
		tags.SetUp = '1';
		tags.FEN = board.startFen;
	}
	const head = Object.entries(tags)
		.map(([key, value]) => `[${key} "${value.replaceAll('"', '')}"]`)
		.join('\n');
	return `${head}\n\n${movetext}`;
}

/** SANs of the active spine only, which is what a main-line review walks. */
export function mainlineSans(board: AnalysisBoard): San[] {
	return spine(board.root).map((edge) => edge.san);
}
