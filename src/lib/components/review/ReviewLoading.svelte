<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Classification, GameRecord } from '#lib/review/types.ts';
	import Label from './Label.svelte';
	let { game, progress = 0, finished = false, shortRating = false, coach }: { game: GameRecord; progress?: number; finished?: boolean; shortRating?: boolean; coach?: Snippet } = $props();
	const labels: Classification[] = ['find', 'sharp', 'best', 'strong', 'good', 'book', 'only', 'loose', 'mistake', 'missed', 'blunder'];
	const percent = $derived(Math.max(0, Math.min(100, progress)));
</script>
<div class:finished class="loading" aria-busy={!finished} aria-label="Analyzing game">
	<div class="coach-slot">{#if coach}{@render coach()}{:else}<p>Analyzing your game…</p>{/if}</div>
	<div class="card chart"><div class="grid"></div><div class="horizontal"></div><div class="progress-track"><div style:width={`${percent}%`}></div></div></div>
	<div class="card placeholders">
		<div class="outcome"><i class="skeleton"></i></div>
		<div class="players">
			{#each [game.white, game.black] as player, index}
				<section>
					<b class="name">{player.name && player.name !== '?' ? player.name : index === 0 ? 'White' : 'Black'}</b>
					<i class="skeleton metric"></i>
					<span>Accuracy</span>
					{#if !shortRating}<i class="skeleton rating"></i><span>Game rating</span>{/if}
				</section>
			{/each}
			{#if shortRating}<p class="rating-note">Not enough moves for a game rating</p>{/if}
		</div>
		{#each labels as label}<div class="tally"><i class="skeleton count"></i><span class="label"><Label classification={label} named size={28} /></span><i class="skeleton count"></i></div>{/each}
	</div>
	<div class="status" role="status">Analyzing · {Math.floor(percent)}%</div>
</div>
<style>
	.loading {
		display: grid;
		gap: 12px;
		transition: opacity 2.5s ease;
	}
	.finished {
		opacity: 0.12;
	}
	.coach-slot {
		color: var(--text-2);
		font-size: 14px;
	}
	p {
		margin: 0;
	}
	.chart {
		position: relative;
		height: 116px;
		overflow: hidden;
		padding: 12px;
	}
	.grid,
	.horizontal {
		position: absolute;
		inset: 12px;
		opacity: 0.3;
	}
	.grid {
		background: repeating-linear-gradient(90deg, transparent 0 39px, var(--text-3) 40px 41px);
		animation: pulse 1.5s ease infinite;
	}
	.horizontal {
		background: repeating-linear-gradient(0deg, transparent 0 24px, var(--text-3) 25px 26px);
		animation: pulse 1.5s ease 350ms infinite;
	}
	.progress-track {
		position: absolute;
		bottom: 12px;
		left: 12px;
		right: 12px;
		height: 4px;
		background: var(--surface-4);
		border-radius: var(--r-pill);
		overflow: hidden;
	}
	.progress-track div {
		height: 100%;
		background: var(--accent);
		transition: width 500ms ease;
	}
	.placeholders { padding: 16px 14px 8px; }
	.outcome { display: grid; place-items: center; height: 18px; margin-bottom: 14px; }
	.outcome i { width: 96px; height: 12px; }
	.players { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding-bottom: 16px; }
	.players section { min-width: 0; display: grid; justify-items: center; gap: 4px; }
	.rating-note { grid-column: 1 / -1; text-align: center; color: var(--text-3); font-size: 12px; margin: 2px 0 0; }
	.name { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 15px; font-weight: 600; margin-bottom: 6px; }
	.players span { color: var(--text-3); font-size: 12px; }
	.skeleton { display: block; border-radius: 6px; background: var(--surface-4); animation: breathe 1.6s ease infinite; }
	.metric { width: 96px; height: 42px; border-radius: var(--r-sm); }
	.rating { width: 48px; height: 18px; margin-top: 8px; }
	.count { width: 16px; height: 14px; justify-self: center; }
	.tally { display: grid; grid-template-columns: 1fr 2.2fr 1fr; align-items: center; min-height: 44px; border-top: 1px solid var(--stroke); }
	.tally .label { display: flex; justify-content: center; opacity: 0.55; }
	.status {
		color: var(--text-2);
		font-size: 12px;
	}
	.status {
		text-align: center;
	}
	@keyframes breathe {
		50% {
			opacity: 0.5;
		}
	}
	@keyframes pulse {
		50% {
			opacity: 0.08;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.loading,
		.progress-track div {
			transition: none;
		}
		.grid,
		.horizontal,
		.skeleton {
			animation: none;
		}
	}
</style>
