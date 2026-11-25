<script lang="ts">
	import { seg } from '#lib/components/seg.ts';
	import { onMount } from 'svelte';
	import { courses } from '#lib/courses/index.ts';
	import type { LineKey } from '#lib/courses/types.ts';
	import type { Color } from '#lib/chess/types.ts';
	import type { LineProgress } from '#lib/db.ts';
	import MiniBoard from '#lib/components/MiniBoard.svelte';
	import { loadProgress } from '#lib/train/data.ts';
	import { courseStats } from '#lib/train/stats.ts';
	import { positionOf, searchCourses } from '#lib/courses/search.ts';

	let progress = $state.raw(new Map<LineKey, LineProgress>());
	let text = $state('');
	let side = $state<Color | undefined>();
	const now = Date.now();

	onMount(async () => {
		progress = await loadProgress();
	});

	const results = $derived(searchCourses(courses, { text, side }));
	const typed = $derived(positionOf(text));
	const preview = (course: (typeof courses)[number]) => course.lines[0].plies[Math.min(5, course.lines[0].plies.length - 1)].fenAfter;
</script>

<svelte:head><title>Courses · Chessmode</title></svelte:head>

<main class="page">
	<header class="top">
		<a class="icon-btn" href="/" aria-label="Back">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
		</a>
		<h1 class="h-title">Courses</h1>
		<a class="btn sm btn-surface create" href="/create">Create</a>
	</header>

	<label class="field search">
		<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
		<input type="search" placeholder="Search by name or moves, e.g. 1.d4 d5 2.Nc3" bind:value={text} aria-label="Search courses" autocapitalize="none" spellcheck={false} />
	</label>

	<div class="seg" use:seg role="group" aria-label="Side">
		<button aria-pressed={side === undefined} onclick={() => (side = undefined)}>All</button>
		<button aria-pressed={side === 'w'} onclick={() => (side = 'w')}>White</button>
		<button aria-pressed={side === 'b'} onclick={() => (side = 'b')}>Black</button>
	</div>

	{#if typed}
		<div class="typed card">
			<MiniBoard fen={typed} orientation={side === 'b' ? 'black' : 'white'} size={72} />
			<p>{results.length ? `${results.length} ${results.length === 1 ? 'course reaches' : 'courses reach'} this position.` : 'No course reaches this position yet.'}</p>
		</div>
	{/if}

	<div class="list">
		{#each results as course (course.id)}
			{@const s = courseStats(course, progress, now)}
			<article class="card course">
				<a class="body" href="/course/{course.id}">
					<MiniBoard fen={preview(course)} orientation={course.side === 'w' ? 'white' : 'black'} size={92} />
					<div class="t">
						<p class="label"><span class="side" class:black={course.side === 'b'}></span>{course.side === 'w' ? 'White' : 'Black'} · {course.level}</p>
						<h2 class="h-head">{course.name}</h2>
						<p class="tagline">{course.tagline}</p>
						<p class="meta">{course.lines.length} lines · {course.chapters.length} chapters</p>
					</div>
				</a>
				<div class="foot">
					<div class="progress"><i style:width="{(100 * s.learned) / s.total}%"></i></div>
					<span class="count">{s.learned}/{s.total}</span>
					<a class="btn sm {s.learned ? 'btn-surface' : 'btn-primary'}" href={s.next ? `/learn/${course.id}/${s.next.id}` : `/course/${course.id}`}>
						{s.learned === 0 ? 'Try the first line' : s.next ? 'Continue' : 'Open'}
					</a>
				</div>
			</article>
		{:else}
			<p class="empty muted">No course matches “{text}”.</p>
		{/each}
	</div>
</main>

<style>
	.top {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 14px 0 16px;
	}
	.create {
		margin-left: auto;
	}
	.search {
		display: flex;
		align-items: center;
		gap: 10px;
		color: var(--text-3);
	}
	.search input {
		flex: 1;
		min-width: 0;
		background: none;
		border: 0;
		outline: 0;
		color: var(--text);
		font: inherit;
	}
	.seg {
		margin-top: 12px;
	}
	.typed {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 12px;
		margin-top: 14px;
		color: var(--text-2);
		font-size: 14px;
	}
	.list {
		display: grid;
		gap: 12px;
		margin-top: 16px;
	}
	.course {
		padding: 14px;
		display: grid;
		gap: 12px;
	}
	.body {
		display: flex;
		gap: 14px;
		align-items: flex-start;
	}
	.t {
		flex: 1;
		min-width: 0;
		display: grid;
		gap: 3px;
	}
	.label {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.side {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: #f4f4f2;
	}
	.side.black {
		background: #111;
		box-shadow: 0 0 0 1.5px #666;
	}
	.tagline {
		font-size: 14px;
		line-height: 1.45;
		color: var(--text-2);
	}
	.meta {
		font-size: 12px;
		color: var(--text-3);
	}
	.foot {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.foot .progress {
		flex: 1;
	}
	.count {
		font: 600 12px var(--mono);
		color: var(--text-2);
	}
	.empty {
		text-align: center;
		padding: 30px 0;
	}
	@media (min-width: 900px) {
		.list {
			grid-template-columns: 1fr 1fr;
		}
	}
</style>
