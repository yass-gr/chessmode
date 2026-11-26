<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { courses } from '#lib/courses/index.ts';
	import { courseScope, defaultDepth } from '#lib/courses/depth.ts';
	import { modeAvailability } from '#lib/courses/unlocks.ts';
	import type { Course, Line, LineKey } from '#lib/courses/types.ts';
	import LineTrainer from '#lib/components/train/LineTrainer.svelte';
	import ResultSheet from '#lib/components/train/ResultSheet.svelte';
	import Sheet from '#lib/components/Sheet.svelte';
	import { readCoursePreferences } from '#lib/settings/preferences.ts';
	import { finishPractice } from '#lib/srs.ts';
	import { logSession } from '#lib/progress.ts';
	import { db } from '#lib/db.ts';
	import { loadDepth, loadProgress } from '#lib/train/data.ts';
	import { commonPrefix, openingSkip } from '#lib/train/lines.ts';
	import { clockSpeed, dealDeck, drain, DRILL_ADVANCE_MS, lineBonusMs, penalise, pickNext, reward, TIME_MODE } from '#lib/train/session.ts';
	import { best } from '#lib/train/stats.ts';
	import type { AttemptResult } from '#lib/train/types.ts';
	import type { LineProgress } from '#lib/db.ts';

	type Item = { course: Course; line: Line };

	const mode = $derived(page.url.searchParams.get('mode') === 'time' ? 'time' : 'drill');
	const scope = $derived(page.url.searchParams.get('course') ?? undefined);

	let pool = $state<Item[]>([]);
	let skips = $state<Record<string, boolean>>({});
	let order = $state<Item[]>([]);
	let cursor = 0;
	let generation = 0;
	let item = $state<Item | undefined>();
	let round = $state(0);
	let loaded = $state(false);
	let blocked = $state('');
	let unseen = $state<Item | undefined>();
	let streak = $state(0);
	let bestStreak = $state(0);
	let previousBest = $state(0);
	let cleanLines = $state(0);
	let mistakes = $state(0);
	let points = $state(0);
	let livePoints = $state(0);
	let finished = 0;
	let offer = $state(false);
	let over = $state(false);
	let settled = false;
	let remaining = $state<number>(TIME_MODE.startMs);
	let bump = $state('');
	let bumpKind = $state<'plus' | 'minus'>('plus');

	function itemsFrom(progress: Map<LineKey, LineProgress>, learnedOnly: boolean): Item[] {
		return courses
			.filter((course) => !scope || course.id === scope)
			.flatMap((course) =>
				course.lines
					.filter((line) => (learnedOnly ? progress.has(line.key) : !progress.has(line.key)))
					.map((line) => ({ course, line }))
			);
	}

	onMount(async () => {
		const [progress, sessions] = await Promise.all([loadProgress(), db.sessions.toArray()]);
		const learned = itemsFrom(progress, true);
		if (scope) {
			const course = courses.find((item) => item.id === scope);
			const gate = modeAvailability(mode, learned.length, course?.lines.length ?? 0);
			if (gate.kind === 'locked') blocked = `Learn ${gate.remaining} more ${gate.remaining === 1 ? 'line' : 'lines'}. ${mode === 'time' ? 'Time' : 'Drill'} opens right after.`;
			else if (gate.kind === 'unavailable') blocked = gate.reason;
		}
		pool = learned;
		previousBest = best(sessions.filter((row) => !scope || row.courseId === scope), mode);
		const ids = [...new Set(learned.map((item) => item.course.id))];
		const prefRows = await Promise.all(ids.map(async (id) => [id, (await readCoursePreferences(id)).skipSharedStart] as const));
		skips = Object.fromEntries(prefRows);
		const depths = await Promise.all((scope ? courses.filter((course) => course.id === scope) : courses).map(async (course) => [course.id, await loadDepth(course.id)] as const));
		const depthOf = Object.fromEntries(depths);
		unseen = (scope ? courses.filter((course) => course.id === scope) : courses).flatMap((course) => {
			const selected = courseScope(course, depthOf[course.id] ?? defaultDepth(), progress);
			const next = selected.next ?? course.lines.find((line) => !progress.has(line.key));
			return next ? [{ course, line: next }] : [];
		})[0];
		loaded = true;
		if (!blocked && pool.length) begin();
	});

	function begin() {
		generation += 1;
		settled = false;
		over = false;
		offer = false;
		streak = 0;
		bestStreak = 0;
		cleanLines = 0;
		mistakes = 0;
		points = 0;
		livePoints = 0;
		finished = 0;
		remaining = TIME_MODE.startMs;
		order = mode === 'drill' ? dealDeck(pool) : [];
		cursor = 0;
		pull(generation);
	}

	function pull(gen: number) {
		if (gen !== generation || over || offer) return;
		if (mode === 'drill') {
			if (cursor >= order.length) {
				if (unseen) {
					offer = true;
					return;
				}
				order = dealDeck(pool);
				cursor = 0;
			}
			item = order[cursor];
			cursor += 1;
		} else {
			item = pickNext(pool, item);
		}
		round += 1;
		livePoints = 0;
	}

	function flash(text: string, kind: 'plus' | 'minus') {
		bump = text;
		bumpKind = kind;
		setTimeout(() => {
			if (bump === text) bump = '';
		}, 600);
	}

	function record() {
		if (settled) return;
		settled = true;
		generation += 1;
		if (finished === 0) return;
		void logSession({
			mode,
			courseId: scope,
			lines: cleanLines,
			mistakes,
			score: mode === 'time' ? points : bestStreak,
			metric: mode === 'time' ? 'moves' : 'lines',
			reps: finished
		});
	}

	function settle() {
		const played = finished;
		record();
		if (played === 0) void goto('/drill');
		else over = true;
	}

	function onmistake() {
		if (over) return;
		mistakes += 1;
		if (mode === 'drill') streak = 0;
		if (mode === 'time') {
			remaining = penalise(remaining);
			flash(`−${TIME_MODE.penaltyMs / 1000}s`, 'minus');
			if (remaining <= 0) settle();
		}
	}

	function onhint() {
		if (mode === 'drill') streak = 0;
	}

	function onprogress(attempt: AttemptResult) {
		livePoints = attempt.points;
	}

	function onfinish(attempt: AttemptResult) {
		if (over || !item) return;
		const gen = generation;
		const current = item;
		finished += 1;
		void finishPractice(current.line.key, attempt.mistakes, attempt.hints);
		const clean = attempt.mistakes === 0 && attempt.hints === 0;
		if (mode === 'drill') {
			if (clean) {
				streak += 1;
				bestStreak = Math.max(bestStreak, streak);
				cleanLines += 1;
			}
			if (cursor >= order.length && unseen) {
				offer = true;
				return;
			}
			setTimeout(() => pull(gen), clean ? DRILL_ADVANCE_MS : TIME_MODE.nextLineMs);
			return;
		}
		points += attempt.points;
		livePoints = 0;
		if (clean) {
			cleanLines += 1;
			const bonus = lineBonusMs(current.line.plies.length);
			remaining = reward(remaining, current.line.plies.length, true);
			if (bonus) flash(`+${bonus / 1000}s`, 'plus');
		}
		if (remaining <= 0) {
			settle();
			return;
		}
		setTimeout(() => pull(gen), TIME_MODE.nextLineMs);
	}

	function keepDrilling() {
		offer = false;
		order = dealDeck(pool);
		cursor = 0;
		pull(generation);
	}

	$effect(() => {
		if (mode !== 'time' || over || !item) return;
		let last = performance.now();
		const timer = setInterval(() => {
			const at = performance.now();
			remaining = drain(remaining, at - last, cleanLines);
			last = at;
			if (remaining <= 0) settle();
		}, 100);
		return () => clearInterval(timer);
	});

	function startAtFor(current: Item): number {
		const mates = pool.filter((entry) => entry.course.id === current.course.id).map((entry) => entry.line);
		return openingSkip({
			mode,
			enabled: skips[current.course.id] ?? false,
			lines: mates,
			line: current.line,
			firstLearn: false
		});
	}

	function sharedFor(current: Item): boolean {
		const mates = pool.filter((entry) => entry.course.id === current.course.id).map((entry) => entry.line);
		return mates.length >= 2 && commonPrefix(mates) >= 2;
	}

	const seconds = $derived(Math.ceil(remaining / 1000));
	const shownPoints = $derived(points + livePoints);
	const isBest = $derived((mode === 'time' ? points : bestStreak) > previousBest);
