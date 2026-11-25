import type { Course, LineKey } from '#lib/courses/types.ts';
import type { LineProgress } from '#lib/db.ts';
import { courseScope, defaultDepth, type DepthChoice } from '#lib/courses/depth.ts';
import { modeAvailability } from '#lib/courses/unlocks.ts';
import { courseStats } from '#lib/train/stats.ts';

/** Queued after a threshold is crossed, matching the reference sheet delay. */
export const NOTICE_DELAY_MS = 1200;

export const tierBlurb = (name: string) =>
	name === 'Essentials'
		? 'The main lines you will meet most'
		: name === 'Advanced'
			? 'Adds the common sidelines'
			: 'Every line in the course';

export function normalizeDepth(value: Partial<DepthChoice> | null | undefined): DepthChoice {
	const base = defaultDepth();
	if (!value || typeof value !== 'object') return base;
	return {
		tier: Number.isInteger(value.tier) ? (value.tier as number) : base.tier,
		seen: Boolean(value.seen),
		pinned: Array.isArray(value.pinned) ? value.pinned.filter((key): key is LineKey => typeof key === 'string') : [],
		acked: Array.isArray(value.acked) ? value.acked.filter((id): id is string => typeof id === 'string') : []
	};
}

/** A direct link to a line outside the active tier keeps that line in the set. */
export function withPinnedLine(course: Course, choice: DepthChoice, lineKey: LineKey): DepthChoice {
	const normalized = normalizeDepth(choice);
	const samePins =
		normalized.pinned.length === (choice.pinned?.length ?? -1) && normalized.pinned.every((key, index) => key === choice.pinned?.[index]);
	const unchanged = samePins ? choice : normalized;
	if (!course.lines.some((line) => line.key === lineKey) || normalized.pinned.includes(lineKey)) return unchanged;
	const scope = courseScope(course, normalized, new Map());
	if (scope.lines.some((line) => line.key === lineKey)) return unchanged;
	return { ...normalized, pinned: [...normalized.pinned, lineKey] };
}

export interface NoticeAction {
	label: string;
	href?: string;
	/** Set when the action moves the course to the next depth tier. */
	tier?: number;
}

export interface Notice {
	id: string;
	eyebrow: string;
	title: string;
	body: string;
	stay: string;
	go?: NoticeAction;
}

const seen = (choice: DepthChoice) => new Set(choice.acked ?? []);

function unlock(id: string, title: string, body: string, label: string, href: string): Notice {
	return { id, eyebrow: 'Unlocked', title, body, stay: 'Not now', go: { label, href } };
}

/** The next one-time sheet for this course, if a threshold has been crossed and not acknowledged. */
export function pendingNotice(course: Course, choice: DepthChoice, progress: ReadonlyMap<LineKey, LineProgress>, puzzle: boolean, arena: boolean): Notice | undefined {
	const normalized = normalizeDepth(choice);
	const scope = courseScope(course, normalized, progress);
	const learnedCourse = course.lines.filter((line) => progress.has(line.key)).length;
	const done = seen(normalized);
	const total = course.lines.length;
	if (learnedCourse <= 0) return undefined;

	if (!done.has('unlock:practice') && modeAvailability('practice', learnedCourse, total).kind === 'available') {
		return unlock(
			'unlock:practice',
			'Practice is open',
			'Recall the lines you have learned. A hint is there if you need it, and a clean run marks the line perfect.',
			'Start Practice',
			`/practice/run?course=${course.id}`
		);
	}
	const puzzles = modeAvailability('puzzle', learnedCourse, total, puzzle);
	const arenas = modeAvailability('arena', learnedCourse, total, arena);
	if (!done.has('unlock:rated') && (puzzles.kind === 'available' || arenas.kind === 'available')) {
		const both = puzzles.kind === 'available' && arenas.kind === 'available';
		return unlock(
			'unlock:rated',
			both ? 'Puzzles and Arena are open' : puzzles.kind === 'available' ? 'Puzzles are open' : 'Arena is open',
			both
				? 'Puzzles start from an opponent mistake in your opening. Arena plays the opening as a game against rating-matched replies.'
				: puzzles.kind === 'available'
					? 'Puzzles start from an opponent mistake in your opening.'
					: 'Arena plays your opening as a game. The opponent chooses replies from games near your rating.',
			puzzles.kind === 'available' ? 'Try Puzzles' : 'Play Arena',
			puzzles.kind === 'available' ? `/puzzles/${course.id}` : `/arena/${course.id}`
		);
	}
	if (!done.has('unlock:drill') && modeAvailability('drill', learnedCourse, total).kind === 'available') {
		return unlock(
			'unlock:drill',
			'Drill and Time are open',
			'Drill draws learned lines at random and ends on the first miss. Time gives you 60 seconds: clean lines add time and mistakes cost it.',
			'Go to Drill',
			'/drill'
		);
	}
	if (learnedCourse >= 5 && total >= 5 && !done.has('celebrate:5')) {
		return {
			id: 'celebrate:5',
			eyebrow: 'Milestone',
			title: 'Five lines learned',
			body: 'This is a milestone, not another gate. Practice, Drill, Time, Puzzles and Arena stay on the thresholds you already cleared.',
			stay: 'Keep going'
		};
	}

	const tier = scope.tiers[scope.tier];
	const next = scope.tiers[scope.tier + 1];
	if (tier && scope.learned >= tier.count && !done.has(`learned:${scope.tier}`)) {
		return {
			id: `learned:${scope.tier}`,
			eyebrow: 'Milestone',
			title: `${tier.name} complete`,
			body: next ? `All ${tier.count} lines learned. You can add ${next.name}, or stay with ${tier.name}.` : `All ${tier.count} lines learned. Reviews keep them sharp.`,
			stay: next ? `Stay on ${tier.name}` : 'Keep training',
			go: next ? { label: `Continue with ${next.name}`, tier: scope.tier + 1 } : undefined
		};
	}
	if (tier && scope.perfected >= tier.count && !done.has(`perfected:${scope.tier}`)) {
		return {
			id: `perfected:${scope.tier}`,
			eyebrow: 'Milestone',
			title: `${tier.name} perfected`,
			body: next ? `All ${tier.count} lines, flawless. You can add ${next.name}, or stay with ${tier.name}.` : `All ${tier.count} lines, flawless. Reviews keep them sharp.`,
			stay: next ? `Stay on ${tier.name}` : 'Stay sharp',
			go: next ? { label: `Continue with ${next.name}`, tier: scope.tier + 1 } : undefined
		};
	}
	return undefined;
}

