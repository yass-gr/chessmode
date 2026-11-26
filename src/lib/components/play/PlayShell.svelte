<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Volume2, VolumeX, X } from '@lucide/svelte';
	import { isMuted, setMuted } from '#lib/sound.ts';

	interface Props {
		closeHref: string;
		status: Snippet;
		board: Snippet;
		panel: Snippet;
	}

	let { closeHref, status, board, panel }: Props = $props();
	let muted = $state(isMuted());

	async function toggleSound() {
		muted = !muted;
		await setMuted(muted);
	}
</script>

<main class="shell">
	<header class="topbar">
		<a class="icon-btn" href={closeHref} aria-label="Close">
			<X size={18} stroke-width={1.75} />
		</a>
		<div class="status">{@render status()}</div>
		<button class="icon-btn" onclick={toggleSound} aria-label={muted ? 'Turn sound on' : 'Turn sound off'} aria-pressed={!muted}>
			{#if muted}
				<VolumeX size={18} stroke-width={1.75} />
			{:else}
				<Volume2 size={18} stroke-width={1.75} />
			{/if}
		</button>
	</header>
	<div class="layout">
		<section class="board-col">{@render board()}</section>
		<aside class="panel">{@render panel()}</aside>
	</div>
</main>

<style>
	.shell {
		max-width: 1120px;
		margin: 0 auto;
		padding: 12px var(--gutter) calc(32px + var(--safe-bottom));
	}
	.topbar {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 4px 0 14px;
	}
	.status {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 12px;
		min-width: 0;
	}
	.layout {
		display: grid;
		gap: 16px;
	}
	.board-col {
		width: 100%;
		max-width: 560px;
		margin: 0 auto;
	}
	.panel {
		display: grid;
		gap: 12px;
		align-content: start;
		min-width: 0;
	}
	@media (min-width: 900px) {
		.layout {
			grid-template-columns: minmax(0, 600px) minmax(320px, 400px);
			justify-content: center;
			gap: 36px;
		}
		.board-col {
			max-width: none;
		}
	}
</style>
