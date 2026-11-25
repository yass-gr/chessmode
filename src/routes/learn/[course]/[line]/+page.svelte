<script lang="ts">
	import { page } from '$app/state';
	import { getCourse } from '#lib/courses/index.ts';
	import LineTrainer from '#lib/components/train/LineTrainer.svelte';
	import ResultSheet from '#lib/components/train/ResultSheet.svelte';
	import { finishLearn } from '#lib/srs.ts';
	import { logSession } from '#lib/progress.ts';
	import { db } from '#lib/db.ts';
	import { relativeTime } from '#lib/train/stats.ts';

	const course = $derived(getCourse(page.params.course));
	const line = $derived(course?.lines.find((l) => l.id === page.params.line));

	let result = $state<{ mistakes: number; due: number; next?: string } | undefined>();
	$effect(() => {
		void line?.key;
		result = undefined;
	});

	async function onfinish({ mistakes }: { mistakes: number }) {
		if (!course || !line) return;
		const progress = await finishLearn(line.key, course.id);
		await logSession({ mode: 'learn', courseId: course.id, lines: 1, mistakes });
		const learned = new Set((await db.progress.where('courseId').equals(course.id).toArray()).map((p) => p.key));
		const next = course.lines.find((l) => !learned.has(l.key))?.id;
		result = { mistakes, due: new Date(progress.card.due).getTime(), next };
	}
</script>

<svelte:head><title>{line?.name ?? 'Learn'} · Chessmode</title></svelte:head>

{#if course && line}
	{#key line.key}
		<LineTrainer {course} {line} mode="learn" closeHref="/course/{course.id}" {onfinish} />
	{/key}
	{#if result}
		<ResultSheet
			eyebrow="Line learned · +10 XP"
			title={line.name}
			subtitle="First review {relativeTime(result.due)}. Practice brings it back just before you would forget it."
			stats={[
				{ label: 'Your moves', value: line.plies.filter((p) => p.student).length },
				{ label: 'Mistakes', value: result.mistakes, tone: result.mistakes ? 'bad' : 'good' }
			]}
		>
			{#snippet actions()}
				{#if result?.next}
					<a class="btn btn-primary block" href="/learn/{course.id}/{result.next}" data-sveltekit-replacestate>Learn the next line</a>
				{/if}
				<a class="btn btn-surface block" href="/course/{course.id}">Back to course</a>
			{/snippet}
		</ResultSheet>
	{/if}
{:else}
	<main class="page stack" style="padding-top:48px">
		<h1 class="h-title">Line not found</h1>
		<a class="btn btn-surface" href="/">Home</a>
	</main>
{/if}
