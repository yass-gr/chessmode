<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { courses } from '#lib/courses/index.ts';
	import type { Course, Line } from '#lib/courses/types.ts';
	import LineTrainer from '#lib/components/train/LineTrainer.svelte';
	import ResultSheet from '#lib/components/train/ResultSheet.svelte';
	import { db } from '#lib/db.ts';
	import { finishPractice } from '#lib/srs.ts';
	import { logSession } from '#lib/progress.ts';
	import { relativeTime } from '#lib/train/stats.ts';

	type Item = { course: Course; line: Line };
	type Outcome = { mistakes: number; hints: number; due: number };

	let queue = $state<Item[]>([]);
	let loaded = $state(false);
	let at = $state(0);
	let outcome = $state<Outcome | undefined>();
	let outcomes = $state<Outcome[]>([]);
	let logged = false;

	const AHEAD_LIMIT = 10;

	onMount(async () => {
		const params = page.url.searchParams;
		const scope = params.get('course');
		const only = params.get('line');
		const ahead = params.get('ahead') === '1';
		const now = Date.now();
		const rows = (await db.progress.toArray())
			.filter((p) => (!scope || p.courseId === scope) && (!only || p.key === only))
			.sort((a, b) => +new Date(a.card.due) - +new Date(b.card.due));
		const picked = only ? rows : ahead ? rows.slice(0, AHEAD_LIMIT) : rows.filter((p) => new Date(p.card.due).getTime() <= now);
		queue = picked.flatMap((p) => {
			const course = courses.find((c) => c.id === p.courseId);
			const line = course?.lines.find((l) => l.key === p.key);
			return course && line ? [{ course, line }] : [];
		});
		loaded = true;
	});

	const item = $derived(queue[at]);
	const finished = $derived(loaded && at >= queue.length);
	const clean = $derived(outcomes.filter((o) => o.mistakes === 0 && o.hints === 0).length);

	async function onfinish(r: { mistakes: number; hints: number }) {
		if (!item) return;
		const updated = await finishPractice(item.line.key, r.mistakes, r.hints);
		outcome = { ...r, due: updated ? new Date(updated.card.due).getTime() : Date.now() };
		outcomes = [...outcomes, outcome];
	}

	function next() {
		outcome = undefined;
		at += 1;
	}

	$effect(() => {
		if (finished && outcomes.length && !logged) {
			logged = true;
			void logSession({
				mode: 'practice',
				courseId: page.url.searchParams.get('course') ?? undefined,
				lines: outcomes.length,
				mistakes: outcomes.reduce((s, o) => s + o.mistakes, 0)
			});
		}
	});
</script>

<svelte:head><title>Practice · Chessmode</title></svelte:head>

{#if item && !finished}
	{#key at}
		<LineTrainer course={item.course} line={item.line} mode="practice" closeHref="/practice" {onfinish}>
			{#snippet heading()}
				<p class="session label">Review {at + 1} of {queue.length}</p>
			{/snippet}
		</LineTrainer>
	{/key}
	{#if outcome}
		<ResultSheet
			image={outcome.mistakes ? '/img/node-locked.webp' : '/img/node-done.webp'}
			eyebrow={outcome.mistakes ? 'Needs another look' : outcome.hints ? 'Done with a hint' : 'Clean'}
			title={item.line.name}
			subtitle="Next review {relativeTime(outcome.due)}."
			stats={[
				{ label: 'Mistakes', value: outcome.mistakes, tone: outcome.mistakes ? 'bad' : 'good' },
				{ label: 'Hints', value: outcome.hints },
				{ label: 'Left', value: queue.length - at - 1 }
			]}
		>
			{#snippet actions()}
				<button class="btn btn-primary block" onclick={next}>{at + 1 < queue.length ? 'Next line' : 'Finish'}</button>
			{/snippet}
		</ResultSheet>
	{/if}
{:else if finished}
	<main class="page done">
		{#if outcomes.length}
			<img src="/img/node-active.webp" alt="" />
			<p class="label">Practice complete · +{outcomes.length * 5} XP</p>
			<h1 class="h-display">{clean} of {outcomes.length} clean</h1>
			<p class="muted">Missed lines come back soon. Clean ones wait longer each time.</p>
		{:else}
			<img src="/img/node-done.webp" alt="" />
			<h1 class="h-display">Nothing due</h1>
			<p class="muted">You are up to date. Learn a new line or review ahead.</p>
		{/if}
		<div class="actions">
			<a class="btn btn-primary block" href="/">Back home</a>
			<a class="btn btn-surface block" href="/practice">Practice menu</a>
		</div>
	</main>
{/if}

<style>
	.session {
		color: var(--accent-hi);
		text-transform: uppercase;
	}
	.done {
		padding-top: 72px;
		text-align: center;
		display: grid;
		justify-items: center;
		gap: 8px;
	}
	.done img {
		width: 160px;
		height: 160px;
		object-fit: contain;
	}
	.actions {
		width: 100%;
		display: grid;
		gap: 10px;
		margin-top: 20px;
	}
</style>
