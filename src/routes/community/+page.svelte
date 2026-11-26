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
			<article class="card item">
				<div>
					<p class="label">{course.side === 'w' ? 'White' : 'Black'} · {course.lines} lines</p>
					<h2 class="h-title">{course.name}</h2>
					<p class="muted">{course.tagline}</p>
				</div>
				<a class="btn btn-primary" href={course.href}>Try the first line</a>
			</article>
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
		display: grid;
		gap: 12px;
		padding: 16px;
	}
	.item .muted {
		margin: 4px 0 0;
	}
</style>