export function ackNotice(choice: DepthChoice, id: string, tier?: number): DepthChoice {
	const normalized = normalizeDepth(choice);
	const acked = normalized.acked?.includes(id) ? normalized.acked : [...(normalized.acked ?? []), id];
	return { ...normalized, acked, tier: tier ?? normalized.tier };
}

/** Course and line a trainer URL is about. Line keys use `courseId/lineId`. */
export function trainerTarget(pathname: string, search: URLSearchParams): { courseId: string; lineKey?: LineKey } | undefined {
	const learn = pathname.match(/^\/learn\/([^/]+)\/([^/]+)/);
	if (learn) {
		const courseId = decodeURIComponent(learn[1]);
		const lineId = decodeURIComponent(learn[2]);
		return { courseId, lineKey: `${courseId}/${lineId}` as LineKey };
	}
	const quiz = pathname.match(/^\/quiz\/([^/]+)/);
	if (quiz) return { courseId: decodeURIComponent(quiz[1]) };
	const rated = pathname.match(/^\/(?:puzzles|arena)\/([^/]+)/);
	if (rated) return { courseId: decodeURIComponent(rated[1]) };
	if (pathname === '/practice/run' || pathname === '/drill/run') {
		const line = search.get('line') ?? undefined;
		const courseId = search.get('course') ?? line?.split('/')[0];
		if (!courseId) return undefined;
		return { courseId, lineKey: line as LineKey | undefined };
	}
	return undefined;
}

/** Landing page for a trainer URL the course has not unlocked. Unscoped Drill and Time stay available. */
export function gateRedirect(pathname: string, search: URLSearchParams, learned: number, total: number, puzzle: boolean, arena: boolean): string | undefined {
	if (pathname === '/practice/run') {
		const id = search.get('course') ?? search.get('line')?.split('/')[0];
		if (id && modeAvailability('practice', learned, total).kind !== 'available') return `/course/${id}`;
	}
	if (pathname === '/drill/run') {
		const id = search.get('course');
		if (!id) return undefined;
		const mode = search.get('mode') === 'time' ? 'time' : 'drill';
		if (modeAvailability(mode, learned, total).kind !== 'available') return '/drill';
	}
	const puzzles = pathname.match(/^\/puzzles\/([^/]+)/);
	if (puzzles && modeAvailability('puzzle', learned, total, puzzle).kind !== 'available') return `/course/${decodeURIComponent(puzzles[1])}`;
	const arenas = pathname.match(/^\/arena\/([^/]+)/);
	if (arenas && modeAvailability('arena', learned, total, arena).kind !== 'available') return `/course/${decodeURIComponent(arenas[1])}`;
	return undefined;
}

/** Next lesson, due Practice, or Drill, at the saved depth. An unseen chooser opens the course page. */
export function resumeHref(course: Course, choice: DepthChoice, progress: ReadonlyMap<LineKey, LineProgress>, now: number): string {
	const normalized = normalizeDepth(choice);
	const scope = courseScope(course, normalized, progress);
	if (!normalized.seen && scope.tiers.length > 1) return `/course/${course.id}`;
	const stats = courseStats({ ...course, lines: scope.lines }, progress as Map<LineKey, LineProgress>, now);
	if (stats.due) return `/practice/run?course=${course.id}`;
	if (stats.next) return `/learn/${course.id}/${stats.next.id}`;
	return '/drill';
}
