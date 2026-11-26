<script lang="ts">
	import type { Course, Line, LineKey } from '#lib/courses/types.ts';
	import type { LineProgress } from '#lib/db.ts';

	let {
		course,
		current,
		progress,
		selected,
		onselect,
		onclose
	}: {
		course: Course;
		current?: LineKey;
		progress: LineProgress[];
		selected?: ReadonlySet<LineKey>;
		onselect: (line: Line, mode: 'learn' | 'practice') => void;
		onclose: () => void;
	} = $props();

	const byKey = $derived(new Map(progress.map((item) => [item.key, item])));
	const groups = $derived(
		selected
			? [
					{ name: 'Selected lines', lines: course.lines.filter((line) => selected?.has(line.key)) },
					{ name: 'Beyond depth', lines: course.lines.filter((line) => !selected?.has(line.key)) }
				]
			: [{ name: 'All lines', lines: course.lines }]
	);
	const chapterName = (line: Line) => course.chapters.find((chapter) => chapter.id === line.chapterId)?.name;
</script>

<section class="card picker" aria-label="Choose a line">
	<header>
		<h2>Choose a line</h2>
		<button class="btn btn-surface" onclick={onclose}>Close</button>
	</header>
	<div class="list">
		{#each groups as group}
			{#if group.lines.length}<h3>{group.name}</h3>{/if}
			{#each group.lines as line (line.key)}
				{@const state = byKey.get(line.key)}
				{@const chapter = chapterName(line)}
				<button class="option line" aria-current={line.key === current ? 'true' : undefined} onclick={() => onselect(line, state ? 'practice' : 'learn')}>
					<span class="copy">
						<span class="name">{line.name}</span>
						{#if chapter}<span class="chapter">{chapter}</span>{/if}
					</span>
					<small>{state?.clean ? 'Perfected' : state ? 'Learned' : 'New'}</small>
				</button>
			{/each}
		{/each}
	</div>
</section>

<style>
	.picker {
		display: flex;
		flex-direction: column;
		max-height: min(80dvh, 700px);
		padding: 16px;
		gap: 12px;
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	h2,
	h3 {
		margin: 0;
	}
	h3 {
		font-size: 13px;
		color: var(--text-2);
		padding: 12px 0 6px;
	}
	.list {
		overflow-y: auto;
		min-height: 0;
	}
	.line {
		align-items: center;
		justify-content: space-between;
		margin-bottom: 6px;
	}
	.copy {
		display: grid;
		gap: 2px;
		min-width: 0;
	}
	.name {
		font-weight: 600;
	}
	.chapter {
		color: var(--text-3);
		font-size: 13px;
		line-height: 1.3;
	}
	small {
		color: var(--text-2);
		white-space: nowrap;
	}
</style>
