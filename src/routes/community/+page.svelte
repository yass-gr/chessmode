<script lang="ts">
	import { courses } from '#lib/courses/index.ts';
	import { communityShelf } from '#lib/community/shelf.ts';

	const shelf = communityShelf(courses);
</script>

<svelte:head><title>Openings · Chessmode</title></svelte:head>

<main class="page">
	<header class="head">
		<p class="label">The shipped courses</p>
		<h1 class="h-display">Openings</h1>
		<p class="muted">Every course here can be tried from the first line, with no account. Publishing a private repertoire for other people waits on sync, which this app does not do yet.</p>
	</header>
	<div class="list">
		{#each shelf as course (course.id)}
			<a class="card item" href={course.href}>
				<div class="copy">
					<p class="label">{course.side === 'w' ? 'White' : 'Black'} · {course.lines} lines</p>
					<h2 class="h-title">{course.name}</h2>
					<p class="muted">{course.tagline}</p>
				</div>
				<svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
			</a>
		{/each}
	</div>
</main>

<style>
	.head {
		display: grid;
		gap: 6px;
		padding: 28px 0 16px;
	}
	.list {
		display: grid;
		gap: 12px;
	}
	@media (min-width: 800px) {
		.list {
			grid-template-columns: 1fr 1fr;
		}
	}
	.item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 16px;
		color: inherit;
	}
	.copy {
		flex: 1;
		min-width: 0;
	}
	.item .muted {
		margin: 4px 0 0;
	}
	.chevron {
		flex: 0 0 auto;
		width: 20px;
		height: 20px;
		color: var(--text-3);
	}
</style>
