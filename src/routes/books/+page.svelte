<script lang="ts">
	import { BOOKS } from '#lib/books/shelf.ts';
</script>

<svelte:head><title>Reading · Chessmode</title></svelte:head>

<main class="page">
	<header class="head">
		<p class="label">Study</p>
		<h1 class="h-display">Reading</h1>
		<p class="muted">Short original notes, with a board for every position they mention. These are not part of the opening courses.</p>
	</header>
	<div class="list">
		{#each BOOKS as book (book.id)}
			<a class="card book" href="/books/{book.id}">
				<img class="cover" src="/img/books/cover.webp" alt="" />
				<p class="label">{book.author}</p>
				<h2 class="h-title">{book.title}</h2>
				<p class="muted">{book.summary}</p>
				<p class="count">{book.sections.length} sections</p>
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
	.book {
		display: grid;
		gap: 6px;
		padding: 18px;
		color: inherit;
	}
	.cover { width: 90px; height: 90px; object-fit: contain; grid-column: 2; grid-row: 1 / 5; }
	.count {
		margin: 4px 0 0;
		color: var(--text-3);
		font-size: 13px;
	}
</style>