</script>

<svelte:head><title>{mode === 'time' ? 'Time' : 'Drill'} · Chessmode</title></svelte:head>

{#if blocked}
	<main class="page empty">
		<img src="/img/empty/drill.webp" alt="" />
		<h1 class="h-title">{mode === 'time' ? 'Time' : 'Drill'} is still locked</h1>
		<p class="muted">{blocked}</p>
		<a class="btn btn-primary block" href={scope ? `/course/${scope}` : '/drill'}>Back</a>
	</main>
{:else if item}
	{#key round}
		<LineTrainer
			course={item.course}
			line={item.line}
			{mode}
			startAt={startAtFor(item)}
			sharedStartAvailable={sharedFor(item)}
			closeHref="/drill"
			{onfinish}
			{onmistake}
			{onhint}
			{onprogress}
			onleave={settle}
		>
			{#snippet status()}
				{#if mode === 'time'}
					<div class="clock" class:low={seconds <= 10} style:--p={Math.min(1, remaining / TIME_MODE.startMs)}>
						<span>{seconds}</span>
					</div>
					<div class="score">
						<b>{shownPoints}</b>
						<span>{shownPoints === 1 ? 'point' : 'points'} · {cleanLines} clean{clockSpeed(cleanLines) > 1 ? ` · ×${clockSpeed(cleanLines).toFixed(2)}` : ''}</span>
						{#if bump}<em class={bumpKind}>{bump}</em>{/if}
					</div>
				{:else}
					<div class="streak">
						<img src="/img/flame.webp" alt="" />
						<b>{streak}</b>
						<span>streak · best {Math.max(previousBest, bestStreak)} · {cleanLines} clean</span>
					</div>
				{/if}
			{/snippet}
		</LineTrainer>
	{/key}
{:else if loaded}
	<main class="page empty">
		<img src="/img/empty/drill.webp" alt="" />
		<h1 class="h-title">No learned lines yet</h1>
		<p class="muted">Learn one line. Drill and Time are ready the moment you do.</p>
		<a class="btn btn-primary block" href={scope ? `/course/${scope}` : '/'}>Learn a line</a>
	</main>
{/if}

{#if offer && unseen}
	<Sheet labelledby="deck-title" ondismiss={keepDrilling}>
		<h2 id="deck-title" class="h-title">You've been through this deck</h2>
		<p class="muted offer-copy">There are still lines to learn. Keep drilling this deck, or learn another one.</p>
		<a class="btn btn-primary block" href="/learn/{unseen.course.id}/{unseen.line.id}" onclick={record}>Learn more</a>
		<button class="btn btn-surface block" type="button" onclick={keepDrilling}>Keep drilling</button>
	</Sheet>
{/if}

{#if over}
	<ResultSheet
		image={mode === 'time' ? '/img/result/timed.webp' : '/img/result/mistakes.webp'}
		eyebrow={isBest ? 'New personal best' : mode === 'time' ? 'Time is up' : 'Run finished'}
		title={mode === 'time' ? `${points} ${points === 1 ? 'point' : 'points'}` : `${bestStreak} streak`}
		subtitle={mode === 'time' ? `${cleanLines} clean ${cleanLines === 1 ? 'line' : 'lines'}.` : `${cleanLines} clean ${cleanLines === 1 ? 'line' : 'lines'} this run.`}
		stats={[
			{ label: mode === 'time' ? 'Points' : 'Best streak', value: mode === 'time' ? points : bestStreak, tone: 'accent' },
			{ label: 'Clean lines', value: cleanLines },
			{ label: 'Record', value: Math.max(previousBest, mode === 'time' ? points : bestStreak) }
		]}
	>
		{#snippet actions()}
			<button class="btn btn-primary block" type="button" onclick={begin}>Play again</button>
			<a class="btn btn-surface block" href="/drill">Done</a>
		{/snippet}
	</ResultSheet>
{/if}

<style>
	.clock {
		--p: 1;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: conic-gradient(var(--accent) calc(var(--p) * 360deg), var(--surface-3) 0);
		display: grid;
		place-items: center;
		flex: 0 0 auto;
	}
	.clock span {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: var(--bg);
		display: grid;
		place-items: center;
		font: 600 14px var(--mono);
	}
	.clock.low span {
		color: var(--bad);
	}
	.score,
	.streak {
		position: relative;
		display: flex;
		align-items: baseline;
		gap: 6px;
		flex: 1;
		min-width: 0;
	}
	.score b,
	.streak b {
		font-size: 22px;
		font-weight: 600;
		letter-spacing: -0.03em;
	}
	.score span,
	.streak span {
		font-size: 13px;
		color: var(--text-2);
	}
	.streak {
		align-items: center;
	}
	.streak img {
		width: 30px;
		height: 30px;
		object-fit: contain;
	}
	em {
		position: absolute;
		left: 0;
		top: -14px;
		font: 700 12px var(--mono);
		font-style: normal;
		animation: float 0.6s var(--ease-out) forwards;
	}
	em.plus {
		color: var(--good);
	}
	em.minus {
		color: var(--bad);
	}
	.offer-copy {
		margin: 8px 0 14px;
	}
	@keyframes float {
		to {
			transform: translateY(-10px);
			opacity: 0;
		}
	}
	.empty {
		padding-top: 80px;
		text-align: center;
		display: grid;
		justify-items: center;
		gap: 10px;
	}
	.empty img {
		width: 140px;
		height: 140px;
		object-fit: contain;
	}
	@media (prefers-reduced-motion: reduce) {
		em {
			animation: none;
		}
	}
</style>
