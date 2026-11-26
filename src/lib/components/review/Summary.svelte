<script lang="ts">
	import { plural } from '#lib/format.ts';
	import Label from '#lib/components/review/Label.svelte';
	import { CLASSIFICATIONS } from '#lib/review/classify.ts';
	import type { Classification, GameRecord, GameReview } from '#lib/review/types.ts';
	import { accuracyText, firstClassPly } from './evaluation.ts';

	let { game, review, onselect }: { game: GameRecord; review: GameReview; onselect?: (ply: number) => void } = $props();
	const labels: Classification[] = ['find', 'sharp', 'best', 'strong', 'good', 'book', 'only', 'loose', 'mistake', 'missed', 'blunder'];
	const shortRating = $derived([review.white, review.black].every(stats => stats.ratingContext?.kind === 'unavailable' && stats.ratingContext.reason === 'short-sample'));
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
			<button type="button" style:color={count ? CLASSIFICATIONS[label].color : undefined} disabled={!count || !onselect} aria-label={`${color === 'w' ? 'White' : 'Black'}: ${count} ${CLASSIFICATIONS[label].label} ${plural(count, 'move')}`} onclick={() => jump(label, index === 0 ? 'w' : 'b')}>{count}</button>
		{/each}
	</div>
{/snippet}
<div class="card summary">
	<div class="players">
		{#each ['white', 'black'] as side, index}
			{@const player = index === 0 ? game.white : game.black}
			{@const stats = index === 0 ? review.white : review.black}
			{@const name = player.name && player.name !== '?' ? player.name : index === 0 ? 'White' : 'Black'}
			{@const hasMoves = review.moves.some(move => move.color === (index === 0 ? 'w' : 'b'))}
			{@const rating = stats.ratingContext?.kind === 'available' ? stats.ratingContext.value : stats.ratingContext ? undefined : stats.estimatedRating || undefined}
			{@const ratingReason = stats.ratingContext?.kind === 'unavailable' && stats.ratingContext.reason === 'missing-data' ? 'No rating data' : 'Not enough moves'}
			<section><b class="name" title={name}>{name}</b><span>{side === 'white' ? 'White' : 'Black'}</span><strong>{hasMoves ? accuracyText(stats.accuracy) : '–'}{#if hasMoves}<small>%</small>{/if}</strong><span>Accuracy</span>{#if !shortRating}<b title={rating ? 'Estimated performance for this game' : ratingReason}>{rating ?? '–'}</b><span>{rating ? 'Game rating' : ratingReason}</span>{/if}</section>
		{/each}
		{#if shortRating}<p class="rating-note">Not enough moves for a game rating</p>{/if}
	</div>
	<div class="tallies">{#each labels as label}{@render tally(label)}{/each}</div>
</div>
<style>
	.summary {
		padding: 14px;
	}
	.players {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
		padding: 3px 0 15px;
	}
	section {
		min-width: 0;
		display: grid;
		justify-items: center;
		gap: 3px;
	}
	.name {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	section span {
		color: var(--text-2);
		font-size: 12px;
	}
	strong {
		font: 700 23px var(--mono);
		margin-top: 7px;
	}
	small {
		font-size: 11px;
	}
	.tally {
		display: grid;
		grid-template-columns: 1fr 2fr 1fr;
		align-items: center;
		min-height: 34px;
		border-top: 1px solid var(--stroke);
		text-align: center;
		font-size: 13px;
	}
	.rating-note { grid-column: 1 / -1; text-align: center; color: var(--text-3); font-size: 12px; margin: 3px 0 0; }
	.tally .label { text-align: left; font: 600 14px var(--font); }
	.tally button {
		padding: 7px;
		font: 700 16px var(--font);
	}
	.tally button:not(:disabled) {
		cursor: pointer;
	}
	.tally button:not(:disabled):hover {
		color: var(--accent-hi);
	}
	.tally button:disabled:not([style]) {
		color: var(--text-3);
	}

</style>
