<script lang="ts">
	import Label from '#lib/components/review/Label.svelte';
	import { CLASSIFICATIONS } from '#lib/review/classify.ts';
	import type { Classification, GameRecord, GameReview } from '#lib/review/types.ts';

	let { game, review }: { game: GameRecord; review: GameReview } = $props();
	const labels = (Object.keys(CLASSIFICATIONS) as Classification[]).sort((a, b) => CLASSIFICATIONS[b].rank - CLASSIFICATIONS[a].rank);
	const sides = ['white', 'black'] as const;
</script>

<div class="card summary">
	<div class="players">
		{#each sides as side}
			{@const player = game[side]}
			{@const stats = review[side]}
			<section>
				<div class="ring" style:--accuracy={stats.accuracy + '%'}><strong>{stats.accuracy.toFixed(1)}<small>%</small></strong></div>
				<b class="name" title={player.name}>{player.name}</b>
				<span>{side === 'white' ? 'White' : 'Black'} · Accuracy</span>
			</section>
		{/each}
	</div>
	<table>
		<thead><tr><th scope="col">White</th><th scope="col">Game summary</th><th scope="col">Black</th></tr></thead>
		<tbody>
			<tr><td>{review.white.estimatedRating || '–'}</td><th scope="row">Estimated rating</th><td>{review.black.estimatedRating || '–'}</td></tr>
			<tr><td>{review.white.acpl.toFixed(1)}</td><th scope="row">Avg. centipawn loss</th><td>{review.black.acpl.toFixed(1)}</td></tr>
			{#each labels as classification}
				<tr>
					<td>{review.white.counts[classification]}</td>
					<th scope="row"><Label {classification} named /></th>
					<td>{review.black.counts[classification]}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.summary { padding: 14px; }
	.players { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 3px 0 15px; }
	section { min-width: 0; display: grid; justify-items: center; gap: 3px; }
	.name { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	section span { color: var(--text-2); font-size: 12px; }
	.ring { width: 68px; aspect-ratio: 1; display: grid; place-items: center; border-radius: 50%; background: conic-gradient(var(--accent-hi) var(--accuracy), var(--surface-4) 0); margin-bottom: 4px; }
	.ring strong { display: grid; place-content: center; grid-auto-flow: column; align-items: baseline; width: 58px; aspect-ratio: 1; border-radius: 50%; background: var(--surface-2); font: 700 17px var(--mono); }
	small { font-size: 9px; }
	table { width: 100%; border-collapse: collapse; font-size: 13px; }
	th, td { padding: 5px 2px; text-align: center; border-top: 1px solid var(--stroke); }
	td { width: 22%; font-family: var(--mono); }
	th { font-weight: 550; }
	thead { color: var(--text-2); }
</style>
