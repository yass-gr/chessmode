<script lang="ts">
	import Mascot from '#lib/components/Mascot.svelte';
	import { BOTS } from '#lib/bots/bots.ts';
	import type { BotColor } from '#lib/bots/types.ts';

	let bot = $state(BOTS[0].id);
	let color = $state<BotColor>('w');
	const colors: { id: BotColor; label: string }[] = [
		{ id: 'w', label: 'White' },
		{ id: 'b', label: 'Black' },
		{ id: 'random', label: 'Random' }
	];
	const href = $derived(`/bots/play?${new URLSearchParams({ bot, color })}`);
</script>

<svelte:head><title>Bots · Chessmode</title></svelte:head>

<main class="page">
	<header class="head">
		<p class="label">From the starting position</p>
		<h1 class="h-display">Play a bot</h1>
		<p class="muted">Pick who you face and which color you take. A finished game opens in review.</p>
	</header>

	<div class="list">
		{#each BOTS as item (item.id)}
			<button class="card bot" class:on={bot === item.id} type="button" aria-pressed={bot === item.id} onclick={() => (bot = item.id)}>
				{#if item.mascot}
					<Mascot expression="happy" size={48} alt="" />
				{:else}
					<span class="mark" data-bot={item.id} aria-hidden="true">{item.initials}</span>
				{/if}
				<span>
					<b>{item.name}</b>
					<small>{item.blurb}</small>
				</span>
			</button>
		{/each}
	</div>

	<p class="label section">Your color</p>
	<div class="seg" role="group" aria-label="Color">
		{#each colors as item (item.id)}
			<button type="button" aria-pressed={color === item.id} onclick={() => (color = item.id)}>{item.label}</button>
		{/each}
	</div>
	<a class="btn btn-primary block" {href}>Play</a>
</main>

<style>
	.head {
		display: grid;
		gap: 6px;
		padding: 28px 0 16px;
	}
	.list {
		display: grid;
		gap: 10px;
	}
	.bot {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		padding: 12px;
		text-align: left;
		color: inherit;
	}
	.bot.on {
		background: var(--surface-3);
		box-shadow: inset 0 0 0 1.5px var(--text-2);
	}
	.bot b {
		display: block;
	}
	.bot small {
		color: var(--text-3);
	}
	.mark {
		display: grid;
		place-items: center;
		flex: 0 0 auto;
		width: 48px;
		height: 48px;
		border-radius: 50%;
		font-size: 18px;
		font-weight: 600;
		letter-spacing: -0.03em;
	}
	.mark[data-bot='pip'] {
		background: color-mix(in srgb, var(--text-2) 24%, var(--surface-1));
		color: var(--text);
	}
	.mark[data-bot='lark'] {
		background: color-mix(in srgb, var(--good) 22%, var(--surface-1));
		color: var(--good);
	}
	.mark[data-bot='bram'] {
		background: color-mix(in srgb, var(--warn) 24%, var(--surface-1));
		color: var(--warn);
	}
	.mark[data-bot='nessa'] {
		background: color-mix(in srgb, var(--eval-graph-black) 70%, var(--surface-3));
		color: var(--text);
	}
	.section {
		margin: 26px 0 10px;
	}
	.seg {
		margin: 0 0 16px;
	}
</style>
