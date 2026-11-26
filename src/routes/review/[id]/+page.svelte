<script lang="ts">
	import { plural } from '#lib/format.ts';
	import { ArrowRightLeft, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Ellipsis, Sun } from '@lucide/svelte';
	import { page } from '$app/state';
	import Board, { type Arrow, type Marker } from '#lib/components/Board.svelte';
	import Sheet from '#lib/components/Sheet.svelte';
	import Coach from '#lib/components/review/Coach.svelte';
	import ReviewSettings from '#lib/components/review/ReviewSettings.svelte';
	import EvalBar from '#lib/components/review/EvalBar.svelte';
	import EvalGraph from '#lib/components/review/EvalGraph.svelte';
	import Label from '#lib/components/review/Label.svelte';
	import Overview from '#lib/components/review/Overview.svelte';
	import ReviewLoading from '#lib/components/review/ReviewLoading.svelte';
	import { lineAction, overviewVerdict, type CoachPhase, type RetryMood } from '#lib/components/review/coach.ts';
	import { START_FEN, other, turnOf, type Color, type Ply, type Uci } from '#lib/chess/types.ts';
	import { db, getSetting, setSetting } from '#lib/db.ts';
	import { readPgn } from '#lib/import/pgn.ts';
	import { courses } from '#lib/courses/index.ts';
	import { reducedMotion } from '#lib/motion.ts';
	import { DEFAULT_DEPTH, DEPTHS, DEPTH_SETTING, reviewCacheKey, reviewGame, type ReviewDepth, type ReviewProgress } from '#lib/review/analyse.ts';
	import { CLASSIFICATIONS } from '#lib/review/classify.ts';
	import { keyMomentPlies, nextGuidedDestination } from '#lib/review/moments.ts';
	import { playReviewEvent } from '#lib/review/review-audio.ts';
	import { findDeviation } from '#lib/review/repertoire.ts';
	import {
		BRANCH_INTERVAL_MS, GUIDED_STEP_MS, RETRY_REWIND_MS, decisionTransition, evaluateRetry, isRetryable, lineMoves, retryQueue,
		type DecisionSession
	} from '#lib/review/session.ts';
	import type { Classification, GameRecord, GameReview, MoveReview, ReviewBranchStep, Score } from '#lib/review/types.ts';
	import { readReviewPreferences, writeReviewPreferences } from '#lib/settings/preferences.ts';
	import { DEFAULT_REVIEW_PREFERENCES, type ReviewPreferences } from '#lib/settings/types.ts';

	type Screen = 'loading' | 'overview' | 'review';
	type CoachView = { phase: CoachPhase; classification?: Classification; retry?: RetryMood; headline: string; detail?: string };

	let game = $state<GameRecord>();
	let plies = $state<Ply[]>([]);
	let review = $state<GameReview>();
	let progress = $state<ReviewProgress>();
	let screen = $state<Screen>('loading');
	let fading = $state(false);
	let depth = $state<ReviewDepth>(DEFAULT_DEPTH);
	let orientation = $state<Color>('w');
	let prefs = $state<ReviewPreferences>({ ...DEFAULT_REVIEW_PREFERENCES });
	let decision = $state<DecisionSession>({ kind: 'mainline', ply: 0, generation: 0 });
	let activeBranch = $state<{ role: 'played' | 'recommended'; steps: ReviewBranchStep[] } | undefined>();
	let branchImmediate = $state(false);
	let concluded = $state(false);
	let promo = $state<string | undefined>();
	let status = $state('');
	let error = $state('');
	let analysis: AbortController | undefined;
	let retryAbort: AbortController | undefined;
	let guidedToken = 0;
	let guidedTimer: ReturnType<typeof setTimeout> | undefined;
	let fadeTimer: ReturnType<typeof setTimeout> | undefined;
	let touch: { x: number; y: number } | undefined;
	let panelBody = $state<HTMLDivElement>();
	let settingsOpen = $state(false);
	let moreOpen = $state(false);
	const promotions = [
		{ piece: 'Queen', key: 'q' },
		{ piece: 'Rook', key: 'r' },
		{ piece: 'Bishop', key: 'b' },
		{ piece: 'Knight', key: 'n' }
	];

	let studied = $state.raw(new Set<string>());
	void db.progress.toArray().then((rows) => (studied = new Set(rows.map((row) => row.courseId))));
	const deviation = $derived(plies.length ? findDeviation(courses, plies, game?.userColor, studied) : undefined);
	let deviationLearned = $state(false);
	$effect(() => {
		const key = deviation?.line;
		deviationLearned = false;
		if (key) void db.progress.get(key).then((row) => (deviationLearned = !!row && deviation?.line === key));
	});
	const deviationHref = $derived.by(() => {
		if (!deviation) return '';
		if (deviationLearned) return `/practice/run?line=${encodeURIComponent(deviation.line)}`;
		const line = deviation.course.lines.find((item) => item.key === deviation.line);
		return `/learn/${deviation.course.id}/${line?.id ?? ''}`;
	});

	const moments = $derived(review ? keyMomentPlies(review.moves, prefs.perspective) : []);
	const current = $derived(review?.moves[decision.ply - 1]);
	const retrySide = $derived(prefs.perspective === 'both' ? (game?.userColor ?? orientation) : prefs.perspective);
	const retryCount = $derived(review ? retryQueue(review.moves, retrySide).length : 0);
	const exploring = $derived(decision.kind !== 'mainline');
	const percent = $derived(plies.length ? ((progress?.ply ?? 0) / plies.length) * 100 : 0);
	const graphMoves = $derived(review?.moves ?? progress?.moves ?? []);
	const graphWin = $derived(progress?.win ?? []);
	const bestLabel = $derived(current?.branches?.recommended.steps[0] ? lineAction(current.branches.recommended.steps[0].explanation, 'recommended') : '');
	const followLabel = $derived(current?.branches && current.branches.played.steps.length > 1 ? lineAction(current.branches.played.steps[1].explanation, 'played') : '');
	type DockAction = { id: string; label: string; run: () => void };
	const dockActions = $derived.by((): DockAction[] => {
		const actions: DockAction[] = [];
		if (bestLabel) actions.push({ id: 'best', label: bestLabel, run: () => openBranch('recommended') });
		if (followLabel) {
			actions.push({
				id: 'follow',
				label: followLabel === bestLabel ? 'Show the follow-up' : followLabel,
				run: () => openBranch('played')
			});
		}
		if (current && isRetryable(current)) actions.push({ id: 'retry', label: 'Retry', run: retryHere });
		return actions;
	});
	const visibleActions = $derived(dockActions.slice(0, 2));
	const overflowActions = $derived(dockActions.slice(2));
	const hasPreviousMoment = $derived(decision.kind === 'mainline' && moments.some((ply) => ply < decision.ply));
	const primaryLabel = $derived.by(() => {
		if (concluded) return 'Back to overview';
		if (!review || decision.kind !== 'mainline') return 'Next';
		const dest = nextGuidedDestination(moments, decision.ply, plies.length);
		if (dest.kind === 'end' && dest.ply === decision.ply) return 'Finish review';
		if (dest.kind === 'end') return 'Go to the end';
		return 'Next';
	});
	const shown = $derived.by(() => {
		const startFen = plies[0]?.fenBefore ?? START_FEN;
		if (decision.kind === 'branch') {
			const step = decision.step === 0 ? undefined : decision.line[decision.step - 1];
			const score = decision.step === 0 ? (activeBranch?.role === 'played' ? current?.scoreAfter : current?.best.score) : undefined;
			const fen = step?.fen ?? decision.baseFen;
			return { fen, last: step ? squares(step.uci) : undefined, score, turn: turnOf(fen as typeof START_FEN), movable: 'none' as const };
		}
		if (decision.kind === 'feedback') {
			return {
				fen: decision.feedback.move.fen, last: squares(decision.feedback.move.uci), score: decision.feedback.score,
				turn: other(decision.move.color), movable: 'none' as const
			};
		}
		if (decision.kind === 'retry' && decision.status === 'checking' && decision.submission) {
			const played = lineMoves(decision.move.fenBefore, [decision.submission])[0];
			return { fen: played.fen, last: squares(played.uci), score: undefined, turn: other(decision.move.color), movable: 'none' as const };
		}
		if (decision.kind === 'rewinding' || decision.kind === 'retry') {
			const playing = decision.kind === 'retry' && decision.status === 'playing';
			return {
				fen: decision.move.fenBefore, last: undefined, score: decision.move.best.score, turn: decision.move.color,
				movable: playing ? decision.move.color : 'none' as const
			};
		}
		if (!decision.ply) return { fen: startFen, last: undefined, score: progress?.initialScore, turn: plies[0]?.color ?? 'w', movable: 'none' as const };
		const ply = plies[decision.ply - 1];
		return { fen: ply?.fenAfter ?? startFen, last: squares(ply?.uci), score: current?.scoreAfter, turn: ply ? other(ply.color) : 'w', movable: 'none' as const };
	});
	const barResult = $derived(decision.kind === 'mainline' && decision.ply === plies.length && plies.length > 0 ? game?.result : undefined);
	const marker = $derived.by((): Marker | undefined => {
		if (!prefs.glyphs || decision.kind !== 'mainline' || !current) return;
		const info = CLASSIFICATIONS[current.classification];
		return { square: current.uci.slice(2, 4), classification: current.classification, glyph: info.glyph, color: info.color, label: info.label };
	});
	const arrows = $derived.by((): Arrow[] => {
		if (decision.kind === 'retry') {
			const uci = decision.move.best.uci;
			if (decision.hint === 'origin') return [{ from: uci.slice(0, 2), brush: 'accent' }];
			if (decision.hint === 'arrow') return [{ from: uci.slice(0, 2), to: uci.slice(2, 4), brush: 'good' }];
			return [];
		}
		if (decision.kind !== 'mainline' || !current) return [];
		const played = { from: current.uci.slice(0, 2), to: current.uci.slice(2, 4), brush: 'muted' as const };
		const best = { from: current.best.uci.slice(0, 2), to: current.best.uci.slice(2, 4), brush: 'good' as const };
		const same = current.uci === current.best.uci;
		if (prefs.overlays === 'none' || (prefs.overlays === 'best' && same)) return [];
		if (prefs.overlays === 'played') return [played];
		if (prefs.overlays === 'best') return [best];
		return same ? [played] : [played, best];
	});
	const rows = $derived.by(() => {
		const groups: { number: number; white?: number; black?: number }[] = [];
		for (const [index, ply] of plies.entries()) {
			const number = Number(ply.fenBefore.split(' ')[5]);
			let row = groups.at(-1);
			if (!row || row.number !== number) {
				row = { number };
				groups.push(row);
			}
			row[ply.color === 'w' ? 'white' : 'black'] = index + 1;
		}
		return groups;
	});
	const coach = $derived.by((): CoachView => {
		if (screen === 'loading' || !review || !game) {
			return { phase: 'loading', headline: 'Looking through the game…', detail: plies.length ? `${progress?.ply ?? 0} of ${plies.length} ${plural(plies.length, 'move')}` : undefined };
		}
		if (screen === 'overview') return { phase: 'overview', ...overviewVerdict(game, review) };
		if (concluded && decision.kind === 'mainline') {
			return { phase: 'complete', headline: 'That is the whole game.', detail: 'Return to the overview, or step through any move.' };
		}
		if (decision.kind === 'rewinding') {
			return { phase: 'retry', retry: 'playing', headline: 'Let’s look at that position again.', detail: `${decision.move.san} was ${CLASSIFICATIONS[decision.move.classification].label.toLowerCase()}.` };
		}
		if (decision.kind === 'retry') {
			if (decision.status === 'checking') return { phase: 'retry', retry: 'playing', headline: 'Checking that move…' };
			return { phase: 'retry', retry: 'playing', headline: 'Find a better move.', detail: promo ? 'Choose the piece to promote to.' : 'Use Hint if you want a nudge.' };
		}
		if (decision.kind === 'feedback') {
			const { feedback, move } = decision;
			if (feedback.accepted) {
				const detail = feedback.move.uci === move.best.uci ? 'That is the best move.' : 'That stays within a strong margin of the best move.';
				return { phase: 'retry', retry: 'right', headline: `${feedback.move.san} works.`, detail };
			}
			return { phase: 'retry', retry: 'wrong', headline: `${feedback.move.san} does not hold.`, detail: `The best move is ${move.best.san}.` };
		}
		if (decision.kind === 'branch') {
			const step = decision.step === 0 ? undefined : activeBranch?.steps[decision.step - 1];
			if (!step) {
				const first = activeBranch?.steps[0]?.explanation;
				const headline = activeBranch?.role === 'recommended' ? `The best move is ${current?.best.san ?? 'waiting'}.` : 'Here is the follow-up.';
				return { phase: 'followup', headline, detail: first };
			}
			return { phase: 'followup', headline: step.explanation };
		}
		if (!current) return { phase: 'move', headline: 'Starting position.', detail: 'Next jumps to the first key moment.' };
		return { phase: 'move', classification: current.classification, headline: current.explanation.headline, detail: current.explanation.detail };
	});

	$effect(() => {
		const id = page.params.id;
		const load = new AbortController();
		game = undefined;
		review = undefined;
		progress = undefined;
		error = '';
		status = '';
		screen = 'loading';
		fading = false;
		concluded = false;
		activeBranch = undefined;
		decision = { kind: 'mainline', ply: 0, generation: 0 };
		void (async () => {
			try {
				const [record, preference] = await Promise.all([
					id ? db.games.get(id) : undefined,
					getSetting<number>(DEPTH_SETTING, DEFAULT_DEPTH)
				]);
				if (load.signal.aborted) return;
				if (!record) {
					error = 'This game is missing from your saved matches.';
					return;
				}
				game = record;
				plies = readPgn(record.pgn).plies;
				depth = DEPTHS.find((option) => option.value === preference)?.value ?? DEFAULT_DEPTH;
				orientation = record.userColor ?? 'w';
				prefs = await readReviewPreferences(record.userColor);
				if (load.signal.aborted) return;
				const cached = await db.reviews.get(reviewCacheKey(record.id, depth));
				if (load.signal.aborted) return;
				if (cached) {
					review = cached;
					progress = progressFrom(cached);
					screen = 'overview';
					return;
				}
				await runAnalysis();
			} catch (cause) {
				if (!load.signal.aborted) error = cause instanceof Error ? cause.message : 'Could not open this game.';
			}
		})();
		return () => {
			load.abort();
			analysis?.abort();
			retryAbort?.abort();
			cancelGuided();
			clearTimeout(fadeTimer);
			if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
		};
	});

	$effect(() => {
		if (decision.kind !== 'branch' || !decision.autoplay || decision.step >= decision.line.length) return;
		const generation = decision.generation;
		const step = decision.step;
		const san = decision.line[step]?.san;
		const delay = step === 0 && branchImmediate ? 0 : BRANCH_INTERVAL_MS;
		const timer = setTimeout(() => {
			if (decision.kind !== 'branch' || decision.generation !== generation || decision.step !== step) return;
			decision = decisionTransition(decision, { type: 'tick', generation });
			if (san) playReviewEvent({ kind: 'animated-move', san });
		}, delay);
		return () => clearTimeout(timer);
	});

	$effect(() => {
		if (decision.kind !== 'rewinding') return;
		const generation = decision.generation;
		const timer = setTimeout(() => {
			decision = decisionTransition(decision, { type: 'rewound', generation });
		}, reducedMotion() ? 0 : RETRY_REWIND_MS);
		return () => clearTimeout(timer);
	});

	$effect(() => {
		const active = decision.ply;
		const host = panelBody;
		if (!host || !active || screen !== 'review') return;
		const selected = host.querySelector<HTMLButtonElement>('[aria-current="step"]');
		if (!selected) return;
		const bounds = host.getBoundingClientRect();
		const row = selected.getBoundingClientRect();
		if (row.bottom > bounds.bottom) host.scrollTop += row.bottom - bounds.bottom;
		else if (row.top < bounds.top) host.scrollTop += row.top - bounds.top;
	});

	$effect(() => {
		if (screen === 'review') window.scrollTo(0, 0);
	});

	function progressFrom(value: GameReview): ReviewProgress {
		const first = value.moves[0];
		return {
			ply: value.moves.length, total: value.moves.length, moves: value.moves, opening: value.opening,
			win: first ? [first.winBefore, ...value.moves.map((move) => move.winAfter)] : [],
			initialScore: first?.best.score ?? { cp: 0 }
		};
	}

	function revealOverview() {
		if (reducedMotion()) {
			fading = false;
			screen = 'overview';
			return;
		}
		fading = true;
		screen = 'overview';
		clearTimeout(fadeTimer);
		fadeTimer = setTimeout(() => { fading = false; }, 2500);
	}

	async function runAnalysis(chosen: ReviewDepth = depth) {
		if (!game) return;
		analysis?.abort();
		const run = new AbortController();
		analysis = run;
		cancelGuided();
		retryAbort?.abort();
		screen = 'loading';
		fading = false;
		review = undefined;
		progress = undefined;
		error = '';
		status = '';
		try {
			const cached = await db.reviews.get(reviewCacheKey(game.id, chosen));
			if (run.signal.aborted) return;
			if (cached) {
				review = cached;
				progress = progressFrom(cached);
				screen = 'overview';
				return;
			}
			const result = await reviewGame(game, {
				depth: chosen, plies: $state.snapshot(plies), signal: run.signal,
				onProgress: (value) => { if (!run.signal.aborted) progress = value; }
			});
			if (run.signal.aborted) return;
			review = result;
			revealOverview();
		} catch (cause) {
			if (!run.signal.aborted) error = cause instanceof Error ? cause.message : 'Analysis could not finish.';
		}
	}

	async function changeDepth(value: string) {
		const selected = DEPTHS.find((option) => String(option.value) === value);
		if (!selected || selected.value === depth || exploring) return;
		depth = selected.value;
		const pending = runAnalysis(depth);
		try {
			await setSetting(DEPTH_SETTING, selected.value);
		} catch {
			status = 'Could not remember the depth setting.';
		}
		await pending;
	}

	function squares(uci?: Uci): [string, string] | undefined {
		if (uci && uci.length >= 4) return [uci.slice(0, 2), uci.slice(2, 4)];
	}

	function moveNumber(index: number) {
		const move = plies[index - 1];
		const number = move?.fenBefore.split(' ')[5];
		return move ? number + (move.color === 'w' ? '.' : '…') : '';
	}

	function savePrefs(patch: Partial<ReviewPreferences>) {
		prefs = { ...prefs, ...patch };
		// IndexedDB cannot clone a rune proxy.
		const stored = $state.snapshot(prefs);
		void writeReviewPreferences(stored).catch(() => { status = 'Could not remember that setting.'; });
	}

	function speakCoach() {
		if (!prefs.voice || typeof speechSynthesis === 'undefined') return;
		const text = [coach.headline, coach.detail].filter(Boolean).join(' ');
		if (!text) return;
		speechSynthesis.cancel();
		speechSynthesis.speak(new SpeechSynthesisUtterance(text));
	}

	function toggleVoice() {
		const voice = !prefs.voice;
		savePrefs({ voice });
		if (!voice) {
			if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
			return;
		}
		speakCoach();
	}

	function cancelGuided() {
		guidedToken += 1;
		clearTimeout(guidedTimer);
	}

	function land(ply: number, mode: 'mainline' | 'playback' | 'retry') {
		const move = review?.moves[ply - 1];
		if (!move) return;
		playReviewEvent({
			kind: 'landing', classification: move.classification, color: move.color, playerColor: game?.userColor,
			glyphs: prefs.glyphs, mode, changed: true
		});
	}

	function stepAnimated(ply: number) {
		const from = decision.ply;
		decision = decisionTransition(decision, { type: 'select', ply });
		const san = plies[Math.max(ply, from) - 1]?.san;
		if (san) playReviewEvent({ kind: 'animated-move', san });
		land(ply, 'mainline');
	}

	function playToward(target: number, conclude: boolean) {
		cancelGuided();
		const token = guidedToken;
		const hop = () => {
			if (token !== guidedToken || decision.kind !== 'mainline') return;
			if (decision.ply === target) {
				if (conclude) concluded = true;
				speakCoach();
				return;
			}
			if (reducedMotion()) {
				const from = decision.ply;
				decision = decisionTransition(decision, { type: 'select', ply: target });
				if (target !== from) playReviewEvent({ kind: 'navigation' });
				land(target, 'mainline');
				if (conclude) concluded = true;
				speakCoach();
				return;
			}
			const next = decision.ply + Math.sign(target - decision.ply);
			stepAnimated(next);
			if (next === target) {
				if (conclude) concluded = true;
				speakCoach();
				return;
			}
			guidedTimer = setTimeout(hop, GUIDED_STEP_MS);
		};
		hop();
	}

	function select(ply: number) {
		if (!review || ply < 0 || ply > plies.length) return;
		cancelGuided();
		retryAbort?.abort();
		promo = undefined;
		fading = false;
		const from = decision.ply;
		const wasMain = decision.kind === 'mainline';
		activeBranch = undefined;
		screen = 'review';
		concluded = false;
		if (wasMain && ply === from) return;
		const single = wasMain && Math.abs(ply - from) === 1;
		decision = decisionTransition(decision, { type: 'select', ply });
		if (single) {
			const san = plies[Math.max(ply, from) - 1]?.san;
			if (san) playReviewEvent({ kind: 'animated-move', san });
		} else {
			playReviewEvent({ kind: 'navigation' });
		}
		land(ply, 'mainline');
		speakCoach();
	}

	function startPass() {
		if (!review) return;
		fading = false;
		screen = 'review';
		concluded = false;
		activeBranch = undefined;
		decision = decisionTransition(decision, { type: 'select', ply: 0 });
		const dest = nextGuidedDestination(keyMomentPlies(review.moves, prefs.perspective), 0, review.moves.length);
		playToward(dest.ply, dest.kind === 'end');
	}

	function previousMoment() {
		if (!review || decision.kind !== 'mainline') return;
		const prev = [...moments].reverse().find((ply) => ply < decision.ply);
		if (prev === undefined) return;
		concluded = false;
		playToward(prev, false);
	}

	function primary() {
		if (!review || decision.kind !== 'mainline') return;
		if (concluded) {
			screen = 'overview';
			concluded = false;
			return;
		}
		const dest = nextGuidedDestination(moments, decision.ply, plies.length);
		if (dest.kind === 'end' && dest.ply === decision.ply) {
			concluded = true;
			speakCoach();
			return;
		}
		playToward(dest.ply, dest.kind === 'end');
	}

	function navigate(direction: number) {
		if (decision.kind === 'branch') {
			const previous = decision.step;
			decision = decisionTransition(decision, { type: 'step', step: previous + direction });
			if (decision.kind !== 'branch' || decision.step === previous) return;
			const san = decision.line[Math.max(decision.step, previous) - 1]?.san;
			if (san && Math.abs(decision.step - previous) === 1) playReviewEvent({ kind: 'animated-move', san });
			else playReviewEvent({ kind: 'navigation' });
			return;
		}
		if (decision.kind === 'mainline') select(decision.ply + direction);
	}

	function handleKeys(event: KeyboardEvent) {
		if (settingsOpen) return;
		if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey
			|| (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable]'))) return;
		if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
			event.preventDefault();
			navigate(event.key === 'ArrowLeft' ? -1 : 1);
		} else if (event.key === 'Escape' && exploring) exitMode();
	}

	function touchStart(event: TouchEvent) {
		const point = event.touches[0];
		touch = point && event.touches.length === 1 ? { x: point.clientX, y: point.clientY } : undefined;
	}

	function touchEnd(event: TouchEvent) {
		const point = event.changedTouches[0];
		if (!touch || !point) return;
		const dx = point.clientX - touch.x;
		const dy = point.clientY - touch.y;
		touch = undefined;
		if (Math.abs(dx) >= 42 && Math.abs(dx) > Math.abs(dy) * 1.4) navigate(dx < 0 ? 1 : -1);
	}

	function openBranch(role: 'played' | 'recommended') {
		if (!current?.branches) return;
		const steps = role === 'recommended' ? current.branches.recommended.steps : current.branches.played.steps.slice(1);
		if (!steps.length) return;
		cancelGuided();
		retryAbort?.abort();
		playReviewEvent({ kind: 'navigation' });
		branchImmediate = role === 'played';
		activeBranch = { role, steps };
		decision = decisionTransition(decision, {
			type: 'branch',
			baseFen: role === 'played' ? current.fenAfter : current.fenBefore,
			line: steps.map((step) => ({ fen: step.fenAfter, san: step.san, uci: step.uci })),
			autoplay: prefs.autoplay
		});
	}

	function exitMode() {
		cancelGuided();
		retryAbort?.abort();
		promo = undefined;
		activeBranch = undefined;
		playReviewEvent({ kind: 'navigation' });
		decision = decisionTransition(decision, { type: 'exit' });
	}

	function beginRetry(move: MoveReview, queue: number[]) {
		cancelGuided();
		promo = undefined;
		activeBranch = undefined;
		playReviewEvent({ kind: 'navigation' });
		orientation = move.color;
		screen = 'review';
		decision = decisionTransition(decision, { type: 'retry', move, queue });
	}

	function retryHere() {
		if (!current || !review || !isRetryable(current)) return;
		const rest = retryQueue(review.moves, current.color).filter((item) => item.ply > current.ply).map((item) => item.ply);
		beginRetry(current, rest);
	}

	function retryAll() {
		if (!review) return;
		const queue = retryQueue(review.moves, retrySide);
		const first = queue[0];
		if (!first) return;
		beginRetry(first, queue.slice(1).map((item) => item.ply));
	}

	function afterRetry() {
		if (decision.kind !== 'feedback' || !review) return;
		const [next, ...rest] = decision.queue;
		if (next === undefined) {
			exitMode();
			status = 'Retry complete. You found a better move for each position.';
			return;
		}
		const move = review.moves[next - 1];
		if (move) beginRetry(move, rest);
	}

	function boardMove(value: string) {
		if (decision.kind !== 'retry' || decision.status !== 'playing') return;
		if (value.length >= 5) {
			promo = value.slice(0, 4);
			return;
		}
		void submitRetry(value);
	}

	async function submitRetry(value: string) {
		if (decision.kind !== 'retry') return;
		const uci = value as Uci;
		const next = decisionTransition(decision, { type: 'submit', uci });
		if (next.kind !== 'retry' || next.status !== 'checking') return;
		const generation = next.generation;
		const move = next.move;
		decision = next;
		promo = undefined;
		const check = new AbortController();
		retryAbort = check;
		try {
			const feedback = await evaluateRetry(move, uci, check.signal);
			if (check.signal.aborted) return;
			decision = decisionTransition(decision, { type: 'checked', generation, uci, feedback });
			if (decision.kind === 'feedback') playReviewEvent({ kind: 'retry', correct: feedback.accepted });
		} catch (cause) {
			if (check.signal.aborted) return;
			decision = decisionTransition(decision, { type: 'checkFailed', generation, uci });
			status = cause instanceof Error ? cause.message : 'Could not check that move.';
		}
	}

	function setAutoplay(enabled: boolean) {
		savePrefs({ autoplay: enabled });
		if (decision.kind === 'branch') decision = decisionTransition(decision, { type: 'autoplay', enabled });
	}

	function setPerspective(value: string) {
		if (value !== 'w' && value !== 'b' && value !== 'both') return;
		cancelGuided();
		savePrefs({ perspective: value });
	}

	function setOverlays(value: string) {
		if (value !== 'none' && value !== 'played' && value !== 'best' && value !== 'both') return;
		savePrefs({ overlays: value });
	}
