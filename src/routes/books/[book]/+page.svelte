<script lang="ts">
	import { page } from '$app/state';
	import { bookById } from '#lib/books/read.ts';
	import { BOOKS } from '#lib/books/shelf.ts';

	const book = $derived(bookById(BOOKS, page.params.book));
</script>

<svelte:head><title>{book ? `${book.title} · Chessmode` : 'Reading · Chessmode'}</title></svelte:head>

<main class="page">
	{#if book}
		<a class="back" href="/books">Reading</a>
		<header class="head">
			<p class="label">{book.author}</p>
			<h1 class="h-display">{book.title}</h1>
			<p class="muted">{book.summary}</p>
		</header>
		<ol>
			{#each book.sections as section, index (section.id)}
				<li>
					<a href="/books/{book.id}/{section.id}">
						<span>{index + 1}</span>
						<b>{section.title}</b>
					</a>
				</li>
			{/each}
		</ol>
	{:else}
		<p class="muted">That book is not on the shelf.</p>
		<a class="btn btn-primary" href="/books">Back to reading</a>
	{/if}
</main>

<style>
	.back {
		display: inline-block;
		margin-top: 18px;
		color: var(--text-3);
		font-size: 14px;
	}
	.head {
		display: grid;
		gap: 6px;
		padding: 12px 0 8px;
	}
	ol {
		list-style: none;
		margin: 8px 0 0;
		padding: 0;
		display: grid;
	}
	a {
		color: inherit;
	}
	li a {
		display: flex;
		align-items: baseline;
		gap: 12px;
		padding: 14px 0;
		border-top: 1px solid var(--stroke);
	}
	li span {
		width: 1.5rem;
		color: var(--text-3);
		font: 13px var(--mono);
	}
</style>
