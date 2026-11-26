<script lang="ts">
	import { onMount } from 'svelte';
	import { BookOpen, Bot, ChevronRight, Compass, Flag } from '@lucide/svelte';
	import { courses } from '#lib/courses/index.ts';
	import { isCustom } from '#lib/courses/custom.ts';
	import { db, type LineProgress, type RatingRecord, type SessionLog } from '#lib/db.ts';
	import { ARENA_START } from '#lib/explorer/arena.ts';
	import { PUZZLE_START } from '#lib/ratings.ts';
	import { TIME_MODE } from '#lib/train/session.ts';
	import { best } from '#lib/train/stats.ts';
	import { modeAvailability } from '#lib/courses/unlocks.ts';

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
	const ratedCourses = $derived(scopedCourses.filter((c) => !isCustom(c.id)));
	const ratingOf = (kind: 'arena' | 'puzzle', id: string) => ratings.find((r) => r.key === `${kind}/${id}`);
	const learnedIn = (id: string) => learned.filter((p) => p.courseId === id).length;
	const gate = $derived(scope ? modeAvailability('drill', count, courses.find(c => c.id === scope)?.lines.length ?? 0) : (count ? { kind: 'available' as const } : { kind: 'locked' as const, remaining: 1 }));
	const href = (mode: 'drill' | 'time') => `/drill/run?${new URLSearchParams({ mode, ...(scope ? { course: scope } : {}) })}`;
</script>

<svelte:head><title>Drill · Chessmode</title></svelte:head>

<main class="page">
	<header class="head">
		<h1 class="h-display">Drill</h1>
		<p class="muted">Learned lines, one pass at a time. A miss or a hint breaks the streak.</p>
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
					<p class="muted">Every learned line once, then the offer to learn more. A miss or a hint breaks the streak.</p>
					<p class="pb">Best <b>{best(scoped, 'drill')}</b> {best(scoped, 'drill') === 1 ? 'line' : 'lines'}</p>
				</div>
				<a class="btn btn-primary block" class:disabled={gate.kind !== 'available'} href={gate.kind === 'available' ? href('drill') : undefined} aria-disabled={gate.kind !== 'available'}>Start drill</a>
			</article>

			<article class="card mode">
				<img src="/img/flame.webp" alt="" />
				<div class="body">
					<p class="label">60 seconds</p>
					<h2 class="h-title">Time</h2>
					<p class="muted">Each correct move scores a point. A clean line adds time from its length, and a wrong move costs {TIME_MODE.penaltyMs / 1000} seconds.</p>
					<p class="pb">Best <b>{best(scoped, 'time')}</b> {best(scoped, 'time') === 1 ? 'point' : 'points'}</p>
				</div>
				<a class="btn btn-white block" class:disabled={gate.kind !== 'available'} href={gate.kind === 'available' ? href('time') : undefined} aria-disabled={gate.kind !== 'available'}>Start the clock</a>
			</article>

			<article class="card mode wide">
				<div class="body">
					<p class="label">Rated</p>
					<h2 class="h-title">Arena</h2>
					<p class="muted">Play your opening as a game. Your opponent plays what Lichess players near your rating play, and the engine judges where you stand when their moves run out.</p>
				</div>
				<ul class="per-course">
					{#each ratedCourses as c (c.id)}
						{@const r = ratingOf('arena', c.id)}
						{@const arenaGate = modeAvailability('arena', learnedIn(c.id), c.lines.length, !isCustom(c.id))}
						<li>
							<span class="t"><b>{c.name}</b><small>{r ? `${r.wins}W ${r.draws}D ${r.losses}L` : arenaGate.kind === 'available' ? 'No games yet' : arenaGate.kind === 'locked' ? `Learn ${arenaGate.remaining} more` : arenaGate.reason}</small></span>
							<span class="num">{r?.rating ?? ARENA_START}</span>
							<a class="btn sm btn-primary" class:disabled={arenaGate.kind !== 'available'} href={arenaGate.kind === 'available' ? `/arena/${c.id}` : undefined} aria-disabled={arenaGate.kind !== 'available'}>Play</a>
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
					{#each ratedCourses as c (c.id)}
						{@const r = ratingOf('puzzle', c.id)}
						{@const gate = modeAvailability('puzzle', learnedIn(c.id), c.lines.length, ['caro-kann', 'jobava-london'].includes(c.id))}
						<li>
							<span class="t"><b>{c.name}</b><small>{gate.kind === 'locked' ? `Learn ${gate.remaining} more lines` : gate.kind === 'unavailable' ? gate.reason : r ? `${r.wins} of ${r.games} solved` : 'Not started'}</small></span>
							<span class="num">{r?.rating ?? PUZZLE_START}</span>
							<a class="btn sm btn-surface" class:disabled={gate.kind !== 'available'} href={gate.kind === 'available' ? `/puzzles/${c.id}` : undefined} aria-disabled={gate.kind !== 'available'}>Solve</a>
						</li>
					{/each}
				</ul>
			</article>
		</div>

		{#if gate.kind === 'locked'}<p class="avail muted">Learn {gate.remaining} more {gate.remaining === 1 ? 'line' : 'lines'} to unlock Drill and Time.</p>{/if}
		<p class="avail muted">
			{#if count}
				{count} learned {count === 1 ? 'line' : 'lines'} in the pool.
			{:else}
				Learn a line first. Drills use lines you have already learned. <a href="/">Go to your course</a>
			{/if}
		</p>
	{/if}
	<section class="more" aria-labelledby="more-heading">
		<h2 id="more-heading" class="h-head">More ways to train</h2>
		<div class="more-grid">
			<a class="card more-card" href="/endgames"><span class="more-icon"><Flag size={20} /></span><span class="more-copy"><b>Endgames</b><small>Practice the final phase</small></span><ChevronRight size={18} /></a>
			<a class="card more-card" href="/books"><span class="more-icon"><BookOpen size={20} /></span><span class="more-copy"><b>Reading</b><small>Study chess ideas</small></span><ChevronRight size={18} /></a>
			<a class="card more-card" href="/bots"><span class="more-icon"><Bot size={20} /></span><span class="more-copy"><b>Bots</b><small>Play a practice game</small></span><ChevronRight size={18} /></a>
			<a class="card more-card" href="/community"><span class="more-icon"><Compass size={20} /></span><span class="more-copy"><b>Openings</b><small>Explore more openings</small></span><ChevronRight size={18} /></a>
		</div>
	</section>
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
		border-color: transparent;
		pointer-events: none;
	}
	.more {
		display: grid;
		gap: 12px;
		margin-top: 28px;
	}
	.more-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 10px;
	}
	.more-card {
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 0;
		padding: 14px;
		color: var(--text-2);
		text-decoration: none;
	}
	.more-icon {
		display: grid;
		place-items: center;
		flex: none;
		width: 36px;
		height: 36px;
		border-radius: 8px;
		background: var(--surface-4);
	}
	.more-copy {
		display: grid;
		flex: 1;
		min-width: 0;
		gap: 2px;
	}
	.more-copy b {
		color: var(--text);
	}
	.more-copy small {
		color: var(--text-3);
		font-size: 12px;
	}
	.more-card > :global(svg) {
		flex: none;
	}
	@media (min-width: 1024px) {
		.more-grid {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}
	}
	.avail {
		margin-top: 16px;
		font-size: 14px;
		text-align: center;
	}
	.avail a {
		color: var(--text);
	}
</style>
