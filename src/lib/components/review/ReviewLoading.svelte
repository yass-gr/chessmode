<script lang="ts">
	import type { Snippet } from 'svelte';
	let { progress = 0, finished = false, coach }: { progress?: number; finished?: boolean; coach?: Snippet } = $props();
	const percent = $derived(Math.max(0, Math.min(100, progress)));
</script>
<div class:finished class="loading" aria-busy={!finished} aria-label="Analyzing game">
	<div class="coach-slot">{#if coach}{@render coach()}{:else}<p>Analyzing your game…</p>{/if}</div>
	<div class="card chart"><div class="grid"></div><div class="horizontal"></div><div class="progress-track"><div style:width={`${percent}%`}></div></div></div>
	<div class="card placeholders"><div><span>White</span><b>–</b><span>Accuracy</span><b>–</b><span>Game rating</span></div><div><span>Black</span><b>–</b><span>Accuracy</span><b>–</b><span>Game rating</span></div></div>
	<div class="status" role="status">Analyzing · {Math.floor(percent)}%</div>
</div>
<style>
	.loading {
		display: grid;
		gap: 12px;
		transition: opacity 2.5s ease;
	}
	.finished {
		opacity: 0.12;
	}
	.coach-slot {
		color: var(--text-2);
		font-size: 14px;
	}
	p {
		margin: 0;
	}
	.chart {
		position: relative;
		height: 116px;
		overflow: hidden;
		padding: 12px;
	}
	.grid,
	.horizontal {
		position: absolute;
		inset: 12px;
		opacity: 0.3;
	}
	.grid {
		background: repeating-linear-gradient(90deg, transparent 0 39px, var(--text-3) 40px 41px);
		animation: pulse 1.5s ease infinite;
	}
	.horizontal {
		background: repeating-linear-gradient(0deg, transparent 0 24px, var(--text-3) 25px 26px);
		animation: pulse 1.5s ease 350ms infinite;
	}
	.progress-track {
		position: absolute;
		bottom: 12px;
		left: 12px;
		right: 12px;
		height: 4px;
		background: var(--surface-4);
		border-radius: var(--r-pill);
		overflow: hidden;
	}
	.progress-track div {
		height: 100%;
		background: var(--accent);
		transition: width 500ms ease;
	}
	.placeholders {
		display: grid;
		grid-template-columns: 1fr 1fr;
		padding: 16px;
		text-align: center;
	}
	.placeholders div {
		display: grid;
		gap: 5px;
	}
	.placeholders span,
	.status {
		color: var(--text-2);
		font-size: 12px;
	}
	.placeholders b {
		font: 700 20px var(--mono);
	}
	.status {
		text-align: center;
	}
	@keyframes pulse {
		50% {
			opacity: 0.08;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.loading,
		.progress-track div {
			transition: none;
		}
		.grid,
		.horizontal {
			animation: none;
		}
	}
</style>
