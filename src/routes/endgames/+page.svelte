<script lang="ts">
	import { onMount } from 'svelte';
	import { loadEndgameProgress, saveEndgameProgress } from '#lib/endgames/store.ts';
	import type { EndgameDifficulty, EndgameMode, EndgameProgress } from '#lib/endgames/types.ts';

	let progress = $state<EndgameProgress | undefined>();

	onMount(async () => {
		progress = await loadEndgameProgress();
	});

	const modes: { id: EndgameMode; label: string }[] = [
		{ id: 'auto', label: 'Auto' },
		{ id: 'coached', label: 'Coached' },
		{ id: 'rated', label: 'Rated' }
	];
	const difficulties: { id: EndgameDifficulty; label: string }[] = [
		{ id: 'easier', label: 'Easier' },
		{ id: 'normal', label: 'Normal' },
		{ id: 'harder', label: 'Harder' }
	];

	function patch(partial: Partial<EndgameProgress>) {
		if (!progress) return;
		progress = { ...progress, ...partial };
		void saveEndgameProgress(progress);
	}

	const tierLabel = $derived(progress?.tier === 'lineage' ? 'Uncoached' : 'Coached');
</script>

<svelte:head><title>Endgames · Chessmode</title></svelte:head>

<main class="page">
	<header class="head">
		<img src="/img/train/endgames.webp" alt="" width="72" height="72" />
		<div>
			<p class="label">Separate from openings</p>
			<h1 class="h-display">Endgame arena</h1>
		</div>
	</header>
	<p class="muted">Play a won endgame against the engine. Your rating here stays off the opening boards.</p>

	{#if progress}
		<section class="card glow stats">
			<div>
				<p class="label">Rating</p>
				<p class="num">{progress.rating}</p>
			</div>
			<div>
				<p class="label">Tier</p>
				<p class="num">{tierLabel}</p>
			</div>
			<div>
				<p class="label">Record</p>
				<p class="num">{progress.wins}–{progress.draws}–{progress.losses}</p>
			</div>
		</section>

		<p class="label">Mode</p>
		<div class="seg" role="group" aria-label="Endgame mode">
			{#each modes as mode (mode.id)}
				<button type="button" aria-pressed={progress.mode === mode.id} onclick={() => patch({ mode: mode.id })}>{mode.label}</button>
			{/each}
		</div>
		<p class="help muted">Auto starts coached. It leaves coaching at 1200, and comes back under 850 after a game. Coached and Rated stay where you put them.</p>

		<p class="label">Positions</p>
		<div class="seg" role="group" aria-label="Position difficulty">
			{#each difficulties as item (item.id)}
				<button type="button" aria-pressed={progress.difficulty === item.id} onclick={() => patch({ difficulty: item.id })}>{item.label}</button>
			{/each}
		</div>

		<a class="btn btn-primary block" href="/endgames/play">Play an endgame</a>
	{/if}
</main>

<style>
	.head {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 28px 0 8px;
	}
	.stats {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
		margin: 16px 0;
		padding: 16px;
	}
	.num {
		margin: 4px 0 0;
		font: 600 18px var(--mono);
	}
	.seg {
		margin: 8px 0 12px;
	}
	.help {
		margin: 0 0 16px;
		font-size: 14px;
	}
	.btn {
		margin-top: 8px;
	}
</style>
