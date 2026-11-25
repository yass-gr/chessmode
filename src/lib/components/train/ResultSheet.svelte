<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		image?: string;
		eyebrow?: string;
		title: string;
		subtitle?: string;
		stats?: { label: string; value: string | number; tone?: 'good' | 'bad' | 'accent' }[];
		actions: Snippet;
	}
	let { image = '/img/node-done.webp', eyebrow, title, subtitle, stats = [], actions }: Props = $props();
</script>

<div class="scrim" role="presentation"></div>
<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="result-title">
	<img src={image} alt="" />
	{#if eyebrow}<p class="label">{eyebrow}</p>{/if}
	<h2 id="result-title" class="h-display">{title}</h2>
	{#if subtitle}<p class="muted sub">{subtitle}</p>{/if}
	{#if stats.length}
		<dl class="stats">
			{#each stats as s (s.label)}
				<div>
					<dt>{s.label}</dt>
					<dd class={s.tone}>{s.value}</dd>
				</div>
			{/each}
		</dl>
	{/if}
	<div class="actions">{@render actions()}</div>
</div>

<style>
	.scrim {
		position: fixed;
		inset: 0;
		background: rgba(8, 8, 9, 0.55);
		backdrop-filter: blur(3px);
		-webkit-backdrop-filter: blur(3px);
		z-index: 50;
		animation: fade 0.25s ease;
	}
	.sheet {
		position: fixed;
		z-index: 51;
		left: 50%;
		bottom: 0;
		transform: translateX(-50%);
		width: min(100%, 460px);
		padding: 8px 22px calc(24px + var(--safe-bottom));
		border-radius: 28px 28px 0 0;
		background: radial-gradient(120% 60% at 50% 0%, rgba(255, 107, 44, 0.22), transparent 60%), var(--surface-2);
		border: 1px solid var(--stroke-2);
		border-bottom: 0;
		box-shadow: 0 -30px 60px -20px rgba(0, 0, 0, 0.9);
		text-align: center;
		animation: up 0.38s var(--ease-out);
	}
	img {
		width: 132px;
		height: 132px;
		object-fit: contain;
		margin: -64px auto 0;
		display: block;
		filter: drop-shadow(0 18px 24px rgba(0, 0, 0, 0.6));
	}
	.label {
		margin-top: 2px;
	}
	h2 {
		margin-top: 4px;
	}
	.sub {
		margin-top: 6px;
		font-size: 15px;
	}
	.stats {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: 1fr;
		gap: 8px;
		margin: 18px 0 0;
	}
	.stats div {
		padding: 12px 8px;
		border-radius: var(--r-md);
		background: var(--surface-1);
		border: 1px solid var(--stroke);
	}
	dt {
		font-size: 12px;
		color: var(--text-3);
	}
	dd {
		margin: 2px 0 0;
		font-size: 20px;
		font-weight: 600;
		letter-spacing: -0.02em;
	}
	dd.good {
		color: var(--good);
	}
	dd.bad {
		color: var(--bad);
	}
	dd.accent {
		color: var(--accent-hi);
	}
	.actions {
		display: grid;
		gap: 10px;
		margin-top: 20px;
	}
	@keyframes up {
		from {
			transform: translate(-50%, 40px);
			opacity: 0;
		}
	}
	@keyframes fade {
		from {
			opacity: 0;
		}
	}
	@media (min-width: 700px) {
		.sheet {
			bottom: 50%;
			transform: translate(-50%, 50%);
			border-radius: 28px;
			border-bottom: 1px solid var(--stroke-2);
			padding-bottom: 24px;
			margin-top: 60px;
		}
		@keyframes up {
			from {
				transform: translate(-50%, calc(50% + 30px));
				opacity: 0;
			}
		}
	}
</style>
