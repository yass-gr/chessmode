<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { courses, getCourse } from '#lib/courses/index.ts';
	import { courseScope } from '#lib/courses/depth.ts';
	import type { Course, Line, LineKey } from '#lib/courses/types.ts';
	import LineTrainer from '#lib/components/train/LineTrainer.svelte';
	import ResultSheet from '#lib/components/train/ResultSheet.svelte';
	import { readCoursePreferences } from '#lib/settings/preferences.ts';
	import { finishPractice } from '#lib/srs.ts';
	import { enterFromTrainer, loadDepth, loadProgress } from '#lib/train/data.ts';
	import { commonPrefix, openingSkip } from '#lib/train/lines.ts';
	import { selectPractice, type PracticeCandidate } from '#lib/train/session.ts';
	import { relativeTime } from '#lib/train/stats.ts';
	import type { AttemptResult } from '#lib/train/types.ts';
	import { logSession } from '#lib/progress.ts';

	type Item = PracticeCandidate & { course: Course; line: Line; startAt: number; shared: boolean };
	type Outcome = AttemptResult & { due: number; confidence: number; name: string };

	let item = $state<Item | undefined>();
	let loaded = $state(false);
	let empty = $state(false);
	let due = $state(0);
	let outcome = $state<Outcome | undefined>();
	let round = $state(0);
	let finished = $state(0);

	const scopeId = $derived(page.url.searchParams.get('course') ?? '');
	const requested = $derived(page.url.searchParams.get('line'));

	async function pool(now: number): Promise<Item[]> {
		const progress = await loadProgress();
		const rows: Item[] = [];
		for (const course of courses) {
			if (scopeId && course.id !== scopeId) continue;
			const [depth, prefs] = await Promise.all([loadDepth(course.id), readCoursePreferences(course.id)]);
			const scope = courseScope(course, depth, progress);
			const shared = scope.lines.length >= 2 && commonPrefix(scope.lines) >= 2;
			for (const line of scope.lines) {
				const saved = progress.get(line.key);
				if (!saved) continue;
				rows.push({
					key: line.key,
					due: saved.card?.due ? new Date(saved.card.due).getTime() : null,
					perfected: !!saved.clean,
					course,
					line,
					shared,
					startAt: openingSkip({ mode: 'practice', enabled: prefs.skipSharedStart, lines: scope.lines, line, firstLearn: false })
				});
			}
		}
		due = rows.filter((row) => row.due == null || row.due <= now).length;
		return rows;
	}

	async function explicit(key: string): Promise<Item | undefined> {
		const progress = await loadProgress();
		for (const course of courses) {
			const line = course.lines.find((item) => item.key === key);
			const saved = progress.get(key as LineKey);
			if (!line || !saved) continue;
			await enterFromTrainer(course.id, line.key);
			const [depth, prefs] = await Promise.all([loadDepth(course.id), readCoursePreferences(course.id)]);
			const scope = courseScope(course, depth, progress);
			return {
				key,
				due: saved.card?.due ? new Date(saved.card.due).getTime() : null,
				perfected: !!saved.clean,
				course,
				line,
				shared: scope.lines.length >= 2 && commonPrefix(scope.lines) >= 2,
				startAt: openingSkip({ mode: 'practice', enabled: prefs.skipSharedStart, lines: scope.lines, line, firstLearn: false })
			};
		}
	}

	async function choose(current?: string, prefer?: string) {
		const now = Date.now();
		if (prefer) {
			const picked = await explicit(prefer);
			item = picked;
			empty = !picked;
			loaded = true;
			return;
		}
		const rows = await pool(now);
		const picked = selectPractice(rows, now, current);
		item = picked;
		empty = !picked;
		loaded = true;
	}

	onMount(() => {
		if (scopeId) void enterFromTrainer(scopeId);
		void choose(undefined, requested ?? undefined);
	});

	async function onfinish(attempt: AttemptResult) {
		if (!item || outcome) return;
		const updated = await finishPractice(item.line.key, attempt.mistakes, attempt.hints);
		await logSession({ mode: 'practice', courseId: item.course.id, lines: 1, mistakes: attempt.mistakes });
		await pool(Date.now());
		finished += 1;
		outcome = {
			...attempt,
			name: item.line.name,
			due: updated ? new Date(updated.card.due).getTime() : Date.now(),
			confidence: updated?.confidence ?? 5
		};
	}

	function next() {
		const current = item?.key;
		outcome = undefined;
		round += 1;
		void choose(current);
	}
</script>

<svelte:head><title>Practice · Chessmode</title></svelte:head>

{#if item && !empty}
	{#key `${item.key}:${round}`}
		<LineTrainer
			course={item.course}
			line={item.line}
			mode="practice"
			startAt={item.startAt}
			sharedStartAvailable={item.shared}
			closeHref="/practice"
			onfinish={onfinish}
			onreset={() => { outcome = undefined; round += 1; void choose(item?.key); }}
		>
			{#snippet heading()}
				<p class="session label">{due ? `${due} due` : 'None due'} · line {finished + 1}</p>
			{/snippet}
		</LineTrainer>
	{/key}
	{#if outcome}
		<ResultSheet
			image={outcome.mistakes ? '/img/node-locked.webp' : '/img/node-done.webp'}
			eyebrow={outcome.mistakes >= 2 || outcome.hints >= 2 ? 'Needs another look' : outcome.mistakes || outcome.hints ? 'With help' : 'Clean'}
			title={outcome.name}
			subtitle="Next review {relativeTime(outcome.due)}. Confidence {outcome.confidence} of 10."
			stats={[
				{ label: 'Mistakes', value: outcome.mistakes, tone: outcome.mistakes ? 'bad' : 'good' },
				{ label: 'Hints', value: outcome.hints },
				{ label: 'Due', value: due }
			]}
		>
			{#snippet actions()}
				<button class="btn btn-primary block" type="button" onclick={next}>Next line</button>
			{/snippet}
		</ResultSheet>
	{/if}
{:else if loaded}
	<main class="page done">
		<img src={finished ? '/img/node-active.webp' : '/img/node-locked.webp'} alt="" />
		{#if finished}
			<p class="label">Practice · +{finished * 5} XP</p>
			<h1 class="h-display">{finished} {finished === 1 ? 'line' : 'lines'}</h1>
			<p class="muted">Nothing else in this depth is learned yet.</p>
		{:else if requested}
			<h1 class="h-display">Learn it first</h1>
			<p class="muted">Practice recalls lines you have already learned.</p>
			{#if getCourse(requested.split('/')[0])}
				<a class="btn btn-primary block" href="/learn/{requested.split('/')[0]}/{requested.split('/')[1]}">Learn this line</a>
			{/if}
		{:else}
			<h1 class="h-display">Nothing to practise yet</h1>
			<p class="muted">Learn a line in this depth. It will show up here, due or not.</p>
		{/if}
		<div class="actions">
			<a class="btn btn-primary block" href={scopeId ? `/course/${scopeId}` : '/'}>{scopeId ? 'Back to the course' : 'Learn a line'}</a>
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
