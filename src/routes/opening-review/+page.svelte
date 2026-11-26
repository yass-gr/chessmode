<script lang="ts">
	import { onMount } from 'svelte';
	import { liveQuery } from 'dexie';
	import { seg } from '#lib/components/seg.ts';
	import type { Color } from '#lib/chess/types.ts';
	import { courses } from '#lib/courses/index.ts';
	import { db } from '#lib/db.ts';
	import { readPgn } from '#lib/import/pgn.ts';
	import { reviewOpenings, selectOpenings, trainHref, type OpeningMatch, type OpeningRow } from '#lib/review/opening.ts';
	import type { GameRecord } from '#lib/review/types.ts';

	const list = courses.slice().sort((a, b) => a.name.localeCompare(b.name));
	let records = $state<GameRecord[]>([]);
	let learned = $state.raw(new Set<string>());
	let courseId = $state('');
	let side = $state<Color | ''>('');
	let error = $state('');

	const rows = $derived<OpeningRow[]>(
		reviewOpenings(
			records.map((game) => {
				try {
					return { id: game.id, plies: readPgn(game.pgn).plies, userColor: game.userColor };
				} catch {
					return { id: game.id, plies: [], userColor: game.userColor, unreadable: true };
				}
			}),
			courses
		)
	);
	const view = $derived(selectOpenings(rows, { courseId: courseId || undefined, side: side || undefined }));
	const names = $derived(new Map(records.map((game) => [game.id, game])));

	onMount(() => {
		const subscription = liveQuery(async () => ({
			games: await db.games.orderBy('playedAt').reverse().toArray(),
			progress: await db.progress.toArray()
		})).subscribe({
			next: (data) => {
				records = data.games;
				learned = new Set(data.progress.map((row) => row.key));
			},
			error: () => {
				error = 'Could not read saved games on this device.';
			}
		});
		return () => subscription.unsubscribe();
	});

	function title(id: string) {
		const game = names.get(id);
		if (!game) return 'Saved game';
		if (!game.userColor) return `${game.white.name} vs. ${game.black.name}`;
		const opponent = game.userColor === 'w' ? game.black.name : game.white.name;
		return `vs. ${opponent}`;
	}

	function summary(row: OpeningMatch) {
		const move = Math.floor(row.ply / 2) + 1;
		if (row.kind === 'you') return `You left at move ${move}. You played ${row.playedSan}; the course plays ${row.expectedSan}.`;
		if (row.kind === 'opponent') return `Your opponent left the course at move ${move} with ${row.playedSan}.`;
		return `You followed the course through move ${move}.`;
	}
</script>

<svelte:head><title>Opening review · Chessmode</title></svelte:head>

<main class="page opening">
	<header class="top">
		<a class="back" href="/matches" aria-label="Back to Matches">‹</a>
		<div>
			<h1>Opening review</h1>
			<p>Where your saved games left a course. Games stay on this device.</p>
		</div>
	</header>

	<div class="filters">
		<div class="seg" use:seg role="group" aria-label="Side">
			<button type="button" aria-pressed={side === ''} onclick={() => (side = '')}>Both</button>
			<button type="button" aria-pressed={side === 'w'} onclick={() => (side = 'w')}>White</button>
			<button type="button" aria-pressed={side === 'b'} onclick={() => (side = 'b')}>Black</button>
		</div>
		<div class="courses" role="group" aria-label="Course">
			<button class="chip" class:accent={courseId === ''} type="button" aria-pressed={courseId === ''} onclick={() => (courseId = '')}>All courses</button>
			{#each list as course (course.id)}
				<button class="chip" class:accent={courseId === course.id} type="button" aria-pressed={courseId === course.id} onclick={() => (courseId = course.id)}>{course.name}</button>
			{/each}
		</div>
	</div>

	{#if error}<p class="bad" role="alert">{error}</p>{/if}

	<section aria-labelledby="matched-label">
		<h2 id="matched-label">In a course <span>{view.matched.length}</span></h2>
		{#if view.matched.length}
			<div class="card list">
				{#each view.matched as row (row.gameId)}
					<article class="row">
						<div>
							<b>{title(row.gameId)}</b>
							<span class="meta">{row.courseName} · {row.side === 'w' ? 'White' : 'Black'}</span>
							<p>{summary(row)}</p>
						</div>
						<div class="links">
							<a class="btn sm" href={row.reviewHref}>Full review</a>
							<a class="btn sm" href={row.positionHref}>Position</a>
							<a class="btn sm btn-primary" href={trainHref(row, learned.has(row.line))}>{learned.has(row.line) ? 'Drill the line' : 'Learn the line'}</a>
						</div>
					</article>
				{/each}
			</div>
		{:else}
			<p class="card empty">No saved game matched this filter.</p>
		{/if}
	</section>

	<section aria-labelledby="unmatched-label">
		<h2 id="unmatched-label">Not matched <span>{view.unmatched.length}</span></h2>
		{#if view.unmatched.length}
			<div class="card list">
				{#each view.unmatched as row (row.gameId)}
					<article class="row">
						<div>
							<b>{title(row.gameId)}</b>
							<p>{row.reason === 'unreadable' ? 'This PGN could not be read.' : 'No course matched this game.'}</p>
						</div>
						<a class="btn sm" href={row.reviewHref}>Full review</a>
					</article>
				{/each}
			</div>
		{:else}
			<p class="card empty">Every saved game in this filter matched a course.</p>
		{/if}
	</section>
</main>

<style>
	.opening {
		max-width: 880px;
	}
	.top {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 16px;
	}
	h1 {
		font-size: clamp(26px, 4vw, 36px);
		letter-spacing: -0.045em;
		line-height: 1.1;
	}
	.top p,
	.meta,
	.empty,
	.row p {
		color: var(--text-2);
		font-size: 13px;
	}
	.back {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border-radius: var(--r-pill);
		background: var(--surface-2);
		font-size: 22px;
		line-height: 1;
	}
	.filters,
	.courses {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.filters {
		margin-bottom: 22px;
	}
	.chip {
		cursor: pointer;
	}
	.chip.accent {
		background: var(--accent-soft);
		border-color: rgba(255, 107, 44, 0.35);
		color: var(--accent-hi);
	}
	section + section {
		margin-top: 22px;
	}
	h2 {
		margin-bottom: 8px;
		font-size: 17px;
	}
	h2 span {
		margin-left: 6px;
		color: var(--text-2);
		font: 12px var(--mono);
	}
	.list {
		padding: 4px 14px;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 12px 0;
	}
	.row + .row {
		border-top: 1px solid var(--stroke);
	}
	.row b,
	.meta {
		display: block;
	}
	.links {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.empty {
		padding: 14px;
	}
	.bad {
		margin-bottom: 12px;
		color: var(--bad);
		font-size: 13px;
	}
	.btn.sm {
		min-height: 36px;
	}
	@media (min-width: 800px) {
		.row {
			flex-wrap: nowrap;
		}
		.links {
			flex: 0 0 auto;
		}
	}
</style>