</script>

<svelte:head><title>Game review · Chessmode</title></svelte:head>
<svelte:window onkeydown={handleKeys} />

{#snippet coachBubble(size: 'compact' | 'large')}
	<Coach phase={coach.phase} classification={coach.classification} retry={coach.retry} headline={coach.headline} detail={coach.detail} showMascot={prefs.coach} {size} />
{/snippet}

{#snippet playerCard(side: Color)}
	{@const player = side === 'w' ? game?.white : game?.black}
	{@const stats = side === 'w' ? review?.white : review?.black}
	{@const name = player?.name && player.name !== '?' ? player.name : side === 'w' ? 'White' : 'Black'}
	<div class="player">
		<span aria-hidden="true" class:white={side === 'w'} class="dot"></span>
		<b title={name}>{name}</b>
		{#if player?.rating}<span class="rating">{player.rating}</span>{/if}
		{#if stats}<span class="chip">{stats.accuracy.toFixed(1)}%</span>{/if}
	</div>
{/snippet}

{#snippet moveButton(index: number | undefined)}
	{#if index !== undefined}
		{@const analysed = review?.moves[index - 1] ?? progress?.moves[index - 1]}
		<button type="button" class="move" class:active={decision.ply === index} aria-current={decision.ply === index ? 'step' : undefined} onclick={() => select(index)}>
			<span>{plies[index - 1].san}</span>
			{#if analysed}<Label classification={analysed.classification} />{/if}
		</button>
	{:else}<span></span>{/if}
{/snippet}

{#snippet repertoireCard()}
	{#if deviation}
		<section class="card repertoire" aria-label="Repertoire">
			<span class="eyeline">{deviation.course.name}</span>
			{#if deviation.kind === 'you'}
				<p><b>You left your repertoire at {moveNumber(deviation.ply + 1)}</b> You played <span class="san">{deviation.played.san}</span>, the course plays <span class="san">{deviation.expected.san}</span>.</p>
			{:else if deviation.kind === 'opponent'}
				<p><b>Your opponent left the course at {moveNumber(deviation.ply + 1)}</b> <span class="san">{deviation.played.san}</span> is not prepared in the course, so you were on your own from here.</p>
			{:else}
				<p><b>You played the course to the end of the line</b> Every move up to {moveNumber(deviation.ply + 1)} was from your repertoire.</p>
			{/if}
			<div class="repertoire-actions">
				<button class="btn sm btn-surface" onclick={() => select(deviation.kind === 'complete' ? deviation.ply + 1 : deviation.ply)}>Show position</button>
				<a class="btn sm btn-primary" href={deviationHref}>{deviationLearned ? 'Drill this line' : 'Learn this line'}</a>
			</div>
		</section>
	{/if}
{/snippet}

{#snippet moveListCard()}
	<div class="card moves" aria-label="Move list">
		{#each rows as row (row.number)}
			<div class="move-row"><span>{row.number}</span>{@render moveButton(row.white)}{@render moveButton(row.black)}</div>
		{/each}
	</div>
{/snippet}

{#snippet momentsCard()}
	{#if review && moments.length}
		<section class="card moments" aria-label="Key moments">
			<div class="moments-head">
				<h2>Key moments</h2>
				{#if retryCount}<button type="button" class="btn sm btn-surface" onclick={retryAll}>Retry {retrySide === 'w' ? 'White' : 'Black'} mistakes</button>{/if}
			</div>
			<div class="moment-list">
				{#each moments as ply (ply)}
					{@const move = review.moves[ply - 1]}
					{#if move}
						<button type="button" class:active={decision.ply === ply} onclick={() => select(ply)}>
							<span>{moveNumber(ply)} {move.san}</span><Label classification={move.classification} named />
						</button>
					{/if}
				{/each}
			</div>
		</section>
	{/if}
{/snippet}

<main class="page review" data-screen={screen}>
	<header class="header">
		<a class="back" href="/matches" aria-label="Back to Matches">
			<ChevronLeft size={18} stroke-width={1.75} />
		</a>
		<div class="titles">
			<h1>Game review</h1>
			{#if game}<p>{[review?.opening?.name ?? progress?.opening?.name ?? game.opening?.name, game.speed, game.result].filter(Boolean).join(' · ')}</p>{/if}
			{#if game}
				<div class="handoff">
					<a href={`/analysis?game=${encodeURIComponent(game.id)}`}>Open in analysis board</a>
					<a href={`/analysis?game=${encodeURIComponent(game.id)}&add=course`}>Add to a course</a>
				</div>
			{/if}
		</div>
		{#if game}
			<button type="button" class="icon-btn" aria-label="Flip board" onclick={() => { orientation = other(orientation); }}>
				<ArrowRightLeft size={18} stroke-width={1.75} />
			</button>
			<button type="button" class="icon-btn" aria-label="Review settings" aria-expanded={settingsOpen} onclick={() => { settingsOpen = true; }}>
				<Sun size={18} stroke-width={1.75} />
			</button>
		{/if}
	</header>

	{#if game}
		<div class="workspace">
			<section class="board-column" aria-label="Game board">
				{@render playerCard(other(orientation))}
				<div class="board-frame" role="group" aria-label="Board position" ontouchstartcapture={touchStart} ontouchendcapture={touchEnd} ontouchcancel={() => { touch = undefined; }}>
					<EvalBar score={shown.score as Score | undefined} turn={shown.turn} {orientation} result={barResult} loading={screen === 'loading'} />
					<div class="board-slot">
						<Board fen={shown.fen} orientation={orientation === 'w' ? 'white' : 'black'} lastMove={shown.last} {arrows} {marker}
							movable={shown.movable} onmove={boardMove} />
					</div>
				</div>
				{@render playerCard(orientation)}
			</section>

			<section class="panel" aria-label="Coach">
				{#if review && screen !== 'loading'}
					<div class="panel-head">
						{@render coachBubble(screen === 'review' ? 'compact' : 'large')}
						{#if screen === 'review' && decision.kind === 'mainline' && current}
							<div class="coach-label"><Label classification={current.classification} named /></div>
						{/if}
					</div>
				{/if}

				<div class="panel-body" bind:this={panelBody}>
					{#if error}
						<div class="card error" role="alert"><p>{error}</p><button class="btn btn-surface compact" type="button" onclick={() => void runAnalysis()}>Try analysis again</button></div>
					{/if}
					{#if status}<p role="status" class="status">{status}</p>{/if}

					{#if screen !== 'review' || fading}
						<div class="stage">
							{#if review && (screen === 'overview' || fading)}
								<div class="overview-layer">
									<Overview {game} {review} ply={decision.ply} onselect={select} />
									{@render repertoireCard()}
									<details class="card archive">
										<summary><ChevronRight size={18} stroke-width={1.75} />Moves and key moments</summary>
										{@render moveListCard()}
										{@render momentsCard()}
									</details>
								</div>
							{/if}
							{#if screen === 'loading' || fading}
								<div class="loading-layer" class:done={fading}>
									<ReviewLoading {game} progress={percent} finished={fading}>
										{#snippet coach()}{@render coachBubble('large')}{/snippet}
									</ReviewLoading>
								</div>
							{/if}
						</div>
					{/if}

					{#if screen === 'review' && review}
						{#if decision.kind === 'mainline'}
							<div class="navigation" aria-label="Move navigation">
								<button class="btn btn-surface" type="button" aria-label="First position" disabled={!decision.ply} onclick={() => select(0)}><ChevronsLeft size={18} stroke-width={1.75} /></button>
								<button class="btn btn-surface" type="button" aria-label="Previous move" disabled={!decision.ply} onclick={() => navigate(-1)}><ChevronLeft size={18} stroke-width={1.75} /></button>
								<button class="btn btn-surface" type="button" aria-label="Next move" disabled={decision.ply === plies.length} onclick={() => navigate(1)}><ChevronRight size={18} stroke-width={1.75} /></button>
								<button class="btn btn-surface" type="button" aria-label="Last move" disabled={decision.ply === plies.length} onclick={() => select(plies.length)}><ChevronsRight size={18} stroke-width={1.75} /></button>
							</div>
							<button type="button" class="back-overview" onclick={() => { screen = 'overview'; concluded = false; }}>Overview</button>
						{/if}
						{#if decision.kind === 'branch'}
							{@const line = decision}
							<div class="variation" aria-label="Line moves">
								{#each line.line as move, index}
									<button type="button" class:active={line.step === index + 1} onclick={() => navigate(index + 1 - line.step)}>{move.san}</button>
								{/each}
							</div>
						{/if}
						<EvalGraph win={graphWin} moves={graphMoves} total={plies.length} ply={decision.ply} onselect={select} />
						{@render repertoireCard()}
						{@render moveListCard()}
						{@render momentsCard()}
					{/if}
				</div>

				{#if screen === 'overview' && review}
					<div class="dock">
						<button class="btn btn-primary block" type="button" onclick={startPass}>Start review</button>
					</div>
				{:else if screen === 'review' && review}
					<div class="dock">
						{#if promo}
							<div class="dock-row scroll" role="group" aria-label="Promote pawn">
								{#each promotions as { piece, key } (key)}
									<button class="btn btn-primary" type="button" onclick={() => void submitRetry(promo + key)}>{piece}</button>
								{/each}
							</div>
						{/if}
						{#if decision.kind === 'branch'}
							{@const line = decision}
							<div class="dock-row">
								<button class="btn btn-surface" type="button" aria-pressed={line.autoplay} onclick={() => setAutoplay(!line.autoplay)}>{line.autoplay ? 'Autoplay on' : 'Autoplay off'}</button>
								<button class="btn btn-surface" type="button" disabled={line.step === 0} onclick={() => navigate(-1)}>Previous</button>
								<button class="btn btn-primary grow" type="button" disabled={line.step === line.line.length} onclick={() => navigate(1)}>Next line move</button>
							</div>
							<div class="dock-row">
								<button class="btn btn-ghost" type="button" onclick={exitMode}>Hide line</button>
							</div>
						{:else if decision.kind === 'rewinding' || decision.kind === 'retry'}
							<div class="dock-row">
								{#if decision.kind === 'retry' && decision.status === 'playing'}
									<button class="btn btn-surface" type="button" onclick={() => { decision = decisionTransition(decision, { type: 'hint' }); }}>Hint</button>
								{/if}
								<button class="btn btn-primary grow" type="button" onclick={exitMode}>Back to game</button>
							</div>
						{:else if decision.kind === 'feedback'}
							<div class="dock-row">
								{#if decision.feedback.accepted}
									<button class="btn btn-primary grow" type="button" onclick={afterRetry}>{decision.queue.length ? 'Next mistake' : 'Back to game'}</button>
								{:else}
									<button class="btn btn-primary grow" type="button" onclick={() => { promo = undefined; decision = decisionTransition(decision, { type: 'tryAgain' }); }}>Try again</button>
								{/if}
								{#if !decision.feedback.accepted || decision.queue.length}<button class="btn btn-ghost" type="button" onclick={exitMode}>Back to game</button>{/if}
							</div>
						{:else}
							<div class="dock-row">
								<button class="btn btn-surface" type="button" aria-label="Previous key moment" disabled={!hasPreviousMoment} onclick={previousMoment}>Previous</button>
								<button class="btn btn-primary grow" type="button" onclick={primary}>{primaryLabel}</button>
							</div>
							{#if visibleActions.length}
								<div class="dock-row actions">
									{#each visibleActions as action (action.id)}
										<button class="btn btn-surface" type="button" onclick={action.run}>{action.label}</button>
									{/each}
									{#if overflowActions.length}
										<button type="button" class="icon-btn" aria-label="More actions" aria-expanded={moreOpen} aria-haspopup="dialog" onclick={() => { moreOpen = true; }}>
											<Ellipsis size={18} stroke-width={1.75} />
										</button>
									{/if}
								</div>
							{/if}
						{/if}
					</div>
				{/if}
			</section>
		</div>
	{:else if error}
		<p role="alert" class="card error">{error}</p>
	{:else}
		<p role="status" class="card empty">Loading game…</p>
	{/if}
</main>

{#if moreOpen && overflowActions.length}
	<Sheet labelledby="review-more-title" ondismiss={() => { moreOpen = false; }}>
		<div class="more-sheet">
			<h2 id="review-more-title">More</h2>
			{#each overflowActions as action (action.id)}
				<button class="btn btn-surface block" type="button" onclick={() => { moreOpen = false; action.run(); }}>{action.label}</button>
			{/each}
		</div>
	</Sheet>
{/if}

{#if settingsOpen && game}
	<ReviewSettings
		{prefs}
		{depth}
		depthDisabled={exploring}
		onclose={() => { settingsOpen = false; }}
		onperspective={setPerspective}
		onoverlays={setOverlays}
		ondepth={(value) => { settingsOpen = false; void changeDepth(String(value)); }}
		onvoice={toggleVoice}
		oncoach={() => savePrefs({ coach: !prefs.coach })}
		onglyphs={() => savePrefs({ glyphs: !prefs.glyphs })}
	/>
{/if}

<style>
	.review {
		display: flex;
		flex-direction: column;
		max-width: 580px;
		min-height: 100dvh;
		padding-top: 12px;
		padding-bottom: 0;
	}
	.header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 8px;
		flex: 0 0 auto;
	}
	.titles {
		flex: 1;
		min-width: 0;
	}
	.handoff {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 12px;
		margin-top: 4px;
	}
	.handoff a {
		color: var(--accent-hi);
		font-size: 12px;
		font-weight: 650;
		white-space: normal;
	}
	h1 {
		font-size: 22px;
		line-height: 1.12;
		letter-spacing: -0.045em;
	}
	.header p {
		margin-top: 2px;
		color: var(--text-2);
		font-size: 11px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.back {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		flex: 0 0 auto;
		border: 1px solid var(--stroke-2);
		border-radius: var(--r-sm);
		background: var(--surface-2);
	}
	.header .icon-btn {
		width: 40px;
		height: 40px;
	}
	.workspace {
		display: flex;
		flex-direction: column;
		gap: 8px;
		min-width: 0;
		min-height: 0;
	}
	.board-column {
		--board-cap: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 5px;
		min-width: 0;
		flex: 0 0 auto;
	}
	.player,
	.board-frame {
		width: var(--board-cap);
	}
	.player {
		display: flex;
		align-items: center;
		min-width: 0;
		gap: 8px;
		min-height: 26px;
		padding: 0 1px;
	}
	.player b {
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		font-size: 13px;
	}
	.rating {
		flex: 0 0 auto;
		color: var(--text-2);
		font: 11px var(--mono);
	}
	.player .chip {
		margin-left: auto;
		color: var(--text);
	}
	.dot {
		width: 10px;
		height: 10px;
		flex: 0 0 auto;
		border-radius: 50%;
		background: var(--eval-black);
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.38);
	}
	.dot.white {
		background: var(--sq-light);
		box-shadow: none;
	}
	.board-frame {
		display: grid;
		grid-template-columns: 28px minmax(0, 1fr);
		gap: 8px;
		align-items: stretch;
	}
	.board-slot {
		min-width: 0;
	}
	.panel {
		display: flex;
		flex-direction: column;
		gap: 8px;
		min-width: 0;
		min-height: 0;
	}
	.panel-head {
		display: grid;
		gap: 8px;
		flex: 0 0 auto;
		padding: 12px 14px;
		border: 1px solid var(--stroke);
		border-radius: var(--r-lg);
		background: var(--g-card-glow), var(--surface-2);
	}
	.coach-label {
		display: flex;
	}
	.panel-body {
		display: flex;
		flex-direction: column;
		gap: 12px;
		min-width: 0;
		min-height: 0;
	}
	/* Cards use overflow:hidden, so a fixed-height panel would shrink them to slivers. :global reaches child components such as the graph. */
	.panel-body > :global(*) {
		flex: 0 0 auto;
		min-height: min-content;
	}
	.stage {
		display: grid;
	}
	.stage > * {
		grid-area: 1 / 1;
	}
	.overview-layer {
		display: grid;
		gap: 12px;
	}
	.loading-layer.done {
		pointer-events: none;
	}
	.back-overview {
		justify-self: start;
		color: var(--text-2);
		font-size: 13px;
		font-weight: 600;
	}
	.eyeline {
		display: block;
		color: var(--text-2);
		font: 10px var(--mono);
	}
	.repertoire-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.dock {
		display: grid;
		gap: 8px;
		flex: 0 0 auto;
		min-width: 0;
		max-width: 100%;
	}
	.dock-row {
		display: flex;
		gap: 8px;
		align-items: center;
		min-width: 0;
		max-width: 100%;
	}
	.dock-row.scroll {
		overflow-x: auto;
	}
	.dock-row.actions {
		flex-wrap: wrap;
	}
	.dock-row.actions .btn {
		flex: 1 1 0;
		min-width: 0;
		max-width: 100%;
		height: auto;
		min-height: 44px;
		padding: 8px 12px;
		white-space: normal;
		line-height: 1.25;
		text-align: center;
	}
	.more-sheet {
		display: grid;
		gap: 10px;
	}
	.more-sheet h2 {
		font-size: 18px;
	}
	.dock .btn {
		height: 44px;
		padding: 0 14px;
		font-size: 14px;
		flex: 0 0 auto;
	}
	.dock .grow {
		flex: 1 1 auto;
	}
	.dock .block {
		height: 52px;
		padding: 0 26px;
		font-size: 16px;
		flex: 1 1 auto;
	}
	.navigation {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 7px;
	}
	.navigation .btn {
		height: 36px;
		padding: 0;
		border-radius: var(--r-sm);
		font-size: 18px;
	}
	.variation {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
	}
	.variation button {
		padding: 4px 7px;
		border-radius: var(--r-xs);
		background: var(--surface-3);
		font: 12px var(--mono);
	}
	.active {
		background: var(--accent-soft) !important;
		color: var(--accent-hi);
	}
	.error {
		padding: 12px 14px;
		color: var(--bad);
	}
	.error button {
		margin-top: 8px;
	}
	.empty {
		padding: 12px 14px;
		font-size: 13px;
		color: var(--text-2);
	}
	.status {
		color: var(--good);
		font-size: 13px;
		padding: 0 4px;
	}
	.moves {
		padding: 6px;
	}
	.move-row {
		display: grid;
		grid-template-columns: 37px 1fr 1fr;
		gap: 3px;
		align-items: center;
	}
	.move-row:nth-child(even) {
		background: var(--surface-1);
		border-radius: var(--r-xs);
	}
	.move-row > span {
		text-align: center;
		color: var(--text-2);
		font: 11px var(--mono);
	}
	.move {
		display: flex;
		text-align: left;
		align-items: center;
		justify-content: space-between;
		min-height: 35px;
		padding: 3px 9px;
		gap: 5px;
		font: 13px var(--mono);
		border-radius: var(--r-xs);
	}
	@media (hover: hover) and (pointer: fine) {
		.move:hover,
		.moment-list button:hover {
			background: var(--surface-4);
		}
	}
	.repertoire {
		display: grid;
		gap: 8px;
		padding: 12px 14px;
	}
	.repertoire p {
		font-size: 14px;
		line-height: 1.5;
		color: var(--text-2);
	}
	.repertoire p b {
		display: block;
		color: var(--text);
		font-weight: 600;
	}
	.repertoire .san {
		font: 600 13px var(--mono);
		color: var(--accent-hi);
	}
	.moments {
		padding: 10px 12px;
	}
	.moments-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin-bottom: 6px;
	}
	.moments h2 {
		font-size: 14px;
	}
	.moments-head .btn {
		height: 34px;
		padding: 0 12px;
		font-size: 12px;
	}
	.moment-list button {
		display: flex;
		min-height: 35px;
		width: 100%;
		justify-content: space-between;
		align-items: center;
		padding: 3px 7px;
		border-radius: var(--r-xs);
		gap: 5px;
		font: 12px var(--mono);
	}
	.archive {
		padding: 0;
	}
	.archive summary {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 12px 14px;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		list-style: none;
	}
	.archive summary::-webkit-details-marker {
		display: none;
	}
	.archive summary :global(svg) {
		flex: 0 0 auto;
		transition: transform 220ms var(--ease-out);
	}
	.archive[open] > summary :global(svg) {
		transform: rotate(90deg);
	}
	.archive .moves,
	.archive .moments {
		max-height: 220px;
		overflow: auto;
		border: 0;
		box-shadow: none;
		background: transparent;
	}
	@media (max-width: 1023px) {
		.review[data-screen='review'] {
			height: 100dvh;
			overflow: hidden;
		}
		.review[data-screen='review'] .workspace {
			flex: 1;
			min-height: 0;
		}
		.review[data-screen='review'] .board-column {
			--board-cap: min(100%, calc(100dvh - 430px));
		}
		.review[data-screen='review'] .panel {
			flex: 1;
			min-height: 0;
			overflow: hidden;
		}
		.review[data-screen='review'] .panel-body {
			flex: 1;
			overflow: auto;
			overscroll-behavior: contain;
		}
		.review[data-screen='review'] .dock {
			padding-bottom: calc(6px + var(--safe-bottom));
			background: linear-gradient(180deg, rgba(13, 13, 14, 0), var(--bg) 22%);
		}
		.review[data-screen='overview'] .dock {
			padding: 12px 0 calc(12px + var(--safe-bottom));
		}
	}
	@media (min-width: 1024px) {
		.review {
			max-width: 1160px;
			height: 100dvh;
			overflow: hidden;
			padding-bottom: 16px;
		}
		.header {
			margin-bottom: 12px;
		}
		h1 {
			font-size: 28px;
		}
		.header p {
			font-size: 13px;
		}
		.workspace {
			flex: 1;
			display: grid;
			grid-template-columns: minmax(0, 1.15fr) minmax(360px, 0.9fr);
			gap: 20px;
			align-items: stretch;
		}
		.board-column {
			--board-cap: min(100%, calc(100dvh - 220px));
			justify-content: center;
			min-height: 0;
		}
		.player b {
			font-size: 15px;
		}
		.panel {
			height: 100%;
			gap: 0;
			overflow: hidden;
			background: var(--surface-1);
			border: 1px solid var(--stroke);
			border-radius: var(--r-lg);
		}
		.panel-head {
			padding: 16px 16px 12px;
			border: 0;
			border-bottom: 1px solid var(--stroke);
			border-radius: 0;
			background: var(--g-card-glow), var(--surface-2);
		}
		.panel-body {
			flex: 1;
			overflow: auto;
			overscroll-behavior: contain;
			padding: 14px 16px;
		}
		.dock {
			padding: 12px 16px 16px;
			border-top: 1px solid var(--stroke);
			background: var(--surface-1);
		}
		.navigation .btn {
			height: 40px;
		}
	}
</style>
