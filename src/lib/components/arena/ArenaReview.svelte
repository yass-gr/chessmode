<script lang="ts">
	import Board from '#lib/components/Board.svelte';
	import EvalBar from '#lib/components/review/EvalBar.svelte';
	import EvalGraph from '#lib/components/review/EvalGraph.svelte';
	import { START_FEN, type Color, type Fen, type Ply } from '#lib/chess/types.ts';
	import type { BoardTheme, PieceSet } from '#lib/settings/types.ts';
	import type { MoveReview, Score } from '#lib/review/types.ts';

	let {
		plies,
		moves,
		ply,
		score,
		turn,
		variation,
		evalNote,
		reviewHref,
		orientation,
		theme,
		pieces,
		onselect,
		onagain
	}: {
		plies: readonly Ply[];
		moves: readonly MoveReview[];
		ply: number;
		score?: Score;
		turn: Color;
		variation: string;
		evalNote: string;
		reviewHref: string;
		orientation: Color;
		theme: BoardTheme;
		pieces: PieceSet;
		onselect: (ply: number) => void;
		onagain: () => void;
	} = $props();

	const win = $derived(Array.from({ length: Math.max(plies.length, 1) + 1 }, () => 50));
	const shown = $derived(ply <= 0 ? (plies[0]?.fenBefore ?? START_FEN) : (plies[ply - 1]?.fenAfter ?? START_FEN));
	const last = $derived(ply > 0 ? plies[ply - 1] : undefined);
	const moveNo = (index: number) => `${Math.floor(index / 2) + 1}${index % 2 ? '…' : '.'}`;
</script>

<div class="review" data-text="default">
	<div class="board-frame">
		<EvalBar {score} {turn} {orientation} loading={!score && !evalNote} />
		<div class="board-slot">
			<Board
				fen={shown as Fen}
				orientation={orientation === 'w' ? 'white' : 'black'}
				movable="none"
				lastMove={last ? [last.uci.slice(0, 2), last.uci.slice(2, 4)] : undefined}
				{theme}
				{pieces}
			/>
		</div>
	</div>
	<EvalGraph {win} {moves} total={plies.length} {ply} {onselect} />
	<p class="variation card">{variation || evalNote || 'Engine line appears here.'}</p>
	<div class="moves card">
		{#each plies as move, index (index)}
			<button type="button" class:mine={move.color === orientation} class:on={index + 1 === ply} onclick={() => onselect(index + 1)}>
				{#if index % 2 === 0}<em>{moveNo(index)}</em>{/if}{move.san}
			</button>
		{/each}
	</div>
	<div class="actions">
		<button type="button" class="btn btn-surface" onclick={() => onselect(Math.max(0, ply - 1))} disabled={ply <= 0}>Previous</button>
		<button type="button" class="btn btn-surface" onclick={() => onselect(Math.min(plies.length, ply + 1))} disabled={ply >= plies.length}>Next</button>
	</div>
	<div class="actions">
		<button type="button" class="btn btn-primary block" onclick={onagain}>Play again</button>
		{#if reviewHref}
			<a class="btn btn-surface block" href={reviewHref}>Full analysis</a>
		{/if}
	</div>
</div>

<style>
	.review {
		display: grid;
		gap: 12px;
	}
	.board-frame {
		display: grid;
		grid-template-columns: 28px minmax(0, 1fr);
		gap: 8px;
		align-items: stretch;
	}
	.board-slot {
		min-width: 0;
	}
	.variation {
		padding: 12px 14px;
		font: 14px/1.45 var(--mono);
		color: var(--text);
	}
	.moves {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 8px;
		padding: 12px 14px;
	}
	.moves button {
		border: 0;
		background: transparent;
		color: var(--text-2);
		font: 13px/1.9 var(--mono);
		padding: 0 2px;
		border-radius: var(--r-xs);
	}
	.moves button.mine {
		color: var(--text);
	}
	.moves button.on {
		background: var(--accent-soft);
		color: var(--accent);
	}
	.moves em {
		font-style: normal;
		margin-right: 3px;
		color: var(--text-3);
	}
	.actions {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}
	.actions .block {
		grid-column: 1 / -1;
	}
</style>
