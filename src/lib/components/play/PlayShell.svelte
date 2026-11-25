<script lang="ts">
	import type { Snippet } from 'svelte';
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
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
		</a>
		<div class="status">{@render status()}</div>
		<button class="icon-btn" onclick={toggleSound} aria-label={muted ? 'Turn sound on' : 'Turn sound off'} aria-pressed={!muted}>
			{#if muted}
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M23 9l-6 6M17 9l6 6" /></svg>
			{:else}
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M15.5 8.5a5 5 0 010 7M19 5a10 10 0 010 14" /></svg>
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
