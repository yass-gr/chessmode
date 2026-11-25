<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { courses } from '#lib/courses/index.ts';
	import type { Course, Line } from '#lib/courses/types.ts';
	import LineTrainer from '#lib/components/train/LineTrainer.svelte';
	import ResultSheet from '#lib/components/train/ResultSheet.svelte';
	import { db } from '#lib/db.ts';
	import { logSession } from '#lib/progress.ts';
	import { moveDeadline, pickNext, TIME_MODE } from '#lib/train/session.ts';
	import { best } from '#lib/train/stats.ts';

	type Item = { course: Course; line: Line };

	const mode = $derived(page.url.searchParams.get('mode') === 'time' ? 'time' : 'drill');
	const scope = $derived(page.url.searchParams.get('course') ?? undefined);

	let pool = $state<Item[]>([]);
	let loaded = $state(false);
	let item = $state<Item>();
	let round = $state(0);
	let score = $state(0);
	let mistakes = $state(0);
	let previousBest = $state(0);
	let over = $state(false);
	let deadline = $state(0);
	let now = $state(Date.now());
	let bump = $state<'plus' | 'minus' | undefined>();

	onMount(async () => {
		const [progress, sessions] = await Promise.all([db.progress.toArray(), db.sessions.toArray()]);
		const keys = new Set(progress.map((p) => p.key));
		pool = courses
			.filter((c) => !scope || c.id === scope)
			.flatMap((course) => course.lines.filter((l) => keys.has(l.key)).map((line) => ({ course, line })));
		previousBest = best(sessions.filter((s) => !scope || s.courseId === scope), mode);
		loaded = true;
		start();
	});

	function start() {
		if (!pool.length) return;
		score = 0;
		mistakes = 0;
		over = false;
		item = pickNext(pool, undefined);
		round += 1;
		deadline = Date.now() + TIME_MODE.startMs;
	}

	const remaining = $derived(Math.max(0, deadline - now));

	$effect(() => {
		if (mode !== 'time' || over || !item) return;
		const t = setInterval(() => {
			now = Date.now();
			if (now >= deadline) finish();
		}, 100);
		return () => clearInterval(t);
	});

	function flashBump(kind: 'plus' | 'minus') {
		bump = kind;
		setTimeout(() => (bump = undefined), 600);
	}

	function finish() {
		if (over) return;
		over = true;
		void logSession({ mode, courseId: scope, lines: score, mistakes, score });
	}

	function onmistake() {
		mistakes += 1;
		if (mode === 'time') {
			deadline = moveDeadline(deadline, Date.now(), 'mistake');
			flashBump('minus');
		}
	}

	function onfinish(r: { mistakes: number }) {
		if (over) return;
		if (r.mistakes === 0) {
			score += 1;
			if (mode === 'time') {
				deadline = moveDeadline(deadline, Date.now(), 'clean');
				flashBump('plus');
			}
		} else if (mode === 'drill') {
			finish();
			return;
		}
		setTimeout(() => {
			if (over) return;
			item = pickNext(pool, item);
			round += 1;
		}, 500);
	}

	const seconds = $derived(Math.ceil(remaining / 1000));
	const isBest = $derived(score > previousBest);
</script>

<svelte:head><title>{mode === 'time' ? 'Time' : 'Drill'} · Chessmode</title></svelte:head>

{#if item}
	{#key round}
		<LineTrainer course={item.course} line={item.line} {mode} closeHref="/drill" {onfinish} {onmistake}>
			{#snippet status()}
				{#if mode === 'time'}
					<div class="clock" class:low={seconds <= 10} style:--p={Math.min(1, remaining / TIME_MODE.startMs)}>
						<span>{seconds}</span>
					</div>
					<div class="score">
						<b>{score}</b>
						<span>{score === 1 ? 'line' : 'lines'}</span>
						{#if bump}<em class={bump}>{bump === 'plus' ? '+8s' : '−5s'}</em>{/if}
					</div>
				{:else}
					<div class="streak">
						<img src="/img/flame.webp" alt="" />
						<b>{score}</b>
						<span>streak · best {Math.max(previousBest, score)}</span>
					</div>
				{/if}
			{/snippet}
		</LineTrainer>
	{/key}
{:else if loaded}
	<main class="page empty">
		<img src="/img/node-locked.webp" alt="" />
		<h1 class="h-title">No learned lines yet</h1>
		<p class="muted">Drills replay lines you have learned. Learn one first.</p>
		<a class="btn btn-primary block" href="/">Learn a line</a>
	</main>
{/if}

{#if over}
	<ResultSheet
		image={mode === 'time' ? '/img/flame.webp' : '/img/knight.webp'}
		eyebrow={isBest ? 'New personal best' : mode === 'time' ? 'Time is up' : 'Streak over'}
		title="{score} {score === 1 ? 'line' : 'lines'}"
		subtitle={mode === 'drill' && item ? `Missed in ${item.line.name}.` : undefined}
		stats={[
			{ label: 'Score', value: score, tone: 'accent' },
			{ label: 'Best', value: Math.max(previousBest, score) },
			{ label: 'Mistakes', value: mistakes, tone: mistakes ? 'bad' : 'good' }
		]}
	>
		{#snippet actions()}
			<button class="btn btn-primary block" onclick={start}>Play again</button>
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
</style>
