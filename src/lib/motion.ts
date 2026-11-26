/**
 * How a route change moves, in iOS terms. `push`/`pop` slide sideways within the tabbed app,
 * `present`/`dismiss` bring a full-screen flow (a lesson, a review) up from the bottom and back down,
 * and switching between tab roots does not animate, as on iOS.
 */
export type NavKind = 'push' | 'pop' | 'present' | 'dismiss' | 'none';

const TAB_ROOTS = new Set(['/', '/practice', '/drill', '/matches', '/you']);

/** Full-screen flows hide the tab bar. Opening review stays in the Matches tab because it is a list. */
export const isImmersive = (path: string) => /^\/(learn|practice\/run|drill\/run|quiz|review|arena|puzzles|explorer|analysis|endgames\/play|bots\/play)\b/.test(path);

/** Where the back button leads; the catalog sits between Learn and a course because that is how you reach one. */
const PARENTS: [RegExp, string][] = [
	[/^\/create$/, '/courses'],
	[/^\/courses$/, '/'],
	[/^\/course\/[^/]+$/, '/courses'],
	[/^\/(explorer|analysis|opening-review)$/, '/matches'],
	[/^\/(endgames|books|bots|community)$/, '/drill']
];

function parent(path: string): string | undefined {
	if (TAB_ROOTS.has(path)) return undefined;
	const known = PARENTS.find(([re]) => re.test(path));
	if (known) return known[1];
	const up = path.split('/').filter(Boolean).slice(0, -1);
	return up.length ? `/${up.join('/')}` : '/';
}

function isAncestor(of: string, path: string): boolean {
	for (let at = parent(path); at !== undefined; at = parent(at)) if (at === of) return true;
	return false;
}

/** `historyDelta` is set for back/forward navigations: negative means back. */
export function navKind(from: string, to: string, historyDelta?: number): NavKind {
	if (from === to) return 'none';
	const fromFlow = isImmersive(from);
	const toFlow = isImmersive(to);
	if (!fromFlow && toFlow) return 'present';
	if (fromFlow && !toFlow) return 'dismiss';
	if (TAB_ROOTS.has(from) && TAB_ROOTS.has(to)) return 'none';
	if (historyDelta !== undefined) return historyDelta < 0 ? 'pop' : 'push';
	if (isAncestor(to, from)) return 'pop';
	return TAB_ROOTS.has(to) ? 'none' : 'push';
}

/** A CSS cubic-bezier as an easing function, for Svelte transitions that must match the CSS tokens. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
	const ax = 3 * x1 - 3 * x2 + 1;
	const bx = 3 * x2 - 6 * x1;
	const cx = 3 * x1;
	const ay = 3 * y1 - 3 * y2 + 1;
	const by = 3 * y2 - 6 * y1;
	const cy = 3 * y1;
	const x = (s: number) => ((ax * s + bx) * s + cx) * s;
	const dx = (s: number) => (3 * ax * s + 2 * bx) * s + cx;
	return (t) => {
		if (t <= 0 || t >= 1) return t;
		let s = t;
		for (let i = 0; i < 8; i++) {
			const err = x(s) - t;
			if (Math.abs(err) < 1e-5) break;
			const d = dx(s);
			if (Math.abs(d) < 1e-6) break;
			s -= err / d;
		}
		s = Math.min(1, Math.max(0, s));
		return ((ay * s + by) * s + cy) * s;
	};
}

/** Mirrors `--ease-out` in app.css. */
export const easeOut = cubicBezier(0.23, 1, 0.32, 1);

export const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
