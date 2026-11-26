<script lang="ts">
	import { plural } from '#lib/format.ts';
 import type { Coverage, Gap } from '#lib/explorer/coverage.ts';
 import type { Explorer } from '#lib/explorer/types.ts';
 let { coverage, explorer, bands, onselect }: { coverage: Coverage; explorer: Explorer; bands?: number[]; onselect: (gap: Gap) => void } = $props();
</script>
<section class="card coverage">
 <h2>Repertoire coverage</h2>
 <p class="muted">Lichess sample: {explorer.games.toLocaleString()} {plural(explorer.games, 'game')} · {explorer.month} · ratings {(bands ?? explorer.bands).join(', ')}</p>
 {#if coverage.observed}<p>{Math.round(coverage.score * 100)}% answered · {coverage.points.toFixed(1)} gap points</p>{:else}<p>Coverage is unknown: no reply data is available.</p>{/if}
 <p class="muted">Points reflect reach-weighted missing replies; their scale is local to Chessmode.</p>
 {#if coverage.unknown.length}<p>Coverage is unknown at {coverage.unknown.length} {coverage.unknown.length === 1 ? 'position' : 'positions'} without data.</p>{/if}
 {#if coverage.gaps.length}
  <ol>{#each coverage.gaps as gap}<li><button class="option" onclick={() => onselect(gap)}><span>{gap.path.join(' ')} → {gap.san}</span><small>{(gap.share * 100).toFixed(1)}% of replies</small></button></li>{/each}</ol>
 {:else if coverage.observed && !coverage.unknown.length}<p>No common unanswered replies in the available sample.</p>{/if}
</section>
<style>
	.coverage {
		display: grid;
		gap: 10px;
		padding: 16px;
	}
	h2,
	p {
		margin: 0;
	}
	h2 {
		font-size: 17px;
		line-height: 1.3;
		font-weight: 600;
		letter-spacing: -0.015em;
	}
	p {
		line-height: 1.45;
	}
	ol {
		display: grid;
		gap: 8px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	small {
		color: var(--text-2);
		white-space: nowrap;
	}
</style>
