<script lang="ts">
	import type { GameRecord, GameReview } from '#lib/review/types.ts';
	import EvalGraph from './EvalGraph.svelte';
	import Summary from './Summary.svelte';

	let { game, review, ply = 0, onselect }: { game: GameRecord; review: GameReview; ply?: number; onselect: (ply: number) => void } = $props();
	const win = $derived([50, ...review.moves.map(move => move.winAfter)]);
</script>
<div class="overview">
	<EvalGraph {win} moves={review.moves} total={review.moves.length} {ply} {onselect} />
	<Summary {game} {review} {onselect} />
</div>
<style>
	.overview {
		display: grid;
		gap: 12px;
	}
</style>
