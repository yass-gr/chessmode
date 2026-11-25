<script lang="ts">
	import { onMount } from 'svelte';
	import { courses } from '#lib/courses/index.ts';
	import { db, type LineProgress, type RatingRecord, type SessionLog } from '#lib/db.ts';
	import { ARENA_START, ARENA_UNLOCK_LINES } from '#lib/explorer/arena.ts';
	import { PUZZLE_START } from '#lib/ratings.ts';
	import { TIME_MODE } from '#lib/train/session.ts';
	import { best } from '#lib/train/stats.ts';

	let scope = $state('');
	let sessions = $state<SessionLog[]>([]);
	let learned = $state<LineProgress[]>([]);
	let ratings = $state<RatingRecord[]>([]);
	let loaded = $state(false);

	onMount(async () => {
		[sessions, learned, ratings] = await Promise.all([db.sessions.toArray(), db.progress.toArray(), db.ratings.toArray()]);
		loaded = true;
	});

	const count = $derived(learned.filter((p) => !scope || p.courseId === scope).length);
	const scoped = $derived(sessions.filter((s) => !scope || s.courseId === scope));
	const scopedCourses = $derived(courses.filter((c) => !scope || c.id === scope));
	const ratingOf = (kind: 'arena' | 'puzzle', id: string) => ratings.find((r) => r.key === `${kind}/${id}`);
	const learnedIn = (id: string) => learned.filter((p) => p.courseId === id).length;
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
					<p class="muted">Clean lines win back {TIME_MODE.cleanMs / 1000} seconds, mistakes cost {TIME_MODE.mistakeMs / 1000}. The clock speeds up as you score.</p>
					<p class="pb">Best <b>{best(scoped, 'time')}</b> {best(scoped, 'time') === 1 ? 'line' : 'lines'}</p>
				</div>
				<a class="btn btn-white block" class:disabled={!count} href={count ? href('time') : undefined} aria-disabled={!count}>Start the clock</a>
			</article>

			<article class="card mode wide">
				<div class="body">
					<p class="label">Rated</p>
					<h2 class="h-title">Arena</h2>
					<p class="muted">Play your opening as a game. Your opponent plays what Lichess players near your rating play, and the engine judges where you stand when their moves run out.</p>
				</div>
				<ul class="per-course">
					{#each scopedCourses as c (c.id)}
						{@const r = ratingOf('arena', c.id)}
						{@const open = learnedIn(c.id) >= ARENA_UNLOCK_LINES}
						<li>
							<span class="t"><b>{c.name}</b><small>{r ? `${r.wins}W ${r.draws}D ${r.losses}L` : open ? 'No games yet' : `Learn ${ARENA_UNLOCK_LINES} lines to unlock`}</small></span>
							<span class="num">{r?.rating ?? ARENA_START}</span>
							<a class="btn sm btn-primary" class:disabled={!open} href={open ? `/arena/${c.id}` : undefined} aria-disabled={!open}>Play</a>
						</li>
					{/each}
				</ul>
			</article>

			<article class="card mode wide">
				<div class="body">
					<p class="label">Tactics</p>
					<h2 class="h-title">Puzzles</h2>
					<p class="muted">Positions from real games in your openings where the opponent went wrong. Find the punishment.</p>
				</div>
				<ul class="per-course">
					{#each scopedCourses as c (c.id)}
						{@const r = ratingOf('puzzle', c.id)}
						<li>
							<span class="t"><b>{c.name}</b><small>{r ? `${r.wins} of ${r.games} solved` : 'Not started'}</small></span>
							<span class="num">{r?.rating ?? PUZZLE_START}</span>
							<a class="btn sm btn-surface" href="/puzzles/{c.id}">Solve</a>
						</li>
					{/each}
				</ul>
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
	.per-course {
		list-style: none;
		display: grid;
		margin: 4px 0 0;
		padding: 0;
	}
	.per-course li {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 0;
		border-top: 1px solid var(--stroke);
	}
	.per-course .t {
		flex: 1;
		min-width: 0;
		display: grid;
	}
	.per-course .t small {
		font-size: 12px;
		color: var(--text-3);
	}
	.per-course .num {
		font: 600 15px var(--mono);
		color: var(--text-2);
	}
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
	.mode.wide {
		grid-template-columns: 1fr;
	}
	.mode.wide .body,
	.per-course {
		grid-column: 1;
		grid-row: auto;
	}
	.per-course .btn {
		grid-column: auto;
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
