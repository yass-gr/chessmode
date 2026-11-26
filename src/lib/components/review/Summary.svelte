<script lang="ts">
	import { plural } from '#lib/format.ts';
	import Label from '#lib/components/review/Label.svelte';
	import { CLASSIFICATIONS } from '#lib/review/classify.ts';
	import type { Classification, GameRecord, GameReview } from '#lib/review/types.ts';
	import { accuracyText, firstClassPly } from './evaluation.ts';

	let { game, review, onselect }: { game: GameRecord; review: GameReview; onselect?: (ply: number) => void } = $props();
	const labels: Classification[] = ['find', 'sharp', 'best', 'strong', 'good', 'book', 'only', 'loose', 'mistake', 'missed', 'blunder'];
	const shortRating = $derived([review.white, review.black].every(stats => stats.ratingContext?.kind === 'unavailable' && stats.ratingContext.reason === 'short-sample'));
	const outcome = $derived(
		game.result === '1-0' ? 'White won' : game.result === '0-1' ? 'Black won' : game.result === '1/2-1/2' ? 'Draw' : 'Unfinished'
	);
	function jump(label: Classification, color: 'w' | 'b') {
		const target = firstClassPly(review.moves, label, color);
		if (target !== undefined) onselect?.(target);
	}
</script>

{#snippet tally(label: Classification)}
	<div class="tally">
		{#each ['w', 'b'] as color, index}
			{@const count = index === 0 ? review.white.counts[label] : review.black.counts[label]}
			{#if index === 1}<span class="label"><Label classification={label} named size={28} /></span>{/if}
			<button type="button" class="count" class:zero={!count} style:color={count ? CLASSIFICATIONS[label].color : undefined} disabled={!count || !onselect} aria-label={`${color === 'w' ? 'White' : 'Black'}: ${count} ${CLASSIFICATIONS[label].label} ${plural(count, 'move')}`} onclick={() => jump(label, index === 0 ? 'w' : 'b')}>{count}</button>
		{/each}
	</div>
{/snippet}

<div class="card summary">
	<div class="outcome"><span>{game.result === '*' ? '' : game.result}</span>{outcome}</div>
	<div class="players">
		{#each ['white', 'black'] as side, index}
			{@const player = index === 0 ? game.white : game.black}
			{@const stats = index === 0 ? review.white : review.black}
			{@const name = player.name && player.name !== '?' ? player.name : index === 0 ? 'White' : 'Black'}
			{@const hasMoves = review.moves.some(move => move.color === (index === 0 ? 'w' : 'b'))}
			{@const rating = stats.ratingContext?.kind === 'available' ? stats.ratingContext.value : stats.ratingContext ? undefined : stats.estimatedRating || undefined}
			{@const ratingReason = stats.ratingContext?.kind === 'unavailable' && stats.ratingContext.reason === 'missing-data' ? 'No rating data' : 'Not enough moves'}
			<section>
				<b class="name" title={name}>{name}</b>
				<strong class="accuracy" class:light={side === 'white'}>{hasMoves ? accuracyText(stats.accuracy) : '–'}{#if hasMoves}<small>%</small>{/if}</strong>
				<span class="caption">Accuracy</span>
				{#if !shortRating}
					<b class="rating" title={rating ? 'Estimated performance for this game' : ratingReason}>{rating ?? '–'}</b>
					<span class="caption">{rating ? 'Game rating' : ratingReason}</span>
				{/if}
			</section>
		{/each}
		{#if shortRating}<p class="rating-note">Not enough moves for a game rating</p>{/if}
	</div>
	<div class="tallies">{#each labels as label}{@render tally(label)}{/each}</div>
</div>

<style>
	.summary {
		padding: 16px 14px 8px;
	}
	.outcome {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 8px;
		margin-bottom: 14px;
		color: var(--text-2);
		font-size: 13px;
		font-weight: 600;
	}
	.outcome span {
		color: var(--text);
		font-variant-numeric: tabular-nums;
	}
	.outcome span:empty {
		display: none;
	}
	.players {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
		padding-bottom: 16px;
	}
	section {
		min-width: 0;
		display: grid;
		justify-items: center;
		gap: 4px;
	}
	.name {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 15px;
		font-weight: 600;
		margin-bottom: 6px;
	}
	.accuracy {
		display: inline-flex;
		align-items: baseline;
		justify-content: center;
		min-width: 96px;
		padding: 8px 14px;
		border-radius: var(--r-sm);
		background: #2c2c30;
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08), 0 2px 6px rgba(0, 0, 0, 0.35);
		color: var(--text);
		font: 700 26px/1 var(--font);
		letter-spacing: -0.02em;
		font-variant-numeric: tabular-nums;
	}
	.accuracy.light {
		background: #f1efe9;
		color: #141416;
		box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.35);
	}
	small {
		margin-left: 1px;
		font-size: 14px;
		font-weight: 600;
	}
	.caption {
		color: var(--text-3);
		font-size: 12px;
	}
	.rating {
		margin-top: 8px;
		font-size: 18px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.rating-note {
		grid-column: 1 / -1;
		margin: 2px 0 0;
		color: var(--text-3);
		font-size: 12px;
		text-align: center;
	}
	.tally {
		display: grid;
		grid-template-columns: 1fr 2.2fr 1fr;
		align-items: center;
		min-height: 44px;
		border-top: 1px solid var(--stroke);
		text-align: center;
	}
	.tally .label {
		text-align: left;
	}
	.count {
		padding: 8px;
		font: 700 17px var(--font);
		font-variant-numeric: tabular-nums;
	}
	.count:not(:disabled) {
		cursor: pointer;
	}
	@media (hover: hover) and (pointer: fine) {
		.count:not(:disabled):hover {
			filter: brightness(1.2);
		}
	}
	.count.zero {
		color: var(--text-3);
		font-weight: 500;
	}
</style>
