<script lang="ts">
 import type { Coverage, Gap } from '#lib/explorer/coverage.ts';
 import type { Explorer } from '#lib/explorer/types.ts';
 let { coverage, explorer, bands, onselect }: { coverage: Coverage; explorer: Explorer; bands?: number[]; onselect: (gap: Gap) => void } = $props();
</script>
<section class="card coverage">
 <h2>Repertoire coverage</h2>
 <p class="muted">Lichess sample: {explorer.games.toLocaleString()} games · {explorer.month} · ratings {(bands ?? explorer.bands).join(', ')}</p>
 {#if coverage.observed}<p>{Math.round(coverage.score * 100)}% answered · {coverage.points.toFixed(1)} gap points</p>{:else}<p>Coverage is unknown: no reply data is available.</p>{/if}
 <p class="muted">Points reflect reach-weighted missing replies; their scale is local to Chessmode.</p>
 {#if coverage.unknown.length}<p>Coverage is unknown at {coverage.unknown.length} {coverage.unknown.length === 1 ? 'position' : 'positions'} without data.</p>{/if}
 {#if coverage.gaps.length}
  <ol>{#each coverage.gaps as gap}<li><button class="option" onclick={() => onselect(gap)}><span>{gap.path.join(' ')} → {gap.san}</span><small>{(gap.share * 100).toFixed(1)}% of replies</small></button></li>{/each}</ol>
 {:else if coverage.observed && !coverage.unknown.length}<p>No common unanswered replies in the available sample.</p>{/if}
</section>
<style>.coverage { padding:16px; } h2 { margin:0; } p { line-height:1.45; } ol { padding-left:20px; } li { margin:8px 0; } button { width:100%; display:flex; justify-content:space-between; gap:12px; text-align:left; } small { color:var(--text-2); }</style>
