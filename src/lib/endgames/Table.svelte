<script lang="ts">
	import Board, { type Arrow } from '#lib/components/Board.svelte';
	import PlayShell from '#lib/components/play/PlayShell.svelte';
	import EvalBar from '#lib/components/review/EvalBar.svelte';
	import BoardOptions from '#lib/components/training/BoardOptions.svelte';
	import type { EndgamePlay } from '#lib/endgames/play.ts';
	import type { EndgamePosition } from '#lib/endgames/types.ts';
	import type { Score } from '#lib/review/types.ts';
	import type { Preferences } from '#lib/settings/types.ts';

	let {
		round,
		position,
		rating,
		preferences,
		score,
		busy,
		error,
		settings,
		arrows,
		onmove,
		onhint,
		onshow,
		onkeep,
		oncommit,
		onresign,
		ontogglesettings,
		onpreferences
	}: {
		round: EndgamePlay;
		position: EndgamePosition;
		rating: number;
		preferences: Preferences;
		score?: Score;
		busy: boolean;
		error: string;
		settings: boolean;
		arrows: Arrow[];
		onmove: (uci: string) => void;
		onhint: () => void;
		onshow: () => void;
		onkeep: () => void;
		oncommit: () => void;
		onresign: () => void;
		ontogglesettings: () => void;
		onpreferences: (preferences: Preferences) => void;
	} = $props();

	const last = $derived(round.plies.at(-1));
</script>

<PlayShell closeHref="/endgames">
	{#snippet status()}
		<div class="status">
			<strong>{rating}</strong>
			<span>{round.coach === 'off' ? 'Rated' : 'Coached'} · {position.rating}</span>
		</div>
	{/snippet}
	{#snippet board()}
		<div class="board-row">
			{#if preferences.evalBar}
				<EvalBar {score} turn={round.fen.split(' ')[1] === 'b' ? 'b' : 'w'} orientation={round.player} loading={busy} />
			{/if}
			<Board
				fen={round.fen}
				orientation={round.player === 'w' ? 'white' : 'black'}
				movable={round.phase === 'player' ? round.player : 'none'}
				lastMove={last ? [last.uci.slice(0, 2), last.uci.slice(2, 4)] : undefined}
				{arrows}
				theme={preferences.theme}
				pieces={preferences.pieces}
				premove={{ session: round.session }}
				{onmove}
			/>
		</div>
	{/snippet}
	{#snippet panel()}
		<p class="turn">{round.phase === 'opponent' || busy ? 'Opponent is thinking' : round.phase === 'considering' ? 'That is not the idea.' : 'Your move'}</p>
		{#if error}<p class="error">{error}</p>{/if}
		{#if round.coach !== 'off' && round.phase === 'player'}
			<div class="row">
				<button class="btn btn-surface" type="button" onclick={onhint}>Hint</button>
				<button class="btn btn-surface" type="button" onclick={onshow}>Show</button>
			</div>
		{/if}
		{#if round.phase === 'considering'}
			<div class="row">
				<button class="btn btn-primary" type="button" onclick={onkeep}>Keep trying</button>
				<button class="btn btn-surface" type="button" onclick={oncommit}>Play it</button>
			</div>
		{/if}
		{#if round.plies.length}
			<ol class="moves">
				{#each round.plies as ply, i (i)}
					<li>{ply.san}</li>
				{/each}
			</ol>
		{/if}
		<button class="btn btn-ghost" type="button" onclick={ontogglesettings}>{settings ? 'Hide settings' : 'Settings'}</button>
		{#if settings}<BoardOptions onchange={onpreferences} />{/if}
		{#if round.phase !== 'over'}
			<button class="btn btn-ghost" type="button" onclick={onresign}>Resign</button>
		{/if}
	{/snippet}
</PlayShell>

<style>
	.status {
		display: grid;
	}
	.status span {
		color: var(--text-3);
		font-size: 13px;
	}
	.board-row {
		display: flex;
		align-items: stretch;
		gap: 8px;
	}
	.board-row :global(.board-wrap) {
		flex: 1;
	}
	.turn {
		margin: 0;
		font-weight: 600;
	}
	.error {
		margin: 0;
		color: var(--bad);
	}
	.row {
		display: flex;
		gap: 8px;
	}
	.moves {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 12px;
		margin: 0;
		padding: 0;
		list-style: none;
		font: 14px var(--mono);
		color: var(--text-2);
	}
</style>
