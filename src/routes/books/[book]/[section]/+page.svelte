<script lang="ts">
	import { page } from '$app/state';
	import Board from '#lib/components/Board.svelte';
	import { bookById, lineFen, playUci, sectionById, sectionNeighbors } from '#lib/books/read.ts';
	import { BOOKS } from '#lib/books/shelf.ts';
	import { readPreferences } from '#lib/settings/preferences.ts';
	import { DEFAULT_PREFERENCES, type Preferences } from '#lib/settings/types.ts';
	import type { Fen } from '#lib/chess/types.ts';
	import { onMount } from 'svelte';

	let preferences = $state<Preferences>({ ...DEFAULT_PREFERENCES });
	let ply = $state(0);
	let exercise = $state<Fen | undefined>();
	let exerciseFor = '';

	const book = $derived(bookById(BOOKS, page.params.book));
	const section = $derived(book ? sectionById(book, page.params.section) : undefined);
	const neighbors = $derived(book && section ? sectionNeighbors(book, section.id) : undefined);

	$effect(() => {
		const id = section?.id ?? '';
		ply = 0;
		if (id !== exerciseFor) {
			exerciseFor = id;
			exercise = section?.try?.fen;
		}
	});

	onMount(async () => {
		preferences = await readPreferences();
	});
</script>

<svelte:head><title>{section ? `${section.title} · Chessmode` : 'Reading · Chessmode'}</title></svelte:head>

<main class="page">
	{#if book && section && neighbors}
		<a class="back" href="/books/{book.id}">{book.title}</a>
		<header class="head">
			<p class="label">Section {neighbors.index + 1} of {book.sections.length}</p>
			<h1 class="h-display">{section.title}</h1>
		</header>
		<div class="prose">
			{#each section.paragraphs as paragraph, i (i)}
				<p>{paragraph}</p>
			{/each}
		</div>

		{#if section.line}
			<section class="study">
				<Board
					fen={lineFen(section.line, ply)}
					orientation={section.line.orientation}
					movable="none"
					theme={preferences.theme}
					pieces={preferences.pieces}
				/>
				<p class="caption">{section.line.caption}</p>
				<div class="row">
					<button class="btn btn-surface" type="button" disabled={ply === 0} onclick={() => (ply -= 1)}>Previous move</button>
					<button class="btn btn-primary" type="button" disabled={ply >= section.line.sans.length} onclick={() => (ply += 1)}>Next move</button>
				</div>
				<p class="step muted">{ply} of {section.line.sans.length}</p>
			</section>
		{/if}

		{#if section.try && exercise}
			<section class="study">
				<h2 class="h-title">Your turn</h2>
				<Board
					fen={exercise}
					orientation={section.try.orientation}
					movable={exercise.split(' ')[1] === 'b' ? 'b' : 'w'}
					theme={preferences.theme}
					pieces={preferences.pieces}
					onmove={(uci) => {
						const next = playUci(exercise!, uci);
						if (next) exercise = next;
					}}
				/>
				<p class="caption">{section.try.caption}</p>
				<button class="btn btn-surface" type="button" onclick={() => (exercise = section?.try?.fen)}>Reset position</button>
			</section>
		{/if}

		<nav class="neighbors" aria-label="Sections">
			{#if neighbors.prev}
				<a href="/books/{book.id}/{neighbors.prev.id}">Previous · {neighbors.prev.title}</a>
			{:else}
				<span></span>
			{/if}
			{#if neighbors.next}
				<a class="next" href="/books/{book.id}/{neighbors.next.id}">Next · {neighbors.next.title}</a>
			{/if}
		</nav>
	{:else}
		<p class="muted">That section is not in this book.</p>
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
		padding: 12px 0 4px;
	}
	.prose {
		display: grid;
		gap: 12px;
	}
	.prose p {
		margin: 0;
		line-height: 1.5;
	}
	.study {
		display: grid;
		gap: 10px;
		margin-top: 18px;
	}
	.caption {
		margin: 0;
		color: var(--text-2);
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.step {
		margin: 0;
		font-size: 13px;
	}
	.neighbors {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		margin-top: 22px;
	}
	.neighbors a {
		color: var(--accent-hi);
	}
	.next {
		margin-left: auto;
		text-align: right;
	}
	@media (min-width: 900px) {
		.study {
			max-width: 560px;
		}
	}
</style>
