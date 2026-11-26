<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { GameRecord, GameReview } from '#lib/review/types.ts';
	import EvalGraph from './EvalGraph.svelte';
	import Summary from './Summary.svelte';

	let { game, review, ply = 0, onselect, onstart, coach }: { game: GameRecord; review: GameReview; ply?: number; onselect: (ply: number) => void; onstart: () => void; coach?: Snippet } = $props();
	const win = $derived([50, ...review.moves.map(move => move.winAfter)]);
</script>
<div class="overview">
	<div class="coach-slot">{#if coach}{@render coach()}{:else}<p>Review the turning points and see how each side played.</p>{/if}</div>
	<EvalGraph {win} moves={review.moves} total={review.moves.length} {ply} {onselect} />
	<div class="result">{game.white.name} <b>{game.result === '*' ? 'Game in progress' : game.result}</b> {game.black.name}</div>
	<Summary {game} {review} {onselect} />
	<button class="btn btn-primary" type="button" onclick={onstart}>Start review</button>
</div>
<style>
	.overview {
		display: grid;
		gap: 12px;
	}
	.coach-slot {
		color: var(--text-2);
		font-size: 14px;
	}
	.coach-slot p {
		margin: 0;
	}
	.result {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 8px;
		color: var(--text-2);
		font-size: 13px;
		text-align: center;
	}
	.result b {
		color: var(--text);
		font-family: var(--mono);
	}
</style>
