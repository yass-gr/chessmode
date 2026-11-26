<script lang="ts">
	import type { GameRecord, GameReview } from '#lib/review/types.ts';
	import EvalGraph from './EvalGraph.svelte';
	import Summary from './Summary.svelte';

	let { game, review, ply = 0, onselect }: { game: GameRecord; review: GameReview; ply?: number; onselect: (ply: number) => void } = $props();
	const win = $derived([50, ...review.moves.map(move => move.winAfter)]);
	const sideName = (name: string, fallback: string) => name && name !== '?' ? name : fallback;
</script>
<div class="overview">
	<EvalGraph {win} moves={review.moves} total={review.moves.length} {ply} {onselect} />
	<div class="result">{sideName(game.white.name, 'White')} <b>{game.result === '*' ? 'Game in progress' : game.result}</b> {sideName(game.black.name, 'Black')}</div>
	<Summary {game} {review} {onselect} />
</div>
<style>
	.overview {
		display: grid;
		gap: 12px;
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
