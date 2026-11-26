<script lang="ts">
	import Board from '#lib/components/Board.svelte';
	import Mascot from '#lib/components/Mascot.svelte';
	import PlayShell from '#lib/components/play/PlayShell.svelte';
	import BoardOptions from '#lib/components/training/BoardOptions.svelte';
	import { outcomeText } from '#lib/bots/bots.ts';
	import type { BotGame, BotProfile } from '#lib/bots/types.ts';
	import type { Preferences } from '#lib/settings/types.ts';

	let {
		game,
		bot,
		preferences,
		settings,
		view,
		error,
		busy,
		onmove,
		onview,
		onlive,
		onrestart,
		ontogglesettings,
		onpreferences,
		onresign
	}: {
		game: BotGame;
		bot: BotProfile;
		preferences: Preferences;
		settings: boolean;
		view?: number;
		error: string;
		busy: boolean;
		onmove: (uci: string) => void;
		onview: (ply: number) => void;
		onlive: () => void;
		onrestart: () => void;
		ontogglesettings: () => void;
		onpreferences: (preferences: Preferences) => void;
		onresign: () => void;
	} = $props();

	const live = $derived(view === undefined);
	const fen = $derived(view === undefined ? game.fen : game.plies[view]?.fenAfter ?? game.fen);
	const last = $derived(game.plies.at(-1));
</script>

<PlayShell closeHref="/bots">
	{#snippet status()}
		<div class="who">
			{#if bot.mascot}
				<Mascot expression="neutral" size={36} alt="" />
			{:else}
				<img class="portrait" src="/img/bots/{bot.id}.webp" alt="" />
			{/if}
			<div>
				<strong>{bot.name}</strong>
				<span>You are {game.player === 'w' ? 'White' : 'Black'}</span>
			</div>
		</div>
	{/snippet}
	{#snippet board()}
		<Board
			{fen}
			orientation={game.player === 'w' ? 'white' : 'black'}
			movable={live && game.phase === 'player' ? game.player : 'none'}
			lastMove={live && last ? [last.uci.slice(0, 2), last.uci.slice(2, 4)] : undefined}
			theme={preferences.theme}
			pieces={preferences.pieces}
			premove={{ session: live ? game.session : `${game.session}-view` }}
			{onmove}
		/>
	{/snippet}
	{#snippet panel()}
		<p class="turn">{!live ? 'Looking back' : game.phase === 'bot' || busy ? `${bot.name} is thinking` : game.phase === 'over' ? outcomeText(game) : 'Your move'}</p>
		{#if error}<p class="error">{error}</p>{/if}
		{#if game.plies.length}
			<ol class="moves">
				{#each game.plies as ply, i (i)}
					<li>
						<button type="button" class:on={view === i} onclick={() => onview(i)}>{ply.san}</button>
					</li>
				{/each}
			</ol>
		{/if}
		{#if !live}
			<button class="btn btn-primary" type="button" onclick={onlive}>Back to the game</button>
		{/if}
		<div class="row">
			<button class="btn btn-surface" type="button" onclick={onrestart}>Restart</button>
			<button class="btn btn-ghost" type="button" onclick={ontogglesettings}>{settings ? 'Hide settings' : 'Settings'}</button>
		</div>
		{#if settings}<BoardOptions onchange={onpreferences} />{/if}
		{#if game.phase !== 'over'}
			<button class="btn btn-ghost" type="button" onclick={onresign}>Resign</button>
		{/if}
	{/snippet}
</PlayShell>

<style>
	.portrait { width: 36px; height: 36px; object-fit: contain; }
	.who {
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 0;
	}
	.who div {
		display: grid;
	}
	.who span {
		color: var(--text-3);
		font-size: 13px;
	}
	.turn {
		margin: 0;
		font-weight: 600;
	}
	.error {
		margin: 0;
		color: var(--bad);
	}
	.moves {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.moves button {
		border: 0;
		background: transparent;
		color: var(--text-2);
		font: 14px var(--mono);
		padding: 4px 2px;
	}
	.moves button.on {
		color: var(--accent-hi);
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
</style>
