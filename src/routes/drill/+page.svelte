<script lang="ts">
	import { onMount } from 'svelte';
	import { courses } from '#lib/courses/index.ts';
	import { db, type LineProgress, type SessionLog } from '#lib/db.ts';
	import { best } from '#lib/train/stats.ts';

	let scope = $state('');
	let sessions = $state<SessionLog[]>([]);
	let learned = $state<LineProgress[]>([]);
	let loaded = $state(false);

	onMount(async () => {
		[sessions, learned] = await Promise.all([db.sessions.toArray(), db.progress.toArray()]);
		loaded = true;
	});

	const count = $derived(learned.filter((p) => !scope || p.courseId === scope).length);
	const scoped = $derived(sessions.filter((s) => !scope || s.courseId === scope));
	const href = (mode: 'drill' | 'time') => `/drill/run?${new URLSearchParams({ mode, ...(scope ? { course: scope } : {}) })}`;
</script>

<svelte:head><title>Drill · Chessmode</title></svelte:head>

<main class="page">
	<header class="head">
		<h1 class="h-display">Drill</h1>
		<p class="muted">Your learned lines, back to back, until one slips.</p>
	</header>

	<div class="scopes" role="group" aria-label="Course">
		<button class="chip" class:accent={!scope} aria-pressed={!scope} onclick={() => (scope = '')}>All courses</button>
		{#each courses as c (c.id)}
			<button class="chip" class:accent={scope === c.id} aria-pressed={scope === c.id} onclick={() => (scope = c.id)}>{c.name}</button>
		{/each}
	</div>

	{#if loaded}
		<div class="modes">
			<article class="card mode">
				<img src="/img/knight.webp" alt="" />
				<div class="body">
					<p class="label">Streak</p>
					<h2 class="h-title">Drill</h2>
					<p class="muted">Random lines, no hints. One wrong move ends the run.</p>
					<p class="pb">Best <b>{best(scoped, 'drill')}</b> {best(scoped, 'drill') === 1 ? 'line' : 'lines'}</p>
				</div>
				<a class="btn btn-primary block" class:disabled={!count} href={count ? href('drill') : undefined} aria-disabled={!count}>Start drill</a>
			</article>

			<article class="card mode">
				<img src="/img/flame.webp" alt="" />
				<div class="body">
					<p class="label">60 seconds</p>
					<h2 class="h-title">Time</h2>
					<p class="muted">Clean lines add 8 seconds. Mistakes cost 5.</p>
					<p class="pb">Best <b>{best(scoped, 'time')}</b> {best(scoped, 'time') === 1 ? 'line' : 'lines'}</p>
				</div>
				<a class="btn btn-white block" class:disabled={!count} href={count ? href('time') : undefined} aria-disabled={!count}>Start the clock</a>
			</article>
		</div>

		<p class="avail muted">
			{#if count}
				{count} learned {count === 1 ? 'line' : 'lines'} in the pool.
			{:else}
				Learn a line first. Drills use lines you have already learned. <a href="/">Go to your course</a>
			{/if}
		</p>
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
	.modes {
		display: grid;
		gap: 14px;
	}
	@media (min-width: 700px) {
		.modes {
			grid-template-columns: 1fr 1fr;
		}
	}
	.mode {
		padding: 20px;
		display: grid;
		grid-template-columns: 1fr 96px;
		gap: 12px 8px;
		background: var(--g-card-glow), var(--surface-2);
	}
	.mode img {
		grid-column: 2;
		grid-row: 1;
		width: 110px;
		height: 110px;
		object-fit: contain;
		margin: -10px -14px 0 -10px;
		filter: drop-shadow(0 12px 18px rgba(0, 0, 0, 0.5));
	}
	.body {
		grid-column: 1;
		grid-row: 1;
		display: grid;
		gap: 4px;
		align-content: start;
	}
	.body .muted {
		font-size: 14px;
	}
	.pb {
		margin-top: 6px;
		font-size: 13px;
		color: var(--text-3);
	}
	.pb b {
		color: var(--text);
		font-size: 15px;
	}
	.mode .btn {
		grid-column: 1 / -1;
	}
	.btn.disabled {
		background: var(--surface-3);
		color: var(--text-3);
		box-shadow: inset 0 1px 0 var(--highlight);
		text-shadow: none;
		pointer-events: none;
	}
	.avail {
		margin-top: 16px;
		font-size: 14px;
		text-align: center;
	}
	.avail a {
		color: var(--accent-hi);
	}
</style>
