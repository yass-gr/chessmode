<script lang="ts">
	import Label from '#lib/components/review/Label.svelte';
	import { CLASSIFICATIONS } from '#lib/review/classify.ts';
	import type { Classification, GameRecord, GameReview } from '#lib/review/types.ts';
	import { accuracyText, firstClassPly } from './evaluation.ts';

	let { game, review, onselect }: { game: GameRecord; review: GameReview; onselect?: (ply: number) => void } = $props();
	const primary: Classification[] = ['find', 'sharp', 'best', 'strong', 'good', 'book', 'only', 'mistake', 'missed', 'blunder'];
	const common: Classification[] = ['best', 'strong', 'good'];
	let expanded = $state(false);
	const visible = $derived(primary.filter(label => !common.includes(label) || common.filter(item => review.white.counts[item] + review.black.counts[item] > 0).includes(label)));
	const extra: Classification[] = ['loose'];
	function jump(label: Classification, color: 'w' | 'b') {
		const target = firstClassPly(review.moves, label, color);
		if (target !== undefined) onselect?.(target);
	}
</script>

{#snippet tally(label: Classification)}
	<div class="tally">
		{#each ['w', 'b'] as color, index}
			{@const count = index === 0 ? review.white.counts[label] : review.black.counts[label]}
			{#if index === 1}<span class="label"><Label classification={label} named /></span>{/if}
			<button type="button" disabled={!count || !onselect} aria-label={`${color === 'w' ? 'White' : 'Black'}: ${count} ${CLASSIFICATIONS[label].label} moves`} onclick={() => jump(label, index === 0 ? 'w' : 'b')}>{count}</button>
		{/each}
	</div>
{/snippet}
<div class="card summary">
	<div class="players">
		{#each ['white', 'black'] as side, index}
			{@const player = index === 0 ? game.white : game.black}
			{@const stats = index === 0 ? review.white : review.black}
			{@const hasMoves = review.moves.some(move => move.color === (index === 0 ? 'w' : 'b'))}
			<section><b class="name" title={player.name}>{player.name}</b><span>{side === 'white' ? 'White' : 'Black'}</span><strong>{hasMoves ? accuracyText(stats.accuracy) : '–'}{#if hasMoves}<small>%</small>{/if}</strong><span>Accuracy</span><b title={stats.estimatedRating ? 'Estimated performance for this game' : 'Not enough moves to estimate a rating'}>{stats.estimatedRating || '–'}</b><span>{stats.estimatedRating ? 'Game rating' : 'Not enough moves'}</span></section>
		{/each}
	</div>
	<div class="tallies">{#each visible as label}{@render tally(label)}{/each}</div>
	<div class:expanded class="extra" inert={!expanded}><div>{#each extra as label}{@render tally(label)}{/each}</div></div>
	<button class="expand" type="button" aria-expanded={expanded} onclick={() => { expanded = !expanded; }}>{expanded ? 'Show less' : 'Show more'}</button>
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
	.tally button {
		padding: 7px;
		font: 600 13px var(--mono);
	}
	.tally button:not(:disabled) {
		cursor: pointer;
	}
	.tally button:not(:disabled):hover {
		color: var(--accent-hi);
	}
	.tally button:disabled {
		color: var(--text-3);
	}
	.extra {
		display: grid;
		grid-template-rows: 0fr;
		opacity: 0;
		transition:
			grid-template-rows 150ms cubic-bezier(0.5, 0, 0.6, 1),
			opacity 100ms cubic-bezier(0.5, 0, 0.6, 1);
	}
	.extra.expanded {
		grid-template-rows: 1fr;
		opacity: 1;
	}
	.extra > div {
		overflow: hidden;
	}
	.expand {
		display: block;
		width: 100%;
		padding: 10px;
		color: var(--text-2);
		font-size: 12px;
	}
	@media (prefers-reduced-motion: reduce) {
		.extra {
			transition: none;
		}
	}
</style>
