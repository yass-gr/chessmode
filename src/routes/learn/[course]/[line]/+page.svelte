<script lang="ts">
	import { page } from '$app/state';
	import { getCourse } from '#lib/courses/index.ts';
	import { courseScope, defaultDepth, type DepthChoice } from '#lib/courses/depth.ts';
	import type { LineKey } from '#lib/courses/types.ts';
	import LineTrainer from '#lib/components/train/LineTrainer.svelte';
	import ResultSheet from '#lib/components/train/ResultSheet.svelte';
	import { db, type LineProgress } from '#lib/db.ts';
	import { logSession } from '#lib/progress.ts';
	import { readCoursePreferences } from '#lib/settings/preferences.ts';
	import { finishLearn } from '#lib/srs.ts';
	import { enterFromTrainer, loadDepth, loadProgress } from '#lib/train/data.ts';
	import { commonPrefix, openingSkip } from '#lib/train/lines.ts';
	import type { AttemptResult } from '#lib/train/types.ts';

	const params = $derived(page.params);
	const course = $derived(getCourse(params.course));
	const line = $derived(course?.lines.find((item) => item.id === params.line));
	const back = $derived.by(() => {
		const value = page.url.searchParams.get('return');
		if (!value || !value.startsWith('/') || value.startsWith('//')) return;
		return value;
	});

	let progress = $state(new Map<LineKey, LineProgress>());
	let choice = $state<DepthChoice>(defaultDepth());
	let startAt = $state(0);
	let shared = $state(false);
	let ready = $state(false);
	let play = $state(0);
	let result = $state<{ mistakes: number; next?: string; learned: number } | undefined>();

	$effect(() => {
		const courseId = params.course;
		const lineId = params.line;
		if (!courseId || !lineId) return;
		ready = false;
		result = undefined;
		void (async () => {
			const loaded = getCourse(courseId);
			const current = loaded?.lines.find((item) => item.id === lineId);
			if (!loaded || !current) {
				if (params.course === courseId) ready = true;
				return;
			}
			await enterFromTrainer(loaded.id, current.key);
			const [map, depth, prefs] = await Promise.all([loadProgress(), loadDepth(loaded.id), readCoursePreferences(loaded.id)]);
			if (params.course !== courseId || params.line !== lineId) return;
			const scope = courseScope(loaded, depth, map);
			const firstLearn = loaded.lines.every((item) => !map.has(item.key));
			progress = map;
			choice = depth;
			startAt = openingSkip({ mode: 'learn', enabled: prefs.skipSharedStart, lines: scope.lines, line: current, firstLearn });
			shared = scope.lines.length >= 2 && commonPrefix(scope.lines) >= 2;
			ready = true;
		})();
	});

	const scope = $derived(course ? courseScope(course, choice, progress) : undefined);
	const finalNote = $derived(line?.plies[line.plies.length - 1]?.note);

	async function onfinish(attempt: AttemptResult) {
		if (!course || !line || result) return;
		const { created } = await finishLearn(line.key, course.id);
		if (created) await logSession({ mode: 'learn', courseId: course.id, lines: 1, mistakes: attempt.mistakes });
		progress = new Map((await db.progress.where('courseId').equals(course.id).toArray()).map((row) => [row.key, row]));
		const next = courseScope(course, choice, progress).lines.find((item) => !progress.has(item.key))?.id;
		result = { mistakes: attempt.mistakes, next, learned: course.lines.filter((item) => progress.has(item.key)).length };
	}
</script>

<svelte:head><title>{line?.name ?? 'Learn'} · Chessmode</title></svelte:head>

{#if course && line && ready}
	{#key `${line.key}:${play}`}
		<LineTrainer
			{course}
			{line}
			mode="learn"
			{startAt}
			sharedStartAvailable={shared}
			closeHref={back ?? `/course/${course.id}`}
			returnHref={back}
			{onfinish}
		/>
	{/key}
	{#if result}
		<ResultSheet
			eyebrow="Line learned · +10 XP"
			title={line.name}
			subtitle="{finalNote ? `${finalNote} ` : ''}{result.next ? 'The next new line is ready.' : 'That was the last new line in this depth. Practice is next.'}{result.learned === 1 ? ' Practice is open.' : result.learned === 3 ? ' Drill and Time are open.' : ''}"
			stats={[
				{ label: 'Your moves', value: line.plies.filter((ply) => ply.student).length },
				{ label: 'Mistakes', value: result.mistakes, tone: result.mistakes ? 'bad' : 'good' }
			]}
		>
			{#snippet actions()}
				{#if result?.next}
					<a class="btn btn-primary block" href="/learn/{course.id}/{result.next}" data-sveltekit-replacestate>Learn the next line</a>
					<a class="btn btn-surface block" href="/practice/run?course={course.id}&line={encodeURIComponent(line.key)}">Practice this line</a>
				{:else}
					<a class="btn btn-primary block" href="/practice/run?course={course.id}">Practice</a>
					<a class="btn btn-surface block" href="/practice/run?course={course.id}&line={encodeURIComponent(line.key)}">Practice this line</a>
				{/if}
				<button class="btn btn-surface block" type="button" onclick={() => { result = undefined; play += 1; }}>Replay</button>
				<a class="btn btn-surface block" href="/course/{course.id}">Back to course</a>
			{/snippet}
		</ResultSheet>
	{/if}
{:else if ready}
	<main class="page stack" style="padding-top:48px">
		<h1 class="h-title">Line not found</h1>
		<a class="btn btn-surface" href="/">Home</a>
	</main>
{/if}
