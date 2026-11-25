import { Chess } from 'chess.js';
import { posKey, START_FEN, turnOf, type Fen, type PosKey, type San, type Uci } from '#lib/chess/types.ts';
import type { Course } from '#lib/courses/types.ts';
import { repliesAt, type Explorer } from '#lib/explorer/types.ts';

/** ChessReps' rule: an unanswered reply is a gap once 1% of players choose it. */
export const GAP_SHARE = 0.01;

export interface Gap {
	key: PosKey;
	fen: Fen;
	uci: Uci;
	san: San;
	/** Share of players at this position who choose the reply. */
	share: number;
	/** Chance of reaching this position from the start when the opponent plays like Lichess players. */
	reach: number;
	/** The course moves that lead here. */
	path: San[];
}

export interface Coverage {
	/** Reach-weighted share of common replies the course answers, 0..1. */
	score: number;
	gaps: Gap[];
	/** Reach-weighted missing reply mass in points; normalization is local, not a reference score. */
	points: number;
	unknown: { fen: Fen; path: San[] }[];
	observed: number;
}

function sanOf(fen: Fen, uci: Uci): San {
	try {
		return new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined }).san as San;
	} catch {
		return uci as unknown as San;
	}
}

export function courseCoverage(course: Course, explorer: Explorer, bands?: number[]): Coverage {
	let answered = 0;
	let missing = 0;
	let observed = 0;
	const gaps: Gap[] = [];
	const unknown: Coverage['unknown'] = [];
	const seen = new Set<PosKey>();

	/** Before the student's first move, opponent moves only choose the course's lines; 1.d4 is no gap in a Caro-Kann. */
	function visit(fen: Fen, reach: number, path: San[], entered = false) {
		const key = posKey(fen);
		const node = course.repertoire.get(key);
		if (seen.has(key)) return;
		seen.add(key);
		if (node?.student) return visit(node.student.fenAfter, reach, [...path, node.student.san], true);
		if (turnOf(fen) === course.side) return;
		const preparedReplies = node?.replies ?? [];
		if (!entered && !preparedReplies.length) return;

		const all = repliesAt(explorer, key, bands);
		const replies = entered ? all : all.filter((r) => preparedReplies.some((p) => p.uci === r.uci));
		const total = replies.reduce((s, r) => s + r.count, 0);
		if (!total) {
			if (entered) unknown.push({ fen, path });
			for (const reply of preparedReplies) visit(reply.fenAfter, reach / preparedReplies.length, [...path, reply.san], entered);
			return;
		}
		if (entered) observed++;
		for (const { uci, count } of replies) {
			const share = count / total;
			const prepared = preparedReplies.find((r) => r.uci === uci);
			if (prepared) {
				if (entered) answered += reach * share;
				visit(prepared.fenAfter, reach * share, [...path, prepared.san], entered);
			} else if (share >= GAP_SHARE) {
				missing += reach * share;
				gaps.push({ key, fen, uci, san: sanOf(fen, uci), share, reach, path });
			}
		}
	}

	visit(START_FEN, 1, []);
	gaps.sort((a, b) => b.reach * b.share - a.reach * a.share);
	const mass = answered + missing;
	return { score: mass ? answered / mass : 1, gaps, points: missing * 100, unknown, observed };
}
