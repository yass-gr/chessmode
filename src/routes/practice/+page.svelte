<script lang="ts">
	import { onMount } from 'svelte';
	import { courses } from '#lib/courses/index.ts';
	import type { LineProgress } from '#lib/db.ts';
	import type { LineKey } from '#lib/courses/types.ts';
	import MiniBoard from '#lib/components/MiniBoard.svelte';
	import { loadProgress } from '#lib/train/data.ts';
	import { lineEnd, relativeTime } from '#lib/train/stats.ts';

	let progress = $state(new Map<LineKey, LineProgress>());
	let loaded = $state(false);
	let scope = $state('');
	const now = Date.now();

	onMount(async () => {
		progress = await loadProgress();
		loaded = true;
	});

	const rows = $derived([...progress.values()].filter((p) => !scope || p.courseId === scope).sort((a, b) => +new Date(a.card.due) - +new Date(b.card.due)));
	const due = $derived(rows.filter((p) => new Date(p.card.due).getTime() <= now));
	const upcoming = $derived(rows.filter((p) => new Date(p.card.due).getTime() > now).slice(0, 6));
	const lookup = (key: string) => {
		for (const c of courses) {
			const line = c.lines.find((l) => l.key === key);
			if (line) return { course: c, line };
		}
	};
	const query = (ahead: boolean) => new URLSearchParams({ ...(scope ? { course: scope } : {}), ...(ahead ? { ahead: '1' } : {}) }).toString();
</script>

<svelte:head><title>Practice · Chessmode</title></svelte:head>

<main class="page">
	<header class="head">
		<h1 class="h-display">Practice</h1>
		<p class="muted">Lines come back just before you would forget them.</p>
	</header>

	<div class="scopes" role="group" aria-label="Course">
		<button class="chip" class:accent={!scope} aria-pressed={!scope} onclick={() => (scope = '')}>All courses</button>
		{#each courses as c (c.id)}
			<button class="chip" class:accent={scope === c.id} aria-pressed={scope === c.id} onclick={() => (scope = c.id)}>{c.name}</button>
		{/each}
	</div>

	{#if loaded}
		{#if rows.length === 0}
			<section class="card glow hero">
				<img src="/img/node-locked.webp" alt="" />
				<h2 class="h-title">Nothing to practise yet</h2>
				<p class="muted">Learn a line first. It shows up here when it is time to review it.</p>
				<a class="btn btn-primary block" href="/">Learn a line</a>
			</section>
		{:else}
			<section class="card glow hero">
				<div class="due-ring" style:--p={rows.length ? due.length / rows.length : 0}>
					<span><b>{due.length}</b><small>due</small></span>
				</div>
				<h2 class="h-title">{due.length ? `${due.length} ${due.length === 1 ? 'line' : 'lines'} to review` : 'All caught up'}</h2>
				<p class="muted">
					{#if due.length}
						{rows.length} learned. Clean lines come back later, missed ones come back soon.
					{:else if upcoming[0]}
						Next review {relativeTime(new Date(upcoming[0].card.due).getTime(), now)}.
					{/if}
				</p>
				{#if due.length}
					<a class="btn btn-primary block" href="/practice/run?{query(false)}">Start practice</a>
				{:else}
					<a class="btn btn-surface block" href="/practice/run?{query(true)}">Review ahead</a>
				{/if}
			</section>

			{#if upcoming.length}
				<h3 class="label section">Coming up</h3>
				<div class="card list">
					{#each upcoming as p (p.key)}
						{@const found = lookup(p.key)}
						{#if found}
							<a class="item" href="/practice/run?line={encodeURIComponent(p.key)}">
								<MiniBoard fen={lineEnd(found.line)} orientation={found.course.side === 'w' ? 'white' : 'black'} size={48} />
								<span class="t">
									<b>{found.line.name}</b>
									<span>{found.course.name}</span>
								</span>
								<span class="when">{relativeTime(new Date(p.card.due).getTime(), now)}</span>
							</a>
						{/if}
					{/each}
				</div>
			{/if}
		{/if}
	{/if}
</main>

<style>
	.head {
		padding: 28px 0 16px;
		display: grid;
		gap: 6px;
	}
	.scopes {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		scrollbar-width: none;
		margin: 0 calc(-1 * var(--gutter)) 18px;
		padding: 0 var(--gutter);
	}
	.scopes .chip {
		height: 34px;
		padding: 0 14px;
		font-size: 13px;
	}
	.hero {
		padding: 26px 20px 20px;
		display: grid;
		justify-items: center;
		text-align: center;
		gap: 10px;
	}
	.hero img {
		width: 120px;
		height: 120px;
		object-fit: contain;
	}
	.hero .btn {
		margin-top: 8px;
	}
	.due-ring {
		--p: 0;
		width: 128px;
		height: 128px;
		border-radius: 50%;
		background: conic-gradient(var(--accent) calc(var(--p) * 360deg), var(--surface-3) 0);
		display: grid;
		place-items: center;
		box-shadow: 0 0 40px -10px rgba(255, 107, 44, 0.6);
		margin-bottom: 6px;
	}
	.due-ring span {
		width: 112px;
		height: 112px;
		border-radius: 50%;
		background: var(--surface-2);
		display: grid;
		place-content: center;
		line-height: 1;
	}
	.due-ring b {
		font-size: 44px;
		font-weight: 600;
		letter-spacing: -0.04em;
	}
	.due-ring small {
		color: var(--text-2);
		font-size: 13px;
		margin-top: 4px;
	}
	.section {
		margin: 26px 0 10px;
		text-transform: uppercase;
	}
	.list {
		padding: 4px 14px;
	}
	.item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 0;
		border-top: 1px solid var(--stroke);
		position: relative;
	}
	.item:first-child {
		border-top: 0;
	}
	.t {
		flex: 1;
		min-width: 0;
		display: grid;
	}
	.t b {
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.t span,
	.when {
		font-size: 13px;
		color: var(--text-3);
	}
	.when {
		white-space: nowrap;
	}
</style>
